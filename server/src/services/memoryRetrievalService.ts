import Reminder, { IReminder } from '../models/Reminder';
import Note, { INote } from '../models/Note';
import TodoList, { ITodoList } from '../models/TodoList';
import UserDocument from '../models/UserDocument';
import Wish from '../models/Wish';
import SystemSettings from '../models/SystemSettings';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { formatTime12Hour } from './aiWhatsAppService';
import { convertEnglishDigitsToBengali, findMatchingDocumentWithVersion } from './documentService';

// Bidirectional synonyms and phonetic transliterations for Bangla/Banglish/English
const synonymMap: Record<string, string[]> = {
  // Names & People
  'raiyan': ['রাইয়ান', 'রায়ান', 'rayan', 'raian', 'ছেলে'],
  'রাইয়ান': ['raiyan', 'রায়ান', 'rayan', 'ছেলে'],
  'রায়ান': ['raiyan', 'রাইয়ান', 'rayan', 'ছেলে'],
  'rayan': ['রাইয়ান', 'রায়ান', 'raiyan'],
  'rasel': ['রাসেল', 'রনি'],
  'রাসেল': ['rasel'],
  'roni': ['রনি'],
  'রনি': ['roni'],
  'rubel': ['রুবেল'],
  'রুবেল': ['rubel'],
  'mamun': ['মামুন'],
  'মামুন': ['mamun'],

  // Family Relations
  'chele': ['ছেলে', 'পুত্র', 'son', 'boy', 'রাইয়ান', 'raiyan'],
  'ছেলে': ['chele', 'পুত্র', 'son', 'রাইয়ান', 'raiyan'],
  'meye': ['মেয়ে', 'মেয়ে', 'কন্যা', 'daughter', 'girl'],
  'মেয়ে': ['meye', 'মেয়ে', 'কন্যা', 'daughter'],
  'মেয়ে': ['meye', 'মেয়ে', 'কন্যা', 'daughter'],
  'bou': ['বউ', 'স্ত্রী', 'ওয়াইফ', 'wife', 'wifeey'],
  'বউ': ['bou', 'স্ত্রী', 'ওয়াইফ', 'wife'],
  'স্ত্রী': ['bou', 'বউ', 'wife'],
  'wife': ['bou', 'বউ', 'স্ত্রী'],
  'baba': ['বাবা', 'আব্বু', 'আব্বা', 'father', 'dad'],
  'বাবা': ['baba', 'আব্বু', 'আব্বা', 'father'],
  'আব্বু': ['baba', 'বাবা', 'আব্বা', 'father', 'abbu'],
  'আব্বা': ['baba', 'বাবা', 'আব্বু', 'father', 'abba'],
  'ma': ['মা', 'আম্মু', 'আম্মা', 'mother', 'mom'],
  'মা': ['ma', 'আম্মু', 'আম্মা', 'mother'],
  'ammu': ['মা', 'আম্মু', 'আম্মা', 'mother', 'mom'],
  'আম্মু': ['ammu', 'মা', 'আম্মা', 'mother'],
  'আম্মা': ['ammu', 'মা', 'আম্মু', 'mother'],
  'vai': ['ভাই', 'ভাইয়া', 'ভাইয়ের', 'brother'],
  'bhai': ['ভাই', 'ভাইয়া', 'ভাইয়ের', 'brother'],
  'ভাই': ['bhai', 'vai', 'ভাইয়া', 'brother'],
  'bon': ['বোন', 'আপু', 'আপুর', 'sister'],
  'বোন': ['bon', 'আপু', 'আপুর', 'sister'],
  'apu': ['বোন', 'আপু', 'আপুর', 'sister'],
  'আপু': ['apu', 'বোন', 'sister'],

  // Occasions & Events
  'jonmodin': ['জন্মদিন', 'জন্ম দিন', 'birthday', 'bday', 'birth day'],
  'jonmodine': ['জন্মদিন', 'জন্ম দিন', 'birthday'],
  'jonmo': ['জন্মদিন', 'জন্ম দিন', 'birthday'],
  'din': ['দিন', 'তারিখ', 'day', 'date'],
  'জন্মদিন': ['jonmodin', 'birthday', 'bday', 'জন্ম দিন'],
  'birthday': ['জন্মদিন', 'jonmodin', 'bday'],
  'bday': ['জন্মদিন', 'jonmodin', 'birthday'],
  'biyebarsiki': ['বিবাহবার্ষিকী', 'বিবাহ বার্ষিকী', 'anniversary'],
  'anniversary': ['বিবাহবার্ষিকী', 'বিবাহ বার্ষিকী', 'biyebarsiki'],
  'বিবাহবার্ষিকী': ['anniversary', 'biyebarsiki'],
  'eid': ['ঈদ', 'ইদ'],
  'ঈদ': ['eid', 'ইদ'],

  // Tasks & Deadlines
  'tin': ['টিন', 'টিন সাবমিট', 'ট্যাক্স', 'tax', 'আয়কর'],
  'টিন': ['tin', 'ট্যাক্স', 'tax', 'আয়কর'],
  'bdapps': ['বিডিঅ্যাপস', 'bdapp'],
  'বিডিঅ্যাপস': ['bdapps'],
  'submit': ['সাবমিট', 'জমা', 'submission'],
  'সাবমিট': ['submit', 'জমা'],
  'tax': ['ট্যাক্স', 'আয়কর', 'টিন', 'tin'],
  'ট্যাক্স': ['tax', 'আয়কর', 'টিন', 'tin'],
  'bank': ['ব্যাংক', 'bank account', 'অ্যাকাউন্ট', 'হিসাব'],
  'ব্যাংক': ['bank', 'অ্যাকাউন্ট'],
  'account': ['অ্যাকাউন্ট', 'হিসাব', 'bank'],
  'অ্যাকাউন্ট': ['account', 'ব্যাংক'],
  'exam': ['পরীক্ষা', 'porikkha', 'test'],
  'porikkha': ['পরীক্ষা', 'exam', 'test'],
  'পরীক্ষা': ['exam', 'porikkha', 'test'],
  'meeting': ['মিটিং', 'মিটিংস', 'বৈঠক', 'meeting'],
  'মিটিং': ['meeting', 'বৈঠক'],

  // Medicine & Health
  'osudh': ['ওষুধ', 'ঔষধ', 'medicine', 'med', 'tab', 'tablet'],
  'osud': ['ওষুধ', 'ঔষধ', 'medicine', 'med'],
  'oushodh': ['ওষুধ', 'ঔষধ', 'medicine'],
  'ওষুধ': ['osudh', 'medicine', 'ঔষধ', 'ট্যাবলেট'],
  'ঔষধ': ['osudh', 'medicine', 'ওষুধ', 'ট্যাবলেট'],
  'medicine': ['ওষুধ', 'ঔষধ', 'osudh'],
  'sanbur': ['সানবার', 'sunbur', 'sanbur 30', 'sanbur 30mg'],
  'sunbur': ['সানবার', 'sanbur', 'sunbur 30'],
  'সানবার': ['sanbur', 'sunbur'],
  'napa': ['নাপা'],
  'নাপা': ['napa'],
  'seclo': ['সেকলো'],
  'সেকলো': ['seclo'],
  'sokal': ['সকাল', 'সকালের', 'morning'],
  'সকাল': ['sokal', 'সকালের', 'morning'],
  'rat': ['রাত', 'রাতের', 'night'],
  'রাত': ['rat', 'রাতের', 'night'],
  'dupur': ['দুপুর', 'দুপুরের', 'afternoon'],
  'দুপুর': ['dupur', 'দুপুরের'],

  // Ramadan & Prayers
  'sehri': ['সেহরি', 'সেহেরি', 'সাহরি', 'সাহারী', 'sehri alarm', 'অ্যালার্ম'],
  'seheri': ['সেহরি', 'সেহেরি', 'সাহরি'],
  'sahari': ['সেহরি', 'সেহেরি', 'সাহরি'],
  'সেহরি': ['sehri', 'seheri', 'সাহরি', 'sahari'],
  'সেহেরি': ['sehri', 'seheri', 'সাহরি'],
  'ifter': ['ইফতার', 'ইফতারি', 'iftar'],
  'iftar': ['ইফতার', 'ইফতারি', 'ifter'],
  'ইফতার': ['iftar', 'ifter'],
  'namaj': ['নামাজ', 'নামায', 'সালাত', 'prayer', 'salat'],
  'নামাজ': ['namaj', 'নামায', 'salat'],
  'নামায': ['namaj', 'নামাজ', 'salat'],

  // Special Memories & Places
  'khobor': ['খবর', 'সংবাদ', 'news'],
  'খবর': ['khobor', 'সংবাদ'],
  'bishesh': ['বিশেষ', 'special'],
  'বিশেষ': ['bishesh', 'special'],
  'basa': ['বাসা', 'বাড়ি', 'বাড়ি', 'home', 'house'],
  'basha': ['বাসা', 'বাড়ি', 'বাড়ি', 'home'],
  'bari': ['বাড়ি', 'বাড়ি', 'বাসা', 'home'],
  'বাসা': ['basa', 'বাড়ি', 'home'],
  'বাড়ি': ['bari', 'বাসা', 'home'],
  'office': ['অফিস', 'কাজ', 'work'],
  'অফিস': ['office', 'কাজ']
};

// Bengali and English stop words stripped during inquiry
const STOP_WORDS = new Set([
  'kobe', 'kokhon', 'koytay', 'koiday', 'kothay', 'kothai', 'koi',
  'ki', 'কী', 'কি', 'কত', 'কতো', 'koto',
  'tarikh', 'তারিখ', 'তারিখে', 'সাল', 'সালের', 'saler', 'sal',
  'bolo', 'boloto', 'bologen', 'bologi', 'বলো', 'বলেন', 'বলুন', 'বলতো',
  'daw', 'dao', 'diben', 'den', 'দাও', 'দেন', 'দিবেন', 'দিও', 'diow', 'diyo', 'dio',
  'dekhao', 'dekhaw', 'dekhan', 'দেখাও', 'দেখান',
  'ache', 'asen', 'আছে', 'আছেন', 'ase', 'aseki', 'acheki',
  'naki', 'নাকি', 'er', 'ar', 'এর', 'র', 'ar', 'বা', 'এবং', 'and',
  'ta', 'ti', 'টা', 'টি', 'গুলো', 'গুলা', 'gula', 'gulo',
  'amr', 'amar', 'আমার', 'মায়ের', 'বাবার', 'ছেলের', 'apnar', 'আপনার', 'tumar', 'tomar', 'তোমার',
  'please', 'bhai', 'ভাই', 'vai',
  'tottho', 'তথ্য', 'memory', 'স্মৃতি', 'স্মৃতিতে',
  'reminder', 'reminders', 'remindere', 'রিমাইন্ডার', 'রিমাইন্ডারে',
  'seve', 'save', 'saved', 'সেভ', 'সংরক্ষিত', 'রাখা', 'rakha', 'ase',
  'koro', 'করো', 'করুন', 'korte', 'করতে', 'hobe', 'হবে', 'about', 'regarding'
]);

/**
 * Expand a search word with its phonetic and transliteration variants
 */
export function getTermVariants(word: string): string[] {
  const clean = word.toLowerCase().trim();
  const variants = new Set<string>([clean]);
  
  if (synonymMap[clean]) {
    synonymMap[clean].forEach((s) => variants.add(s.toLowerCase().trim()));
  }

  // Handle common suffixes (er, ar, e, te, r)
  const stems = [
    clean.replace(/(?:er|ar|e|te|r)$/, ''),
    clean.replace(/(?:এর|র|ে|তে)$/, '')
  ].filter((s) => s.length >= 3);

  for (const stem of stems) {
    variants.add(stem);
    if (synonymMap[stem]) {
      synonymMap[stem].forEach((s) => variants.add(s.toLowerCase().trim()));
    }
  }

  return Array.from(variants);
}

/**
 * Extract clean search tokens from a user query or raw text
 */
export function extractSearchTokens(text: string): string[] {
  if (!text) return [];

  // Replace punctuation with spaces
  const clean = text
    .replace(/[?,।!:\-_\/\\()"'`~@#$%^&*+=;]/g, ' ')
    .toLowerCase()
    .trim();

  // Split into words
  const words = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0980-\u09FF]/g, ''))
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  // Also extract composite tokens if user wrote "jonmo din" -> "jonmodin"
  if (clean.includes('jonmo din') || clean.includes('jonmodin') || clean.includes('জন্ম দিন') || clean.includes('জন্মদিন')) {
    words.push('jonmodin', 'জন্মদিন');
  }

  return Array.from(new Set(words));
}

export interface ReminderSearchResult {
  topReminder: IReminder | null;
  matchingReminders: IReminder[];
  score: number;
}

/**
 * Intelligent Reminder search across user's saved reminders
 */
export async function searchReminders(
  userId: string,
  query: string,
  rawText?: string
): Promise<ReminderSearchResult> {
  const tokens = Array.from(new Set([
    ...extractSearchTokens(query),
    ...extractSearchTokens(rawText || '')
  ]));

  const rawClean = (rawText || query || '')
    .replace(/[?,।!:\-_()]/g, '')
    .trim()
    .toLowerCase();

  // Load all user reminders that are not cancelled
  const userReminders = await Reminder.find({
    userId,
    status: { $ne: 'Cancelled' }
  }).sort({ date: 1, time: 1 });

  if (!userReminders || userReminders.length === 0) {
    return { topReminder: null, matchingReminders: [], score: 0 };
  }

  const scored: Array<{ reminder: IReminder; score: number }> = [];

  for (const rem of userReminders) {
    const titleLower = (rem.title || '').toLowerCase().trim();
    const descLower = (rem.description || '').toLowerCase().trim();
    const catLower = (rem.category || '').toLowerCase().trim();
    let score = 0;

    // 1. Direct match: Entire raw inquiry matches title substring
    if (rawClean && (rawClean.includes(titleLower) || titleLower.includes(rawClean))) {
      score += 150;
    }

    // 2. Token variant matching
    let matchedTokenCount = 0;
    for (const token of tokens) {
      const variants = getTermVariants(token);

      const inTitle = variants.some((v) => titleLower.includes(v));
      const inDesc = variants.some((v) => descLower.includes(v));
      const inCat = variants.some((v) => catLower.includes(v));
      const inMeds = rem.medicines?.some((m) => variants.some((v) => m.name.toLowerCase().includes(v)));

      if (inTitle) {
        score += 50;
        matchedTokenCount++;
        // Extra boost for distinct names or specific keywords
        if (token.length >= 4 || ['tin', 'টিন', 'বউ', 'মা', 'son', 'দাও'].includes(token)) {
          score += 25;
        }
      } else if (inMeds) {
        score += 45;
        matchedTokenCount++;
      } else if (inDesc) {
        score += 30;
        matchedTokenCount++;
      } else if (inCat) {
        score += 25;
        matchedTokenCount++;
      }
    }

    // High bonus if multiple distinct tokens matched (e.g. "Raiyan" AND "jonmodin")
    if (matchedTokenCount >= 2) {
      score += 60;
    }

    if (score >= 40) {
      scored.push({ reminder: rem, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return {
      topReminder: scored[0].reminder,
      matchingReminders: scored.map((s) => s.reminder),
      score: scored[0].score
    };
  }

  // Fallback: If rule-based score yielded no confident match, but Gemini is available
  // and user query looks like a question, let Gemini verify the reminders
  if (userReminders.length > 0 && (rawText || query)) {
    try {
      const geminiMatch = await matchReminderWithGemini(userReminders, rawText || query);
      if (geminiMatch) {
        return {
          topReminder: geminiMatch,
          matchingReminders: [geminiMatch],
          score: 80
        };
      }
    } catch (gErr) {
      // Ignore Gemini fallback errors
    }
  }

  return { topReminder: null, matchingReminders: [], score: 0 };
}

/**
 * Gemini LLM second-pass matcher for complex conversational questions
 */
async function matchReminderWithGemini(reminders: IReminder[], userQuery: string): Promise<IReminder | null> {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const settings = await SystemSettings.findOne();
      apiKey = settings?.geminiApiKey;
    } catch {}
  }
  if (!apiKey) return null;

  const candidateList = reminders.slice(0, 15).map((r, i) => {
    const dStr = r.date ? new Date(r.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }) : '';
    return `${i + 1}. Title: "${r.title}", Date: ${dStr}, Time: ${r.time}, Category: ${r.category}`;
  }).join('\n');

  const prompt = `The user asked this question in Bengali or English: "${userQuery}".
Here is the user's list of saved reminders:
${candidateList}

Does ANY reminder in the list answer the user's question (e.g. asking when a birthday, meeting, medicine, or event is)?
Return JSON ONLY:
{ "found": true, "index": 1 } or { "found": false }`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.found && typeof parsed.index === 'number' && parsed.index >= 1 && parsed.index <= reminders.length) {
      return reminders[parsed.index - 1];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Format a single matched reminder into a beautiful, respectful response
 */
export function formatReminderMatchMessage(reminder: IReminder, honorific?: string): string {
  const d = new Date(reminder.date);
  const dayBn = convertEnglishDigitsToBengali(d.getDate());
  const monthBn = d.toLocaleDateString('bn-BD', { month: 'long', timeZone: 'Asia/Dhaka' });
  const yearBn = convertEnglishDigitsToBengali(d.getFullYear());
  const timeBn = formatTime12Hour(reminder.time);

  const titleLower = reminder.title.toLowerCase();
  let header = '📌 আপনার রিমাইন্ডার অনুযায়ী:';
  if (titleLower.includes('জন্মদিন') || titleLower.includes('birthday') || titleLower.includes('bday')) {
    header = '🎂 আপনার রিমাইন্ডার অনুযায়ী:';
  } else if (titleLower.includes('ওষুধ') || titleLower.includes('ঔষধ') || titleLower.includes('medicine')) {
    header = '💊 আপনার ওষুধের রিমাইন্ডার অনুযায়ী:';
  } else if (titleLower.includes('মিটিং') || titleLower.includes('meeting')) {
    header = '📅 আপনার মিটিং রিমাইন্ডার অনুযায়ী:';
  } else if (titleLower.includes('সেহরি') || titleLower.includes('ইফতার')) {
    header = '🌙 আপনার রমজান রিমাইন্ডার অনুযায়ী:';
  }

  const salutation = honorific ? ` ${honorific}` : '';
  let msg = `${header}\n\n`;
  msg += `📌 *${reminder.title}*\n`;
  msg += `📅 *তারিখ:* ${dayBn} ${monthBn} (${yearBn} সাল)\n`;
  msg += `⏰ *সময়:* ${timeBn}\n`;

  const statusBn = reminder.status === 'Pending' ? 'পেন্ডিং (সক্রিয়)' : reminder.status;
  msg += `🔔 *স্ট্যাটাস:* ${statusBn}\n`;

  if (reminder.description) {
    msg += `📝 *বিবরণ:* ${reminder.description}\n`;
  }
  if (reminder.repeat && reminder.repeat !== 'Once') {
    const repeatBn: Record<string, string> = {
      Daily: 'প্রতিদিন',
      Weekly: 'প্রতি সপ্তাহে',
      Monthly: 'প্রতি মাসে',
      Yearly: 'প্রতি বছর'
    };
    msg += `🔁 *পুনরাবৃত্তি:* ${repeatBn[reminder.repeat] || reminder.repeat}\n`;
  }

  msg += `\n💡 আপনার স্মৃতিতে সেভ করা রিমাইন্ডার থেকে এই তথ্যটি দেওয়া হলো${salutation}।`;
  return msg.trim();
}

/**
 * Format multiple matched reminders into a clean list
 */
export function formatMultipleRemindersMessage(reminders: IReminder[], query: string, honorific?: string): string {
  const salutation = honorific ? ` ${honorific}` : '';
  let msg = `📋 আপনার "${query}" সম্পর্কিত রিমাইন্ডারসমূহ (${convertEnglishDigitsToBengali(reminders.length)}টি):\n\n`;

  reminders.forEach((r, idx) => {
    const d = new Date(r.date);
    const dStr = d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' });
    const timeStr = formatTime12Hour(r.time);
    msg += `${idx + 1}. 📌 *${r.title}*\n   ⏰ সময়: ${timeStr} (${dStr})\n\n`;
  });

  msg += `💡 নির্দিষ্ট কোনো রিমাইন্ডার পরিবর্তন বা ডিলিট করতে নম্বর বলুন${salutation}।`;
  return msg.trim();
}

export interface UnifiedMemoryResult {
  found: boolean;
  type?: 'note' | 'reminder' | 'document' | 'todolist' | 'wish';
  replyMessage?: string;
  data?: any;
}

/**
 * Comprehensive Unified Memory Search across ALL Smriti Life collections:
 * 1. Notes (Personal info, address, blood group, passwords)
 * 2. Reminders (Birthdays, meetings, medicine, deadlines)
 * 3. TodoList (Checklists, shopping, tasks)
 * 4. UserDocument (Prescriptions, reports, certificates)
 * 5. Wishes (Celebrations, cards)
 */
export async function searchUnifiedMemory(
  userId: string,
  query: string,
  rawText?: string,
  honorific?: string
): Promise<UnifiedMemoryResult> {
  const cleanQ = (query || '').trim();
  const rawQ = (rawText || '').trim();

  // 1. Check Notes first if exact or strong match
  const noteCore = cleanQ
    .replace(/(?:\b(?:আমার|amr|amar|ta|ti|দাও|বলো|বলোতো|কি|কী|কত|কতো|খুঁজে|daw|dao|ki|bolo|koto|koi|kothay|ache|ase|certificate)\b|টা|টি|দাও|বলো|বলোতো|কি|কী|কত|কতো|খুঁজে|কই|কোথায়|আছে|\?)/gi, '')
    .trim();

  if (noteCore) {
    const escaped = noteCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    const contentRegex = /^[a-zA-Z0-9]+$/.test(noteCore)
      ? new RegExp(`\\b${escaped}\\b`, 'i')
      : searchRegex;
    const matchedNote = await Note.findOne({
      userId,
      $or: [{ title: searchRegex }, { content: contentRegex }]
    });

    if (matchedNote) {
      return {
        found: true,
        type: 'note',
        data: matchedNote,
        replyMessage: `📌 আপনার সংরক্ষিত *${matchedNote.title}*:\n\n📍 ${matchedNote.content}`
      };
    }
  }

  // 2. Check Reminders (Birthdays, events, medicine, tasks)
  const remResult = await searchReminders(userId, cleanQ, rawQ);
  if (remResult.topReminder) {
    if (remResult.matchingReminders.length > 1 && remResult.score < 90) {
      return {
        found: true,
        type: 'reminder',
        data: remResult.matchingReminders,
        replyMessage: formatMultipleRemindersMessage(remResult.matchingReminders, cleanQ, honorific)
      };
    }
    return {
      found: true,
      type: 'reminder',
      data: remResult.topReminder,
      replyMessage: formatReminderMatchMessage(remResult.topReminder, honorific)
    };
  }

  // 3. Check Todo Lists
  if (cleanQ) {
    const todoRegex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchedList = await TodoList.findOne({
      userId,
      $or: [
        { title: todoRegex },
        { 'items.text': todoRegex }
      ]
    });

    if (matchedList) {
      const pendingItems = matchedList.items.filter((i) => !i.completed);
      let todoMsg = `📝 আপনার টু-ডু লিস্ট *${matchedList.title}*:\n\n`;
      if (pendingItems.length === 0) {
        todoMsg += `✅ এই লিস্টের সব কাজ সম্পন্ন হয়েছে!`;
      } else {
        pendingItems.forEach((it, idx) => {
          todoMsg += `${idx + 1}. ⬜ ${it.text}\n`;
        });
      }
      return {
        found: true,
        type: 'todolist',
        data: matchedList,
        replyMessage: todoMsg.trim()
      };
    }
  }

  // 4. Check Documents (Prescriptions, reports, NID)
  const docResult = await findMatchingDocumentWithVersion(userId, cleanQ || rawQ);
  if (docResult.doc) {
    return {
      found: true,
      type: 'document',
      data: docResult
    };
  }

  return { found: false };
}
