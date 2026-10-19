import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import UserDocument, { IUserDocument } from '../models/UserDocument';

const UPLOADS_DIR = path.join(__dirname, '../../uploads/documents');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Automatically categorize document based on text/title/filename
 */
export function detectDocumentCategory(text: string): {
  category: 'Prescription' | 'Medical Report' | 'NID/Card' | 'Certificate' | 'Invoice/Bill' | 'Other';
  tags: string[];
} {
  const lower = (text || '').toLowerCase();
  const tags: string[] = [];

  // Prescription
  if (
    lower.includes('প্রেসক্রিপশন') ||
    lower.includes('প্রেস্ক্রিপশন') ||
    lower.includes('prescription') ||
    lower.includes('ডাক্তার') ||
    lower.includes('doctor') ||
    lower.includes('ওষুধ') ||
    lower.includes('ঔষধ')
  ) {
    tags.push('prescription', 'প্রেসক্রিপশন', 'doctor', 'ডাক্তার');
    return { category: 'Prescription', tags };
  }

  // Medical Report
  if (
    lower.includes('রিপোর্ট') ||
    lower.includes('report') ||
    lower.includes('টেস্ট') ||
    lower.includes('test') ||
    lower.includes('ব্লাড') ||
    lower.includes('blood') ||
    lower.includes('x-ray') ||
    lower.includes('এক্সরে') ||
    lower.includes('আল্ট্রা') ||
    lower.includes('ultra') ||
    lower.includes('lab') ||
    lower.includes('ল্যাব')
  ) {
    tags.push('report', 'রিপোর্ট', 'medical', 'test', 'ল্যাব');
    return { category: 'Medical Report', tags };
  }

  // NID / Identification Card / Passport
  if (
    lower.includes('এনআইডি') ||
    lower.includes('nid') ||
    lower.includes('পরিচয়পত্র') ||
    lower.includes('পরিচয়পত্র') ||
    lower.includes('পাসপোর্ট') ||
    lower.includes('passport') ||
    lower.includes('স্মার্ট কার্ড') ||
    lower.includes('smart card') ||
    lower.includes('লাইসেন্স') ||
    lower.includes('license') ||
    lower.includes('কার্ড') ||
    lower.includes('card')
  ) {
    tags.push('nid', 'এনআইডি', 'card', 'passport', 'পাসপোর্ট');
    return { category: 'NID/Card', tags };
  }

  // Certificate / Educational
  if (
    lower.includes('সার্টিফিকেট') ||
    lower.includes('certificate') ||
    lower.includes('সনদ') ||
    lower.includes('মার্কশিট') ||
    lower.includes('marksheet') ||
    lower.includes('ডিগ্রি') ||
    lower.includes('degree')
  ) {
    tags.push('certificate', 'সার্টিফিকেট', 'সনদ');
    return { category: 'Certificate', tags };
  }

  // Invoice / Bill / Receipt
  if (
    lower.includes('রিসিপ্ট') ||
    lower.includes('receipt') ||
    lower.includes('বিল') ||
    lower.includes('bill') ||
    lower.includes('ভাউচার') ||
    lower.includes('voucher') ||
    lower.includes('চালান') ||
    lower.includes('invoice') ||
    lower.includes('মেমো') ||
    lower.includes('memo')
  ) {
    tags.push('receipt', 'রিসিপ্ট', 'bill', 'বিল', 'invoice');
    return { category: 'Invoice/Bill', tags };
  }

  tags.push('document', 'file', 'ফাইল');
  return { category: 'Other', tags };
}

/**
 * Save binary file buffer to disk
 */
export async function saveFileToDisk(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{ fileName: string; fileUrl: string; fileSize: number; diskPath: string }> {
  const ext = path.extname(originalFilename) || getExtensionFromMime(mimeType) || '.bin';
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const safeBase = path.basename(originalFilename, ext).replace(/[^\w\d-_]/g, '_');
  const fileName = `doc_${Date.now()}_${safeBase}_${randomSuffix}${ext}`;
  const diskPath = path.join(UPLOADS_DIR, fileName);

  await fs.promises.writeFile(diskPath, buffer);
  const fileSize = buffer.length;
  const fileUrl = `/uploads/documents/${fileName}`;

  return { fileName, fileUrl, fileSize, diskPath };
}

function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/msword':
      return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.docx';
    default:
      return '';
  }
}

/**
 * Upload buffer to Meta WhatsApp Graph API to get a media_id for sending
 */
export async function uploadBufferToMeta(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');

    const res = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData,
      signal: AbortSignal.timeout(20000)
    });

    const data = (await res.json()) as any;
    if (res.ok && data?.id) {
      return data.id;
    }
    console.warn('[MetaMediaUpload] Failed response:', data);
    return null;
  } catch (err) {
    console.error('[MetaMediaUpload] Exception:', err);
    return null;
  }
}

/**
 * Load document file buffer from disk, embedded base64 data, or on-demand DB fetch
 */
export async function getDocumentBuffer(doc: IUserDocument | any): Promise<Buffer | null> {
  if (!doc) return null;

  // 1. If base64 data is already in memory
  if (doc.fileData) {
    try {
      return Buffer.from(doc.fileData, 'base64');
    } catch (e) {
      console.error('[DocumentService] Base64 decode error:', e);
    }
  }

  // 2. Try loading from disk
  const baseName = path.basename(doc.fileUrl || doc.fileName || '');
  if (baseName) {
    const candidates = [
      path.join(__dirname, '../../uploads/documents', baseName),
      path.join(__dirname, '../uploads/documents', baseName),
      path.join(process.cwd(), 'uploads/documents', baseName),
      path.join(process.cwd(), 'server/uploads/documents', baseName)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          return await fs.promises.readFile(c);
        } catch (e) {}
      }
    }
  }

  // 3. Fallback: If document was queried with .select('-fileData'), fetch fileData directly from DB by _id
  if (doc._id) {
    try {
      const fullDoc = await UserDocument.findById(doc._id).select('fileData fileName mimeType fileUrl').lean();
      if (fullDoc && fullDoc.fileData) {
        const buffer = Buffer.from(fullDoc.fileData, 'base64');
        // Cache to disk if possible
        if (baseName) {
          const saveDir = path.join(process.cwd(), 'uploads/documents');
          if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
          }
          fs.promises.writeFile(path.join(saveDir, baseName), buffer).catch(() => {});
        }
        return buffer;
      }
    } catch (e) {
      console.error('[DocumentService] Failed to load document fileData from DB:', e);
    }
  }

  return null;
}

/**
 * Calculate usage/lifespan duration elapsed since an item or document was saved
 */
export function calculateItemDuration(createdAt: Date | string | number): {
  days: number;
  hours: number;
  minutes: number;
  durationTextBn: string;
  durationTextEn: string;
  savedDateBn: string;
  savedDateEn: string;
  savedTimeBn: string;
  savedTimeEn: string;
} {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const diffMins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

  const toBn = (n: number) => n.toString().replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);

  let durationTextBn = '';
  let durationTextEn = '';

  if (diffDays === 0) {
    if (diffHours === 0 && diffMins <= 5) {
      durationTextBn = 'আজকে মাত্র কিছুক্ষণ আগে সেভ করা হয়েছে (১ম দিন চলছে)';
      durationTextEn = 'Saved just moments ago today (Day 1 running)';
    } else if (diffHours === 0) {
      durationTextBn = `আজকে প্রায় ${toBn(diffMins)} মিনিট আগে সেভ করা হয়েছে (১ম দিন চলছে)`;
      durationTextEn = `Saved about ${diffMins} minutes ago today (Day 1 running)`;
    } else {
      durationTextBn = `আজকে প্রায় ${toBn(diffHours)} ঘণ্টা আগে সেভ করা হয়েছে (১ম দিন চলছে)`;
      durationTextEn = `Saved about ${diffHours} hour${diffHours > 1 ? 's' : ''} ago today (Day 1 running)`;
    }
  } else if (diffDays === 1) {
    durationTextBn = '১ দিন অতিবাহিত হয়েছে (২য় দিন চলছে)';
    durationTextEn = '1 day elapsed (Day 2 running)';
  } else {
    durationTextBn = `${toBn(diffDays)} দিন অতিবাহিত হয়েছে (${toBn(diffDays + 1)}তম দিন চলছে)`;
    durationTextEn = `${diffDays} days elapsed (Day ${diffDays + 1} running)`;
  }

  const savedDateBn = created.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const savedTimeBn = created.toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const savedDateEn = created.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const savedTimeEn = created.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return {
    days: diffDays,
    hours: diffHours,
    minutes: diffMins,
    durationTextBn,
    durationTextEn,
    savedDateBn,
    savedDateEn,
    savedTimeBn,
    savedTimeEn
  };
}

// Common synonym / transliteration dictionary across Bengali and English/Banglish
const synonymMap: Record<string, string[]> = {
  'টিস্যু': ['tishu', 'tissue', 'টিসু', 'tisu'],
  'টিসু': ['tishu', 'tissue', 'টিস্যু', 'tisu'],
  'tishu': ['টিস্যু', 'টিসু', 'tissue', 'tisu'],
  'tissue': ['টিস্যু', 'টিসু', 'tishu', 'tisu'],
  'tisu': ['টিস্যু', 'টিসু', 'tishu', 'tissue'],
  'বক্স': ['box', 'baksho', 'বাক্স'],
  'বাক্স': ['box', 'baksho', 'বক্স'],
  'box': ['বক্স', 'বাক্স', 'baksho'],
  'বোতল': ['bottol', 'botol', 'bottle'],
  'bottol': ['বোতল', 'botol', 'bottle'],
  'botol': ['বোতল', 'bottol', 'bottle'],
  'bottle': ['বোতল', 'bottol', 'botol'],
  'সিলিন্ডার': ['cylinder', 'silindar', 'silinder', 'selinder'],
  'cylinder': ['সিলিন্ডার', 'silindar', 'silinder', 'selinder'],
  'silindar': ['সিলিন্ডার', 'cylinder', 'silinder'],
  'silinder': ['সিলিন্ডার', 'cylinder', 'silindar'],
  'গ্যাস': ['gas'],
  'gas': ['গ্যাস'],
  'চাল': ['chal', 'rice', 'chaler'],
  'chal': ['চাল', 'rice', 'chaler'],
  'chaler': ['চাল', 'chal', 'rice'],
  'ডাল': ['dal', 'daler'],
  'dal': ['ডাল', 'daler'],
  'daler': ['ডাল', 'dal'],
  'তেল': ['tel', 'oil', 'teler'],
  'tel': ['তেল', 'oil', 'teler'],
  'teler': ['তেল', 'tel', 'oil'],
  'ওষুধ': ['medicine', 'osudh', 'oushodh', 'osud', 'ঔষধ'],
  'ঔষধ': ['medicine', 'osudh', 'oushodh', 'osud', 'ওষুধ'],
  'medicine': ['ওষুধ', 'ঔষধ', 'osudh', 'oushodh'],
  'osudh': ['ওষুধ', 'ঔষধ', 'medicine'],
  'সাবান': ['saban', 'soap'],
  'saban': ['সাবান', 'soap'],
  'soap': ['সাবান', 'saban'],
  'শ্যাম্পু': ['shampoo', 'shampu'],
  'shampoo': ['শ্যাম্পু', 'shampu'],
  'shampu': ['শ্যাম্পু', 'shampoo'],
  'প্রেসক্রিপশন': ['prescription', 'প্রেস্ক্রিপশন', 'prescrip'],
  'প্রেস্ক্রিপশন': ['prescription', 'প্রেসক্রিপশন', 'prescrip'],
  'prescription': ['প্রেসক্রিপশন', 'প্রেস্ক্রিপশন', 'prescrip'],
  'রিপোর্ট': ['report', 'টেস্ট', 'test'],
  'report': ['রিপোর্ট', 'টেস্ট', 'test'],
  'এনআইডি': ['nid', 'ভোটার', 'national id', 'স্মার্ট কার্ড', 'স্মার্টকার্ড'],
  'nid': ['এনআইডি', 'ভোটার', 'national id', 'স্মার্ট কার্ড'],
  'সার্টিফিকেট': ['certificate', 'সনদ'],
  'certificate': ['সার্টিফিকেট', 'সনদ'],
  'বিল': ['bill', 'ইনভয়েস', 'invoice', 'ভাউচার', 'voucher', 'রিসিপ্ট', 'receipt'],
  'bill': ['বিল', 'ইনভয়েস', 'invoice', 'ভাউচার', 'voucher', 'রিসিপ্ট', 'receipt'],
  'রিসিপ্ট': ['receipt', 'বিল', 'bill', 'ভাউচার'],
  'receipt': ['রিসিপ্ট', 'বিল', 'bill', 'ভাউচার'],
  'ট্যাক্স': ['tax', 'আয়কর', 'aykor', 'ট্যাক্স ফাইল', 'tax file', 'রিটার্ন', 'টিন'],
  'tax': ['ট্যাক্স', 'আয়কর', 'aykor', 'tax file', 'ট্যাক্স ফাইল', 'return', 'tin'],
  'আয়কর': ['tax', 'ট্যাক্স', 'aykor', 'tax file'],
  'aykor': ['tax', 'ট্যাক্স', 'আয়কর', 'tax file'],
  'pdf': ['fdp', 'পিডিএফ', 'file', 'doc'],
  'fdp': ['pdf', 'পিডিএফ', 'file', 'doc']
};

export function convertBengaliDigitsToEnglish(str: string): string {
  if (!str) return '';
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, (d) => bnToEn[d] || d);
}

export function convertEnglishDigitsToBengali(str: string | number): string {
  if (str === undefined || str === null) return '';
  const enToBn: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return str.toString().replace(/[0-9]/g, (d) => enToBn[d] || d);
}

/**
 * Extract 4-digit calendar year (1990 - 2099) from Bengali or English text
 */
export function extractYearFromText(text: string): number | null {
  if (!text) return null;
  const normalized = convertBengaliDigitsToEnglish(text);
  const match = normalized.match(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/);
  if (match) {
    const yr = parseInt(match[1], 10);
    if (yr >= 1990 && yr <= 2099) {
      return yr;
    }
  }
  return null;
}

/**
 * Determine the associated year of a user document
 */
export function getDocYear(doc: IUserDocument): number {
  const titleYear = extractYearFromText(doc.title);
  if (titleYear) return titleYear;

  const notesYear = extractYearFromText(doc.notes || '');
  if (notesYear) return notesYear;

  if (doc.createdAt) {
    const yr = new Date(doc.createdAt).getFullYear();
    if (!isNaN(yr) && yr >= 1990 && yr <= 2099) return yr;
  }

  return new Date().getFullYear();
}

function getTermVariants(term: string): string[] {
  const clean = term.toLowerCase().trim();
  const variants = new Set<string>([clean]);
  const syns = synonymMap[clean];
  if (syns) {
    syns.forEach((s) => variants.add(s.toLowerCase().trim()));
  }
  return Array.from(variants);
}

export interface DocumentMatchResult {
  doc: IUserDocument | null;
  targetYear: number | null;
  matchedByYear: boolean;
  itemKeyword: string;
  otherAvailableYears: number[];
  allMatchingDocs: IUserDocument[];
  yearNotFound?: boolean;
}

/**
 * Find matching document for user with intelligent Year & Version discrimination
 */
export async function findMatchingDocumentWithVersion(
  userId: string,
  query: string
): Promise<DocumentMatchResult> {
  const userDocs = (await UserDocument.find({ userId })
    .select('-fileData')
    .sort({ createdAt: -1 })
    .lean()) as any[];
  if (!userDocs || userDocs.length === 0) {
    return {
      doc: null,
      targetYear: null,
      matchedByYear: false,
      itemKeyword: '',
      otherAvailableYears: [],
      allMatchingDocs: []
    };
  }

  // 1. Detect target year in user query (e.g., 2026, 2024, ২০২৪)
  const targetYear = extractYearFromText(query);

  let clean = query
    .replace(/[?,।!]/g, '')
    .trim()
    .toLowerCase();

  // Strip year tokens from query to isolate core item keyword
  let queryWithoutYear = clean;
  if (targetYear) {
    const yrStr = targetYear.toString();
    const bnYrStr = convertEnglishDigitsToBengali(targetYear);
    queryWithoutYear = queryWithoutYear
      .replace(new RegExp(`(?<!\\d)${yrStr}(?:[-_]?(?:ar|er|saler|th|s|সালে|সালের|এর|র))?(?!\\d)`, 'gi'), '')
      .replace(new RegExp(`(?<!\\d)${bnYrStr}(?:[-_]?(?:সালে|সালের|এর|র))?(?!\\d)`, 'gi'), '')
      .replace(/(?:বছর|সালের|সালে|year|saler)/gi, '')
      .trim();
  }

  const stopWords = new Set([
    'আমাকে', 'দাও', 'দিস', 'দিবেন', 'দেন', 'পাঠাও', 'পাঠান', 'দেখাও', 'দেখান',
    'চাই', 'খুঁজে', 'খুঁজো', 'কোথায়', 'আছে', 'আমার', 'মায়ের', 'আম্মুর', 'বাবার',
    'আব্বুর', 'ভাই', 'একটু', 'টা', 'টি', 'কবে', 'কবেকার', 'কত', 'কয়', 'কদ্দিন',
    'দিন', 'তারিখ', 'তারিখে', 'হলো', 'গেছে', 'চলছে', 'চলতেছে', 'কিনেছি', 'কিনেছিলাম',
    'এনেছি', 'এনেছিলাম', 'নিয়েছি', 'নিয়েছিলাম', 'সেভ', 'আপলোড', 'করেছি', 'করেছিলাম',
    'করছি', 'করা', 'হয়েছিল', 'হয়েছে', 'রাখলাম', 'রেখেছি', 'ছবি', 'ফাইল', 'কাগজ', 'ডকুমেন্ট',
    'dao', 'daw', 'dis', 'diben', 'den', 'pathao', 'pathan', 'pathaba', 'dehao',
    'dekhaw', 'dekhan', 'chai', 'cay', 'lagbe', 'khojo', 'khujo', 'khuje', 'kothay',
    'ase', 'ache', 'amar', 'amr', 'bhai', 'ekto', 'ta', 'ti', 'send', 'give', 'show',
    'fetch', 'file', 'doc', 'document', 'pic', 'image', 'photo', 'chobi', 'kobe',
    'kobekar', 'koto', 'koy', 'koddin', 'din', 'tarikh', 'tarikhe', 'holo', 'geche',
    'cholche', 'choltese', 'kinesi', 'kinesilam', 'enechi', 'enesilam', 'niesi',
    'niesilam', 'save', 'upload', 'koresi', 'koresilam', 'korsi', 'kora', 'hoyechilo',
    'hoyeche', 'rekhechi', 'rakhlam', 'when', 'did', 'was', 'how', 'many', 'days', 'long',
    'এর', 'র', 'ar', 'er', 'saler'
  ]);

  const queryWords = queryWithoutYear
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0980-\u09FF]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const itemKeyword = queryWords.join(' ') || queryWithoutYear;

  // 2. Score and group matching documents for this item
  const matchingDocsWithScores: Array<{ doc: IUserDocument; score: number }> = [];

  for (const doc of userDocs) {
    const docTitle = doc.title.toLowerCase().trim();
    const docTokens = docTitle.split(/\s+/).filter((t: string) => t.length >= 2);
    let score = 0;

    // Direct substring in title
    if (queryWithoutYear && (queryWithoutYear.includes(docTitle) || docTitle.includes(queryWithoutYear))) {
      score += 100;
    }

    // Check individual query tokens and synonyms
    for (const qWord of queryWords) {
      const qVariants = getTermVariants(qWord);

      if (qVariants.some((v) => docTitle.includes(v))) {
        score += 35;
      }

      for (const dToken of docTokens) {
        const dVariants = getTermVariants(dToken);
        if (qVariants.some((qv) => dVariants.includes(qv))) {
          score += 60;
        }
      }

      if (doc.tags && doc.tags.some((t: string) => qVariants.some((qv) => t.toLowerCase().includes(qv)))) {
        score += 25;
      }

      if (doc.category) {
        const docCat = doc.category.toLowerCase().trim();
        if (qVariants.some((qv) => docCat.includes(qv) || qv.includes(docCat))) {
          score += 35;
        }
      }
    }

    if (doc.category) {
      const docCat = doc.category.toLowerCase().trim();
      if (queryWithoutYear && (queryWithoutYear.includes(docCat) || docCat.includes(queryWithoutYear))) {
        score += 50;
      }
    }

    if (score > 0) {
      matchingDocsWithScores.push({ doc, score });
    }
  }

  // Sort descending by match score, then by creation date
  matchingDocsWithScores.sort((a, b) => b.score - a.score || new Date(b.doc.createdAt).getTime() - new Date(a.doc.createdAt).getTime());
  let allMatchingDocs = matchingDocsWithScores.map((m) => m.doc);

  // If no direct keyword score match, try category detection
  if (allMatchingDocs.length === 0) {
    const { category, tags } = detectDocumentCategory(queryWithoutYear || clean);
    if (category !== 'Other') {
      const catMatches = userDocs.filter(
        (d: any) => d.category === category || (d.tags && d.tags.some((t: string) => tags.includes(t)))
      );
      allMatchingDocs.push(...catMatches);
    }
  }

  // If still no matches and user asked for "last" or only has 1 document
  if (allMatchingDocs.length === 0) {
    if (/^(?:last|latest|sesh|shesh|শেষ|শেষের|নতুন|সবশেষ|আগের|recent)\b/i.test(clean)) {
      allMatchingDocs.push(userDocs[0]);
    } else if (userDocs.length === 1 && queryWords.length === 0) {
      allMatchingDocs.push(userDocs[0]);
    }
  }

  if (allMatchingDocs.length === 0) {
    return {
      doc: null,
      targetYear,
      matchedByYear: false,
      itemKeyword,
      otherAvailableYears: [],
      allMatchingDocs: []
    };
  }

  // 3. Year Filter Logic
  if (targetYear) {
    // Check which documents match the targetYear
    const yearMatchedDocs = allMatchingDocs.filter((d) => getDocYear(d) === targetYear);
    const allDocYears = Array.from(new Set(allMatchingDocs.map((d) => getDocYear(d))));
    const otherYears = allDocYears.filter((yr) => yr !== targetYear).sort((a, b) => b - a);

    if (yearMatchedDocs.length > 0) {
      return {
        doc: yearMatchedDocs[0],
        targetYear,
        matchedByYear: true,
        itemKeyword: yearMatchedDocs[0].title,
        otherAvailableYears: otherYears,
        allMatchingDocs
      };
    } else {
      // User specifically requested a year that is not available for this item
      return {
        doc: null,
        targetYear,
        matchedByYear: false,
        itemKeyword: allMatchingDocs[0].title,
        otherAvailableYears: allDocYears.sort((a, b) => b - a),
        allMatchingDocs,
        yearNotFound: true
      };
    }
  }

  // 4. Default: User did not specify year -> return the latest one
  const primaryDoc = allMatchingDocs[0];
  const primaryDocYear = getDocYear(primaryDoc);
  const otherYears = Array.from(new Set(allMatchingDocs.map((d) => getDocYear(d))))
    .filter((yr) => yr !== primaryDocYear)
    .sort((a, b) => b - a);

  return {
    doc: primaryDoc,
    targetYear: null,
    matchedByYear: false,
    itemKeyword: primaryDoc.title,
    otherAvailableYears: otherYears,
    allMatchingDocs
  };
}

/**
 * Backwards compatible findMatchingDocument
 */
export async function findMatchingDocument(
  userId: string,
  query: string
): Promise<IUserDocument | null> {
  const result = await findMatchingDocumentWithVersion(userId, query);
  return result.doc;
}

/**
 * Format a list of user documents for WhatsApp message
 */
export function formatDocumentListMessage(docs: IUserDocument[]): string {
  if (!docs || docs.length === 0) {
    return '📁 আপনার কোনো ফাইল বা প্রেসক্রিপশন মেমোরিতে সেভ করা নেই।\n\nআপনি যেকোনো ছবি বা PDF ফাইল পাঠিয়ে ক্যাপশনে নামটি লিখে দিলে আমি তা সুরক্ষিতভাবে সেভ করে রাখবো!';
  }

  let msg = `📁 *আপনার সংরক্ষিত ফাইলসমূহ (${docs.length}টি):*\n\n`;
  docs.slice(0, 10).forEach((d, i) => {
    const icon = d.mimeType.includes('pdf') ? '📄' : '🖼️';
    const dateStr = new Date(d.createdAt).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    msg += `${i + 1}. ${icon} *${d.title}*\n   📂 ${d.category} • 📅 ${dateStr}\n\n`;
  });

  msg += '💡 যেকোনো ফাইল ফেরত পেতে শুধু ফাইলের নামটি লিখে মেসেজ দিন (যেমন: *"আমার প্রেসক্রিপশন দাও"*, বা নির্দিষ্ট বছরের ফাইল পেতে *"২০২৬ সালের ফাইল দাও"*)।';
  return msg;
}

/**
 * Cleanly extracts a concise title (max 35-40 chars) and puts long descriptions into notes.
 * Prevents long sentences or full paragraphs from becoming the document title in the Document Vault.
 */
export function extractCleanDocumentTitleAndNotes(
  rawText: string,
  fallbackFilename: string = '',
  isImage: boolean = false
): { title: string; notes?: string } {
  if (!rawText || !rawText.trim()) {
    const defaultTitle = isImage ? 'প্রেসক্রিপশন / ছবি' : (fallbackFilename ? path.parse(fallbackFilename).name : 'ডকুমেন্ট');
    return { title: defaultTitle };
  }

  let text = rawText.trim();
  // Strip common conversational prefixes like "এটা আমার", "aita amr", "save kore rakh", etc.
  text = text.replace(/^(?:এটা|ita|aita|eta|amr|amar|আমার|দয়া\s*করে|please|নোট\s*করো|সেভ\s*করো|save\s*koro)\s+/i, '').trim();

  // 1. If text has a colon or newline, use the first part as title and rest as notes!
  if (text.includes(':') || text.includes('：') || text.includes('\n')) {
    const parts = text.split(/[:：\n]/);
    const candidateTitle = parts[0].trim();
    const candidateNotes = parts.slice(1).join('\n').trim();
    if (candidateTitle.length >= 2 && candidateTitle.length <= 40) {
      return {
        title: candidateTitle,
        notes: candidateNotes || undefined
      };
    }
  }

  // 2. Look for well-known document types in text
  const docKeywords = [
    { regex: /(?:প্রেসক্রিপশন|প্রেস্ক্রিপশন|prescription)/i, defaultTitle: 'প্রেসক্রিপশন' },
    { regex: /(?:ব্লাড\s*টেস্ট\s*রিপোর্ট|blood\s*test\s*report|রক্তের\s*রিপোর্ট)/i, defaultTitle: 'ব্লাড টেস্ট রিপোর্ট' },
    { regex: /(?:মেডিকেল\s*রিপোর্ট|medical\s*report|টেস্ট\s*রিপোর্ট|ল্যাব\s*রিপোর্ট)/i, defaultTitle: 'মেডিকেল টেস্ট রিপোর্ট' },
    { regex: /(?:এনআইডি\s*কার্ড|nid\s*card|জাতীয়\s*পরিচয়পত্র|ভোটার\s*আইডি)/i, defaultTitle: 'এনআইডি কার্ড' },
    { regex: /(?:পাসপোর্ট|passport)/i, defaultTitle: 'পাসপোর্ট' },
    { regex: /(?:ড্রাইভিং\s*লাইসেন্স|driving\s*license|লাইসেন্স|license)/i, defaultTitle: 'ড্রাইভিং লাইসেন্স' },
    { regex: /(?:বিদ্যুৎ\s*বিল|কারেন্ট\s*বিল|electricity\s*bill)/i, defaultTitle: 'বিদ্যুৎ বিল' },
    { regex: /(?:গ্যাস\s*বিল|gas\s*bill|পানি\s*বিল|water\s*bill|ইন্টারনেট\s*বিল)/i, defaultTitle: 'ইউটিলিটি বিল' },
    { regex: /(?:সার্টিফিকেট|certificate|সনদ)/i, defaultTitle: 'সার্টিফিকেট' },
    { regex: /(?:রসিদ|চালান|invoice|ভাউচার|মেমো|memo|receipt)/i, defaultTitle: 'রসিদ / ইনভয়েস' },
    { regex: /(?:টিন\s*সার্টিফিকেট|tin\s*certificate|ট্যাক্স|tax)/i, defaultTitle: 'টিন সার্টিফিকেট' }
  ];

  // If text is relatively short (<= 35 chars), use it directly as the title!
  if (text.length <= 35) {
    return { title: text };
  }

  // If text is long (> 35 chars), see if it matches any document keyword
  for (const item of docKeywords) {
    if (item.regex.test(text)) {
      let prefix = '';
      if (/(?:আম্মুর|মায়ের|আম্মার|mother)/i.test(text)) prefix = 'আম্মুর ';
      else if (/(?:বাবার|আব্বুর|father)/i.test(text)) prefix = 'বাবার ';
      else if (/(?:আমার|নিজের|personal)/i.test(text)) prefix = 'আমার ';

      return {
        title: `${prefix}${item.defaultTitle}`,
        notes: text
      };
    }
  }

  // Fallback for long text without specific keyword: take first 4-5 words (up to 32 chars)
  const words = text.split(/\s+/);
  let shortTitle = '';
  for (const w of words) {
    if ((shortTitle + ' ' + w).trim().length > 32) break;
    shortTitle = (shortTitle + ' ' + w).trim();
  }
  if (!shortTitle) shortTitle = text.slice(0, 32);

  return {
    title: shortTitle,
    notes: text
  };
}

