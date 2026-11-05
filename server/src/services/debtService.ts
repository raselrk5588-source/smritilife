import mongoose from 'mongoose';
import Debt, { IDebt, IDebtTransaction } from '../models/Debt';
import { bnToEnDigits, enToBnDigits, formatTaka } from './expenseService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import SystemSettings from '../models/SystemSettings';

export interface ParsedDebtItem {
  type: 'lent' | 'borrowed';
  personName: string;
  amount: number;
  notes?: string;
}

export interface ParsedDebt {
  isQuery: boolean;
  queryType?: 'all' | 'person';
  isSettlement?: boolean;
  settlementType?: 'received' | 'paid'; // received = পাওনা উসুল/ফেরত পেয়েছি, paid = দেনা শোধ করেছি
  isDelete?: boolean;
  deleteScope?: 'all' | 'person' | 'lent' | 'borrowed';
  type?: 'lent' | 'borrowed'; // lent = আমি পাবো, borrowed = আমি দেবো
  personName?: string;
  amount?: number;
  notes?: string;
  multipleDebts?: ParsedDebtItem[];
}

export interface DebtPersonSummary {
  personName: string;
  personPhone?: string;
  totalLent: number;
  totalLentRemaining: number;
  totalBorrowed: number;
  totalBorrowedRemaining: number;
  netBalance: number; // positive = user gets money, negative = user owes money
  status: 'receivable' | 'payable' | 'settled';
  itemsCount: number;
  lastUpdated: Date;
}

export interface OverallDebtSummary {
  totalReceivable: number; // আমি পাবো
  totalPayable: number;    // আমি দেবো
  netBalance: number;      // পাওনা - দেনা
  receivableCount: number;
  payableCount: number;
  activePeopleCount: number;
  topReceivables: Array<{ personName: string; amount: number; phone?: string }>;
  topPayables: Array<{ personName: string; amount: number }>;
}

/**
 * Clean person name prefixes and suffixes
 */
export const cleanPersonName = (raw: string): string => {
  return raw
    .trim()
    .replace(/^(?:mr|md|মুহা|জনাব)\s+/i, '')
    // Strip trailing helper phrases like "ar kache ami", "এর কাছে আমি", "ami"
    .replace(/\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:কাছে|kache|kase)\s*(?:আমি|ami)?\s*$/i, '')
    .replace(/\s+(?:আমি|ami)$/i, '')
    .replace(/\s+(?:-?কে|-?k|-?ke|-?er|এর|-?theke|থেকে|-?ar)$/i, '')
    // Bengali possessive suffix only (never strip Latin letters from names like Omar/Peter)
    .replace(/(?:\u09DF\u09C7\u09B0|\u09C7\u09B0)$/i, '')
    .trim();
};

/**
 * Quick pre-filter: does this text look debt related at all?
 */
export const looksDebtRelated = (text: string): boolean =>
  /(?:পাবো|পাব|পাবে|দেবো|দিবো|দেনা|পাওনা|ধার|বাকি|উধার|হাওলাত|করজ|ফেরত|শোধ|পরিশোধ|কাছে|kache|kase|pabo|debo|dibo|dhar|dena|baki|udhar|paona|pauna|pawna|ferot|sodh|shodh|porishodh|hawlat)/i.test(text || '') ||
  /(?:টাকা|taka|tk|হিসাব|hisab)\s*(?:দিয়ে\s*(?:দিয়েছে|দিছে|দিসে|দিলো|দিলাম|দিস)|দিয়েছে|দিছে|দিসে|দিলো|পেয়ে\s*(?:গেছি|গেলাম)|পেয়েছি|পাইছি|পাওয়া\s*গেছে|মিটিয়ে|ক্লিয়ার|diye\s*(?:diyeche|diche|dise|dilo|dilam|disi)|diyeche|diche|dise|dilo|peye\s*(?:gechi|gesi|gelam)|peyechi|paichi|clear)/i.test(text || '');

/**
 * Parse debt intent with Gemini (accurate person-name extraction for Bangla / Banglish).
 * Returns null if AI is unavailable or the message is not debt related.
 */
export const parseDebtWithAI = async (text: string, userId?: any): Promise<ParsedDebt | null> => {
  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const settings: any = await SystemSettings.findOne();
      apiKey = settings?.geminiApiKey;
    }
    if (!apiKey) return null;

    let activeNamesHint = '';
    if (userId) {
      try {
        const existingNames = await Debt.distinct('personName', {
          userId,
          status: { $in: ['pending', 'partial'] }
        });
        if (existingNames && existingNames.length > 0) {
          activeNamesHint = `\nExisting people in user's ledger: ${JSON.stringify(existingNames)}. If the message refers to one of these people (even with Bangla/English transliteration or short name), output that exact existing personName.`;
        }
      } catch (e) {}
    }

    const prompt = `You are a parser for a Bangladeshi personal debt ledger (ধার-দেনা খাতা). Input may be Bangla, Banglish or English, possibly multi-line.${activeNamesHint}
Return ONLY raw JSON, no markdown:
{"isDebt":boolean,"action":"add"|"settle"|"query"|"delete"|"none","items":[{"personName":string,"amount":number,"type":"lent"|"borrowed"}],"settlementType":"received"|"paid"|null,"personName":string|null,"deleteScope":"all"|"person"|"lent"|"borrowed"|null}
Rules:
- "lent" = user will GET money from the person (e.g. "asad ar kache pabo 3500", "asad ar kache ami pabo 3500 taka", "রনিকে ৫০০ ধার দিলাম", "karim 200 baki nilo").
- "borrowed" = user OWES money to the person (e.g. "karim pabe 500", "রহিমের কাছ থেকে ১০০০ ধার নিলাম", "dokane baki 300").
- personName = ONLY the person's name; keep honorifics like vai/bhai/apa if written (e.g. "Manik vai"). NEVER include words like ar, er, kache, ami, pabo, taka, এর, কাছে, আমি, পাবো. Bangla possessive "আসাদের" => "আসাদ".
- amount: convert Bangla digits / words to a number.
- action "settle": someone paid back ("Pias taka diye diche", "পিয়াস টাকা দিয়ে দিয়েছে", "asad 1000 ferot dilo", "pias er taka peye gechi" => settlementType: "received") or user paid back ("karim ke taka diye dilam", "karim ke 500 sodh korlam" => settlementType: "paid"). Put person+amount in items. If NO specific amount is mentioned (meaning full settlement of all remaining debt for that person), set amount to 0 in items (e.g. {"personName":"Pias","amount":0,"type":"lent"}).
- action "query": asking balance/list ("pawna taka daw", "mot koto taka pabo?", "koto taka pabo", "asad er hisab"). Set personName if a specific person is asked.
- action "delete": deleting ledger entries ("pawna list delete koro" => lent, "dena delete" => borrowed, "asad er hisab delete" => person, "dhar dena sob delete" => all).
- If it is NOT about personal debts (normal expense like "bazar 500", reminder, medicine, document), return {"isDebt":false,"action":"none","items":[]}.
Message:
"""${text}"""`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let parsed: any = null;
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0, maxOutputTokens: 512 } });
        const result: any = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        const raw = result.response.text().trim();
        const json = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(json ? json[0] : raw);
        break;
      } catch (e: any) {
        console.warn(`Debt AI parse with ${m} failed:`, e?.message || e);
      }
    }
    if (!parsed) return null; // AI unavailable -> caller falls back to regex
    if (!parsed.isDebt || parsed.action === 'none') return { isQuery: false, notes: '__NOT_DEBT__' };

    const rawItems: ParsedDebtItem[] = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((i: any) => ({
        personName: cleanPersonName(String(i.personName || '')),
        amount: Number(i.amount) || 0,
        type: (i.type === 'borrowed' ? 'borrowed' : 'lent') as 'lent' | 'borrowed'
      }))
      .filter((i: ParsedDebtItem) => !!i.personName);

    const items = rawItems.filter((i: ParsedDebtItem) => i.amount > 0);
    const pName = parsed.personName ? cleanPersonName(String(parsed.personName)) : undefined;

    switch (parsed.action) {
      case 'query':
        return pName ? { isQuery: true, queryType: 'person', personName: pName } : { isQuery: true, queryType: 'all' };
      case 'delete':
        return {
          isQuery: false,
          isDelete: true,
          deleteScope: parsed.deleteScope || (pName ? 'person' : 'all'),
          personName: pName
        };
      case 'settle': {
        const settlePerson = rawItems[0]?.personName || pName;
        if (!settlePerson) return null;
        return {
          isQuery: false,
          isSettlement: true,
          settlementType: parsed.settlementType === 'paid' ? 'paid' : 'received',
          personName: settlePerson,
          amount: rawItems[0]?.amount || 0
        };
      }
      case 'add':
        if (items.length === 0) return null;
        if (items.length === 1) {
          return { isQuery: false, isSettlement: false, type: items[0].type, personName: items[0].personName, amount: items[0].amount };
        }
        return { isQuery: false, multipleDebts: items };
      default:
        return null;
    }
  } catch (err) {
    console.error('parseDebtWithAI error:', err);
    return null;
  }
};


/**
 * Parse a single debt/lent line (e.g. from WhatsApp multi-line text or a note)
 */
export const parseSingleDebtLine = (line: string): ParsedDebtItem | null => {
  if (!line) return null;
  const cleanLine = line.replace(/^[\s\d\.\-\*•📍📌🟢🔴]+/g, '').trim();
  if (!cleanLine) return null;

  // Pattern 1 (lent with kache): [person] [এর/er/ar/র/ের/য়ের]? [কাছে/kache] [টাকা/taka]? [পাবো/পাব/pabo]? [:=]? [amount] [টাকা/tk]? [পাবো/পাব/pabo]?
  // E.g. "Asad ar kache taka pabo 3500", "Manik vai ar kache pabo 3000", "আসাদের কাছে পাবো: ৩,৫০০ টাকা"
  const lentKachePattern = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|\u09C7\u09B0|য়ের|\u09DF\u09C7\u09B0)?\s*(?:কাছে|kache|kase)\s*(?:আমি|ami)?\s*(?:টাকা|taka|tk)?\s*(?:পাবো|পাব|হবে|বাকি|ধার|পাওয়া|pabo|pabo\s*ami)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:পাবো|পাব|হবে|pabo)?$/i
  );
  if (lentKachePattern) {
    const rawPerson = lentKachePattern[1].trim();
    const rawAmount = lentKachePattern[2].replace(/,/g, '');
    const amount = parseFloat(bnToEnDigits(rawAmount));
    if (rawPerson && amount > 0 && !/^(ধার|দেনা|বাকি|টাকা|হিসাব|dhar|dena|baki|taka|hisab)$/i.test(rawPerson)) {
      const person = cleanPersonName(rawPerson);
      if (person) {
        return { type: 'lent', personName: person, amount };
      }
    }
  }

  // Pattern 1b (lent without kache): [person] [পাবো/পাব/pabo] [:=]? [amount]
  const lentDirectPattern = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|\u09C7\u09B0|য়ের|\u09DF\u09C7\u09B0)?\s*(?:আমি|ami)?\s*(?:পাবো|পাব|pabo)\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i
  );
  if (lentDirectPattern) {
    const rawPerson = lentDirectPattern[1].trim();
    const rawAmount = lentDirectPattern[2].replace(/,/g, '');
    const amount = parseFloat(bnToEnDigits(rawAmount));
    if (rawPerson && amount > 0 && !/^(ধার|দেনা|বাকি|টাকা|হিসাব|ami|আমি)$/i.test(rawPerson)) {
      const person = cleanPersonName(rawPerson);
      if (person) {
        return { type: 'lent', personName: person, amount };
      }
    }
  }

  // Pattern 2 (lent): "রনিকে ৫০০ টাকা ধার দিলাম" / "roni k 500 taka dhar dilam"
  const lentPatternA = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*(?:দিলাম|দিয়াছি|দেওয়া\s*হলো|dilam|diasi|dilum)$/i
  );
  if (lentPatternA) {
    const person = cleanPersonName(lentPatternA[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternA[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return { type: 'lent', personName: person, amount };
    }
  }

  // Pattern 3 (lent): "রনি ৫০০ টাকা ধার নিলো" / "roni dhar nilo 500"
  const lentPatternB = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:amar\s*kach\s*theke|আমার\s*কাছ\s*থেকে)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*(?:নিলো|নিয়েছে|নিছে|nilo|niyeche|nise)$/i
  );
  if (lentPatternB) {
    const person = cleanPersonName(lentPatternB[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternB[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return { type: 'lent', personName: person, amount };
    }
  }

  // Pattern 4 (lent): "রনিকে ৫০০ ধার" / "roni ke 500 dhar" / "রনি বাকি ৫০০"
  const lentPatternC = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)?\s*(?:বাকি|ধার|হাওলাত|baki|dhar)\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i
  );
  if (lentPatternC) {
    const person = cleanPersonName(lentPatternC[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternC[2].replace(/,/g, '')));
    if (person && amount > 0 && !/দোকান|মেস|হোটেল|বাড়িওয়ালা/i.test(person)) {
      return { type: 'lent', personName: person, amount };
    }
  }

  // Pattern 5 (borrowed): "করিমের কাছ থেকে ১০০০ টাকা ধার নিলাম"
  const borrowedPatternA = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছ\s*থেকে|-?এর\s*থেকে|theke|থেকে|er\s*kach\s*theke)\s*(?:ধার|হাওলাত|করজ|বাকি|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|করজ|বাকি|dhar|hawlat|baki)?\s*(?:নিলাম|নিয়েছি|nilam|niesi|nilum)$/i
  );
  if (borrowedPatternA) {
    const person = cleanPersonName(borrowedPatternA[1]);
    const amount = parseFloat(bnToEnDigits(borrowedPatternA[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return { type: 'borrowed', personName: person, amount };
    }
  }

  // Pattern 6 (borrowed): "দোকানে বাকি ৩০০ টাকা"
  const borrowedPatternB = cleanLine.match(
    /^(?:দোকানে|দোকান|মুদি|হোটেল|মেস|মালিক|বাড়িওয়ালা|dokan|dokane|hotel|mess)\s*(?:বাকি|ধার|baki|dhar)\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i
  );
  if (borrowedPatternB) {
    const amount = parseFloat(bnToEnDigits(borrowedPatternB[1].replace(/,/g, '')));
    if (amount > 0) {
      return { type: 'borrowed', personName: 'দোকান (বাকি)', amount };
    }
  }

  // Pattern 7 (borrowed): "করিমের কাছে ৫০০ দেনা" / "করিম পাবে ৫০০" / "korim pabe 500"
  const borrowedPatternC = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছে|-?কাছে|kache)?\s*(?:দেনা|পাবে|pabe)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:দেনা|বাকি|ধার|dena|baki|পাবে|pabe)$/i
  );
  if (borrowedPatternC) {
    const person = cleanPersonName(borrowedPatternC[1]);
    const amount = parseFloat(bnToEnDigits(borrowedPatternC[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return { type: 'borrowed', personName: person, amount };
    }
  }

  return null;
};

/**
 * Parse WhatsApp Text for Udhar / Debt operations
 */
export const parseDebtInput = (text: string): ParsedDebt | null => {
  if (!text) return null;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Exclude reminders / alarms / wake up commands
  if (/মনে|ডাক|তুলে|alarm|অ্যালার্ম|wake\s*me/i.test(clean)) return null;

  // Multi-line debt entry detection
  if (clean.includes('\n')) {
    const lines = clean.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const parsedItems: ParsedDebtItem[] = [];
      for (const l of lines) {
        const item = parseSingleDebtLine(l);
        if (item) {
          parsedItems.push(item);
        }
      }
      if (parsedItems.length >= 2 || (parsedItems.length === lines.length && parsedItems.length > 0)) {
        return {
          isQuery: false,
          multipleDebts: parsedItems
        };
      }
    }
  }

  // 1. Debt Deletion Commands (e.g. "pawna takar list delete kore daw", "সব পাওনা ডিলিট করো", "asad ar pawna delete kore daw")
  const isDeleteIntent = /(?:delete|del|remove|মুছে|মুছ|ডিলিট|বাতিল|কেটে|ফেলে)/i.test(clean);
  const isDebtDeleteWord = /(?:ধার\s*দেনা|বাকি\s*খাতা|পাওনা|দেনা|ধার|বাকি|উধার|paona|pauna|pawna|dena|dhar|baki|udhar|হিসাব|hisab)/i.test(clean);

  if (isDeleteIntent && isDebtDeleteWord) {
    // 1a. General / All debts delete
    if (/^(?:সব|সকল|all|shob|sob|আমার|amar|amr)?\s*(?:ধার\s*দেনা|বাকি\s*খাতা|সব\s*হিসাব|dhar\s*dena|baki\s*khata)\s*(?:টাকার?|takar?|taka)?\s*(?:delete|del|remove|মুছে|মুছ|ডিলিট)/i.test(clean) ||
        /^(?:delete|del|remove|মুছে|মুছ|ডিলিট)\s*(?:করে\s*দাও|করো|দিন)?\s*(?:সব|সকল|all|shob|sob)?\s*(?:ধার\s*দেনা|বাকি\s*খাতা|সব\s*হিসাব|dhar\s*dena|baki\s*khata)/i.test(clean)) {
      return { isQuery: false, isDelete: true, deleteScope: 'all' };
    }

    // 1b. All Lent / Pawna list delete (e.g. "pawna takar list delete kore daw", "সব পাওনা ডিলিট করো")
    if (/^(?:সব|সকল|all|shob|sob|আমার|amar|amr)?\s*(?:পাওনা|paona|pauna|pawna)\s*(?:টাকার?|takar?|taka)?\s*(?:লিস্ট|তালিকা|খাতা|হিসাব|list)?\s*(?:delete|del|remove|মুছে|মুছ|ডিলিট)/i.test(clean) ||
        /^(?:delete|del|remove|মুছে|মুছ|ডিলিট)\s*(?:করে\s*দাও|করো|দিন)?\s*(?:সব|সকল|all|shob|sob)?\s*(?:পাওনা|paona|pauna|pawna)\s*(?:টাকার?|takar?|taka)?\s*(?:লিস্ট|তালিকা|খাতা|হিসাব|list)?/i.test(clean)) {
      return { isQuery: false, isDelete: true, deleteScope: 'lent' };
    }

    // 1c. All Borrowed / Dena list delete
    if (/^(?:সব|সকল|all|shob|sob|আমার|amar|amr)?\s*(?:দেনা|dena)\s*(?:টাকার?|takar?|taka)?\s*(?:লিস্ট|তালিকা|খাতা|হিসাব|list)?\s*(?:delete|del|remove|মুছে|মুছ|ডিলিট)/i.test(clean) ||
        /^(?:delete|del|remove|মুছে|মুছ|ডিলিট)\s*(?:করে\s*দাও|করো|দিন)?\s*(?:সব|সকল|all|shob|sob)?\s*(?:দেনা|dena)\s*(?:টাকার?|takar?|taka)?\s*(?:লিস্ট|তালিকা|খাতা|হিসাব|list)?/i.test(clean)) {
      return { isQuery: false, isDelete: true, deleteScope: 'borrowed' };
    }

    // 1d. Person-specific delete (e.g. "asad ar pawna delete kore daw", "আসাদের হিসাব ডিলিট করো", "delete asad pawna")
    const personMatch1 = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|য়ের)?\s*(?:পাওনা|দেনা|ধার|বাকি|হিসাব|paona|pauna|pawna|dena|dhar|baki|hisab)\s*(?:delete|del|remove|মুছে|মুছ|ডিলিট)/i);
    const personMatch2 = clean.match(/(?:delete|del|remove|মুছে|মুছ|ডিলিট)\s*(?:করে\s*দাও|করো|দিন)?\s*([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|য়ের)?\s*(?:পাওনা|দেনা|ধার|বাকি|হিসাব|paona|pauna|pawna|dena|dhar|baki|hisab)/i);
    const personMatch = personMatch1 || personMatch2;

    if (personMatch) {
      const candidate = personMatch[1].trim();
      const isReserved = /(?:সব|সকল|all|shob|sob|লিস্ট|তালিকা|খাতা|list|taka|টাকা|আমার|amar|amr|পাওনা|দেনা|ধার|বাকি|paona|pauna|pawna|dena|dhar|baki)/i.test(candidate);
      if (!isReserved) {
        const pName = cleanPersonName(candidate);
        if (pName && pName.length >= 2) {
          return {
            isQuery: false,
            isDelete: true,
            deleteScope: 'person',
            personName: pName
          };
        }
      }
    }

    return { isQuery: false, isDelete: true, deleteScope: 'all' };
  }

  // 2. General Queries
  // "ধার দেনার হিসাব", "বাকি খাতা", "কার কাছে কত পাবো", "পাওনা কত", "দেনা কত", "koto taka pabo", "pauna takar hisab", "paona takar hisab dao"
  const isGeneralDebtQuery =
    /(?:ধার\s*দেনার?|বাকি|দেনা\s*পাওনা|উধার|পাওনা|দেনা)\s*(?:টাকার?)?\s*(?:হিসাব|খাতা|লিস্ট|তালিকা|কত|দেখাও|দেখান|দাও|দিন|চাই|বলো|বলেন|বলুন|দিতে\s*বলছি|দিতে\s*বললাম)/i.test(clean) ||
    /^(?:ধার\s*দেনা|বাকি\s*খাতা|কার\s*কাছে\s*কত\s*পাবো|আমার\s*পাওনা\s*কত|আমার\s*দেনা\s*কত|পাওনা\s*কত|দেনা\s*কত|পাওনা\s*টাকার?\s*হিসাব|দেনা\s*টাকার?\s*হিসাব|ধার\s*দেনার?\s*হিসাব)$/i.test(clean) ||
    /(?:কত\s*টাকা\s*পাবো|কত\s*টাকা\s*পাব|কত\s*পাবো|কত\s*পাব|কার\s*কাছে\s*কত\s*পাবো|পাওনা\s*টাকা|দেনা\s*টাকা|মোট\s*পাওনা|মোট\s*দেনা)/i.test(clean) ||
    /(?:dhar\s*dena|baki\s*khata|udhar|paona|pauna|pawna|dena)\s*(?:takar?)?\s*(?:hisab|khata|list|koto|dao|daw|dehao|dekhao|bolo|bolte|dite\s*bolchi|dite\s*bollam|chai)?/i.test(lower) ||
    /(?:koto\s*taka\s*pabo|koto\s*pabo|koto\s*taka\s*pabo\s*ami|ami\s*koto\s*taka\s*pabo|kar\s*kache\s*koto\s*pabo|amar\s*paona\s*koto|amar\s*pauna\s*koto|amar\s*pawna\s*koto|amar\s*dena\s*koto|paona\s*koto|pauna\s*koto|pawna\s*koto|dena\s*koto|baki\s*koto|mot\s*paona|mot\s*pauna|mot\s*pawna|mot\s*dena)/i.test(lower) ||
    /^(?:dhar\s*dena|baki\s*khata|paona|pauna|pawna|dena)$/i.test(lower);

  if (isGeneralDebtQuery) {
    // Check if query is about a specific person (e.g. "রনির ধার দেনার হিসাব", "asad ar hisab", "আসাদের কাছে কত পাবো")
    const specificPersonMatch = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:এর|-?er|-?ar|র)?\s*(?:হিসাব|কাছে\s*কত\s*পাবো|কাছে\s*পাওনা|hisab|kache\s*koto\s*pabo)\s*(?:কত|koto|bolo|বলো|কি)?\??$/i);
    if (specificPersonMatch && !/ধার|দেনা|বাকি|পাওনা|মোট|আজ|কাল|টাকা|হিসাব|dhar|dena|baki|paona|pauna|taka|hisab|ami|আমি/i.test(specificPersonMatch[1].trim())) {
      const pName = cleanPersonName(specificPersonMatch[1]);
      if (pName && pName.length >= 2) {
        return {
          isQuery: true,
          queryType: 'person',
          personName: pName
        };
      }
    }

    return {
      isQuery: true,
      queryType: 'all'
    };
  }

  // Specific person query like "রনির কাছে কত পাবো" or "রনির হিসাব কত" or "roni er hisab koto" or "asad ar kache koto pabo"
  const pQuery = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:এর|-?er|-?ar|র)?\s*(?:কাছে\s*কত\s*পাবো|এর\s*হিসাব\s*কত|এর\s*হিসাব|er\s*hisab\s*koto|ar\s*hisab\s*koto|kache\s*koto\s*pabo)\??$/i);
  if (pQuery) {
    const pName = cleanPersonName(pQuery[1]);
    if (pName && pName.length >= 2 && !/ধার|দেনা|বাকি|মোট|আজ|কাল|টাকা|পাওনা|dhar|dena|baki|paona|pauna|taka|hisab|ami|আমি/i.test(pName)) {
      return {
        isQuery: true,
        queryType: 'person',
        personName: pName
      };
    }
  }

  // 2. Settlement / Repayment (ফেরত / শোধ / পরিশোধ / টাকা দিয়ে দিছে)
  // Pattern A1 (with amount): Someone paid us back: "রনি ৫০০ টাকা ফেরত দিলো", "roni 500 tk ferot dilo", "Pias 1000 taka diye diche"
  const settleLentPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:theke|থেকে|er\s*kach\s*theke)?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ফেরত\s*দিলো|ফেরত\s*দিয়েছে|ফেরত\s*দিছে|শোধ\s*করলো|শোধ\s*করেছে|পরিশোধ\s*করলো|পরিশোধ\s*করেছে|ফেরত\s*পেলাম|জমা\s*দিলো|দিয়ে\s*দিয়েছে|দিয়ে\s*দিছে|দিয়ে\s*দিলো|দিয়েছে|দিছে|ferot\s*dilo|ferot\s*diyeche|ferot\s*diche|sodh\s*korlo|shodh\s*koreche|porishodh\s*korlo|porishodh\s*koreche|ferot\s*pelam|diye\s*diyeche|diye\s*diche|diye\s*dise|diyeche|diche|dise)$/i);
  if (settleLentPattern) {
    const person = cleanPersonName(settleLentPattern[1]);
    const amount = parseFloat(bnToEnDigits(settleLentPattern[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: true,
        settlementType: 'received',
        personName: person,
        amount
      };
    }
  }

  // Pattern A2 (without amount - full settlement of receivable): "Pias taka diye diche", "পিয়াস টাকা দিয়ে দিয়েছে", "Pias er taka peye gechi", "Pias sodh kore diche"
  const settleLentFullPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:সব|পুরো|বাকি|পাওনা|baki|paona|pawna|shob|sob)?\s*(?:টাকা|টাকাই|tk|taka|হিসাব|hisab)?\s*(?:দিয়ে\s*(?:দিয়েছে|দিছে|দিসে|দিলো)|দিয়েছে|দিছে|দিসে|ফেরত\s*(?:দিয়েছে|দিছে|দিলো|পেয়েছি|পেলাম)|শোধ\s*(?:করেছে|করলো|করে\s*দিয়েছে|করে\s*দিছে)|পরিশোধ\s*(?:করেছে|করলো)|পেয়ে\s*(?:গেছি|গেলাম)|পেয়েছি|পাইছি|ক্লিয়ার|diye\s*(?:diyeche|diche|dise|dilo)|diyeche|diche|dise|ferot\s*(?:diyeche|diche|dilo|peyechi|pelam)|sodh\s*(?:koreche|korlo|kore\s*diche|kore\s*diyeche)|shodh\s*(?:koreche|korlo|kore\s*diche)|porishodh\s*(?:koreche|korlo)|peye\s*(?:gechi|gesi|gelam)|peyechi|paichi|clear(?:\s*koreche|\s*korsen|\s*hoise)?)$/i);
  if (settleLentFullPattern) {
    const person = cleanPersonName(settleLentFullPattern[1]);
    if (person && !/^(?:আমি|ami|আমার|amar)$/i.test(person)) {
      return {
        isQuery: false,
        isSettlement: true,
        settlementType: 'received',
        personName: person,
        amount: 0
      };
    }
  }

  // Pattern B1 (with amount): We paid someone back: "করিমকে ৫০০ টাকা ফেরত দিলাম", "করিমকে ৫০০ শোধ করলাম", "korim ke 500 taka ferot dilam"
  const settleBorrowedPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ফেরত\s*দিলাম|ফেরত\s*দিয়েছি|শোধ\s*করলাম|শোধ\s*করেছি|পরিশোধ\s*করলাম|পরিশোধ\s*করেছি|দিয়ে\s*দিলাম|দিয়ে\s*দিয়েছি|দিয়া\s*দিলাম|ferot\s*dilam|sodh\s*korlam|shodh\s*korlam|porishodh\s*korlam|diye\s*dilam|diye\s*diyechi)$/i);
  if (settleBorrowedPattern) {
    const person = cleanPersonName(settleBorrowedPattern[1]);
    const amount = parseFloat(bnToEnDigits(settleBorrowedPattern[2].replace(/,/g, '')));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: true,
        settlementType: 'paid',
        personName: person,
        amount
      };
    }
  }

  // Pattern B2 (without amount - full settlement of payable): "করিমকে টাকা দিয়ে দিলাম", "korim ke taka diye dilam"
  const settleBorrowedFullPattern = clean.match(/^(?:আমি\s+|ami\s+)?([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke|-?এর|-?er|-?ar)\s*(?:সব|পুরো|বাকি|দেনা|baki|dena)?\s*(?:টাকা|tk|taka|হিসাব|hisab)?\s*(?:ফেরত\s*দিলাম|ফেরত\s*দিয়েছি|শোধ\s*করলাম|শোধ\s*করেছি|পরিশোধ\s*করলাম|পরিশোধ\s*করেছি|দিয়ে\s*দিলাম|দিয়ে\s*দিয়েছি|দিয়ে\s*দিছি|ferot\s*dilam|sodh\s*korlam|shodh\s*korlam|porishodh\s*korlam|diye\s*dilam|diye\s*diyechi|diye\s*disi)$/i);
  if (settleBorrowedFullPattern) {
    const person = cleanPersonName(settleBorrowedFullPattern[1]);
    if (person && !/^(?:আমি|ami|আমার|amar)$/i.test(person)) {
      return {
        isQuery: false,
        isSettlement: true,
        settlementType: 'paid',
        personName: person,
        amount: 0
      };
    }
  }

  // 3. Lent Entry (আমি পাবো / পাওনা)
  // Pattern A: "রনিকে ৫০০ টাকা ধার দিলাম" / "রনিকে ধার দিলাম ৫০০" / "roni k 500 taka dhar dilam"
  const lentPatternA = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*(?:দিলাম|দিয়াছি|দেওয়া\s*হলো|dilam|diasi|dilum)$/i);
  if (lentPatternA) {
    const person = cleanPersonName(lentPatternA[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternA[2]));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'lent',
        personName: person,
        amount
      };
    }
  }

  // Pattern B: "রনি ৫০০ টাকা ধার নিলো" / "রনি ধার নিলো ৫০০" / "roni dhar nilo 500" / "রনি বাকি নিলো ২০০"
  const lentPatternB = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:amar\s*kach\s*theke|আমার\s*কাছ\s*থেকে)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|বাকি|করজ|dhar|hawlat|baki)?\s*(?:নিলো|নিয়েছে|নিছে|nilo|niyeche|nise)$/i);
  if (lentPatternB) {
    const person = cleanPersonName(lentPatternB[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternB[2]));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'lent',
        personName: person,
        amount
      };
    }
  }

  // Pattern C: "রনিকে ৫০০ ধার" / "roni ke 500 dhar" / "রনি বাকি ৫০০" / "আরিফকে ৫০০ বাকি"
  const lentPatternC = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)?\s*(?:বাকি|ধার|হাওলাত|baki|dhar)\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i);
  if (lentPatternC) {
    const person = cleanPersonName(lentPatternC[1]);
    const amount = parseFloat(bnToEnDigits(lentPatternC[2]));
    if (person && amount > 0 && !/দোকান|মেস|হোটেল|বাড়িওয়ালা/i.test(person)) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'lent',
        personName: person,
        amount
      };
    }
  }

  // 4. Borrowed Entry (আমি দেবো / দেনা)
  // Pattern A: "করিমের কাছ থেকে ১০০০ টাকা ধার নিলাম" / "করিম থেকে ৫০০ ধার নিলাম" / "korim er kach theke 500 dhar nilam"
  const borrowedPatternA = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছ\s*থেকে|-?এর\s*থেকে|theke|থেকে|er\s*kach\s*theke)\s*(?:ধার|হাওলাত|করজ|বাকি|dhar|hawlat|baki)?\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ধার|হাওলাত|করজ|বাকি|dhar|hawlat|baki)?\s*(?:নিলাম|নিয়েছি|nilam|niesi|nilum)$/i);
  if (borrowedPatternA) {
    const person = cleanPersonName(borrowedPatternA[1]);
    const amount = parseFloat(bnToEnDigits(borrowedPatternA[2]));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'borrowed',
        personName: person,
        amount
      };
    }
  }

  // Pattern B: "দোকানে বাকি ৩০০ টাকা" / "দোকান বাকি ৫০০" / "dokane baki 300"
  const borrowedPatternB = clean.match(/^(?:দোকানে|দোকান|মুদি|হোটেল|মেস|মালিক|বাড়িওয়ালা|dokan|dokane|hotel|mess)\s*(?:বাকি|ধার|baki|dhar)\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i);
  if (borrowedPatternB) {
    const amount = parseFloat(bnToEnDigits(borrowedPatternB[1]));
    if (amount > 0) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'borrowed',
        personName: 'দোকান (বাকি)',
        amount
      };
    }
  }

  // Pattern C: "করিমের কাছে ৫০০ দেনা" / "করিম থেকে ৫০০ হাওলাত নিলাম"
  const borrowedPatternC = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছে|-?কাছে|kache)\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:দেনা|বাকি|ধার|dena|baki)$/i);
  if (borrowedPatternC) {
    const person = cleanPersonName(borrowedPatternC[1]);
    const amount = parseFloat(bnToEnDigits(borrowedPatternC[2]));
    if (person && amount > 0) {
      return {
        isQuery: false,
        isSettlement: false,
        type: 'borrowed',
        personName: person,
        amount
      };
    }
  }

  // 5. Fallback check with single-line parser (e.g. "Asad ar kache taka pabo 3500", "Pias pabo 4000")
  const single = parseSingleDebtLine(clean);
  if (single) {
    return {
      isQuery: false,
      isSettlement: false,
      type: single.type,
      personName: single.personName,
      amount: single.amount,
      notes: single.notes
    };
  }

  return null;
};

/**
 * Record a new debt or add to existing
 */
export const recordDebt = async (
  userId: string | mongoose.Types.ObjectId,
  personName: string,
  amount: number,
  type: 'lent' | 'borrowed',
  options?: { personPhone?: string; dueDate?: Date; notes?: string }
): Promise<IDebt> => {
  const cleanName = cleanPersonName(personName);

  const newDebt = new Debt({
    userId,
    personName: cleanName,
    personPhone: options?.personPhone?.trim(),
    type,
    amount,
    paidAmount: 0,
    status: 'pending',
    dueDate: options?.dueDate,
    notes: options?.notes,
    history: [
      {
        date: new Date(),
        amount,
        note: options?.notes || (type === 'lent' ? 'ধার/বাকি দেওয়া হয়েছে' : 'ধার/বাকি নেওয়া হয়েছে'),
        type: 'additional'
      }
    ]
  });

  return await newDebt.save();
};

/**
 * Record a payment / partial repayment on a specific debt entry
 */
export const recordDebtPayment = async (
  debtId: string | mongoose.Types.ObjectId,
  paymentAmount: number,
  note?: string
): Promise<IDebt | null> => {
  const debt = await Debt.findById(debtId);
  if (!debt) return null;

  const newPaidAmount = Math.min(debt.amount, debt.paidAmount + paymentAmount);
  debt.paidAmount = newPaidAmount;
  debt.status = debt.paidAmount >= debt.amount ? 'settled' : 'partial';

  debt.history.push({
    date: new Date(),
    amount: paymentAmount,
    note: note || 'পরিশোধ/জমা',
    type: 'payment'
  });

  return await debt.save();
};

/**
 * Settle Debt by Person Name (WhatsApp auto-matching)
 */
export const settleDebtByPerson = async (
  userId: string | mongoose.Types.ObjectId,
  personName: string,
  settleAmount: number,
  settlementType: 'received' | 'paid'
): Promise<{
  settledTotal: number;
  remainingForPerson: number;
  personName: string;
  debtsUpdated: IDebt[];
}> => {
  let cleanName = cleanPersonName(personName);
  // received = someone gave us back money for what we lent ('lent')
  // paid = we paid back someone for what we borrowed ('borrowed')
  const targetType = settlementType === 'received' ? 'lent' : 'borrowed';

  // Find active pending/partial debts for this person (regex match for slight spelling differences)
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let activeDebts = await Debt.find({
    userId,
    personName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    type: targetType,
    status: { $in: ['pending', 'partial'] }
  }).sort({ createdAt: 1 });

  // Fallback prefix/substring match (e.g. "Manik" -> "Manik vai")
  if (activeDebts.length === 0 && cleanName.length >= 2) {
    activeDebts = await Debt.find({
      userId,
      personName: { $regex: new RegExp(escapedName, 'i') },
      type: targetType,
      status: { $in: ['pending', 'partial'] }
    }).sort({ createdAt: 1 });
    if (activeDebts.length > 0) {
      cleanName = activeDebts[0].personName;
    }
  }

  // If settleAmount <= 0, user meant full settlement ("Pias taka diye diche")
  const totalDue = activeDebts.reduce((sum, d) => sum + Math.max(0, d.amount - d.paidAmount), 0);
  let remainingSettleAmount = settleAmount > 0 ? settleAmount : totalDue;
  let settledTotal = 0;
  const debtsUpdated: IDebt[] = [];

  for (const debt of activeDebts) {
    if (remainingSettleAmount <= 0) break;

    const remainingDue = debt.amount - debt.paidAmount;
    const payment = Math.min(remainingDue, remainingSettleAmount);

    debt.paidAmount += payment;
    remainingSettleAmount -= payment;
    settledTotal += payment;

    debt.status = debt.paidAmount >= debt.amount ? 'settled' : 'partial';
    debt.history.push({
      date: new Date(),
      amount: payment,
      note: settlementType === 'received' ? 'পাওনা আদায় / ফেরত' : 'দেনা শোধ / ফেরত',
      type: 'payment'
    });

    await debt.save();
    debtsUpdated.push(debt);
  }

  // If there are no existing active debts and an explicit amount > 0 was given, create a settled entry for record keeping
  if (debtsUpdated.length === 0 && settleAmount > 0) {
    const fallbackDebt = new Debt({
      userId,
      personName: cleanName,
      type: targetType,
      amount: settleAmount,
      paidAmount: settleAmount,
      status: 'settled',
      notes: settlementType === 'received' ? 'ফেরত জমা (সরাসরি উসুল)' : 'পরিশোধ (সরাসরি শোধ)',
      history: [
        {
          date: new Date(),
          amount: settleAmount,
          note: settlementType === 'received' ? 'ফেরত গ্রহণ' : 'পরিশোধ',
          type: 'payment'
        }
      ]
    });
    await fallbackDebt.save();
    debtsUpdated.push(fallbackDebt);
    settledTotal = settleAmount;
  }

  // Calculate new remaining total balance for this person
  const finalEscaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const remainingAll = await Debt.find({
    userId,
    personName: { $regex: new RegExp(`^${finalEscaped}$`, 'i') },
    type: targetType,
    status: { $in: ['pending', 'partial'] }
  });

  const remainingForPerson = remainingAll.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);

  return {
    settledTotal,
    remainingForPerson,
    personName: cleanName,
    debtsUpdated
  };
};

/**
 * Delete debts by scope (all, person, lent, borrowed)
 */
export const deleteDebts = async (
  userId: string | mongoose.Types.ObjectId,
  scope: 'all' | 'person' | 'lent' | 'borrowed',
  personName?: string
): Promise<{ deletedCount: number; scope: 'all' | 'person' | 'lent' | 'borrowed'; personName?: string }> => {
  let filter: any = { userId };
  if (scope === 'person' && personName) {
    const cleanName = cleanPersonName(personName);
    const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.personName = { $regex: new RegExp(`^${escaped}$`, 'i') };
  } else if (scope === 'lent') {
    filter.type = 'lent';
  } else if (scope === 'borrowed') {
    filter.type = 'borrowed';
  }

  const result = await Debt.deleteMany(filter);
  return { deletedCount: result.deletedCount || 0, scope, personName: personName ? cleanPersonName(personName) : undefined };
};

/**
 * Get Overall Debt Summary (Total Receivable, Total Payable, Net Balance)
 */
export const getDebtSummary = async (userId: string | mongoose.Types.ObjectId): Promise<OverallDebtSummary> => {
  const activeDebts = await Debt.find({
    userId,
    status: { $in: ['pending', 'partial'] }
  });

  let totalReceivable = 0;
  let totalPayable = 0;
  let receivableCount = 0;
  let payableCount = 0;

  const receivableMap: Record<string, { displayName: string; amount: number; phone?: string }> = {};
  const payableMap: Record<string, { displayName: string; amount: number }> = {};
  const activePeopleSet = new Set<string>();

  for (const debt of activeDebts) {
    const remaining = Math.max(0, debt.amount - debt.paidAmount);
    if (remaining <= 0) continue;

    const normName = cleanPersonName(debt.personName).trim();
    const key = normName.toLowerCase();
    activePeopleSet.add(key);

    if (debt.type === 'lent') {
      totalReceivable += remaining;
      receivableCount++;
      if (!receivableMap[key]) {
        receivableMap[key] = { displayName: normName, amount: 0, phone: debt.personPhone };
      }
      receivableMap[key].amount += remaining;
      if (debt.personPhone && !receivableMap[key].phone) {
        receivableMap[key].phone = debt.personPhone;
      }
    } else {
      totalPayable += remaining;
      payableCount++;
      if (!payableMap[key]) {
        payableMap[key] = { displayName: normName, amount: 0 };
      }
      payableMap[key].amount += remaining;
    }
  }

  const topReceivables = Object.values(receivableMap)
    .map(data => ({ personName: data.displayName, amount: data.amount, phone: data.phone }))
    .sort((a, b) => b.amount - a.amount);

  const topPayables = Object.values(payableMap)
    .map(data => ({ personName: data.displayName, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalReceivable,
    totalPayable,
    netBalance: totalReceivable - totalPayable,
    receivableCount,
    payableCount,
    activePeopleCount: activePeopleSet.size,
    topReceivables,
    topPayables
  };
};

/**
 * Get Person-wise Summary for a specific person
 */
export const getPersonDebtSummary = async (
  userId: string | mongoose.Types.ObjectId,
  personName: string
): Promise<DebtPersonSummary | null> => {
  const cleanName = cleanPersonName(personName);
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const debts = await Debt.find({
    userId,
    personName: { $regex: new RegExp(`^${escapedName}$`, 'i') }
  }).sort({ createdAt: -1 });

  if (debts.length === 0) return null;

  let totalLent = 0;
  let totalLentRemaining = 0;
  let totalBorrowed = 0;
  let totalBorrowedRemaining = 0;
  let phone = debts.find(d => !!d.personPhone)?.personPhone;
  let lastUpdated = debts[0].updatedAt || debts[0].createdAt;

  for (const d of debts) {
    if (d.type === 'lent') {
      totalLent += d.amount;
      if (d.status !== 'settled') {
        totalLentRemaining += Math.max(0, d.amount - d.paidAmount);
      }
    } else {
      totalBorrowed += d.amount;
      if (d.status !== 'settled') {
        totalBorrowedRemaining += Math.max(0, d.amount - d.paidAmount);
      }
    }
  }

  const netBalance = totalLentRemaining - totalBorrowedRemaining;
  let status: 'receivable' | 'payable' | 'settled' = 'settled';
  if (netBalance > 0) status = 'receivable';
  else if (netBalance < 0) status = 'payable';

  return {
    personName: cleanName,
    personPhone: phone,
    totalLent,
    totalLentRemaining,
    totalBorrowed,
    totalBorrowedRemaining,
    netBalance,
    status,
    itemsCount: debts.length,
    lastUpdated
  };
};

/**
 * Build WhatsApp Response: Debt Logged (Concise)
 */
export const buildDebtLoggedMessage = (
  personName: string,
  amount: number,
  type: 'lent' | 'borrowed',
  personRemainingBalance: number
): string => {
  const isLent = type === 'lent';
  const icon = isLent ? '🟢' : '🔴';
  const typeLabel = isLent ? 'পাওনা (পাবো)' : 'দেনা (দেবো)';
  const formattedAmount = formatTaka(amount);
  const formattedRemaining = formatTaka(personRemainingBalance);

  const extraTotal = personRemainingBalance !== amount
    ? `\n📊 মোট বাকি: *${formattedRemaining}*`
    : '';

  return (
    `✅ *হিসাব সেভ হয়েছে!*\n` +
    `👤 *${personName}*: *${formattedAmount}* (${icon} ${typeLabel})${extraTotal}`
  );
};

/**
 * Build WhatsApp Response: Multiple Debts Logged (Concise)
 */
export const buildMultipleDebtsLoggedMessage = (
  debts: Array<{ personName: string; amount: number; type: 'lent' | 'borrowed' }>,
  overallSummary: OverallDebtSummary
): string => {
  const listText = debts
    .map((d, idx) => {
      const isLent = d.type === 'lent';
      const icon = isLent ? '🟢' : '🔴';
      const label = isLent ? 'পাবো' : 'দেবো';
      return `${idx + 1}. ${icon} *${d.personName}*: ${formatTaka(d.amount)} (${label})`;
    })
    .join('\n');

  const totals: string[] = [];
  if (overallSummary.totalReceivable > 0) totals.push(`🟢 মোট পাওনা: *${formatTaka(overallSummary.totalReceivable)}*`);
  if (overallSummary.totalPayable > 0) totals.push(`🔴 মোট দেনা: *${formatTaka(overallSummary.totalPayable)}*`);

  return `✅ *হিসাব সেভ হয়েছে!*\n\n${listText}${totals.length ? `\n\n${totals.join('\n')}` : ''}`;
};

/**
 * Build WhatsApp Response: Settlement Recorded (Concise)
 */
export const buildDebtSettledMessage = (
  personName: string,
  settledAmount: number,
  settlementType: 'received' | 'paid',
  remainingForPerson: number
): string => {
  if (settledAmount <= 0) {
    return `ℹ️ *${personName}*-এর নামে কোনো বকেয়া পাওনা বা দেনা পাওয়া যায়নি।`;
  }
  const isReceived = settlementType === 'received';
  const actionLabel = isReceived ? 'ফেরত পেয়েছি 🟢' : 'পরিশোধ করেছি 🔴';
  const formattedSettled = formatTaka(settledAmount);
  const statusNote = remainingForPerson <= 0
    ? `✨ সম্পূর্ণ শোধ!`
    : `📊 অবশিষ্ট বাকি: *${formatTaka(remainingForPerson)}*`;

  return (
    `✅ *${personName}*: *${formattedSettled}* (${actionLabel})\n` +
    `${statusNote}`
  );
};

/**
 * Build WhatsApp Response: Debt Deletion
 */
export const buildDebtDeletedMessage = (
  deletedCount: number,
  scope: 'all' | 'person' | 'lent' | 'borrowed',
  personName?: string
): string => {
  if (deletedCount === 0) {
    if (scope === 'person' && personName) {
      return `ℹ️ *${personName}*-এর নামে কোনো সক্রিয় ধার-দেনার হিসাব পাওয়া যায়নি।`;
    }
    return `ℹ️ কোনো সক্রিয় ধার-দেনার হিসাব পাওয়া যায়নি।`;
  }

  if (scope === 'person' && personName) {
    return `🗑️ *${personName}*-এর ধার-দেনার হিসাব মুছে ফেলা হয়েছে।`;
  }
  if (scope === 'lent') {
    return `🗑️ সব পাওনা টাকার হিসাব মুছে ফেলা হয়েছে।`;
  }
  if (scope === 'borrowed') {
    return `🗑️ সব দেনার হিসাব মুছে ফেলা হয়েছে।`;
  }
  return `🗑️ ধার-দেনা খাতার সব হিসাব মুছে ফেলা হয়েছে।`;
};

/**
 * Build WhatsApp Response: Overall Debt Summary (Concise)
 */
export const buildDebtSummaryMessage = (summary: OverallDebtSummary): string => {
  const formattedReceivable = formatTaka(summary.totalReceivable);
  const formattedPayable = formatTaka(summary.totalPayable);

  const lines: string[] = [
    `🤝 *ধার-দেনা ও বাকি খাতা*`,
    `🟢 মোট পাওনা: *${formattedReceivable}*`,
    `🔴 মোট দেনা: *${formattedPayable}*`
  ];

  if (summary.topReceivables.length > 0) {
    lines.push(`\n👥 *পাওনা তালিকা:*`);
    summary.topReceivables.slice(0, 10).forEach(r => {
      lines.push(`• ${r.personName}: *${formatTaka(r.amount)}*`);
    });
  }

  if (summary.topPayables.length > 0) {
    lines.push(`\n🏪 *দেনা তালিকা:*`);
    summary.topPayables.slice(0, 10).forEach(p => {
      lines.push(`• ${p.personName}: *${formatTaka(p.amount)}*`);
    });
  }

  if (summary.topReceivables.length === 0 && summary.topPayables.length === 0) {
    lines.push(`\n✨ বর্তমানে কোনো সক্রিয় দেনা-পাওনা নেই।`);
  }

  return lines.join('\n');
};

/**
 * Build WhatsApp Response: Person Debt Summary (Concise)
 */
export const buildPersonDebtMessage = (summary: DebtPersonSummary): string => {
  const pName = summary.personName;
  if (summary.status === 'receivable') {
    return `👤 *${pName}*\n🟢 আপনি পাবেন (পাওনা): *${formatTaka(summary.totalLentRemaining)}*`;
  } else if (summary.status === 'payable') {
    return `👤 *${pName}*\n🔴 আপনি দেবেন (দেনা): *${formatTaka(summary.totalBorrowedRemaining)}*`;
  }
  return `👤 *${pName}*\n✨ হিসাব শূন্য (কোনো দেনা-পাওনা নেই)`;
};

/**
 * Generate Polite WhatsApp Reminder Message Template (তাগাদা বার্তা)
 */
export const buildReminderTextMessage = (personName: string, amount: number): string => {
  const formattedAmount = formatTaka(amount);
  return encodeURIComponent(
    `আসসালামু আলাইকুম ${personName} ভাই, আশা করি ভালো আছেন। আপনার কাছে আমার ${formattedAmount} ধার/বাকি রয়েছে। সম্ভব হলে দ্রুত পরিশোধ করলে বিশেষ উপকৃত হতাম। ধন্যবাদ!`
  );
};
