import mongoose from 'mongoose';
import Debt, { IDebt, IDebtTransaction } from '../models/Debt';
import { bnToEnDigits, enToBnDigits, formatTaka } from './expenseService';

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
    .replace(/^(?:mr|md|মুহা|জনাব|কাকু|মামা|চাচা)\s+/i, '')
    .replace(/\s+(?:-?কে|-?k|-?ke|-?er|এর|-?theke|থেকে|-?ar|ar)$/i, '')
    .replace(/(?:-?এর|এর|-?er|-?ar|য়ের|\u09DF\u09C7\u09B0|ের|\u09C7\u09B0|র)$/i, '')
    .trim();
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
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|\u09C7\u09B0|য়ের|\u09DF\u09C7\u09B0)?\s*(?:কাছে|kache)\s*(?:টাকা|taka|tk)?\s*(?:পাবো|পাব|হবে|বাকি|ধার|পাওয়া|pabo|pabo\s*ami)?\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:পাবো|পাব|হবে|pabo)?$/i
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
    /^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?এর|-?er|-?ar|র|ের|\u09C7\u09B0|য়ের|\u09DF\u09C7\u09B0)?\s*(?:পাবো|পাব|pabo)\s*[:=]?\s*([০-৯0-9,]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?$/i
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

  // 2. Settlement / Repayment (ফেরত / শোধ / পরিশোধ)
  // Pattern A: Someone paid us back: "রনি ৫০০ টাকা ফেরত দিলো", "রনি ৫০০ শোধ করলো", "roni 500 tk ferot dilo"
  const settleLentPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:theke|থেকে|er\s*kach\s*theke)?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ফেরত\s*দিলো|শোধ\s*করলো|পরিশোধ\s*করলো|ফেরত\s*পেলাম|জমা\s*দিলো|ferot\s*dilo|sodh\s*korlo|porishodh\s*korlo|ferot\s*pelam)$/i);
  if (settleLentPattern) {
    const person = cleanPersonName(settleLentPattern[1]);
    const amount = parseFloat(bnToEnDigits(settleLentPattern[2]));
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

  // Pattern B: We paid someone back: "করিমকে ৫০০ টাকা ফেরত দিলাম", "করিমকে ৫০০ শোধ করলাম", "korim ke 500 taka ferot dilam"
  const settleBorrowedPattern = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:-?কে|-?k|-?ke)?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকা|টাকার|tk|taka)?\s*(?:ফেরত\s*দিলাম|শোধ\s*করলাম|পরিশোধ\s*করলাম|দিয়া\s*দিলাম|ferot\s*dilam|sodh\s*korlam|porishodh\s*korlam)$/i);
  if (settleBorrowedPattern) {
    const person = cleanPersonName(settleBorrowedPattern[1]);
    const amount = parseFloat(bnToEnDigits(settleBorrowedPattern[2]));
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
  const cleanName = cleanPersonName(personName);
  // received = someone gave us back money for what we lent ('lent')
  // paid = we paid back someone for what we borrowed ('borrowed')
  const targetType = settlementType === 'received' ? 'lent' : 'borrowed';

  // Find active pending/partial debts for this person (regex match for slight spelling differences)
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const activeDebts = await Debt.find({
    userId,
    personName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    type: targetType,
    status: { $in: ['pending', 'partial'] }
  }).sort({ createdAt: 1 });

  let remainingSettleAmount = settleAmount;
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

  // If there are no existing active debts, create a settled entry for record keeping
  if (debtsUpdated.length === 0) {
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
    personName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
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
 * Build WhatsApp Response: Debt Logged
 */
export const buildDebtLoggedMessage = (
  personName: string,
  amount: number,
  type: 'lent' | 'borrowed',
  personRemainingBalance: number
): string => {
  const isLent = type === 'lent';
  const typeLabel = isLent ? 'আমি পাবো (পাওনা 🟢)' : 'আমি দেবো (দেনা 🔴)';
  const formattedAmount = formatTaka(amount);
  const formattedRemaining = formatTaka(personRemainingBalance);

  return (
    `🤝 *বাকি / ধার হিসাব সংরক্ষিত হয়েছে!*\n\n` +
    `👤 ব্যক্তি/দোকান: *${personName}*\n` +
    `💰 এন্ট্রি পরিমাণ: *${formattedAmount}*\n` +
    `📌 ধরন: *${typeLabel}*\n\n` +
    `📊 *${personName}-এর সাথে বর্তমান স্থিতি:*\n` +
    `• মোট বাকি: *${formattedRemaining}* (${isLent ? 'পাওনা' : 'দেনা'})\n\n` +
    `💡 _হিসাব দেখতে লিখুন: "ধার দেনা" বা "${personName}-এর হিসাব"_\n` +
    `_স্মৃতি লাইফ - আপনার বিশ্বস্ত ডিজিটাল খাতা_`
  );
};

/**
 * Build WhatsApp Response: Multiple Debts Logged
 */
export const buildMultipleDebtsLoggedMessage = (
  debts: Array<{ personName: string; amount: number; type: 'lent' | 'borrowed' }>,
  overallSummary: OverallDebtSummary
): string => {
  let listText = '';
  debts.forEach((d, idx) => {
    const isLent = d.type === 'lent';
    const icon = isLent ? '🟢' : '🔴';
    const label = isLent ? 'পাবো' : 'দেবো';
    listText += `${idx + 1}. ${icon} *${d.personName}*: ${formatTaka(d.amount)} (${label})\n`;
  });

  return (
    `🤝 *ধার-দেনা ও বাকি হিসাব সংরক্ষিত হয়েছে!*\n\n` +
    `${listText.trim()}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🟢 *মোট পাওনা:* ${formatTaka(overallSummary.totalReceivable)}\n` +
    `🔴 *মোট দেনা:* ${formatTaka(overallSummary.totalPayable)}\n\n` +
    `💡 _বিস্তারিত জানতে লিখুন: "পাওনা টাকা দাও" বা "ধার দেনা"_`
  );
};

/**
 * Build WhatsApp Response: Settlement Recorded
 */
export const buildDebtSettledMessage = (
  personName: string,
  settledAmount: number,
  settlementType: 'received' | 'paid',
  remainingForPerson: number
): string => {
  const isReceived = settlementType === 'received';
  const actionLabel = isReceived ? 'পাওনা উসুল / ফেরত পেয়েছি 🟢' : 'দেনা পরিশোধ / শোধ করেছি 🔴';
  const formattedSettled = formatTaka(settledAmount);
  const formattedRemaining = formatTaka(remainingForPerson);

  const statusNote = remainingForPerson <= 0
    ? `✨ *হিসাব সম্পূর্ণ শোধ হয়ে গেছে!*`
    : `• অবশিষ্ট বাকি: *${formattedRemaining}*`;

  return (
    `✅ *টাকা ফেরত / পরিশোধ হিসাব জমা হয়েছে!*\n\n` +
    `👤 ব্যক্তি: *${personName}*\n` +
    `💵 জমার পরিমাণ: *${formattedSettled}*\n` +
    `📌 বিবরণ: *${actionLabel}*\n\n` +
    `📊 *বর্তমান স্থিতি:*\n` +
    `${statusNote}\n\n` +
    `_স্মৃতি লাইফ - আপনার বিশ্বস্ত ডিজিটাল খাতা_`
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
      return `ℹ️ *${personName}*-এর নামে কোনো সক্রিয় ধার-দেনার রেকর্ড পাওয়া যায়নি।`;
    }
    return `ℹ️ আপনার কোনো সক্রিয় ধার-দেনার রেকর্ড পাওয়া যায়নি।`;
  }

  if (scope === 'person' && personName) {
    return `🗑️ *${personName}*-এর সব (${enToBnDigits(deletedCount)}টি) ধার-দেনার হিসাব সফলভাবে মুছে ফেলা হয়েছে!`;
  }
  if (scope === 'lent') {
    return `🗑️ আপনার সব (${enToBnDigits(deletedCount)}টি) পাওনা টাকার হিসাব তালিকা সফলভাবে মুছে ফেলা হয়েছে!`;
  }
  if (scope === 'borrowed') {
    return `🗑️ আপনার সব (${enToBnDigits(deletedCount)}টি) দেনার হিসাব তালিকা সফলভাবে মুছে ফেলা হয়েছে!`;
  }
  return `🗑️ আপনার ধার-দেনা খাতার সব (${enToBnDigits(deletedCount)}টি) হিসাব সফলভাবে মুছে ফেলা হয়েছে!`;
};

/**
 * Build WhatsApp Response: Overall Debt Summary
 */
export const buildDebtSummaryMessage = (summary: OverallDebtSummary): string => {
  const formattedReceivable = formatTaka(summary.totalReceivable);
  const formattedPayable = formatTaka(summary.totalPayable);

  const netBalanceSign = summary.netBalance >= 0 ? '+' : '';
  const formattedNet = `${netBalanceSign}${formatTaka(Math.abs(summary.netBalance))}`;
  const netBadge = summary.netBalance > 0
    ? '🟢 উদ্বৃত্ত (পাওনা বেশি)'
    : summary.netBalance < 0
    ? '🔴 ঘাটতি (দেনা বেশি)'
    : '⚪ ব্যালেন্স সমান (০)';

  let receivableList = '• কোনো সক্রিয় পাওনা নেই';
  if (summary.topReceivables.length > 0) {
    receivableList = summary.topReceivables
      .slice(0, 5)
      .map(r => `• ${r.personName}: *${formatTaka(r.amount)}*`)
      .join('\n');
  }

  let payableList = '• কোনো দেনা নেই';
  if (summary.topPayables.length > 0) {
    payableList = summary.topPayables
      .slice(0, 5)
      .map(p => `• ${p.personName}: *${formatTaka(p.amount)}*`)
      .join('\n');
  }

  return (
    `🤝 *আপনার ধার-দেনা ও বাকি খাতা*\n\n` +
    `🟢 *আমি পাবো (মোট পাওনা):* ${formattedReceivable}\n` +
    `🔴 *আমি দেবো (মোট দেনা):* ${formattedPayable}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚖️ *নেট ব্যালেন্স:* ${formattedNet} (${netBadge})\n\n` +
    `👥 *কাদের কাছে পাওনা:*\n` +
    `${receivableList}\n\n` +
    `🏪 *দেনা তালিকা:*\n` +
    `${payableList}\n\n` +
    `💡 _কারো বিস্তারিত জানতে লিখুন: "[নাম]-এর হিসাব"_`
  );
};

/**
 * Build WhatsApp Response: Person Debt Summary
 */
export const buildPersonDebtMessage = (summary: DebtPersonSummary): string => {
  const pName = summary.personName;
  let statusText = '';

  if (summary.status === 'receivable') {
    statusText = `🟢 *আপনি পাবেন (পাওনা):* ${formatTaka(summary.totalLentRemaining)}`;
  } else if (summary.status === 'payable') {
    statusText = `🔴 *আপনি দেবেন (দেনা):* ${formatTaka(summary.totalBorrowedRemaining)}`;
  } else {
    statusText = `✨ *হিসাব একদম শূন্য (কোনো দেনা-পাওনা নেই)*`;
  }

  return (
    `👤 *${pName}-এর সাথে হিসাবের খতিয়ান*\n\n` +
    `${statusText}\n\n` +
    `📋 *সর্বমোট লেনদেন:*\n` +
    `• মোট ধার দিয়েছি: ${formatTaka(summary.totalLent)}\n` +
    `• মোট ধার নিয়েছি: ${formatTaka(summary.totalBorrowed)}\n` +
    `• মোট লেনদেন সংখ্যা: ${enToBnDigits(summary.itemsCount)} টি\n\n` +
    `💡 _টাকা ফেরত পেলে লিখুন: "${pName} [টাকার পরিমাণ] ফেরত দিলো"_`
  );
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
