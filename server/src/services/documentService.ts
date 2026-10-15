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
 * Find matching document for user by search term or intent
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

  // Common synonym / transliteration dictionary
  const synonymMap: Record<string, string[]> = {
    'বোতল': ['bottol', 'botol', 'bottle'],
    'bottol': ['বোতল', 'botol', 'bottle'],
    'botol': ['বোতল', 'bottol', 'bottle'],
    'bottle': ['বোতল', 'bottol', 'botol'],
    'প্রেসক্রিপশন': ['prescription', 'প্রেস্ক্রিপশন', 'prescrip'],
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

  // 1. Direct Title Containment: Check if user's query contains any document's title
  for (const doc of userDocs) {
    const docTitle = doc.title.toLowerCase().trim();
    if (!docTitle) continue;

    // Direct substring in query (e.g. "amar bottol daw" contains "bottol")
    if (clean.includes(docTitle)) {
      return doc;
    }

    // Check synonyms for docTitle
    const syns = synonymMap[docTitle];
    if (syns) {
      for (const syn of syns) {
        if (clean.includes(syn)) return doc;
      }
    }
  }

  // 2. Word Token Matching: Strip stopwords and check matching meaningful words
  const stopWords = new Set([
    'আমাকে', 'দাও', 'দিস', 'দিবেন', 'দেন', 'পাঠাও', 'পাঠান', 'দেখাও', 'দেখান',
    'চাই', 'খুঁজে', 'খুঁজো', 'কোথায়', 'আছে', 'আমার', 'মায়ের', 'আম্মুর', 'বাবার',
    'আব্বুর', 'ভাই', 'একটু', 'টা', 'টি', 'dao', 'daw', 'dis', 'diben', 'den',
    'pathao', 'pathan', 'dehao', 'dekhaw', 'dekhan', 'chai', 'cay', 'lagbe',
    'khojo', 'khujo', 'kothay', 'ase', 'ache', 'amar', 'amr', 'bhai', 'ekto',
    'ta', 'ti', 'send', 'give', 'show', 'fetch', 'file', 'doc', 'document',
    'pic', 'image', 'photo', 'chobi', 'কাগজ'
  ]);

  const queryWords = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0980-\u09FF]/g, ''))
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  for (const word of queryWords) {
    // Check against each doc title
    for (const doc of userDocs) {
      const docTitle = doc.title.toLowerCase();
      if (docTitle.includes(word) || word.includes(docTitle)) {
        return doc;
      }
      // Check word synonyms
      const syns = synonymMap[word];
      if (syns && syns.some((s) => docTitle.includes(s))) {
        return doc;
      }
      // Check tags
      if (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(word))) {
        return doc;
      }
    }
  }

  // 3. Category match based on keywords
  const { category, tags } = detectDocumentCategory(clean);
  if (category !== 'Other') {
    const catMatch = userDocs.find(
      (d) => d.category === category || (d.tags && d.tags.some((t) => tags.includes(t)))
    );
    if (catMatch) return catMatch;
  }

  // 4. If query is a generic document request and user only has 1 document, return it
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
