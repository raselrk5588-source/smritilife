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
  const clean = query
    .replace(/[?,।!]/g, '')
    .trim()
    .toLowerCase();

  // Strip common request intent words
  const searchKeywords = clean
    .replace(
      /(?:আমাকে|দাও|পাঠাও|পাঠান|দিবেন|দেখান|দেখাও|খুঁজে\s*দাও|chai|dao|pathao|pathan|dehao|dekhan|send|show|give|fetch|আমার|amr|amar)/gi,
      ''
    )
    .trim();

  if (!searchKeywords) {
    // If just "file dao" or "document dao", return latest document
    return await UserDocument.findOne({ userId }).sort({ createdAt: -1 });
  }

  // 1. Direct regex on title
  let match = await UserDocument.findOne({
    userId,
    title: { $regex: new RegExp(escapeRegex(searchKeywords), 'i') }
  }).sort({ createdAt: -1 });

  if (match) return match;

  // 2. Search category or tags
  const { category, tags } = detectDocumentCategory(searchKeywords);
  if (category !== 'Other') {
    match = await UserDocument.findOne({
      userId,
      $or: [{ category }, { tags: { $in: tags } }]
    }).sort({ createdAt: -1 });
    if (match) return match;
  }

  // 3. Search word-by-word
  const words = searchKeywords.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 0) {
    const wordRegexes = words.map((w) => ({ title: { $regex: new RegExp(escapeRegex(w), 'i') } }));
    match = await UserDocument.findOne({
      userId,
      $or: wordRegexes
    }).sort({ createdAt: -1 });
    if (match) return match;
  }

  return null;
}

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
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
