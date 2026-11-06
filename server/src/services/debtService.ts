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
  queryScope?: 'all' | 'receivable' | 'payable';
  isSettlement?: boolean;
  settlementType?: 'received' | 'paid'; // received = পাওনা উসুল/ফেরত পেয়েছি, paid = দেনা শোধ করেছি
  isDelete?: boolean;
  deleteScope?: 'all' | 'person' | 'lent' | 'borrowed';
  type?: 'lent' | 'borrowed'; // lent = আমি পাবো, borrowed = আমি দেবো
  personName?: string;
  amount?: number;
  initialAmount?: number; // When user states "X ar kache 4k petam o 3k back diche" (initial=4000, settled=3000)
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

const BANGLISH_NAME_MAP: Record<string, string> = {
  asad: 'আসাদ', pias: 'পিয়াস', piyas: 'পিয়াস', manik: 'মানিক',
  vai: 'ভাই', bhai: 'ভাই', apu: 'আপু', apa: 'আপা',
  rahim: 'রহিম', rohim: 'রহিম', karim: 'করিম', korim: 'করিম',
  roni: 'রনি', rony: 'রনি', rasel: 'রাসেল', russel: 'রাসেল',
  sumon: 'সুমন', shumon: 'সুমন', sakib: 'সাকিব', shakib: 'সাকিব',
  rakib: 'রাকিব', hasan: 'হাসান', hossain: 'হোসেন', hosen: 'হোসেন',
  mamun: 'মামুন', sohel: 'সোহেল', shohel: 'সোহেল', rubel: 'রুবেল',
  jamal: 'জামাল', kamal: 'কামাল', arif: 'আরিফ', sharif: 'শরীফ',
  tarik: 'তারেক', tarek: 'তারেক', imran: 'ইমরান', faruk: 'ফারুক',
  masud: 'মাসুদ', jahid: 'জাহিদ', zahid: 'জাহিদ', nahid: 'নাহিদ',
  fahim: 'ফাহিম', naim: 'নাঈম', nayeem: 'নাঈম', siam: 'সিয়াম',
  rifat: 'রিফাত', rafi: 'রাফি', tanim: 'তানিম', tanvir: 'তানভীর',
  mehedi: 'মেহেদী', mahadi: 'মেহেদী', shanto: 'শান্ত', santo: 'শান্ত',
  joy: 'জয়', ritu: 'রিতু', mitu: 'মিতু', suma: 'সুমা', shuma: 'সুমা',
  rina: 'রিনা', mina: 'মিনা', salma: 'সালমা', nasrin: 'নাসরিন',
  shirin: 'শিরিন', shirina: 'শিরিন', uncle: 'আঙ্কেল', mama: 'মামা',
  chacha: 'চাচা', kaka: 'কাকা', dokan: 'দোকান', mudir: 'মুদির'
};

export const toBanglaPersonName = (raw: string): string => {
  if (!raw) return '';
  return raw
    .trim()
    .split(/\s+/)
    .map(w => {
      const key = w.toLowerCase().replace(/[^a-z]/g, '');
      return (key && BANGLISH_NAME_MAP[key]) ? BANGLISH_NAME_MAP[key] : w;
    })
    .join(' ')
    .trim();
};

/**
 * Clean person name prefixes and suffixes and convert common Banglish names to Bangla
 */
export const cleanPersonName = (raw: string): string => {
  const cleaned = raw
    .trim()
    .replace(/^(?:mr|md|মুহা|জনাব)\s+/i, '')
    // Strip trailing helper phrases like "ar kache ami", "amar kache", "আমার কাছে", "এর কাছে আমি", "ami", "amar"
    .replace(/\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:আমার|amar|amr)?\s*(?:কাছে|kache|kase|কাছ\s*থেকে|থেকে|theke)\s*(?:আমি|ami)?\s*$/i, '')
    .replace(/\s+(?:আমার|amar|amr|আমি|ami)$/i, '')
    .replace(/\s+(?:-?কে|-?k|-?ke|-?er|এর|-?theke|থেকে|-?ar)$/i, '')
    // Bengali possessive suffix only (never strip Latin letters from names like Omar/Peter)
    .replace(/(?:\u09DF\u09C7\u09B0|\u09C7\u09B0)$/i, '')
    .trim();
  return toBanglaPersonName(cleaned) || cleaned;
};

/**
 * Match person names robustly across Bengali and Banglish spellings and with/without honorifics (ভাই, আপু, etc.)
 */
export const isPersonMatch = (nameInDb: string, targetName: string): boolean => {
  if (!nameInDb || !targetName) return false;
  const n1 = cleanPersonName(nameInDb).trim().toLowerCase();
  const n2 = cleanPersonName(targetName).trim().toLowerCase();
  if (n1 === n2) return true;

  const raw1 = nameInDb.trim().toLowerCase();
  const raw2 = targetName.trim().toLowerCase();
  if (raw1 === raw2) return true;

  // Split into tokens excluding common honorifics
  const filterHonorifics = (tokens: string[]) =>
    tokens.filter(t => !/^(?:ভাই|আপু|আপা|আঙ্কেল|মামা|চাচা|vai|bhai|apu|apa|uncle|mama)$/i.test(t));
  const t1 = filterHonorifics(n1.split(/\s+/));
  const t2 = filterHonorifics(n2.split(/\s+/));

  if (t1.length > 0 && t2.length > 0) {
    if (t1.every(t => n2.includes(t)) || t2.every(t => n1.includes(t))) {
      return true;
    }
    if (t1.every(t => raw2.includes(t)) || t2.every(t => raw1.includes(t))) {
      return true;
    }
  }
  return false;
};

/**
 * Normalize shorthand amount multipliers like "3 k", "3k", "4.5 k", "৩ হাজার", "4 hajar" into full digits ("3000", "4500")
 */
export const normalizeDebtAmounts = (text: string): string => {
  if (!text) return '';
  return bnToEnDigits(text).replace(
    /(\d+(?:\.\d+)?)\s*(?:k\b|হাজার|hajar|hazar\b)/gi,
    (_, numStr) => String(Math.round(parseFloat(numStr) * 1000))
  );
};

/**
 * Quick pre-filter: does this text look debt related at all?
 */
export const looksDebtRelated = (text: string): boolean => {
  const norm = normalizeDebtAmounts(text || '');
  return (
    /(?:পাবো|পাব|পাবে|পেতাম|পাইতাম|দেবো|দিবো|দিতাম|দেনা|পাওনা|ধার|বাকি|উধার|হাওলাত|করজ|ফেরত|শোধ|পরিশোধ|কাছে|ব্যাক|kache|kase|pabo|petam|paitam|debo|dibo|ditam|dhar|dena|baki|udhar|paona|pauna|pawna|ferot|sodh|shodh|porishodh|hawlat|back\s*(?:diche|diyeche|dise|dilo|dilam|disi|দিছে|দিয়েছে|দিলো))/i.test(norm) ||
    /(?:টাকা|taka|tk|হিসাব|hisab|\d+)\s*(?:দিয়ে\s*(?:দিয়েছে|দিছে|দিসে|দিলো|দিলাম|দিস)|দিয়েছে|দিছে|দিসে|দিলো|ব্যাক\s*(?:দিছে|দিয়েছে|দিলো)|পেয়ে\s*(?:গেছি|গেলাম)|পেয়েছি|পাইছি|পাওয়া\s*গেছে|মিটিয়ে|ক্লিয়ার|diye\s*(?:diyeche|diche|dise|dilo|dilam|disi)|diyeche|diche|dise|dilo|back\s*(?:diche|diyeche|dise|dilo)|peye\s*(?:gechi|gesi|gelam)|peyechi|paichi|clear)/i.test(norm)
  );
};

/**
 * Parse debt intent with Gemini (accurate person-name extraction for Bangla / Banglish).
 * Returns null if AI is unavailable or the message is not debt related.
 */
export const parseDebtWithAI = async (text: string, userId?: any): Promise<ParsedDebt | null> => {
  try {
    const normalizedText = normalizeDebtAmounts(text);

    // Fast deterministic check FIRST: if regex parser finds a settlement (e.g. "pias 3 k diyeche", "pias ar kache 4 k taka petam o 3 k back diche"), delete, or query, trust it immediately!
    const fastParsed = parseDebtInput(normalizedText);
    if (fastParsed && (fastParsed.isSettlement || fastParsed.isDelete || fastParsed.isQuery)) {
      return fastParsed;
    }

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
{"isDebt":boolean,"action":"add"|"settle"|"query"|"delete"|"none","items":[{"personName":string,"amount":number,"type":"lent"|"borrowed"}],"settlementType":"received"|"paid"|null,"personName":string|null,"initialAmount":number|null,"deleteScope":"all"|"person"|"lent"|"borrowed"|null}
Rules:
- "lent" = user will GET money from the person (e.g. "asad ar kache pabo 3500", "asad ar kache ami pabo 3500 taka", "রনিকে ৫০০ ধার দিলাম", "karim 200 baki nilo").
- "borrowed" = user OWES money to the person (e.g. "karim pabe 500", "রহিমের কাছ থেকে ১০০০ ধার নিলাম", "dokane baki 300").
- personName = ONLY the person's name written in clean Bangla script (e.g. "asad" => "আসাদ", "Manik vai" => "মানিক ভাই", "Pias" => "পিয়াস"); keep honorifics like ভাই/আপু if written. NEVER include words like ar, er, kache, ami, pabo, taka, এর, কাছে, আমি, পাবো. Bangla possessive "আসাদের" => "আসাদ". If the person matches an existing ledger name, match that person.
- amount: convert Bangla digits / words / "k" (e.g. 3k = 3000) to a number.
- action "settle": someone paid back ("Pias taka diye diche", "pias 3000 diyeche", "পিয়াস টাকা দিয়ে দিয়েছে", "asad 1000 ferot dilo", "pias er taka peye gechi", "pabo nato taka petam ta diye diche" => settlementType: "received") or user paid back ("karim ke taka diye dilam", "karim ke 500 sodh korlam" => settlementType: "paid").
  CRITICAL: If the user states BOTH how much they were owed ("petam"/"পেতাম"/"পাবো") AND how much the person paid back ("o 3000 back diche"/"ও ৩০০০ দিয়েছে"/"ফেরত দিছে"), e.g. "pias ar kache 4000 taka petam o 3000 back diche", action MUST be "settle" (NOT "add"!), settlementType: "received", initialAmount: 4000, and items: [{"personName":"পিয়াস","amount":3000,"type":"lent"}]. Note that "o" / "ও" here means "he/she", NOT "and"!
  If NO specific amount is mentioned (meaning full settlement of all remaining debt for that person), set amount to 0 in items (e.g. {"personName":"পিয়াস","amount":0,"type":"lent"}).
- action "query": asking balance/list ("pawna taka daw", "mot koto taka pabo?", "koto taka pabo", "asad er hisab"). Set personName if a specific person is asked.
- action "delete": deleting ledger entries ("pawna list delete koro" => lent, "dena delete" => borrowed, "asad er hisab delete" => person, "dhar dena sob delete" => all).
- If it is NOT about personal debts (normal expense like "bazar 500", reminder, medicine, document), return {"isDebt":false,"action":"none","items":[]}.
Message:
"""${normalizedText}"""`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ['gemini-2.0-flash', 'gemini-2.5-flash'];
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
        const settlePerson = rawItems[0]?.personName || pName || '__LAST_PERSON__';
        return {
          isQuery: false,
          isSettlement: true,
          settlementType: parsed.settlementType === 'paid' ? 'paid' : 'received',
          personName: settlePerson,
          amount: rawItems[0]?.amount || 0,
          initialAmount: Number(parsed.initialAmount) > 0 ? Number(parsed.initialAmount) : undefined
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
  const cleanLine = normalizeDebtAmounts(line.replace(/^[\s\d\.\-\*•📍📌🟢🔴]+/g, '').trim());
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

  // Pattern 7 (borrowed): "রনি আমার কাছে ৭০০০ টাকা পাবে" / "করিমের কাছে ৫০০ দেনা" / "করিম পাবে ৫০০" / "korim pabe 500" / "roni amar kache 7000 taka pabe"
  const borrowedPatternC = cleanLine.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছে|-?কাছে|kache|-?এর\s*কাছ\s*থেকে|theke|থেকে|আমার\s*কাছে|আমার\s*থেকে|amar\s*kache|amar\s*theke|amr\s*kache|amar\s*kase)?\s*(?:দেনা|পাবে|pabe)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:দেনা|বাকি|ধার|dena|baki|পাবে|pabe)$/i
  );
  if (borrowedPatternC) {
    const rawPerson = borrowedPatternC[1].trim();
    if (!/^(?:ধার|দেনা|বাকি|উধার|টাকা|হিসাব|dhar|dena|baki|udhar|taka|hisab)$/i.test(rawPerson)) {
      const person = cleanPersonName(rawPerson);
      const amount = parseFloat(bnToEnDigits(borrowedPatternC[2].replace(/,/g, '')));
      if (person && amount > 0) {
        return { type: 'borrowed', personName: person, amount };
      }
    }
  }

  return null;
};

/**
 * Parse WhatsApp Text for Udhar / Debt operations
 */
export const parseDebtInput = (text: string): ParsedDebt | null => {
  if (!text) return null;
  const clean = normalizeDebtAmounts(text.trim());
  const lower = clean.toLowerCase();

  // Exclude reminders / alarms / wake up commands
  if (/মনে|ডাক|তুলে|alarm|অ্যালার্ম|wake\s*me/i.test(clean)) return null;

  // 0. Compound "Owed X, Paid back Y" in a single sentence:
  // e.g. "pias ar kache 4 k taka petam o 3 k back diche", "পিয়াসের কাছে ৪০০০ টাকা পেতাম ও ৩০০০ ব্যাক দিছে", "আসাদের কাছে ৫০০০ পাবো সে ২০০০ দিয়েছে"
  const compoundSettleMatch = clean.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:কাছে|kache|kase)?\s*(?:আমি|ami)?\s*(?:টাকা|taka|tk)?\s*(?:পেতাম|পাইতাম|পাবো|পাব|petam|paitam|pabo)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:পেতাম|পাইতাম|পাওয়ার\s*ছিল|পাবো|পাব|ছিল|petam|paitam|pabo|chilo)?\s*(?:,|\s+)?(?:ও|সে|তাতে|তার\s*মধ্যে|পরে|এখন|আর|কিন্তু|o|se|she|he|tar\s*moddhe|ekhon|ar|but)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ব্যাক\s*(?:দিয়েছে|দিছে|দিসে|দিলো)|ফেরত\s*(?:দিয়েছে|দিছে|দিসে|দিলো|পেয়েছি|পেলাম)|দিয়ে\s*(?:দিয়েছে|দিছে|দিসে|দিলো)|দিয়েছে|দিছে|দিসে|দিলো|শোধ\s*(?:করেছে|করলো|দিছে)|পরিশোধ\s*(?:করেছে|করলো)|back\s*(?:diyeche|diche|dise|dilo)|ferot\s*(?:diyeche|diche|dise|dilo|peyechi|pelam)|diye\s*(?:diyeche|diche|dise|dilo)|diyeche|diche|dise|dilo|sodh\s*(?:koreche|korlo|diche)|shodh\s*(?:koreche|korlo|diche)|porishodh\s*(?:koreche|korlo))$/i
  );
  if (compoundSettleMatch) {
    const person = cleanPersonName(compoundSettleMatch[1]);
    const initialAmt = parseFloat(bnToEnDigits(compoundSettleMatch[2].replace(/,/g, '')));
    const settledAmt = parseFloat(bnToEnDigits(compoundSettleMatch[3].replace(/,/g, '')));
    if (person && initialAmt > 0 && settledAmt > 0) {
      return {
        isQuery: false,
        isSettlement: true,
        settlementType: 'received',
        personName: person,
        amount: settledAmt,
        initialAmount: initialAmt
      };
    }
  }

  // 0b. Conversational correction when user says "pabo nato taka petam ta diye diche..." / "পাবো না তো টাকা পেতাম তা দিয়ে দিছে"
  if (
    /(?:pabo\s*na(?:to)?|পাবো\s*না(?:\s*তো)?)/i.test(clean) &&
    /(?:diye\s*(?:diyeche|diche|dise|dilo)|diyeche|diche|back\s*diche|দিয়ে\s*(?:দিয়েছে|দিছে|দিসে)|দিয়েছে|দিছে|ফেরত|শোধ|পরিশোধ)/i.test(clean)
  ) {
    return {
      isQuery: false,
      isSettlement: true,
      settlementType: 'received',
      personName: '__LAST_PERSON__',
      amount: 0
    };
  }

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
    // Check if query is about a specific person (e.g. "রনির ধার দেনার হিসাব", "asad ar hisab", "আসাদের কাছে কত পাবো", "tarek ar kache koto taka pabo?")
    const specificPersonMatch = clean.match(
      /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:কাছে|থেকে|kache|kase|theke)?\s*(?:হিসাব|hisab|পাওনা|paona|pauna|pawna|দেনা|dena)?\s*(?:কত\s*টাকা\s*পাবো|কত\s*টাকা\s*পাব|কত\s*টাকা\s*পাবে|কত\s*টাকা|কত\s*পাবো|কত\s*পাব|কত\s*পাবে|কত|koto\s*taka\s*pabo|koto\s*taka\s*pabe|koto\s*taka|koto\s*pabo|koto\s*pabe|koto|হিসাব|hisab)\s*(?:কত|koto|bolo|বলো|কি|দাও|দিন|daw|baki|shodh)?\??$/i
    );
    if (specificPersonMatch) {
      const candidate = specificPersonMatch[1].trim();
      const isReserved =
        /^(?:ধার|দেনা|বাকি|পাওনা|মোট|আজ|কাল|টাকা|হিসাব|dhar|dena|baki|paona|pauna|pawna|taka|hisab|ami|আমি|আমার|amar|amr|কার|kar|karo|কারো|akhon|এখন|shob|sob|সব|সকল|all)$/i.test(candidate) ||
        /\b(?:ami|আমি|amar|আমার|amr|কার|kar|karo|কারো)\b/i.test(candidate);
      if (!isReserved) {
        const pName = cleanPersonName(candidate);
        if (pName && pName.length >= 2) {
          return {
            isQuery: true,
            queryType: 'person',
            personName: pName
          };
        }
      }
    }

    let queryScope: 'all' | 'receivable' | 'payable' = 'all';
    const isPayableOnly =
      /(?:দেনা|দেবো|দিতে\s*হবে|dena|debo|dite\s*hobe)/i.test(clean) &&
      !/(?:পাওনা|পাবো|পাব|paona|pauna|pawna|pabo)/i.test(clean);
    const isReceivableOnly =
      /(?:পাওনা|পাবো|পাব|paona|pauna|pawna|pabo)/i.test(clean) &&
      !/(?:দেনা|দেবো|dena|debo)/i.test(clean);

    if (isPayableOnly) {
      queryScope = 'payable';
    } else if (isReceivableOnly) {
      queryScope = 'receivable';
    }

    return {
      isQuery: true,
      queryType: 'all',
      queryScope
    };
  }

  // Specific person query like "রনির কাছে কত পাবো" or "রনির হিসাব কত" or "roni er hisab koto" or "asad ar kache koto pabo"
  const pQuery = clean.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:কাছে|থেকে|kache|kase|theke)?\s*(?:হিসাব|hisab|পাওনা|paona|pauna|pawna|দেনা|dena)?\s*(?:কত\s*টাকা\s*পাবো|কত\s*টাকা\s*পাব|কত\s*টাকা\s*পাবে|কত\s*টাকা|কত\s*পাবো|কত\s*পাব|কত\s*পাবে|কত|koto\s*taka\s*pabo|koto\s*taka\s*pabe|koto\s*taka|koto\s*pabo|koto\s*pabe|koto|হিসাব|hisab)\s*(?:কত|koto|bolo|বলো|কি|দাও|দিন|daw|baki|shodh)?\??$/i
  );
  if (pQuery) {
    const candidate = pQuery[1].trim();
    const isReserved =
      /^(?:ধার|দেনা|বাকি|পাওনা|মোট|আজ|কাল|টাকা|হিসাব|dhar|dena|baki|paona|pauna|pawna|taka|hisab|ami|আমি|আমার|amar|amr|কার|kar|karo|কারো|akhon|এখন|shob|sob|সব|সকল|all)$/i.test(candidate) ||
      /\b(?:ami|আমি|amar|আমার|amr|কার|kar|karo|কারো)\b/i.test(candidate);
    if (!isReserved) {
      const pName = cleanPersonName(candidate);
      if (pName && pName.length >= 2) {
        return {
          isQuery: true,
          queryType: 'person',
          personName: pName
        };
      }
    }
  }

  // 2. Settlement / Repayment (ফেরত / শোধ / পরিশোধ / টাকা দিয়ে দিছে / ব্যাক দিছে)
  // Pattern A1 (with amount): Someone paid us back: "রনি ৫০০ টাকা ফেরত দিলো", "roni 500 tk ferot dilo", "Pias 1000 taka diye diche", "pias 3 k diyeche", "pias 3000 back diche"
  const settleLentPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের)?\s*(?:theke|থেকে|er\s*kach\s*theke|কাছে|kache)?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ফেরত\s*(?:দিলো|দিয়েছে|দিছে|দিসে|পেলাম|পেয়েছি)|ব্যাক\s*(?:দিলো|দিয়েছে|দিছে|দিসে)|শোধ\s*(?:করলো|করেছে|দিলো|দিছে)|পরিশোধ\s*(?:করলো|করেছে)|জমা\s*(?:দিলো|দিয়েছে|দিছে)|দিয়ে\s*(?:দিয়েছে|দিছে|দিসে|দিলো)|দিয়েছে|দিছে|দিসে|দিলো|back\s*(?:dilo|diyeche|diche|dise)|ferot\s*(?:dilo|diyeche|diche|dise|pelam|peyechi)|sodh\s*(?:korlo|koreche|diche)|shodh\s*(?:korlo|koreche|diche)|porishodh\s*(?:korlo|koreche)|diye\s*(?:diyeche|diche|dise|dilo)|diyeche|diche|dise|dilo)$/i);
  if (settleLentPattern) {
    const rawCandidate = settleLentPattern[1].trim();
    const isExpenseWord = /^(?:রিকশা|রিক্সা|ভাড়া|ভাড়া|বাজার|ওষুধ|ঔষধ|খাবার|নাস্তা|লাঞ্চ|ডিনার|চা|কফি|বাস|সিএনজি|অটো|ট্রেন|বিল|বিদ্যুৎ|গ্যাস|পানি|ওয়াইফাই|নেট|রিচার্জ|ডাক্তার|টেস্ট|জামা|কাপড়|জুতা|বই|খাতা|কলম|সিনেমা|riksha|rickshaw|vara|bhara|bazar|bazaar|medicine|medecin|osud|oshud|khabar|nasta|lunch|dinner|cha|tea|coffee|bus|cng|auto|bill|wifi|net|recharge|doctor|daktar)$/i.test(rawCandidate);
    if (!isExpenseWord) {
      const person = cleanPersonName(rawCandidate);
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

  // Pattern D: "রনি আমার কাছে ৭০০০ টাকা পাবে" / "রনি পাবে ৭০০০" / "roni amar kache 7000 taka pabe" / "roni 7000 pabe"
  const borrowedPatternD = clean.match(
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর\s*কাছে|-?কাছে|kache|-?এর\s*কাছ\s*থেকে|theke|থেকে|আমার\s*কাছে|আমার\s*থেকে|amar\s*kache|amar\s*theke|amr\s*kache|amar\s*kase)?\s*(?:দেনা|পাবে|pabe)?\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:দেনা|বাকি|ধার|dena|baki|পাবে|pabe)$/i
  );
  if (borrowedPatternD) {
    const rawPerson = borrowedPatternD[1].trim();
    if (!/^(?:ধার|দেনা|বাকি|উধার|টাকা|হিসাব|dhar|dena|baki|udhar|taka|hisab)$/i.test(rawPerson)) {
      const person = cleanPersonName(rawPerson);
      const amount = parseFloat(bnToEnDigits(borrowedPatternD[2]));
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
  settlementType: 'received' | 'paid',
  initialAmount?: number
): Promise<{
  settledTotal: number;
  remainingForPerson: number;
  personName: string;
  debtsUpdated: IDebt[];
}> => {
  // received = someone gave us back money for what we lent ('lent')
  // paid = we paid back someone for what we borrowed ('borrowed')
  const targetType = settlementType === 'received' ? 'lent' : 'borrowed';

  let resolvedPersonName = personName;
  if (personName === '__LAST_PERSON__' || !personName) {
    const lastActive = await Debt.findOne({
      userId,
      type: targetType,
      status: { $in: ['pending', 'partial'] }
    }).sort({ updatedAt: -1, createdAt: -1 });
    resolvedPersonName = lastActive ? lastActive.personName : 'পিয়াস';
  }

  let cleanName = cleanPersonName(resolvedPersonName);

  // Retrieve all active debts for this user and match via robust cross-language isPersonMatch
  const allUserDebts = await Debt.find({
    userId,
    status: { $in: ['pending', 'partial'] }
  }).sort({ createdAt: 1 });

  // Filter matching person name
  let matchedPersonDebts = allUserDebts.filter(
    d => isPersonMatch(d.personName, cleanName) || isPersonMatch(d.personName, resolvedPersonName)
  );

  // Prefer targetType (lent for received, borrowed for paid)
  let activeDebts = matchedPersonDebts.filter(d => d.type === targetType);
  if (activeDebts.length === 0 && matchedPersonDebts.length > 0) {
    // If not found in targetType, check other type
    activeDebts = matchedPersonDebts;
  }

  if (activeDebts.length > 0) {
    cleanName = cleanPersonName(activeDebts[0].personName) || cleanName;
  }

  // Special case: User explicitly stated both initial owed amount and settled amount (e.g. "pias ar kache 4 k taka petam o 3 k back diche")
  if (initialAmount && initialAmount > 0 && settleAmount > 0) {
    const paidAmt = Math.min(initialAmount, settleAmount);
    const newStatus = paidAmt >= initialAmount ? 'settled' : 'partial';

    let primaryDebt: IDebt;
    if (activeDebts.length > 0) {
      primaryDebt = activeDebts[0];
      primaryDebt.personName = cleanName;
      primaryDebt.amount = initialAmount;
      primaryDebt.paidAmount = paidAmt;
      primaryDebt.status = newStatus;
      primaryDebt.history.push({
        date: new Date(),
        amount: paidAmt,
        note: settlementType === 'received' ? 'পাওনা আদায় / ফেরত' : 'দেনা শোধ / ফেরত',
        type: 'payment'
      });
      await primaryDebt.save();

      // Remove any extra accidental duplicate entries for this person
      if (activeDebts.length > 1) {
        const extraIds = activeDebts.slice(1).map(d => d._id);
        await Debt.deleteMany({ _id: { $in: extraIds } });
      }
    } else {
      primaryDebt = new Debt({
        userId,
        personName: cleanName,
        type: targetType,
        amount: initialAmount,
        paidAmount: paidAmt,
        status: newStatus,
        notes: settlementType === 'received' ? 'পাওনা ও আংশিক উসুল' : 'দেনা ও আংশিক শোধ',
        history: [
          {
            date: new Date(),
            amount: initialAmount,
            note: targetType === 'lent' ? 'ধার/পাওনা এন্ট্রি' : 'ধার/দেনা এন্ট্রি',
            type: 'additional'
          },
          {
            date: new Date(),
            amount: paidAmt,
            note: settlementType === 'received' ? 'পাওনা আদায় / ফেরত' : 'দেনা শোধ / ফেরত',
            type: 'payment'
          }
        ]
      });
      await primaryDebt.save();
    }

    return {
      settledTotal: paidAmt,
      remainingForPerson: Math.max(0, initialAmount - paidAmt),
      personName: cleanName,
      debtsUpdated: [primaryDebt]
    };
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

    debt.personName = cleanName;
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
  const remainingAll = await Debt.find({
    userId,
    status: { $in: ['pending', 'partial'] }
  });

  const remainingForPerson = remainingAll
    .filter(d => isPersonMatch(d.personName, cleanName))
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);

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
  if (scope === 'person' && personName) {
    const cleanName = cleanPersonName(personName);
    const allDebts = await Debt.find({ userId });
    const toDelete = allDebts.filter(d => isPersonMatch(d.personName, cleanName) || isPersonMatch(d.personName, personName));
    if (toDelete.length > 0) {
      const ids = toDelete.map(d => d._id);
      const res = await Debt.deleteMany({ _id: { $in: ids } });
      return { deletedCount: res.deletedCount || 0, scope, personName: cleanName };
    }
    return { deletedCount: 0, scope, personName: cleanName };
  } else if (scope === 'lent') {
    const result = await Debt.deleteMany({ userId, type: 'lent' });
    return { deletedCount: result.deletedCount || 0, scope };
  } else if (scope === 'borrowed') {
    const result = await Debt.deleteMany({ userId, type: 'borrowed' });
    return { deletedCount: result.deletedCount || 0, scope };
  }

  const result = await Debt.deleteMany({ userId });
  return { deletedCount: result.deletedCount || 0, scope };
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
  const allDebts = await Debt.find({ userId }).sort({ createdAt: -1 });
  const debts = allDebts.filter(d => isPersonMatch(d.personName, cleanName) || isPersonMatch(d.personName, personName));

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
export const buildDebtSummaryMessage = (
  summary: OverallDebtSummary,
  queryScope: 'all' | 'receivable' | 'payable' = 'all'
): string => {
  const formattedReceivable = formatTaka(summary.totalReceivable);
  const formattedPayable = formatTaka(summary.totalPayable);

  if (queryScope === 'payable') {
    const lines: string[] = [
      '🏪 *দেনার হিসাব*',
      `🔴 মোট দেনা: *${formattedPayable}*`
    ];
    if (summary.topPayables.length > 0) {
      lines.push('\n🏪 *দেনা তালিকা:*');
      summary.topPayables.slice(0, 10).forEach(p => {
        lines.push(`• ${p.personName}: *${formatTaka(p.amount)}*`);
      });
    } else {
      lines.push('\n✨ বর্তমানে আপনার কোনো দেনা নেই!');
    }
    return lines.join('\n');
  }

  if (queryScope === 'receivable') {
    const lines: string[] = [
      '👥 *পাওনার হিসাব*',
      `🟢 মোট পাওনা: *${formattedReceivable}*`
    ];
    if (summary.topReceivables.length > 0) {
      lines.push('\n👥 *পাওনা তালিকা:*');
      summary.topReceivables.slice(0, 10).forEach(r => {
        lines.push(`• ${r.personName}: *${formatTaka(r.amount)}*`);
      });
    } else {
      lines.push('\n✨ বর্তমানে আপনার কোনো পাওনা নেই!');
    }
    return lines.join('\n');
  }

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
