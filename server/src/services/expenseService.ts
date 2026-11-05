import Expense, { IExpense } from '../models/Expense';
import mongoose from 'mongoose';

export interface ParsedExpense {
  isQuery: boolean;
  queryType?: 'daily' | 'monthly' | 'range';
  targetDate?: Date;
  dateLabelBn?: string;
  monthYear?: { year: number; month: number; monthLabelBn: string };
  rangeDays?: { days: number; startDate: Date; endDate: Date; labelBn: string };
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
      'dinner', 'breakfast', 'tea', 'coffee', 'food', 'bazar', 'bazaar', 'gorur mangsho', 'murgi', 'khabar',
      'khawar', 'nasta', 'nashta', 'biriyani', 'biryani', 'cha', 'sobji', 'mach', 'mangsho', 'dim', 'dudh',
      'fol', 'ruti', 'paratha', 'porota', 'hotel', 'restaurant', 'fastfood', 'burger', 'pizza', 'fuchka',
      'chotpoti', 'misti', 'mishti', 'chal', 'dal'
    ]
  },
  {
    id: 'transport',
    nameBn: 'যাতায়াত',
    icon: '🚗',
    keywords: [
      'রিকশা', 'রিক্সা', 'বাস', 'ভাড়া', 'ভাড়া', 'ট্রেন', 'সিএনজি', 'উবার', 'পাঠাও', 'বাইক', 'পেট্রোল',
      'অকটেন', 'গ্যাস', 'ডিজেল', 'টিকিট', 'টোল', 'মেট্রো', 'মেট্রোরেল', 'metro', 'uber', 'pathao', 'cng',
      'bus', 'rickshaw', 'riksha', 'riksa', 'ricksha', 'vara', 'bhara', 'bara', 'auto', 'oto', 'laguna',
      'leguna', 'launch', 'boat', 'octane', 'petrol', 'diesel', 'train', 'ticket', 'fare', 'toll'
    ]
  },
  {
    id: 'health',
    nameBn: 'ওষুধ ও চিকিৎসা',
    icon: '💊',
    keywords: [
      'ওষুধ', 'ঔষধ', 'ডাক্তার', 'টেস্ট', 'ক্লিনিক', 'হাসপাতাল', 'ফার্মেসি', 'ডেন্টাল', 'চশমা', 'স্যালাইন',
      'ফি', 'প্রেসক্রিপশন', 'medicine', 'medecin', 'medecine', 'medisin', 'medicne', 'osud', 'oshud',
      'oushud', 'osudh', 'oshudh', 'daktar', 'doctor', 'hospital', 'pharmacy', 'pharma', 'test', 'clinic',
      'saline', 'xray', 'x-ray'
    ]
  },
  {
    id: 'bills',
    nameBn: 'ইউটিলিটি ও বিল',
    icon: '💡',
    keywords: [
      'বিল', 'বিদ্যুৎ', 'কারেন্ট', 'কারেন্ট বিল', 'বিদ্যুৎ বিল', 'গ্যাস বিল', 'পানি বিল', 'ওয়াইফাই', 'ইন্টারনেট',
      'নেট বিল', 'বাড়ি ভাড়া', 'বাসা ভাড়া', 'রুম ভাড়া', 'ডিশ বিল', 'মোবাইল রিচার্জ', 'রিচার্জ', 'টপআপ', 'bill',
      'bil', 'wifi', 'electricity', 'current', 'bidyut', 'biddut', 'current bill', 'gas bill', 'water bill',
      'pani', 'rent', 'basa vara', 'basha vara', 'bari vara', 'room vara', 'mess vara', 'recharge', 'topup',
      'internet', 'net', 'mb', 'dish'
    ]
  },
  {
    id: 'shopping',
    nameBn: 'কেনাকাটা',
    icon: '🛍️',
    keywords: [
      'জামা', 'কাপড়', 'জুতা', 'জুতো', 'প্যান্ট', 'শার্ট', 'পাঞ্জাবি', 'ব্যাগ', 'কসমেটিকস', 'শপিং', 'ড্রেস',
      'টি-শার্ট', 'ঘড়ি', 'shopping', 'cloth', 'shirt', 'pant', 'shoes', 'cosmetics', 'watch', 'jama', 'kapor',
      'juta', 'juto', 'panjabi', 'bag', 'dress', 'tshirt', 't-shirt', 'ghori', 'shari', 'saree'
    ]
  },
  {
    id: 'education',
    nameBn: 'শিক্ষা',
    icon: '📚',
    keywords: [
      'বই', 'খাতা', 'কলম', 'টিউশন', 'বেতন', 'কোচিং', 'কলেজ ফি', 'স্কুল ফি', 'ভার্সিটি ফি', 'পরীক্ষার ফি',
      'book', 'tuition', 'tution', 'school fee', 'college fee', 'exam fee', 'boi', 'khata', 'kolom', 'pen',
      'coaching', 'beton'
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
  'জানুয়ারি': 1, 'জানুয়ারি': 1, 'জানুয়ারির': 1, 'জানুয়ারির': 1,
  'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারির': 2, 'ফেব্রুয়ারির': 2,
  'মার্চ': 3, 'মার্চের': 3,
  'এপ্রিল': 4, 'এপ্রিলের': 4,
  'মে': 5,
  'জুন': 6, 'জুনের': 6,
  'জুলাই': 7, 'জুলাইয়ের': 7, 'জুলাইয়ের': 7, 'জুলাইর': 7,
  'আগস্ট': 8, 'আগষ্ট': 8, 'আগস্টের': 8, 'আগষ্টের': 8,
  'সেপ্টেম্বর': 9, 'সেপ্টেম্বার': 9, 'সেপ্টেম্বরের': 9, 'সেপ্টেম্বারের': 9,
  'অক্টোবর': 10, 'অক্টোবার': 10, 'অক্টোবরের': 10, 'অক্টোবারের': 10,
  'নভেম্বর': 11, 'নভেম্বার': 11, 'নভেম্বরের': 11, 'নভেম্বারের': 11,
  'ডিসেম্বর': 12, 'ডিসেম্বার': 12, 'ডিসেম্বরের': 12, 'ডিসেম্বারের': 12,
  // English / Banglish (including common phonetic spellings like octobor, novembor, septembor, agost)
  'january': 1, 'jan': 1, 'januyari': 1, 'januari': 1, 'januvari': 1, 'januaryr': 1,
  'february': 2, 'feb': 2, 'februari': 2, 'februvari': 2, 'februaryr': 2,
  'march': 3, 'mar': 3, 'marcher': 3,
  'april': 4, 'apr': 4, 'epril': 4, 'apriler': 4,
  'may': 5,
  'june': 6, 'jun': 6, 'juner': 6,
  'july': 7, 'jul': 7, 'julai': 7, 'julyr': 7,
  'august': 8, 'aug': 8, 'agost': 8, 'agust': 8, 'ogost': 8, 'auguster': 8,
  'september': 9, 'sep': 9, 'sept': 9, 'septembor': 9, 'septembar': 9, 'septemberer': 9,
  'october': 10, 'oct': 10, 'octobor': 10, 'octobar': 10, 'oktobor': 10, 'oktober': 10, 'octoberer': 10, 'octoborer': 10,
  'november': 11, 'nov': 11, 'novembor': 11, 'novembar': 11, 'nobhembor': 11, 'novemberer': 11, 'novemborer': 11,
  'december': 12, 'dec': 12, 'decembor': 12, 'decembar': 12, 'disembor': 12, 'decemberer': 12, 'decemborer': 12
};

const MONTH_NAMES_PATTERN = Object.keys(MONTH_MAP)
  .sort((a, b) => b.length - a.length)
  .join('|');

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
  rangeDays?: {
    days: number;
    startDate: Date;
    endDate: Date;
    labelBn: string;
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

  // 1. Specific [Day] [Month] e.g. "10 oct", "10 october", "১০ অক্টোবর", "14 octobor"
  const dayMonthRegex = new RegExp(
    `(?:^|\\s)([০-৯0-9]{1,2})\\s*(?:th|st|nd|rd)?\\s*(?:শে|ই|এ|এর|তারিখ|তারিখের|tarikh|tarik)?\\s*(?:of\\s*)?(${MONTH_NAMES_PATTERN})(?:\\s*(?:মাসের?|maser?|mas\\s*(?:ar|er))?)?(?:\\s*(?:এর|এ|te|e|a|ar|er))?(?:\\s*([০-৯0-9]{4}))?(?=\\s|$|[?।!])`,
    'i'
  );
  const dmMatch = clean.match(dayMonthRegex);
  if (dmMatch) {
    const day = parseInt(bnToEnDigits(dmMatch[1]), 10);
    const mNum = MONTH_MAP[dmMatch[2].toLowerCase()];
    let year = dmMatch[3] ? parseInt(bnToEnDigits(dmMatch[3]), 10) : refYear;
    if (day >= 1 && day <= 31 && mNum) {
      if (!dmMatch[3] && mNum > refMonth) {
        year = refYear - 1;
      }
      const cleaned = clean.replace(dmMatch[0], ' ').trim();
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

  // 2. Specific [Month] [Day] e.g. "october 10", "অক্টোবর ১০", "octobor ar 10 tarikh"
  const monthDayRegex = new RegExp(
    `(?:^|\\s)(${MONTH_NAMES_PATTERN})\\s*(?:মাসের?|maser?|month)?\\s*(?:এর|এ|ar|er|of)?\\s*([০-৯0-9]{1,2})(?:th|st|nd|rd)?\\s*(?:তারিখ|তারিখের|তারিখে|tarikh|tarik|tarikher|tarikhe)?(?:\\s*(?:এর|এ|te|e|a|ar|er))?(?:\\s*([০-৯0-9]{4}))?(?=\\s|$|[?।!])`,
    'i'
  );
  const mdMatch = clean.match(monthDayRegex);
  if (mdMatch) {
    const mNum = MONTH_MAP[mdMatch[1].toLowerCase()];
    const day = parseInt(bnToEnDigits(mdMatch[2]), 10);
    let year = mdMatch[3] ? parseInt(bnToEnDigits(mdMatch[3]), 10) : refYear;
    if (day >= 1 && day <= 31 && mNum) {
      if (!mdMatch[3] && mNum > refMonth) {
        year = refYear - 1;
      }
      const cleaned = clean.replace(mdMatch[0], ' ').trim();
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

  // 3. Last Month: "গত মাস", "গত মাসের", "আগের মাসের", "last month", "last mas ar", "goto mas er"
  const lastMonthRegex = /(?:(?:গত|আগের|বিগত)\s*মাস(?:ের|ে)?(?:\s*এর)?|(?:last|previous|prev|goto|ager|bigoto)\s*(?:months?|mas(?:er|e)?|mash(?:er|e)?)(?:\s*(?:ar|er|a|e))?)/i;
  if (lastMonthRegex.test(clean)) {
    let prevMonth = refMonth - 1;
    let prevYear = refYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const cleaned = clean.replace(lastMonthRegex, ' ').trim();
    return {
      monthDate: {
        year: prevYear,
        month: prevMonth,
        monthLabelBn: `গত মাস (${BENGALI_MONTHS[prevMonth]} ${enToBnDigits(prevYear)})`
      },
      cleanedText: cleaned
    };
  }

  // 4. This / Current Month: "এই মাসের", "চলতি মাসের", "ay mas ar", "ei mas er", "ai maser", "this month"
  const thisMonthRegex = /(?:(?:এই|এ|চলতি|বর্তমান)\s*মাস(?:ের|ে)?(?:\s*এর)?|(?:ay|ai|ei|a|this|current|cholti|colti|bortoman)\s*(?:months?|mas(?:er|e)?|mash(?:er|e)?)(?:\s*(?:ar|er|a|e))?)/i;
  if (thisMonthRegex.test(clean)) {
    const cleaned = clean.replace(thisMonthRegex, ' ').trim();
    return {
      monthDate: {
        year: refYear,
        month: refMonth,
        monthLabelBn: `চলতি মাস (${BENGALI_MONTHS[refMonth]} ${enToBnDigits(refYear)})`
      },
      cleanedText: cleaned
    };
  }

  // 5. Specific Month (without day): e.g. "সেপ্টেম্বর মাসের খরচ", "octobor ar khoros koto", "অক্টোবরের খরচ দাও", "novembor ar hisab"
  const monthOnlyRegex = new RegExp(
    `(?:^|\\s)(${MONTH_NAMES_PATTERN})(?:\\s*([০-৯0-9]{4}))?\\s*(?:মাসের?|মাসে|mas(?:er)?|mash(?:er)?|month)?(?:\\s*(?:এর|এ|ar|er|te|e|a|of))?(?=\\s|$|[?।!])`,
    'i'
  );
  const monthMatch = clean.match(monthOnlyRegex);
  if (monthMatch) {
    const matchedMonthWord = monthMatch[1].toLowerCase();
    // Avoid matching English "may" unless expense/month context is present
    if (matchedMonthWord !== 'may' || /(?:month|mas|mash|মাস|খরচ|khoroc|khoros|khoroch|cost|expense|হিসাব|hisab)/i.test(clean)) {
      const mNum = MONTH_MAP[matchedMonthWord];
      if (mNum) {
        let mYear = monthMatch[2] ? parseInt(bnToEnDigits(monthMatch[2]), 10) : refYear;
        if (!monthMatch[2] && mNum > refMonth) {
          mYear = refYear - 1;
        }
        const cleaned = clean.replace(monthMatch[0], ' ').trim();
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
  }

  // 5.5. Week Range: e.g. "এই সপ্তাহের খরচ", "গত সপ্তাহের খরচ", "last week ar khoros", "this week cost"
  const weekMatch = clean.match(/(?:(?:এই|গত|বিগত|আগের)\s*সপ্তাহ(?:ের|ে)?|(?:this|last|past|goto|ay|ai|ei)\s*(?:weeks?|soptah(?:er|o)?|shoptah(?:er|o)?)(?:\s*(?:ar|er))?)/i);
  if (weekMatch) {
    const startRef = new Date(referenceDate);
    startRef.setDate(startRef.getDate() - 6);
    const startDhaka = startRef.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    const startDate = new Date(`${startDhaka}T00:00:00.000+06:00`);
    const endDate = new Date(`${dhakaStr}T23:59:59.999+06:00`);
    const cleaned = clean.replace(weekMatch[0], ' ').trim();
    return {
      rangeDays: {
        days: 7,
        startDate,
        endDate,
        labelBn: 'গত ৭ দিনের (সপ্তাহের)'
      },
      cleanedText: cleaned
    };
  }

  // 5.6. Multi-day Range: e.g. "last 2 din ar khoros koto", "গত ২ দিনের খরচ", "last 7 days cost", "বিগত ৩ দিনের হিসাব"
  const rangeMatch =
    clean.match(/(?:last|past|goto|গত|বিগত|আগের)\s*([০-৯0-9]+)\s*(?:দিনের?|din\s*(?:er|ar|e)?|diner|days?(?:\s*of)?)(?:\s*(?:এর|এ|ar|er))?/i) ||
    clean.match(/(?:^|\s)([০-৯0-9]+)\s*(?:দিনের|din\s*(?:er|ar)|diner|days?\s*of)(?:\s*(?:এর|এ|ar|er))?/i);
  if (rangeMatch && !/(?:দিন\s*আগের?|din\s*ager?|days?\s*ago)/i.test(clean)) {
    const daysCount = parseInt(bnToEnDigits(rangeMatch[1]), 10);
    if (!isNaN(daysCount) && daysCount >= 1 && daysCount <= 90) {
      const startRef = new Date(referenceDate);
      startRef.setDate(startRef.getDate() - (daysCount - 1));
      const startDhaka = startRef.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      const startDate = new Date(`${startDhaka}T00:00:00.000+06:00`);
      const endDate = new Date(`${dhakaStr}T23:59:59.999+06:00`);
      const cleaned = clean.replace(rangeMatch[0], ' ').trim();
      return {
        rangeDays: {
          days: daysCount,
          startDate,
          endDate,
          labelBn: `গত ${enToBnDigits(daysCount)} দিনের`
        },
        cleanedText: cleaned
      };
    }
  }

  // 6. Yesterday: গতকাল, গত কাল, কালকের, gotokal, gotokalker, gotokaler, kotokalker, koto kalker, kalker, yesterday
  const yesterdayRegex = /(?:গত\s*কাল(?:কের?|ের)?|গতকাল(?:কের?|ের)?|কালকের?|(?:goto|koto)\s*ka?l(?:ker?|er)?|(?:gotoka?l|kotoka?l)(?:ker?|er)?|kalke?r|yesterday(?:'s)?)/i;
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

  // 7. Day before yesterday: গত পরশু, গতপরশু, পরশুর, goto porshu, porshur, day before yesterday
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

  // 8. N days ago: e.g. "৩ দিন আগের", "3 din ager"
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

  // 9. DD/MM or DD-MM or DD/MM/YYYY
  const slashDateMatch = clean.match(/(?:^|\s)([০-৯0-9]{1,2})[/-]([০-৯0-9]{1,2})(?:[/-]([০-৯0-9]{2,4}))?(?:\s*(?:এর|এ|te|e|a|ar|er))?/i);
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

const BANGLISH_PHRASE_TO_BANGLA: Array<[RegExp, string]> = [
  [/\b(?:riksha|rickshaw|riksa|ricksha)\s*(?:vara|bhara|bara|fare)\b/gi, 'রিকশা ভাড়া'],
  [/\b(?:auto|oto)\s*(?:vara|bhara|bara|fare)\b/gi, 'অটো ভাড়া'],
  [/\bcng\s*(?:vara|bhara|bara|fare)\b/gi, 'সিএনজি ভাড়া'],
  [/\b(?:bus|bas)\s*(?:vara|bhara|bara|fare|ticket|tikit)\b/gi, 'বাস ভাড়া'],
  [/\b(?:train|tren)\s*(?:vara|bhara|bara|fare|ticket|tikit)\b/gi, 'ট্রেন ভাড়া'],
  [/\b(?:leguna|laguna)\s*(?:vara|bhara|bara|fare)\b/gi, 'লেগুনা ভাড়া'],
  [/\b(?:basa|basha|bari|house)\s*(?:vara|bhara|bara|rent)\b/gi, 'বাসা ভাড়া'],
  [/\b(?:room|rum)\s*(?:vara|bhara|bara|rent)\b/gi, 'রুম ভাড়া'],
  [/\bmess\s*(?:vara|bhara|bara|rent)\b/gi, 'মেস ভাড়া'],
  [/\b(?:current|bidyut|biddut|electric|electricity)\s*(?:bill|bil)\b/gi, 'বিদ্যুৎ বিল'],
  [/\bgas\s*(?:bill|bil)\b/gi, 'গ্যাস বিল'],
  [/\b(?:pani|water)\s*(?:bill|bil)\b/gi, 'পানি বিল'],
  [/\b(?:wifi|internet|net)\s*(?:bill|bil)\b/gi, 'ওয়াইফাই বিল'],
  [/\bdish\s*(?:bill|bil)\b/gi, 'ডিশ বিল'],
  [/\b(?:mobile|phone|sim)?\s*(?:recharge|flexiload|topup)\b/gi, 'মোবাইল রিচার্জ'],
  [/\b(?:kacha|kancha)\s*(?:bazar|bazaar)\b/gi, 'কাঁচা বাজার'],
  [/\b(?:sokaler|shokaler)\s*(?:nasta|nashta|khabar)\b/gi, 'সকালের নাস্তা'],
  [/\b(?:bikaler|bikal)\s*(?:nasta|nashta)\b/gi, 'বিকালের নাস্তা'],
  [/\b(?:dupurer|dupur)\s*(?:khabar|khawar|lunch)\b/gi, 'দুপুরের খাবার'],
  [/\b(?:rater|raater)\s*(?:khabar|khawar|dinner)\b/gi, 'রাতের খাবার'],
  [/\b(?:gorur|goru)\s*(?:mangsho|mangso|goshto)\b/gi, 'গরুর মাংস'],
  [/\b(?:khashir|khashi)\s*(?:mangsho|mangso|goshto)\b/gi, 'খাসির মাংস'],
  [/\b(?:murgir|murgi)\s*(?:mangsho|mangso|goshto)\b/gi, 'মুরগির মাংস'],
  [/\b(?:school|skul)\s*(?:fee|fees|beton)\b/gi, 'স্কুল ফি'],
  [/\bcollege\s*(?:fee|fees|beton)\b/gi, 'কলেজ ফি'],
  [/\b(?:tuition|tution)\s*(?:fee|fees|beton)?\b/gi, 'টিউশন ফি'],
  [/\bcoaching\s*(?:fee|fees|beton)?\b/gi, 'কোচিং ফি'],
  [/\b(?:chul\s*kata|hair\s*cut|haircut)\b/gi, 'চুল কাটা'],
  [/\b(?:ice\s*cream|icecream)\b/gi, 'আইসক্রিম'],
  [/\b(?:t-shirt|tshirt)\b/gi, 'টি-শার্ট']
];

const BANGLISH_WORD_TO_BANGLA: Record<string, string> = {
  // Transport
  riksha: 'রিকশা', rickshaw: 'রিকশা', riksa: 'রিকশা', ricksha: 'রিকশা',
  vara: 'ভাড়া', bhara: 'ভাড়া', bara: 'ভাড়া', fare: 'ভাড়া',
  auto: 'অটো', oto: 'অটো', cng: 'সিএনজি', bus: 'বাস', bas: 'বাস',
  train: 'ট্রেন', metro: 'মেট্রোরেল', uber: 'উবার', pathao: 'পাঠাও',
  leguna: 'লেগুনা', laguna: 'লেগুনা', bike: 'বাইক', petrol: 'পেট্রোল',
  octane: 'অকটেন', okten: 'অকটেন', diesel: 'ডিজেল', ticket: 'টিকিট', tikit: 'টিকিট', toll: 'টোল',
  // Health
  medicine: 'ওষুধ', medecin: 'ওষুধ', medecine: 'ওষুধ', medisin: 'ওষুধ', medicne: 'ওষুধ',
  osud: 'ওষুধ', oshud: 'ওষুধ', oushud: 'ওষুধ', osudh: 'ওষুধ', oshudh: 'ওষুধ',
  daktar: 'ডাক্তার', dakter: 'ডাক্তার', doctor: 'ডাক্তার', dr: 'ডাক্তার', hospital: 'হাসপাতাল',
  clinic: 'ক্লিনিক', pharmacy: 'ফার্মেসি', pharma: 'ফার্মেসি', test: 'টেস্ট',
  saline: 'স্যালাইন', choshma: 'চশমা', dekhano: 'দেখানো', dekhate: 'দেখাতে', checkup: 'চেকআপ',
  babot: 'বাবদ', babod: 'বাবদ', jonno: 'জন্য', jonne: 'জন্য', kena: 'কেনা', vara_babot: 'ভাড়া বাবদ',
  // Food & Grocery
  bazar: 'বাজার', bazaar: 'বাজার', khabar: 'খাবার', khawar: 'খাবার', food: 'খাবার',
  nasta: 'নাস্তা', nashta: 'নাস্তা', breakfast: 'নাস্তা',
  lunch: 'লাঞ্চ', dinner: 'ডিনার',
  cha: 'চা', tea: 'চা', coffee: 'কফি', kofi: 'কফি',
  biriyani: 'বিরিয়ানি', biryani: 'বিরিয়ানি', kacchi: 'কাচ্চি', tehari: 'তেহারি', khichuri: 'খিচুড়ি',
  bhat: 'ভাত', vat: 'ভাত', ruti: 'রুটি', porota: 'পরোটা', paratha: 'পরোটা',
  mach: 'মাছ', fish: 'মাছ', mangsho: 'মাংস', mangso: 'মাংস', meat: 'মাংস',
  murgi: 'মুরগি', chicken: 'চিকেন', beef: 'গরুর মাংস', mutton: 'খাসির মাংস',
  dim: 'ডিম', egg: 'ডিম', dudh: 'দুধ', milk: 'দুধ',
  sobji: 'সবজি', shobji: 'সবজি', fol: 'ফল', fruit: 'ফল', fruits: 'ফল',
  chal: 'চাল', rice: 'চাল', dal: 'ডাল', tel: 'তেল', oil: 'তেল',
  chini: 'চিনি', sugar: 'চিনি', lobon: 'লবণ', salt: 'লবণ',
  peyaj: 'পেঁয়াজ', piyaj: 'পেঁয়াজ', alu: 'আলু', aloo: 'আলু',
  roshun: 'রসুন', ada: 'আদা', mosla: 'মসলা', moshla: 'মসলা',
  misti: 'মিষ্টি', mishti: 'মিষ্টি', fuchka: 'ফুচকা', chotpoti: 'চটপটি',
  singara: 'সিঙ্গারা', shingara: 'সিঙ্গারা', samucha: 'সমুচা', samosa: 'সমুচা',
  burger: 'বার্গার', pizza: 'পিজ্জা', biscuit: 'বিস্কুট', biskut: 'বিস্কুট',
  cake: 'কেক', juice: 'জুস', pani: 'পানি', water: 'পানি',
  hotel: 'হোটেল', restaurant: 'রেস্টুরেন্ট',
  // Bills
  bill: 'বিল', bil: 'বিল', wifi: 'ওয়াইফাই', internet: 'ইন্টারনেট', net: 'ইন্টারনেট',
  current: 'বিদ্যুৎ বিল', bidyut: 'বিদ্যুৎ', biddut: 'বিদ্যুৎ', electricity: 'বিদ্যুৎ বিল',
  gas: 'গ্যাস', rent: 'ভাড়া', recharge: 'রিচার্জ', mb: 'ডাটা প্যাক', dish: 'ডিশ বিল',
  // Shopping
  shopping: 'কেনাকাটা', kenakata: 'কেনাকাটা', jama: 'জামা', kapor: 'কাপড়', cloth: 'কাপড়',
  shirt: 'শার্ট', pant: 'প্যান্ট', panjabi: 'পাঞ্জাবি', shari: 'শাড়ি', saree: 'শাড়ি',
  dress: 'ড্রেস', juta: 'জুতা', juto: 'জুতা', shoes: 'জুতা', shoe: 'জুতা',
  sandal: 'স্যান্ডেল', bag: 'ব্যাগ', ghori: 'ঘড়ি', watch: 'ঘড়ি',
  cosmetics: 'কসমেটিকস', shaban: 'সাবান', soap: 'সাবান', shampoo: 'শ্যাম্পু',
  paste: 'টুথপেস্ট', toothpaste: 'টুথপেস্ট', saloon: 'সেলুন', salon: 'সেলুন',
  // Education & Entertainment
  boi: 'বই', book: 'বই', khata: 'খাতা', kolom: 'কলম', pen: 'কলম',
  tuition: 'টিউশন', tution: 'টিউশন', coaching: 'কোচিং', beton: 'বেতন', fee: 'ফি', fees: 'ফি',
  gift: 'উপহার', upohar: 'উপহার', movie: 'সিনেমা', cinema: 'সিনেমা',
  tour: 'ভ্রমণ', party: 'পার্টি', dan: 'দান', donation: 'দান'
};

/**
 * Convert Banglish / English expense item title into clean Bengali script
 */
export const toBanglaExpenseTitle = (raw: string): string => {
  if (!raw) return '';
  let text = raw
    .trim()
    .replace(/^(?:আজকের?|আজকে?|আজ|aj|ajke|ajker|কালকের?|কালকে?|কাল|গতকালকের?|গতকালের?|গতকাল|পরশু|গত\s*পরশু|আমি|আমার|ami|amar)\s+/i, '')
    .replace(/^(?:খরচ|খরচা|ব্যয়|ব্যায়|khoroch|khoroc|khoros|expense|cost)\s*[:=-]?\s*/i, '')
    .replace(/\s+(?:দিয়েছি|দিয়েছে|দিলাম|দিয়া|দিয়ে|কিনেছি|কিনেছে|কিনলাম|কিনসি|কেনা\s*হয়েছে|কেনা\s*হলো|কেনা|করেছি|করলাম|হয়েছে|হইছে|হলো|হল|গেল|গেলো|বাবদ|খরচ\s*হয়েছে|খরচ\s*হলো|খরচ|খরচা|dia|dilam|diyechi|diye|kinechi|kineche|kinesi|kinlam|kena\s*hoyeche|kena|koresi|korlam|hoyeche|hoise|holo|gelo|babod|babot|khoroch\s*hoyeche|khoros\s*hoyeche|khoroch|khoroc|khoros|khoroa|cost|costs|expense|expenses)\s*$/i, '')
    .trim();

  if (!text) text = raw.trim();

  // Apply multi-word phrase replacements first
  for (const [pattern, replacement] of BANGLISH_PHRASE_TO_BANGLA) {
    text = text.replace(pattern, replacement);
  }

  // Apply word-by-word replacements for any remaining Latin words
  text = text
    .split(/\s+/)
    .map(token => {
      const cleanToken = token.toLowerCase().replace(/[^a-z]/g, '');
      if (cleanToken && BANGLISH_WORD_TO_BANGLA[cleanToken]) {
        return BANGLISH_WORD_TO_BANGLA[cleanToken];
      }
      return token;
    })
    .join(' ')
    .trim();

  return text;
};

/**
 * Clean unwanted prefixes and action verbs from expense title and convert Banglish to Bangla
 */
const cleanTitleText = (raw: string): string => {
  return toBanglaExpenseTitle(raw);
};

/**
 * Natural Language Expense Parser for WhatsApp (Zero AI Cost)
 */
export const parseExpenseInput = (text: string, referenceDate: Date = new Date()): ParsedExpense | null => {
  if (!text) return null;
  const clean = text.trim();

  // Exclude debt / udhar / baki / lending / borrowing operations from expense tracking
  const isDebtRelated = /(?:পাবো|পাব|পাবে|দেবো|দেনা|ধার|বাকি|উধার|হাওলাত|করজ|কাছে|kache|pabo|debo|dhar|dena|baki|udhar|paona|pauna|pawna|ferot|ফেরত|sodh|শোধ|porishodh|পরিশোধ)/i.test(clean);
  if (isDebtRelated) {
    return null;
  }

  // Extract any specific, past or relative date from the text
  const dateInfo = parseExpenseDate(clean, referenceDate);
  const textWithoutDate = dateInfo?.cleanedText !== undefined ? dateInfo.cleanedText : clean;

  // Check if text is an expense query
  const hasExpenseWord = /(?:খরচ|খরচের|খরচা|ব্যয়|ব্যায়|khoroch|khoroc|khoros|khorosh|khoroj|khoroa|khorca|khorcha|koroch|koroc|koros|korosh|khroch|cost|costs|spending|spent|expense|expenses|হিসাব|hisab)/i.test(clean);
  const hasQueryWord = /(?:কত|koto|koro|মোট|mot|total|হয়েছে|হলো|holo|hoyeche|hoise|ছিল|chilo|দেখা|দেখাও|dekha|dekhao|দেখতে|dekte|dekhte|চাই|cai|chai|লিস্ট|list|দাও|দেও|daw|dao|dew|বলো|bolo|summary|কী\s*কী|কি\s*কি|ki\s*ki)/i.test(clean);
  const isDirectExpensePhrase = /^(?:আজকের|আজকে|আজ|aj|ajke|ajker|গতকাল|গতকালের|কালকের|gotokal|gotokalker|gotokaler|এই\s*মাসের|মাসের|চলতি\s*মাসের|ay\s*mas(?:\s*ar|\s*er)?|ei\s*mas(?:\s*ar|\s*er)?|ai\s*mas(?:\s*ar|\s*er)?|maser|masher|last\s*month|this\s*month)?\s*(?:খরচ|খরচের|খরচা|ব্যয়|ব্যায়|khoroch|khoroc|khoros|khoroa|koros|koroch|cost|costs|হিসাব|hisab|expense|expenses)(?:\s*(?:দাও|দেও|দেখাও|কত|daw|dao|dekhao|koto|list|লিস্ট))?\s*\??$/i.test(clean);

  const isQuery = (hasExpenseWord && (hasQueryWord || clean.endsWith('?'))) || isDirectExpensePhrase;

  // 1. Month Query (e.g. "গত মাসের খরচ কত", "সেপ্টেম্বর মাসের খরচ", "এই মাসের খরচ", "ay mas ar khoros daw", "octobor ar khoros koto")
  if (dateInfo?.monthDate && (isQuery || hasExpenseWord)) {
    return {
      isQuery: true,
      queryType: 'monthly',
      monthYear: dateInfo.monthDate
    };
  }

  if (
    /(?:এই\s*মাসের|মাসের|চলতি\s*মাসের|এই\s*মাস|চলতি\s*মাস|ay\s*mas|ei\s*mas|ai\s*mas|cholti\s*mas|month|monthly|maser|masher|mas\s*ar|mas\s*er|mash\s*ar|mash\s*er|last\s*month|this\s*month)\s*(?:এর|র|ar|er)?\s*(?:মোট\s*|mot\s*|total\s*)?(?:খরচ|খরচের|খরচা|ব্যয়|ব্যায়|khoroch|khoroc|khoros|khoroa|koros|koroch|cost|costs|হিসাব|hisab|expense|expenses)/i.test(clean) ||
    /^(?:মাসের\s*খরচ|এই\s*মাসের\s*খরচ|মাসের\s*হিসাব|maser\s*khoros|maser\s*khoroch|maser\s*hisab|monthly\s*cost|monthly\s*expense)$/i.test(clean)
  ) {
    return {
      isQuery: true,
      queryType: 'monthly'
    };
  }

  // 1.5. Multi-day Range Query (e.g. "last 2 din ar khoros koto", "last 2 din ar cost koto", "গত ২ দিনের খরচ কত")
  if (dateInfo?.rangeDays && (isQuery || hasExpenseWord)) {
    return {
      isQuery: true,
      queryType: 'range',
      rangeDays: dateInfo.rangeDays
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

  // 4. Backdated or Today Expense Logging: [Item] [Amount] e.g. "বাজার ৫০০ টাকা", "Medecin kineche 980 takar", "10 oct রিকশা ৬০"
  const targetText = (textWithoutDate || clean).replace(/[.।!]+$/g, '').trim();

  // Do not treat phone numbers, NID, or time expressions as expense amounts
  if (/(?:\+?88)?01[3-9]\d{8}/.test(targetText) || /(?:টায়|টায়|মিনিট|ঘণ্টা|ঘন্টা|সেকেন্ড|am|pm|মনে\s*করিয়ে|রিমাইন্ডার|reminder|অ্যালার্ম|alarm)/i.test(targetText)) {
    return null;
  }

  // Pattern 1: [Item/Category + optional verb] [Amount] [টাকা/taka/takar/tk]? [optional trailing verb]
  // e.g. "Medecin kineche 980 takar", "বাজার ৫০০ টাকা করেছি", "রিকশা ৬০", "ওষুধ কিনলাম ৯৮০ টাকার"
  const p1 = targetText.match(
    /^([a-zA-Z\u0980-\u09FF\s-]+?)\s*[:=-]?\s*(?:৳\s*)?([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকায়|টাকা|takar|takay|takai|taka|tk|৳)?(?:\s*(?:দিয়েছি|দিয়েছে|দিলাম|দিয়া|দিয়ে|কিনেছি|কিনেছে|কিনলাম|কেনা\s*হয়েছে|করেছি|করলাম|হয়েছে|হইছে|হলো|গেল|খরচ\s*হয়েছে|খরচ|dia|dilam|diyechi|diye|kinechi|kineche|kinlam|koresi|korlam|hoyeche|hoise|holo|gelo|khoroch|khoros|cost))?$/i
  );
  if (p1 && p1[1].trim().length >= 2) {
    const rawTitle = p1[1].trim();
    if (!/কখন|সময়|time|বাকি|তারিখ|date|ঘণ্টা|মিনিট|দিন|alarm|অ্যালার্ম|নম্বর|নাম্বার|number|phone|ফোন|পাসওয়ার্ড|password|পিন|pin|রক্ত|blood/i.test(rawTitle)) {
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

  // Pattern 2: [Amount] [টাকা/taka/takar/tk] [Item] [optional trailing verb]
  // e.g. "৫০০ টাকার বাজার", "৯৮০ টাকার ওষুধ কেনা হয়েছে", "980 takar medecin kineche", "১২০ টাকা লাঞ্চ"
  const p2 = targetText.match(
    /^(?:৳\s*)?([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকায়|টাকা|takar|takay|takai|taka|tk|৳)\s*(?:দিয়ে|dia|diye|ar|er|এর)?\s*([a-zA-Z\u0980-\u09FF\s-]+)$/i
  );
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

  // Pattern 3: 'খরচ [Item] [Amount]' e.g. 'খরচ বাজার ৫০০', 'cost medecin 980'
  const p3 = targetText.match(
    /^(?:খরচ|খরচা|expense|cost|khoroch|khoroc|khoros)\s*[:=-]?\s*([a-zA-Z\u0980-\u09FF\s-]+?)\s*(?:৳\s*)?([০-৯0-9]+(?:\.[০-৯0-9]+)?)\s*(?:টাকার|টাকায়|টাকায়|টাকা|takar|takay|takai|taka|tk|৳)?$/i
  );
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
 * Record a new Expense (normalizes Banglish titles into clean Bengali while keeping raw Banglish in notes for search)
 */
export const recordExpense = async (
  userId: string | mongoose.Types.ObjectId,
  title: string,
  amount: number,
  paymentMethod: string = 'cash',
  date: Date = new Date(),
  notes?: string
) => {
  const normalizedTitle = toBanglaExpenseTitle(title) || title;
  const cat = detectExpenseCategory(`${title} ${normalizedTitle}`);
  const finalNotes = notes || (normalizedTitle !== title ? title : undefined);
  const expense = await Expense.create({
    userId,
    title: normalizedTitle,
    amount,
    category: cat.id,
    categoryBn: cat.nameBn,
    paymentMethod,
    date,
    notes: finalNotes
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
    const displayTitle = toBanglaExpenseTitle(exp.title) || exp.title;
    const cat = detectExpenseCategory(`${exp.title} ${displayTitle}`);
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
    monthExpenses,
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
  }).sort({ date: -1 });

  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount, 0);

  // Category-wise distribution this month
  const categoryMap = new Map<string, { nameBn: string; icon: string; amount: number; count: number }>();
  for (const exp of monthExpenses) {
    const displayTitle = toBanglaExpenseTitle(exp.title) || exp.title;
    const cat = detectExpenseCategory(`${exp.title} ${displayTitle}`);
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
    monthExpenses,
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
  const displayTitle = toBanglaExpenseTitle(title) || title;
  return `✅ *খরচ যুক্ত হয়েছে!*\n` +
         `${category.icon} *খাত:* ${displayTitle} (${category.nameBn})\n` +
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
      const displayTitle = toBanglaExpenseTitle(e.title) || e.title;
      const cat = detectExpenseCategory(`${e.title} ${displayTitle}`);
      return `${enToBnDigits(idx + 1)}. ${cat.icon} ${displayTitle}: *${formatTaka(e.amount)}*`;
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
 * Get Expense Summary for a Multi-Day Range (e.g. Last N Days)
 */
export const getExpenseSummaryForRange = async (
  userId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date,
  labelBn: string = 'গত কয়েক দিনের'
) => {
  const rangeExpenses = await Expense.find({
    userId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });

  const rangeTotal = rangeExpenses.reduce((sum, item) => sum + item.amount, 0);

  const dhakaDateStr = endDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
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
    rangeExpenses,
    rangeTotal,
    rangeCount: rangeExpenses.length,
    monthTotal,
    labelBn
  };
};

/**
 * Format Response Message for Multi-Day Range Query (e.g. Last 2 Days)
 */
export const buildRangeExpenseQueryMessage = (
  expenses: IExpense[],
  total: number,
  monthTotal: number,
  labelBn: string = 'গত কয়েক দিনের'
): string => {
  if (expenses.length === 0) {
    return `📝 *${labelBn} খরচের হিসাব খাতা*\n\n` +
           `${labelBn} আপনার কোনো খরচ রেকর্ড করা নেই।\n\n` +
           `💡 খরচ যোগ করতে লিখুন, যেমন: "আজ বাজার ৫০০ টাকা"`;
  }

  const itemsList = expenses
    .map((e, idx) => {
      const displayTitle = toBanglaExpenseTitle(e.title) || e.title;
      const cat = detectExpenseCategory(`${e.title} ${displayTitle}`);
      const dStr = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      const [, mNum, dNum] = dStr.split('-').map(Number);
      const shortDate = `${enToBnDigits(dNum)} ${BENGALI_MONTHS[mNum] || ''}`.trim();
      return `${enToBnDigits(idx + 1)}. ${cat.icon} ${displayTitle}: *${formatTaka(e.amount)}* _(${shortDate})_`;
    })
    .join('\n');

  return `📊 *${labelBn} খরচের হিসাব খাতা*\n\n` +
         `${itemsList}\n\n` +
         `──────────────\n` +
         `💵 *${labelBn} মোট:* ${formatTaka(total)} (${enToBnDigits(expenses.length)}টি এন্ট্রি)\n` +
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
  monthLabelBn: string = 'চলতি মাসের',
  monthExpenses?: IExpense[]
): string => {
  if (monthCount === 0) {
    return `📅 *${monthLabelBn} খরচের হিসাব খাতা*\n\n${monthLabelBn} এখনও কোনো খরচ এন্ট্রি নেই।\n\n💡 খরচ যোগ করতে লিখুন: যেমন "লাঞ্চ ১২০ টাকা"`;
  }

  let itemsSection = '';
  if (monthExpenses && monthExpenses.length > 0) {
    const maxDisplay = 25;
    const shown = monthExpenses.slice(0, maxDisplay);
    const itemsList = shown
      .map((e, idx) => {
        const displayTitle = toBanglaExpenseTitle(e.title) || e.title;
        const cat = detectExpenseCategory(`${e.title} ${displayTitle}`);
        const dStr = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
        const [, mNum, dNum] = dStr.split('-').map(Number);
        const shortDate = `${enToBnDigits(dNum)} ${BENGALI_MONTHS[mNum] || ''}`.trim();
        return `${enToBnDigits(idx + 1)}. ${cat.icon} ${displayTitle}: *${formatTaka(e.amount)}* _(${shortDate})_`;
      })
      .join('\n');
    const moreText = monthExpenses.length > maxDisplay
      ? `\n_...এবং আরও ${enToBnDigits(monthExpenses.length - maxDisplay)}টি এন্ট্রি_`
      : '';
    itemsSection = `📋 *খরচের তালিকা:*\n${itemsList}${moreText}\n\n`;
  }

  const breakdownList = categoryBreakdown
    .map(c => `• ${c.icon} ${c.nameBn}: *${formatTaka(c.amount)}* (${enToBnDigits(c.percentage)}%)`)
    .join('\n');

  return `📅 *${monthLabelBn} খরচের হিসাব খাতা*\n\n` +
         itemsSection +
         `📊 *খাতভিত্তিক বিভাজন:*\n` +
         `${breakdownList}\n\n` +
         `──────────────\n` +
         `💰 *মোট খরচ:* ${formatTaka(monthTotal)} (${enToBnDigits(monthCount)}টি এন্ট্রি)\n\n` +
         `🌐 সম্পূর্ণ গ্রাফ ও খাতা দেখতে: https://smritilife.com/app/expenses`;
};

/**
 * Delete Expense by Index (1-based index matching daily query list order)
 */
export const deleteExpenseByIndex = async (
  userId: string | mongoose.Types.ObjectId,
  targetDate: Date = new Date(),
  index: number
) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const startOfDay = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
  const endOfDay = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);

  const dateExpenses = await Expense.find({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ date: -1 });

  if (dateExpenses.length === 0) {
    return null;
  }

  let targetExpense = null;
  if (index === -1) {
    targetExpense = dateExpenses[dateExpenses.length - 1];
  } else if (index >= 1 && index <= dateExpenses.length) {
    targetExpense = dateExpenses[index - 1];
  }

  if (!targetExpense) {
    return null;
  }

  await Expense.findByIdAndDelete(targetExpense._id);
  const updatedSummary = await getExpenseSummaryForDate(userId, targetDate);

  return {
    deletedExpense: targetExpense,
    dateTotal: updatedSummary.dateTotal,
    monthTotal: updatedSummary.monthTotal,
    remainingCount: updatedSummary.dateCount,
    remainingExpenses: updatedSummary.dateExpenses
  };
};

/**
 * Delete Expense by Title / Keyword
 */
export const deleteExpenseByTitle = async (
  userId: string | mongoose.Types.ObjectId,
  targetDate: Date = new Date(),
  titleQuery: string
) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const startOfDay = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
  const endOfDay = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);

  const escapedRaw = titleQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const banglaQuery = toBanglaExpenseTitle(titleQuery);
  const escapedBangla = banglaQuery ? banglaQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : escapedRaw;

  const orConditions: any[] = [
    { title: { $regex: new RegExp(escapedRaw, 'i') } },
    { notes: { $regex: new RegExp(escapedRaw, 'i') } }
  ];
  if (escapedBangla && escapedBangla !== escapedRaw) {
    orConditions.push({ title: { $regex: new RegExp(escapedBangla, 'i') } });
    orConditions.push({ categoryBn: { $regex: new RegExp(escapedBangla, 'i') } });
  }

  // First search in target date
  let targetExpense = await Expense.findOne({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay },
    $or: orConditions
  }).sort({ date: -1 });

  // If not found in target date, search recent expenses across any date
  if (!targetExpense) {
    targetExpense = await Expense.findOne({
      userId,
      $or: orConditions
    }).sort({ date: -1 });
  }

  if (!targetExpense) {
    return null;
  }

  await Expense.findByIdAndDelete(targetExpense._id);
  const updatedSummary = await getExpenseSummaryForDate(userId, targetExpense.date);

  return {
    deletedExpense: targetExpense,
    dateTotal: updatedSummary.dateTotal,
    monthTotal: updatedSummary.monthTotal,
    remainingCount: updatedSummary.dateCount,
    remainingExpenses: updatedSummary.dateExpenses
  };
};

/**
 * Delete Last Logged Expense for User
 */
export const deleteLastExpense = async (userId: string | mongoose.Types.ObjectId) => {
  const last = await Expense.findOne({ userId }).sort({ createdAt: -1 });
  if (!last) return null;

  await Expense.findByIdAndDelete(last._id);
  const updatedSummary = await getExpenseSummaryForDate(userId, last.date);

  return {
    deletedExpense: last,
    dateTotal: updatedSummary.dateTotal,
    monthTotal: updatedSummary.monthTotal,
    remainingCount: updatedSummary.dateCount,
    remainingExpenses: updatedSummary.dateExpenses
  };
};

/**
 * Delete All Expenses for a Specific Date
 */
export const deleteAllExpensesForDate = async (
  userId: string | mongoose.Types.ObjectId,
  targetDate: Date = new Date()
) => {
  const dhakaDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const startOfDay = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
  const endOfDay = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);

  const deleteResult = await Expense.deleteMany({
    userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  const updatedSummary = await getExpenseSummaryForDate(userId, targetDate);
  return {
    deletedCount: deleteResult.deletedCount,
    monthTotal: updatedSummary.monthTotal
  };
};

/**
 * Format Response Message for Expense Deletion (with updated remaining list and adjusted totals)
 */
export const buildExpenseDeletedMessage = (
  deletedTitle: string,
  deletedAmount: number,
  dayTotal: number,
  monthTotal: number,
  dateLabelBn: string = 'আজকের',
  remainingExpenses?: Array<{ title: string; amount: number }>
): string => {
  const label = dateLabelBn.includes('আজ') ? 'আজকের' : dateLabelBn;
  const displayTitle = toBanglaExpenseTitle(deletedTitle) || deletedTitle;
  let remainingBlock = '';
  if (remainingExpenses && remainingExpenses.length > 0) {
    const items = remainingExpenses
      .map((e, idx) => {
        const dTitle = toBanglaExpenseTitle(e.title) || e.title;
        const cat = detectExpenseCategory(`${e.title} ${dTitle}`);
        return `${enToBnDigits(idx + 1)}. ${cat.icon} ${dTitle}: *${formatTaka(e.amount)}*`;
      })
      .join('\n');
    remainingBlock = `\n📋 *বাকি খরচের তালিকা:*\n${items}\n`;
  }
  return `🗑️ আপনার খরচের তালিকা থেকে *"${displayTitle}" (${formatTaka(deletedAmount)})* সফলভাবে বাদ দেওয়া হয়েছে!\n` +
         `${remainingBlock}\n` +
         `📊 *${label} নতুন মোট খরচ:* ${formatTaka(dayTotal)}\n` +
         `📅 *চলতি মাসের নতুন মোট:* ${formatTaka(monthTotal)}`;
};

/**
 * Format Response Message when User sends generic Delete command and multiple expenses exist
 */
export const buildExpenseDeleteChoiceMessage = (
  expenses: Array<{ title: string; amount: number }>,
  dateLabelBn: string = 'আজকের'
): string => {
  const label = dateLabelBn.includes('আজ') ? 'আজকের' : dateLabelBn;
  const items = expenses.map((e, idx) => {
    const displayTitle = toBanglaExpenseTitle(e.title) || e.title;
    const cat = detectExpenseCategory(`${e.title} ${displayTitle}`);
    return `${enToBnDigits(idx + 1)}. ${cat.icon} ${displayTitle}: *${formatTaka(e.amount)}*`;
  }).join('\n');

  const firstTitle = toBanglaExpenseTitle(expenses[0]?.title || 'লাঞ্চ') || 'লাঞ্চ';
  return `🗑️ *${label} কোন খরচটি ডিলিট করতে চান?*\n\n` +
         `${items}\n\n` +
         `💡 অনুগ্রহ করে লিখে জানান:\n` +
         `• "১ নম্বরটা ডিলিট করো"\n` +
         `• "শেষেরটা ডিলিট করো"\n` +
         `• অথবা খরচের নাম লিখুন (যেমন: "${firstTitle} ডিলিট করো")`;
};


