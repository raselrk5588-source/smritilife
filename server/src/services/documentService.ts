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
 * Load document file buffer from disk or embedded base64 data
 */
export async function getDocumentBuffer(doc: IUserDocument): Promise<Buffer | null> {
  const baseName = path.basename(doc.fileUrl || '');
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
  if (doc.fileData) {
    try {
      return Buffer.from(doc.fileData, 'base64');
    } catch (e) {}
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
  'receipt': ['রিসিপ্ট', 'বিল', 'bill', 'ভাউচার']
};

function getTermVariants(term: string): string[] {
  const clean = term.toLowerCase().trim();
  const variants = new Set<string>([clean]);
  const syns = synonymMap[clean];
  if (syns) {
    syns.forEach((s) => variants.add(s.toLowerCase().trim()));
  }
  return Array.from(variants);
}

/**
 * Find matching document for user by search term, tracking query, or intent
 */
export async function findMatchingDocument(
  userId: string,
  query: string
): Promise<IUserDocument | null> {
  const userDocs = await UserDocument.find({ userId }).sort({ createdAt: -1 });
  if (!userDocs || userDocs.length === 0) return null;

  const clean = query
    .replace(/[?,।!]/g, '')
    .trim()
    .toLowerCase();

  // 1. Direct Title or Variant Containment in User Query
  for (const doc of userDocs) {
    const docTitle = doc.title.toLowerCase().trim();
    if (!docTitle) continue;

    // Direct substring in query (e.g. "tishu box ta kobe save kora hoyechilo" contains "tishu box")
    if (clean.includes(docTitle) || docTitle.includes(clean)) {
      return doc;
    }

    // Check title variants (e.g. "Tishu box" -> doc tokens: "tishu", "box")
    const docTokens = docTitle.split(/\s+/).filter((t) => t.length >= 2);
    if (docTokens.length > 0) {
      const allTokensPresent = docTokens.every((token) => {
        const variants = getTermVariants(token);
        return variants.some((v) => clean.includes(v));
      });
      if (allTokensPresent) {
        return doc;
      }
    }
  }

  // 2. Token Matching with Stopwords Stripped
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
    'hoyeche', 'rekhechi', 'rakhlam', 'when', 'did', 'was', 'how', 'many', 'days', 'long'
  ]);

  const queryWords = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0980-\u09FF]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  // Score docs based on query word overlap & synonyms
  let bestDoc: IUserDocument | null = null;
  let bestScore = 0;

  for (const doc of userDocs) {
    const docTitle = doc.title.toLowerCase();
    const docTokens = docTitle.split(/\s+/).filter((t) => t.length >= 2);
    let score = 0;

    for (const qWord of queryWords) {
      const qVariants = getTermVariants(qWord);

      // Check against whole title
      if (qVariants.some((v) => docTitle.includes(v))) {
        score += 30;
      }

      // Check against doc tokens
      for (const dToken of docTokens) {
        const dVariants = getTermVariants(dToken);
        if (qVariants.some((qv) => dVariants.includes(qv))) {
          score += 50;
        }
      }

      // Check doc tags
      if (doc.tags && doc.tags.some((t) => qVariants.some((qv) => t.toLowerCase().includes(qv)))) {
        score += 20;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  if (bestDoc && bestScore >= 30) {
    return bestDoc;
  }

  // 3. Category match based on keywords
  const { category, tags } = detectDocumentCategory(clean);
  if (category !== 'Other') {
    const catMatch = userDocs.find(
      (d) => d.category === category || (d.tags && d.tags.some((t) => tags.includes(t)))
    );
    if (catMatch) return catMatch;
  }

  // 4. If user asks for "last" / "শেষ" saved file or only has 1 document:
  if (/^(?:last|latest|sesh|shesh|শেষ|শেষের|নতুন|সবশেষ|আগের|recent)\b/i.test(clean)) {
    return userDocs[0];
  }

  if (userDocs.length === 1 && queryWords.length === 0) {
    return userDocs[0];
  }

  return null;
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

  msg += '💡 যেকোনো ফাইল ফেরত পেতে শুধু ফাইলের নামটি লিখে মেসেজ দিন (যেমন: *"আমার প্রেসক্রিপশন দাও"*)।';
  return msg;
}
