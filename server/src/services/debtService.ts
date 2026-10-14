import mongoose from 'mongoose';
import Debt, { IDebt, IDebtTransaction } from '../models/Debt';
import { bnToEnDigits, enToBnDigits, formatTaka } from './expenseService';

export interface ParsedDebt {
  isQuery: boolean;
  queryType?: 'all' | 'person';
  isSettlement?: boolean;
  settlementType?: 'received' | 'paid'; // received = পাওনা উসুল/ফেরত পেয়েছি, paid = দেনা শোধ করেছি
  type?: 'lent' | 'borrowed'; // lent = আমি পাবো, borrowed = আমি দেবো
  personName?: string;
  amount?: number;
  notes?: string;
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
    .replace(/^(?:ভাই|vai|bhai|mr|md|মুহা|জনাব|কাকু|মামা|চাচা)\s+/i, '')
    .replace(/\s+(?:-?কে|-?k|-?ke|-?er|এর|-?theke|থেকে|ar)$/i, '')
    .trim();
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

  // 1. General Queries
  // "ধার দেনার হিসাব", "বাকি খাতা", "কার কাছে কত পাবো", "পাওনা কত", "দেনা কত", "dhar denar hisab", "baki khata"
  if (
    /(?:ধার\s*দেনার?|বাকি|দেনা\s*পাওনা|উধার)\s*(?:হিসাব|খাতা|লিস্ট|তালিকা|কত|দেখাও|দেখান)/i.test(clean) ||
    /^(?:ধার\s*দেনা|বাকি\s*খাতা|কার\s*কাছে\s*কত\s*পাবো|আমার\s*পাওনা\s*কত|আমার\s*দেনা\s*কত|পাওনা\s*কত|দেনা\s*কত|dhar\s*dena|baki\s*khata)$/i.test(clean) ||
    /(?:dhar\s*dena|baki\s*khata|udhar)\s*(?:hisab|koto|list)?/i.test(lower) ||
    /(?:kar\s*kache\s*koto\s*pabo|amar\s*paona\s*koto|amar\s*dena\s*koto|paona\s*koto|dena\s*koto)/i.test(lower)
  ) {
    // Check if query is about a specific person (e.g. "রনির ধার দেনার হিসাব")
    const specificPersonMatch = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:এর|-?er)?\s*(?:হিসাব|কাছে\s*কত\s*পাবো|কাছে\s*পাওনা|hisab|kache\s*koto\s*pabo)\s*(?:কত|koto|bolo|বলো|কি)?\??$/i);
    if (specificPersonMatch && !/ধার|দেনা|বাকি|মোট|আজ|কাল/i.test(specificPersonMatch[1].trim())) {
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

  // Specific person query like "রনির কাছে কত পাবো" or "রনির হিসাব কত" or "roni er hisab koto"
  const pQuery = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*(?:এর|-?er)?\s*(?:কাছে\s*কত\s*পাবো|এর\s*হিসাব\s*কত|এর\s*হিসাব|er\s*hisab\s*koto|kache\s*koto\s*pabo)\??$/i);
  if (pQuery) {
    const pName = cleanPersonName(pQuery[1]);
    if (pName && pName.length >= 2 && !/ধার|দেনা|বাকি|মোট|আজ|কাল/i.test(pName)) {
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

  const receivableMap: Record<string, { amount: number; phone?: string }> = {};
  const payableMap: Record<string, { amount: number }> = {};
  const activePeopleSet = new Set<string>();

  for (const debt of activeDebts) {
    const remaining = Math.max(0, debt.amount - debt.paidAmount);
    if (remaining <= 0) continue;

    activePeopleSet.add(debt.personName.toLowerCase());

    if (debt.type === 'lent') {
      totalReceivable += remaining;
      receivableCount++;
      if (!receivableMap[debt.personName]) {
        receivableMap[debt.personName] = { amount: 0, phone: debt.personPhone };
      }
      receivableMap[debt.personName].amount += remaining;
      if (debt.personPhone && !receivableMap[debt.personName].phone) {
        receivableMap[debt.personName].phone = debt.personPhone;
      }
    } else {
      totalPayable += remaining;
      payableCount++;
      if (!payableMap[debt.personName]) {
        payableMap[debt.personName] = { amount: 0 };
      }
      payableMap[debt.personName].amount += remaining;
    }
  }

  const topReceivables = Object.entries(receivableMap)
    .map(([personName, data]) => ({ personName, amount: data.amount, phone: data.phone }))
    .sort((a, b) => b.amount - a.amount);

  const topPayables = Object.entries(payableMap)
    .map(([personName, data]) => ({ personName, amount: data.amount }))
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
