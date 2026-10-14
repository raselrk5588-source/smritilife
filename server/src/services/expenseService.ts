import Expense, { IExpense } from '../models/Expense';
import mongoose from 'mongoose';

export interface ParsedExpense {
  isQuery: boolean;
  queryType?: 'daily' | 'monthly';
  targetDate?: Date;
  dateLabelBn?: string;
  monthYear?: { year: number; month: number; monthLabelBn: string };
  title?: string;
  amount?: number;
  paymentMethod?: string;
  expenseDate?: Date;
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
export const BENGALI_MONTHS = [
  '', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export const MONTH_MAP: Record<string, number> = {
  // Bengali
  'জানুয়ারি': 1, 'জানুয়ারি': 1, 'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারি': 2, 'মার্চ': 3,
  'এপ্রিল': 4, 'মে': 5, 'জুন': 6, 'জুলাই': 7, 'আগস্ট': 8, 'আগষ্ট': 8,
  'সেপ্টেম্বর': 9, 'সেপ্টেম্বার': 9, 'অক্টোবর': 10, 'অক্টোবার': 10,
  'নভেম্বর': 11, 'নভেম্বার': 11, 'ডিসেম্বর': 12, 'ডিসেম্বার': 12,
  // English / Banglish
  'january': 1, 'jan': 1, 'januyari': 1,
  'february': 2, 'feb': 2, 'februari': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12
};

export interface ExtractedDateInfo {
  dayDate?: {
    date: Date;
    dateLabelBn: string;
    isSpecificDate: boolean;
  };
  monthDate?: {
    year: number;
    month: number;
    monthLabelBn: string;
  };
  cleanedText?: string;
}

/**
 * Intelligent Bengali, Banglish & English Date Parser for Expenses
 */
export const parseExpenseDate = (text: string, referenceDate: Date = new Date()): ExtractedDateInfo | null => {
  const dhakaStr = referenceDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const [refYear, refMonth, refDay] = dhakaStr.split('-').map(Number);
  const clean = text.trim();

  const makeDhakaDate = (y: number, m: number, d: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00.000+06:00`);
  };

  // 1. Month: "গত মাস", "গত মাসের", "last month", "last mas"
  if (/(?:গত\s*মাসের?|last\s*months?|last\s*maser?|previous\s*month)/i.test(clean)) {
    let prevMonth = refMonth - 1;
    let prevYear = refYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const cleaned = clean.replace(/(?:গত\s*মাসের?|last\s*months?|last\s*maser?|previous\s*month)/i, '').trim();
    return {
      monthDate: {
        year: prevYear,
        month: prevMonth,
        monthLabelBn: `গত মাস (${BENGALI_MONTHS[prevMonth]} ${enToBnDigits(prevYear)})`
      },
      cleanedText: cleaned
    };
  }

  // 2. Specific Month: e.g. "সেপ্টেম্বর মাসের খরচ", "september maser khoroc", "october khoroc"
  const monthMatch = clean.match(/(?:^|\s)(জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|আগষ্ট|সেপ্টেম্বর|সেপ্টেম্বার|অক্টোবর|অক্টোবার|নভেম্বর|নভেম্বার|ডিসেম্বর|ডিসেম্বার|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s*(?:মাসের?|maser?|month)?(?:\s*(?:এর|এ|te|e|a))?\s*(?:খরচ|khoroc|khoros|হিসাব)/i);
  if (monthMatch) {
    const mNum = MONTH_MAP[monthMatch[1].toLowerCase()];
    if (mNum) {
      let mYear = refYear;
      if (mNum > refMonth) {
        mYear = refYear - 1;
      }
      const cleaned = clean.replace(monthMatch[0], 'খরচ').trim();
      return {
        monthDate: {
          year: mYear,
          month: mNum,
          monthLabelBn: `${BENGALI_MONTHS[mNum]} ${enToBnDigits(mYear)}`
        },
        cleanedText: cleaned
      };
    }
  }

  // 3. Yesterday: গতকাল, গত কাল, কালকের, gotokal, gotokaal, goto kal, yesterday
  const yesterdayRegex = /(?:গত\s*কাল(?:কের?|ের)?|গতকাল(?:কের?|ের)?|কালকের?|goto\s*kal(?:ker?|er)?|gotokal(?:er)?|gotokaal(?:er)?|yesterday)/i;
  if (yesterdayRegex.test(clean)) {
    const yDate = new Date(referenceDate);
    yDate.setDate(yDate.getDate() - 1);
    const yDhaka = yDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    const [yY, yM, yD] = yDhaka.split('-').map(Number);
    const cleaned = clean.replace(yesterdayRegex, '').trim();
    return {
      dayDate: {
        date: makeDhakaDate(yY, yM, yD),
        dateLabelBn: `গতকাল (${enToBnDigits(yD)} ${BENGALI_MONTHS[yM]})`,
        isSpecificDate: true
      },
      cleanedText: cleaned
    };
  }

  // 4. Day before yesterday: গত পরশু, গতপরশু, পরশুর, goto porshu, porshur, day before yesterday
  const porshuRegex = /(?:গত\s*পরশুর?|গতপরশুর?|পরশুর?|goto\s*porshur?|goto\s*porshu|porshur?|day\s*before\s*yesterday)/i;
  if (porshuRegex.test(clean)) {
    const pDate = new Date(referenceDate);
    pDate.setDate(pDate.getDate() - 2);
    const pDhaka = pDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    const [pY, pM, pD] = pDhaka.split('-').map(Number);
    const cleaned = clean.replace(porshuRegex, '').trim();
    return {
      dayDate: {
        date: makeDhakaDate(pY, pM, pD),
        dateLabelBn: `গত পরশু (${enToBnDigits(pD)} ${BENGALI_MONTHS[pM]})`,
        isSpecificDate: true
      },
      cleanedText: cleaned
    };
  }

  // 5. N days ago: e.g. "৩ দিন আগের", "3 din ager"
  const nDaysMatch = clean.match(/([০-৯0-9]+)\s*(?:দিন\s*আগের?|din\s*ager?)/i);
  if (nDaysMatch) {
    const daysAgo = parseInt(bnToEnDigits(nDaysMatch[1]), 10);
    if (!isNaN(daysAgo) && daysAgo > 0 && daysAgo <= 90) {
      const nDate = new Date(referenceDate);
      nDate.setDate(nDate.getDate() - daysAgo);
      const nDhaka = nDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      const [nY, nM, nD] = nDhaka.split('-').map(Number);
      const cleaned = clean.replace(nDaysMatch[0], '').trim();
      return {
        dayDate: {
          date: makeDhakaDate(nY, nM, nD),
          dateLabelBn: `${enToBnDigits(daysAgo)} দিন আগে (${enToBnDigits(nD)} ${BENGALI_MONTHS[nM]})`,
          isSpecificDate: true
        },
        cleanedText: cleaned
      };
    }
  }

  // 6. [Day] [Month] e.g. "10 oct", "10 october", "১০ অক্টোবর", "10th October"
  const dayMonthRegex = /(?:^|\s)([০-৯0-9]{1,2})\s*(?:th|st|nd|rd)?\s*(?:শে|ই|এ|এর)?\s*(জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|আগষ্ট|সেপ্টেম্বর|সেপ্টেম্বার|অক্টোবর|অক্টোবার|নভেম্বর|নভেম্বার|ডিসেম্বর|ডিসেম্বার|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s*(?:এর|এ|te|e|a))?(?:\s*([০-৯0-9]{4}))?/i;
  const dmMatch = clean.match(dayMonthRegex);
  if (dmMatch) {
    const day = parseInt(bnToEnDigits(dmMatch[1]), 10);
    const mNum = MONTH_MAP[dmMatch[2].toLowerCase()];
    let year = dmMatch[3] ? parseInt(bnToEnDigits(dmMatch[3]), 10) : refYear;
    if (day >= 1 && day <= 31 && mNum) {
      if (!dmMatch[3] && mNum > refMonth) {
        year = refYear - 1;
      }
      const cleaned = clean.replace(dmMatch[0], '').trim();
      return {
        dayDate: {
          date: makeDhakaDate(year, mNum, day),
          dateLabelBn: `${enToBnDigits(day)} ${BENGALI_MONTHS[mNum]}, ${enToBnDigits(year)}`,
          isSpecificDate: true
        },
        cleanedText: cleaned
      };
    }
  }

  // 7. [Month] [Day] e.g. "october 10", "অক্টোবর ১০"
  const monthDayRegex = /(?:^|\s)(জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|আগষ্ট|সেপ্টেম্বর|সেপ্টেম্বার|অক্টোবর|অক্টোবার|নভেম্বর|নভেম্বার|ডিসেম্বর|ডিসেম্বার|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s*([০-৯0-9]{1,2})(?:th|st|nd|rd)?(?:\s*(?:এর|এ|te|e|a))?(?:\s*([০-৯0-9]{4}))?/i;
  const mdMatch = clean.match(monthDayRegex);
  if (mdMatch) {
    const mNum = MONTH_MAP[mdMatch[1].toLowerCase()];
    const day = parseInt(bnToEnDigits(mdMatch[2]), 10);
    let year = mdMatch[3] ? parseInt(bnToEnDigits(mdMatch[3]), 10) : refYear;
    if (day >= 1 && day <= 31 && mNum) {
      if (!mdMatch[3] && mNum > refMonth) {
        year = refYear - 1;
      }
      const cleaned = clean.replace(mdMatch[0], '').trim();
      return {
        dayDate: {
          date: makeDhakaDate(year, mNum, day),
          dateLabelBn: `${enToBnDigits(day)} ${BENGALI_MONTHS[mNum]}, ${enToBnDigits(year)}`,
          isSpecificDate: true
        },
        cleanedText: cleaned
      };
    }
  }

  // 8. DD/MM or DD-MM or DD/MM/YYYY
  const slashDateMatch = clean.match(/(?:^|\s)([০-৯0-9]{1,2})[/-]([০-৯0-9]{1,2})(?:[/-]([০-৯0-9]{2,4}))?(?:\s*(?:এর|এ|te|e|a))?/i);
  if (slashDateMatch) {
    const day = parseInt(bnToEnDigits(slashDateMatch[1]), 10);
    const month = parseInt(bnToEnDigits(slashDateMatch[2]), 10);
    let year = slashDateMatch[3] ? parseInt(bnToEnDigits(slashDateMatch[3]), 10) : refYear;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const cleaned = clean.replace(slashDateMatch[0], '').trim();
      return {
        dayDate: {
          date: makeDhakaDate(year, month, day),
          dateLabelBn: `${enToBnDigits(day)} ${BENGALI_MONTHS[month]}, ${enToBnDigits(year)}`,
          isSpecificDate: true
        },
        cleanedText: cleaned
      };
    }
  }

  // 9. Day of this month: "১০ তারিখের খরচ", "10 tarikhe koto khoroc", "১০ তারিখ"
  const dateOnlyMatch = clean.match(/(?:^|\s)([০-৯0-9]{1,2})\s*(?:তারিখের?|তারিখে|tarikher?|tarikhe|tarikh)(?:\s*(?:এর|এ|te|e|a))?/i);
  if (dateOnlyMatch) {
    const day = parseInt(bnToEnDigits(dateOnlyMatch[1]), 10);
    if (day >= 1 && day <= 31) {
      const cleaned = clean.replace(dateOnlyMatch[0], ' ').trim();
      return {
        dayDate: {
          date: makeDhakaDate(refYear, refMonth, day),
          dateLabelBn: `${enToBnDigits(day)} ${BENGALI_MONTHS[refMonth]}, ${enToBnDigits(refYear)}`,
          isSpecificDate: true
        },
        cleanedText: cleaned
      };
    }
  }

  // 10. Today keywords explicitly: "আজ", "আজকে", "aj", "ajke", "ajker", "aaj", "aajke", "today"
  const todayRegex = /(?:^|\s)(?:আজকের?|আজকে?|ajker?|ajke?|aajker?|aajke?|\baj\b|\baaj\b|today)(?:[^\w\u0980-\u09FF]|$)/i;
  if (todayRegex.test(clean)) {
    const cleaned = clean.replace(todayRegex, ' ').trim();
    return {
      dayDate: {
        date: makeDhakaDate(refYear, refMonth, refDay),
        dateLabelBn: 'আজকের',
        isSpecificDate: false
      },
      cleanedText: cleaned
    };
  }

  return null;
};

/**
 * Clean unwanted prefixes from title
 */
const cleanTitleText = (raw: string): string => {
  return raw
    .replace(/^(?:আজ|আজকে|aj|ajke|কাল|গতকাল|গতকালের|পরশু|গত পরশু)\s+/i, '')
    .replace(/^(?:খরচ|khoroc|khoros|expense)\s*[:=]?\s*/i, '')
    .replace(/\s*(?:দিয়ে|দিলাম|দিয়া|dia|dilam|koresi|করলাম|হলো|holo|গেল|gelo)\s*$/i, '')
    .trim();
};

/**
 * Natural Language Expense Parser for WhatsApp (Zero AI Cost)
 */
export const parseExpenseInput = (text: string, referenceDate: Date = new Date()): ParsedExpense | null => {
  if (!text) return null;
  const clean = text.trim();

  // Extract any specific, past or relative date from the text
  const dateInfo = parseExpenseDate(clean, referenceDate);
  const textWithoutDate = dateInfo?.cleanedText !== undefined ? dateInfo.cleanedText : clean;

  // Check if text is an expense query
  const hasExpenseWord = /(?:খরচ|খরচের|khoroc|khoros|expense|expenses|হিসাব|hisab)/i.test(clean);
  const hasQueryWord = /(?:কত|koto|koro|মোট|mot|total|হয়েছে|হলো|holo|hoyeche|hoise|ছিল|chilo|দেখা|দেখাও|dekha|dekhao|লিস্ট|list|দাও|daw|dao|বলো|bolo|summary)/i.test(clean);
  const isDirectExpensePhrase = /^(?:আজকের|আজকে|আজ|aj|ajke|ajker|গতকাল|গতকালের|কালকের|gotokal|এই\s*মাসের|মাসের|চলতি\s*মাসের|last\s*month)?\s*(?:খরচ|khoroc|khoros|হিসাব|expense)\s*\??$/i.test(clean);

  const isQuery = (hasExpenseWord && (hasQueryWord || clean.endsWith('?'))) || isDirectExpensePhrase;

  // 1. Month Query (e.g. "গত মাসের খরচ কত", "সেপ্টেম্বর মাসের খরচ", "এই মাসের খরচ")
  if (dateInfo?.monthDate) {
    return {
      isQuery: true,
      queryType: 'monthly',
      monthYear: dateInfo.monthDate
    };
  }

  if (
    /(?:এই\s*মাসের|মাসের|চলতি\s*মাসের|month|monthly|maser|last\s*month)\s*(?:খরচ|khoroc|khoros|হিসাব)/i.test(clean) ||
    /^(?:মাসের\s*খরচ|এই\s*মাসের\s*খরচ|মাসের\s*হিসাব)$/i.test(clean)
  ) {
    return {
      isQuery: true,
      queryType: 'monthly'
    };
  }

  // 2. Specific Date / Yesterday / Day before yesterday Query
  if (isQuery && dateInfo?.dayDate && dateInfo.dayDate.isSpecificDate) {
    return {
      isQuery: true,
      queryType: 'daily',
      targetDate: dateInfo.dayDate.date,
      dateLabelBn: dateInfo.dayDate.dateLabelBn
    };
  }

  // 3. General or Today Query (e.g. "Aj mot koto khoros hoyeche?", "aj koto khoroc", "mot khoros koto", "খরচ কত")
  if (isQuery) {
    return {
      isQuery: true,
      queryType: 'daily',
      targetDate: dateInfo?.dayDate?.date,
      dateLabelBn: dateInfo?.dayDate?.dateLabelBn || 'আজকের'
    };
  }

  // 4. Backdated or Today Expense Logging: [Item] [Amount] e.g. "বাজার ৫০০ টাকা", "গতকাল বাজার ৫০০", "10 oct রিকশা ৬০"
  const targetText = textWithoutDate || clean;

  // Pattern 1: [Item/Category] [Amount] [টাকা/tk]? e.g. "বাজার ৫০০ টাকা", "রিকশা ৬০"
  const p1 = targetText.match(/^([a-zA-Z\u0980-\u09FF\s]+?)\s*[:=]?\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)?$/i);
  if (p1 && p1[1].trim().length >= 2) {
    const rawTitle = p1[1].trim();
    if (!/কখন|সময়|time|বাকি|তারিখ|date|ঘণ্টা|মিনিট|দিন|alarm|অ্যালার্ম/i.test(rawTitle)) {
      const amount = parseFloat(bnToEnDigits(p1[2]));
      if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
        return {
          isQuery: false,
          title: cleanTitleText(rawTitle),
          amount,
          paymentMethod: detectPaymentMethod(clean),
          expenseDate: dateInfo?.dayDate?.date,
          dateLabelBn: dateInfo?.dayDate?.dateLabelBn
        };
      }
    }
  }

  // Pattern 2: [Amount] টাকা [Item] e.g. "৫০০ টাকার বাজার", "১২০ টাকা লাঞ্চ"
  const p2 = targetText.match(/^([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)\s*(?:দিয়ে|dia|ar)?\s*([a-zA-Z\u0980-\u09FF\s]+)$/i);
  if (p2 && p2[2].trim().length >= 2) {
    const amount = parseFloat(bnToEnDigits(p2[1]));
    const rawTitle = p2[2].trim();
    if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
      return {
        isQuery: false,
        title: cleanTitleText(rawTitle),
        amount,
        paymentMethod: detectPaymentMethod(clean),
        expenseDate: dateInfo?.dayDate?.date,
        dateLabelBn: dateInfo?.dayDate?.dateLabelBn
      };
    }
  }

  // Pattern 3: 'খরচ [Item] [Amount]' e.g. 'খরচ বাজার ৫০০'
  const p3 = targetText.match(/^(?:খরচ|expense|khoroc|khoros)\s*[:=]?\s*([a-zA-Z\u0980-\u09FF\s]+?)\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকা|tk|taka)?$/i);
  if (p3 && p3[1].trim().length >= 2) {
    const rawTitle = p3[1].trim();
    const amount = parseFloat(bnToEnDigits(p3[2]));
    if (!isNaN(amount) && amount > 0 && amount <= 10000000) {
      return {
        isQuery: false,
        title: cleanTitleText(rawTitle),
        amount,
        paymentMethod: detectPaymentMethod(clean),
        expenseDate: dateInfo?.dayDate?.date,
        dateLabelBn: dateInfo?.dayDate?.dateLabelBn
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
/**
 * Get Expense Summary for a specific Date (with Asia/Dhaka day boundaries)
 */
export const getExpenseSummaryForDate = async (
  userId: string | mongoose.Types.ObjectId,
  targetDate: Date = new Date(),
  dateLabelBn: string = 'আজকের'
) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"
  const startOfDay = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
  const endOfDay = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);

  // Target date expenses
  const dateExpenses = await Expense.find({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ date: -1 });

  const dateTotal = dateExpenses.reduce((sum, item) => sum + item.amount, 0);

  // Month total for context (month of targetDate)
  const [yearStr, monthStr] = dhakaDateStr.split('-');
  const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+06:00`);
  const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const endOfMonth = new Date(`${yearStr}-${monthStr}-${pad(lastDay)}T23:59:59.999+06:00`);

  const monthExpenses = await Expense.find({
    userId,
    date: { $gte: startOfMonth, $lte: endOfMonth }
  });
  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0);

  return {
    dateExpenses,
    dateTotal,
    dateCount: dateExpenses.length,
    monthTotal,
    dateLabelBn,
    dateStr: dhakaDateStr
  };
};

/**
 * Get Expense Summary for a specific Month
 */
export const getExpenseSummaryForMonth = async (
  userId: string | mongoose.Types.ObjectId,
  year: number,
  month: number,
  monthLabelBn: string = 'চলতি মাসের'
) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const startOfMonth = new Date(`${year}-${pad(month)}-01T00:00:00.000+06:00`);
  const lastDay = new Date(year, month, 0).getDate();
  const endOfMonth = new Date(`${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999+06:00`);

  const monthExpenses = await Expense.find({
    userId,
    date: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({ date: -1 });

  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0);

  // Category-wise distribution
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
    monthTotal,
    monthCount: monthExpenses.length,
    categoryBreakdown,
    monthLabelBn
  };
};

/**
 * Get Expense Summary for a User (Today & This Month - Web API compatibility)
 */
export const getExpenseSummary = async (userId: string | mongoose.Types.ObjectId, targetDate: Date = new Date()) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"
  const startOfToday = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
  const endOfToday = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);

  // Start of current month in Dhaka
  const [yearStr, monthStr] = dhakaDateStr.split('-');
  const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+06:00`);

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
  dayTotal: number,
  monthTotal: number,
  dateLabelBn?: string
): string => {
  const isBackdated = dateLabelBn && !dateLabelBn.includes('আজ');
  return `✅ *খরচ যুক্ত হয়েছে!*\n` +
         `${category.icon} *খাত:* ${title} (${category.nameBn})\n` +
         `💰 *পরিমাণ:* ${formatTaka(amount)}\n` +
         (isBackdated ? `📅 *তারিখ:* ${dateLabelBn}\n` : '') +
         `\n📊 *${dateLabelBn || 'আজকের'} মোট খরচ:* ${formatTaka(dayTotal)}\n` +
         `📅 *চলতি মাসের মোট:* ${formatTaka(monthTotal)}\n\n` +
         `💡 হিসাব দেখতে লিখুন: "${isBackdated ? 'গতকালের' : 'আজকের'} খরচ কত"`;
};

/**
 * Format Response Message for Daily Query (Today, Yesterday, Specific Date)
 */
export const buildDailyExpenseQueryMessage = (
  expenses: IExpense[],
  total: number,
  monthTotal: number,
  dateLabelBn: string = 'আজকের'
): string => {
  const label = dateLabelBn.includes('আজ') ? 'আজকের' : dateLabelBn;

  if (expenses.length === 0) {
    return `📝 *${label} খরচের হিসাব খাতা*\n\n` +
           `ওই তারিখে আপনার কোনো খরচ রেকর্ড করা ছিল না।\n\n` +
           `💡 খরচ যোগ করতে লিখুন, যেমন: "${label.includes('গত') ? 'গতকাল' : 'আজ'} বাজার ৫০০ টাকা"`;
  }

  const itemsList = expenses
    .map((e, idx) => {
      const cat = detectExpenseCategory(e.title);
      return `${enToBnDigits(idx + 1)}. ${cat.icon} ${e.title}: *${formatTaka(e.amount)}*`;
    })
    .join('\n');

  return `📊 *${label} খরচের হিসাব খাতা*\n\n` +
         `${itemsList}\n\n` +
         `──────────────\n` +
         `💵 *ওই দিনের মোট:* ${formatTaka(total)} (${enToBnDigits(expenses.length)}টি এন্ট্রি)\n` +
         `📅 *চলতি মাসের মোট:* ${formatTaka(monthTotal)}\n\n` +
         `🌐 বিস্তারিত খাতা: https://smritilife.com/app/expenses`;
};

/**
 * Format Response Message for Monthly Query (This Month, Last Month, Specific Month)
 */
export const buildMonthlyExpenseQueryMessage = (
  monthTotal: number,
  monthCount: number,
  categoryBreakdown: Array<{ nameBn: string; icon: string; amount: number; percentage: number }>,
  monthLabelBn: string = 'চলতি মাসের'
): string => {
  if (monthCount === 0) {
    return `📅 *${monthLabelBn} খরচের হিসাব:*\n\nএই মাসে এখনও কোনো খরচ এন্ট্রি নেই।\n\n💡 খরচ যোগ করতে লিখুন: যেমন "লাঞ্চ ১২০ টাকা"`;
  }

  const breakdownList = categoryBreakdown
    .map(c => `• ${c.icon} ${c.nameBn}: *${formatTaka(c.amount)}* (${enToBnDigits(c.percentage)}%)`)
    .join('\n');

  return `📅 *${monthLabelBn} খরচের সারাংশ*\n\n` +
         `💰 *মোট খরচ:* ${formatTaka(monthTotal)} (${enToBnDigits(monthCount)}টি এন্ট্রি)\n\n` +
         `📊 *খাতভিত্তিক বিভাজন:*\n` +
         `${breakdownList}\n\n` +
         `🌐 সম্পূর্ণ গ্রাফ ও খাতা দেখতে: https://smritilife.com/app/expenses`;
};

