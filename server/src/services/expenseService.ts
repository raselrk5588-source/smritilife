import Expense, { IExpense } from '../models/Expense';
import mongoose from 'mongoose';

export interface ParsedExpense {
  isQuery: boolean;
  isMonthly?: boolean;
  title?: string;
  amount?: number;
  paymentMethod?: string;
}

export interface CategoryInfo {
  id: string;
  nameBn: string;
  icon: string;
  keywords: string[];
}

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'food',
    nameBn: 'খাবার ও বাজার',
    icon: '🛒',
    keywords: [
      'বাজার', 'চাল', 'ডাল', 'তেল', 'মাছ', 'মাংস', 'মুরগি', 'গরু', 'সবজি', 'তরকারি', 'ডিম', 'দুধ', 'ফল',
      'নাস্তা', 'বিরিয়ানি', 'বার্গার', 'চা', 'কফি', 'লাঞ্চ', 'ডিনার', 'খাবার', 'রেস্টুরেন্ট', 'ফুড', 'মিষ্টি',
      'পিঠা', 'হোটেল', 'রুটি', 'পরোটা', 'ভাত', 'চিকেন', 'স্যান্ডউইচ', 'বিস্কুট', 'ফুচকা', 'চটপটি', 'lunch',
      'dinner', 'breakfast', 'tea', 'coffee', 'food', 'bazar', 'bazaar', 'gorur mangsho', 'murgi'
    ]
  },
  {
    id: 'transport',
    nameBn: 'যাতায়াত',
    icon: '🚗',
    keywords: [
      'রিকশা', 'রিক্সা', 'বাস', 'ভাড়া', 'ভাড়া', 'ট্রেন', 'সিএনজি', 'উবার', 'পাঠাও', 'বাইক', 'পেট্রোল',
      'অকটেন', 'গ্যাস', 'ডিজেল', 'টিকিট', 'টোল', 'মেট্রো', 'মেট্রোরেল', 'metro', 'uber', 'pathao', 'cng',
      'bus', 'rickshaw', 'train', 'ticket', 'fare', 'toll', 'fare'
    ]
  },
  {
    id: 'health',
    nameBn: 'ওষুধ ও চিকিৎসা',
    icon: '💊',
    keywords: [
      'ওষুধ', 'ঔষধ', 'ডাক্তার', 'টেস্ট', 'ক্লিনিক', 'হাসপাতাল', 'ফার্মেসি', 'ডেন্টাল', 'চশমা', 'স্যালাইন',
      'ফি', 'প্রেসক্রিপশন', 'medicine', 'doctor', 'hospital', 'pharmacy', 'test', 'clinic'
    ]
  },
  {
    id: 'bills',
    nameBn: 'ইউটিলিটি ও বিল',
    icon: '💡',
    keywords: [
      'বিল', 'বিদ্যুৎ', 'কারেন্ট', 'কারেন্ট বিল', 'বিদ্যুৎ বিল', 'গ্যাস বিল', 'পানি বিল', 'ওয়াইফাই', 'ইন্টারনেট',
      'নেট বিল', 'বাড়ি ভাড়া', 'বাসা ভাড়া', 'রুম ভাড়া', 'ডিশ বিল', 'মোবাইল রিচার্জ', 'রিচার্জ', 'টপআপ', 'bill',
      'wifi', 'electricity', 'current bill', 'gas bill', 'water bill', 'rent', 'recharge', 'topup'
    ]
  },
  {
    id: 'shopping',
    nameBn: 'কেনাকাটা',
    icon: '🛍️',
    keywords: [
      'জামা', 'কাপড়', 'জুতা', 'জুতো', 'প্যান্ট', 'শার্ট', 'পাঞ্জাবি', 'ব্যাগ', 'কসমেটিকস', 'শপিং', 'ড্রেস',
      'টি-শার্ট', 'ঘড়ি', 'shopping', 'cloth', 'shirt', 'pant', 'shoes', 'cosmetics', 'watch'
    ]
  },
  {
    id: 'education',
    nameBn: 'শিক্ষা',
    icon: '📚',
    keywords: [
      'বই', 'খাতা', 'কলম', 'টিউশন', 'বেতন', 'কোচিং', 'কলেজ ফি', 'স্কুল ফি', 'ভার্সিটি ফি', 'পরীক্ষার ফি',
      'book', 'tuition', 'school fee', 'college fee', 'exam fee'
    ]
  },
  {
    id: 'entertainment',
    nameBn: 'বিনোদন ও উপহার',
    icon: '🎬',
    keywords: [
      'সিনেমা', 'মুভি', 'ঘুরতে', 'ট্যুর', 'উপহার', 'গিফট', 'পার্টি', 'movie', 'cinema', 'tour', 'gift', 'party'
    ]
  }
];

// Bengali numbers to English
export const bnToEnDigits = (str: string): string => {
  const bnDigits = '০১২৩৪৫৬৭৮৯';
  return str.replace(/[০-৯]/g, d => bnDigits.indexOf(d).toString());
};

// English numbers to Bengali
export const enToBnDigits = (num: number | string): string => {
  const bnDigits: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  return num.toString().replace(/\d/g, d => bnDigits[d] || d);
};

// Format currency in Bengali (e.g. ৳১,৫০০)
export const formatTaka = (amount: number): string => {
  const formattedEn = Math.round(amount).toLocaleString('en-IN');
  return `৳${enToBnDigits(formattedEn)}`;
};

/**
 * Detect Category from text title
 */
export const detectExpenseCategory = (text: string): { id: string; nameBn: string; icon: string } => {
  const lower = text.toLowerCase();
  for (const cat of EXPENSE_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { id: cat.id, nameBn: cat.nameBn, icon: cat.icon };
      }
    }
  }
  return { id: 'other', nameBn: 'অন্যান্য', icon: '📌' };
};

/**
 * Detect Payment Method from text
 */
export const detectPaymentMethod = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('bkash') || lower.includes('বিকাশ')) return 'bkash';
  if (lower.includes('nagad') || lower.includes('নগদ')) return 'nagad';
  if (lower.includes('card') || lower.includes('কার্ড')) return 'card';
  if (lower.includes('bank') || lower.includes('ব্যাংক')) return 'bank';
  return 'cash';
};

/**
 * Clean unwanted prefixes from title
 */
const cleanTitleText = (raw: string): string => {
  return raw
    .replace(/^(?:আজ|আজকে|aj|ajke|কাল|গতকাল|গতকালের)\s+/i, '')
    .replace(/^(?:খরচ|khoroc|expense)\s*[:=]?\s*/i, '')
    .replace(/\s*(?:দিয়ে|দিলাম|দিয়া|dia|dilam|koresi|করলাম|হলো|holo|গেল|gelo)\s*$/i, '')
    .trim();
};

/**
 * Natural Language Expense Parser for WhatsApp (Zero AI Cost)
 */
export const parseExpenseInput = (text: string): ParsedExpense | null => {
  if (!text) return null;
  const clean = text.trim();

  // 1. Query Detection (Today / This month summary)
  if (
    /(?:আজকের|আজকে|আজ|ajke|aj|ajker)\s*(?:খরচ|khoroc|হিসাব|খরচের\s*হিসাব)\s*(?:কত|koto|dekhao|দেখা|লিস্ট|দাও|daw)?/i.test(clean) ||
    /^(?:আজকের\s*খরচ|খরচ\s*কত|আজকের\s*হিসাব)$/i.test(clean)
  ) {
    return { isQuery: true, isMonthly: false };
  }

  if (
    /(?:এই\s*মাসের|মাসের|চলতি\s*মাসের|month|monthly|maser)\s*(?:খরচ|khoroc|হিসাব|খরচের\s*হিসাব)\s*(?:কত|koto|dekhao|দেখা|লিস্ট|দাও|daw)?/i.test(clean) ||
    /^(?:মাসের\s*খরচ|এই\s*মাসের\s*খরচ|মাসের\s*হিসাব)$/i.test(clean)
  ) {
    return { isQuery: true, isMonthly: true };
  }

  // 2. Pattern: [Item/Category] [Amount] [টাকা/tk]? e.g. "বাজার ৫০০ টাকা", "রিকশা ৬০"
  const p1 = clean.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)?$/i);
  if (p1 && p1[1].trim().length >= 2) {
    const rawTitle = p1[1].trim();
    // Exclude reminder/time queries like "কাল ১০টা"
    if (!/কখন|সময়|time|বাকি|তারিখ|date|ঘণ্টা|মিনিট|দিন/i.test(rawTitle)) {
      const amount = parseFloat(bnToEnDigits(p1[2]));
      if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
        return {
          isQuery: false,
          title: cleanTitleText(rawTitle),
          amount,
          paymentMethod: detectPaymentMethod(clean)
        };
      }
    }
  }

  // 3. Pattern: [Amount] টাকা [Item] e.g. "৫০০ টাকার বাজার", "১২০ টাকা লাঞ্চ"
  const p2 = clean.match(/^([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)\s*(?:দিয়ে|dia|ar)?\s*([a-zA-Z\u0980-\u09FF\s]+)$/i);
  if (p2 && p2[2].trim().length >= 2) {
    const amount = parseFloat(bnToEnDigits(p2[1]));
    const rawTitle = p2[2].trim();
    if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
      return {
        isQuery: false,
        title: cleanTitleText(rawTitle),
        amount,
        paymentMethod: detectPaymentMethod(clean)
      };
    }
  }

  // 4. Pattern: 'খরচ [Item] [Amount]' e.g. 'খরচ বাজার ৫০০'
  const p3 = clean.match(/^(?:খরচ|expense|khoroc)\s*[:=]?\s*([a-zA-Z\u0980-\u09FF\s]+?)\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)?$/i);
  if (p3 && p3[1].trim().length >= 2) {
    const rawTitle = p3[1].trim();
    const amount = parseFloat(bnToEnDigits(p3[2]));
    if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
      return {
        isQuery: false,
        title: cleanTitleText(rawTitle),
        amount,
        paymentMethod: detectPaymentMethod(clean)
      };
    }
  }

  return null;
};

/**
 * Record a new Expense
 */
export const recordExpense = async (
  userId: string | mongoose.Types.ObjectId,
  title: string,
  amount: number,
  paymentMethod: string = 'cash',
  date: Date = new Date(),
  notes?: string
) => {
  const cat = detectExpenseCategory(title);
  const expense = await Expense.create({
    userId,
    title,
    amount,
    category: cat.id,
    categoryBn: cat.nameBn,
    paymentMethod,
    date,
    notes
  });
  return expense;
};

/**
 * Get Expense Summary for a User (Today & This Month)
 */
export const getExpenseSummary = async (userId: string | mongoose.Types.ObjectId, targetDate: Date = new Date()) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"
  const startOfToday = new Date(`${dhakaDateStr}T00:00:00.000Z`);
  const endOfToday = new Date(`${dhakaDateStr}T23:59:59.999Z`);

  // Start of current month in Dhaka
  const [yearStr, monthStr] = dhakaDateStr.split('-');
  const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);

  // Today's expenses
  const todayExpenses = await Expense.find({
    userId,
    date: { $gte: startOfToday, $lte: endOfToday }
  }).sort({ date: -1 });

  const todayTotal = todayExpenses.reduce((sum, item) => sum + item.amount, 0);

  // This month's expenses
  const monthExpenses = await Expense.find({
    userId,
    date: { $gte: startOfMonth, $lte: endOfToday }
  });

  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0);

  // Category-wise distribution this month
  const categoryMap = new Map<string, { nameBn: string; icon: string; amount: number; count: number }>();
  for (const exp of monthExpenses) {
    const cat = detectExpenseCategory(exp.title);
    const existing = categoryMap.get(exp.category) || {
      nameBn: exp.categoryBn || cat.nameBn,
      icon: cat.icon,
      amount: 0,
      count: 0
    };
    existing.amount += exp.amount;
    existing.count += 1;
    categoryMap.set(exp.category, existing);
  }

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([catId, data]) => ({
    id: catId,
    nameBn: data.nameBn,
    icon: data.icon,
    amount: data.amount,
    count: data.count,
    percentage: monthTotal > 0 ? Math.round((data.amount / monthTotal) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  return {
    todayExpenses,
    todayTotal,
    todayCount: todayExpenses.length,
    monthTotal,
    monthCount: monthExpenses.length,
    categoryBreakdown,
    dateStr: dhakaDateStr
  };
};

/**
 * Format Response Message for WhatsApp Logging
 */
export const buildExpenseLoggedMessage = (
  title: string,
  amount: number,
  category: { nameBn: string; icon: string },
  todayTotal: number,
  monthTotal: number
): string => {
  return `✅ *খরচ যুক্ত হয়েছে!*\n` +
         `${category.icon} *খাত:* ${title} (${category.nameBn})\n` +
         `💰 *পরিমাণ:* ${formatTaka(amount)}\n\n` +
         `📊 *আজকের মোট খরচ:* ${formatTaka(todayTotal)}\n` +
         `📅 *এই মাসের মোট:* ${formatTaka(monthTotal)}\n\n` +
         `💡 আজকের সব খরচ দেখতে লিখুন: "আজকের খরচ কত"`;
};

/**
 * Format Response Message for Daily Query
 */
export const buildDailyExpenseQueryMessage = (
  todayExpenses: IExpense[],
  todayTotal: number,
  monthTotal: number
): string => {
  if (todayExpenses.length === 0) {
    return `📝 *আজকের খরচের হিসাব:*\n\nআজকে এখনও কোনো খরচ রেকর্ড করা হয়নি।\n\n💡 যেকোনো খরচ লিখতে পারেন, যেমন: "বাজার ৫০০ টাকা" বা "রিকশা ৬০"`;
  }

  const itemsList = todayExpenses
    .map((e, idx) => {
      const cat = detectExpenseCategory(e.title);
      return `${enToBnDigits(idx + 1)}. ${cat.icon} ${e.title}: *${formatTaka(e.amount)}*`;
    })
    .join('\n');

  return `📊 *আজকের খরচের হিসাব খাতা*\n\n` +
         `${itemsList}\n\n` +
         `──────────────\n` +
         `💵 *আজকের মোট:* ${formatTaka(todayTotal)}\n` +
         `📅 *এই মাসের মোট:* ${formatTaka(monthTotal)}\n\n` +
         `🌐 বিস্তারিত চার্ট দেখতে ভিজিট করুন: https://smritilife.com/app/expenses`;
};

/**
 * Format Response Message for Monthly Query
 */
export const buildMonthlyExpenseQueryMessage = (
  monthTotal: number,
  monthCount: number,
  categoryBreakdown: Array<{ nameBn: string; icon: string; amount: number; percentage: number }>
): string => {
  if (monthCount === 0) {
    return `📅 *এই মাসের খরচের হিসাব:*\n\nএই মাসে এখনও কোনো খরচ এন্ট্রি নেই।\n\n💡 খরচ যোগ করতে লিখুন: যেমন "লাঞ্চ ১২০ টাকা"`;
  }

  const breakdownList = categoryBreakdown
    .map(c => `• ${c.icon} ${c.nameBn}: *${formatTaka(c.amount)}* (${enToBnDigits(c.percentage)}%)`)
    .join('\n');

  return `📅 *চলতি মাসের খরচের সারাংশ*\n\n` +
         `💰 *মোট খরচ:* ${formatTaka(monthTotal)} (${enToBnDigits(monthCount)}টি এন্ট্রি)\n\n` +
         `📊 *খাতভিত্তিক বিভাজন:*\n` +
         `${breakdownList}\n\n` +
         `🌐 সম্পূর্ণ গ্রাফ ও খাতা দেখতে: https://smritilife.com/app/expenses`;
};
