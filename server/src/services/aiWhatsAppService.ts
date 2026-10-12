import { GoogleGenerativeAI } from '@google/generative-ai';
import SystemSettings from '../models/SystemSettings';

// In-memory chat history for WhatsApp users (In production, save to Redis or DB)
const chatHistories = new Map<string, any[]>();

/**
 * Converts 24-hour HH:mm (e.g. "13:00", "01:30") to human-friendly 12-hour format with AM/PM (e.g. "1:00 PM", "1:30 AM")
 */
export const formatTime12Hour = (time24?: string): string => {
  if (!time24 || !time24.includes(':')) return time24 || '';
  const parts = time24.split(':');
  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || '00';
  if (isNaN(hour)) return time24;
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  
  return `${hour}:${minute} ${ampm}`;
};

/**
 * Intelligent Bengali/Banglish time parser for phrases like "sokal 9ta", "bikal 4ta", "rat 8ta", "dupur 2ta", "sondha 7ta", "1pm", "4:30 pm"
 */
export const parseBengaliTime = (rawText: string): string => {
  const bnToEn: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const text = rawText.replace(/[০-৯]/g, (m) => bnToEn[m] || m);
  const lower = text.toLowerCase();

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(টা|টায়|টায়|am|pm|AM|PM)?/i);
  if (!timeMatch) return '10:00';

  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] || '00';
  const tag = (timeMatch[3] || '').toLowerCase();

  const isMorning = lower.includes('সকাল') || lower.includes('ভোর') || lower.includes('sokal') || lower.includes('shokal') || lower.includes('vhor') || lower.includes('vor') || tag === 'am';
  const isNoon = lower.includes('দুপুর') || lower.includes('dupur') || lower.includes('dupor');
  const isAfternoon = lower.includes('বিকাল') || lower.includes('বিকেল') || lower.includes('bikal') || lower.includes('bikele') || lower.includes('bikale');
  const isEvening = lower.includes('সন্ধ্যা') || lower.includes('সন্ধে') || lower.includes('sondha') || lower.includes('shondha') || lower.includes('shondhe');
  const isNight = lower.includes('রাত') || lower.includes('রাত্রে') || lower.includes('rat') || lower.includes('raat') || lower.includes('ratri') || lower.includes('ratre');
  const isPM = tag === 'pm' || isNoon || isAfternoon || isEvening || isNight;

  if (isPM) {
    if (hour < 12) {
      // e.g. 1টা দুপুর/রাত -> 13:00 / 01:00?
      // In Bengali: "রাত ১টা" = 01:00 AM (after midnight) or late night. But usually 12, 1, 2, 3, 4 at night can be AM.
      // Standard: 1pm - 11pm are afternoon/evening/night (+12)
      if (isNight && (hour === 1 || hour === 2 || hour === 3 || hour === 4)) {
        // Late night/midnight (e.g. 1am, 2am)
        hour = hour;
      } else if (isNight && hour === 12) {
        hour = 0; // midnight 12:00
      } else {
        hour += 12;
      }
    }
  } else if (isMorning) {
    if (hour === 12) hour = 0;
  }

  if (hour >= 24) hour = 10;
  return `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

/**
 * Intelligent relative date parser supporting Bengali ('কাল', 'আগামীকাল', 'পরশু', 'আজ'),
 * Banglish ('kal', 'kaal', 'agamikal', 'porshu', 'aj', 'ajke'), and English ('tomorrow', 'today').
 * If no explicit date keyword is found, but the parsed time has already passed today in Bangladesh,
 * it rolls over to tomorrow to prevent triggering an instant overdue alert!
 */
export const parseRelativeDate = (rawText: string, parsedTime?: string): Date => {
  const lower = (rawText || '').toLowerCase().trim();

  // Current date & time in Bangladesh (Asia/Dhaka)
  const now = new Date();
  const dhakaStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"
  const dhakaTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false }); // "HH:mm:ss"

  const [year, month, day] = dhakaStr.split('-').map(Number);
  // Construct date object representing midnight in UTC for Bangladesh
  const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Match tomorrow keywords: Banglish ('kal', 'kaal', 'kalke', 'kaalke', 'agamikal', 'agamikaal', 'tomorrow')
  // and Bengali ('কাল', 'কালে', 'কালকে', 'আগামীকাল') while ensuring Bengali 'সকাল' is NOT mistaken for 'কাল'
  const isTomorrowBanglish = /\b(?:kal|kaal|kalke|kaalke|agamikal|agamikaal|tomorrow)\b/i.test(lower);
  const isTomorrowBengali = /(?:^|[^\u0980-\u09FF]|[\s])(?:আগামীকাল|কালকে|কালে|কাল)(?:[^\u0980-\u09FF]|[\s]|$)/.test(rawText) ||
    (/(?<![সsh])(?:কাল|আগামীকাল)/i.test(rawText) && !rawText.includes('আজ') && !rawText.includes('সকাল') && rawText.includes('কাল'));
  const isTomorrow = isTomorrowBanglish || isTomorrowBengali;

  // Day after tomorrow: Banglish ('porshu', 'porshudin') / Bengali ('পরশু', 'পরশুদিন')
  const isDayAfterBanglish = /\b(?:porshu|porshudin|day after tomorrow)\b/i.test(lower);
  const isDayAfterBengali = /(?:পরশু|পরশুদিন)/.test(rawText);
  const isDayAfter = isDayAfterBanglish || isDayAfterBengali;

  // Today keywords: Banglish ('aj', 'aaj', 'ajke', 'aajke', 'today') / Bengali ('আজ', 'আজকে')
  const isTodayBanglish = /\b(?:aj|aaj|ajke|aajke|today)\b/i.test(lower);
  const isTodayBengali = /(?:^|[^\u0980-\u09FF]|[\s])(?:আজ|আজকে)(?:[^\u0980-\u09FF]|[\s]|$)/.test(rawText) || rawText.includes('আজ');
  const isToday = isTodayBanglish || isTodayBengali;

  if (isDayAfter) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 2);
  } else if (isTomorrow) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  } else if (!isToday && parsedTime) {
    // If user specified a time without explicitly saying "today" or "tomorrow":
    // Check if the time has already passed today in Dhaka
    const [currentHour, currentMin] = dhakaTimeStr.split(':').map(Number);
    const [targetHour, targetMin] = parsedTime.split(':').map(Number);

    const currentTotalMin = currentHour * 60 + currentMin;
    const targetTotalMin = targetHour * 60 + targetMin;

    if (targetTotalMin <= currentTotalMin) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }
  }

  return targetDate;
};

/**
 * Intelligent extractor for the actual message body intended for the recipient.
 * Handles quoted text, 'j' / 'je' / 'যে' clauses, and cleans prefixes cleanly without corrupting words.
 */
export const extractScheduledMessage = (rawText: string, recipientPhone?: string): string => {
  let text = rawText.trim();
  if (recipientPhone) {
    text = text.replace(recipientPhone, ' ').trim();
  }

  // 1. Quoted message (e.g. "koi tumi bhiya..." or '...')
  const quoteMatch = text.match(/["'“‘]([^"'“‘”]+)["'”’]/);
  if (quoteMatch && quoteMatch[1].trim().length > 1) {
    return quoteMatch[1].trim();
  }

  // 2. Connector clause: 'j ...', 'je ...', 'যে ...' (e.g. "...ar somoi j bari jaba kobe")
  const jeMatch = text.match(/\b(?:j|je|যে)\s+(.+)$/i);
  if (jeMatch && jeMatch[1].trim().length > 1) {
    return jeMatch[1].trim();
  }

  // 3. Connector colon: 'message: ...' or 'মেসেজ: ...'
  const colonMatch = text.match(/(?:message|msg|বার্তা|মেসেজ)\s*[:：\-]\s*(.+)$/i);
  if (colonMatch && colonMatch[1].trim().length > 1) {
    return colonMatch[1].trim();
  }

  // 4. Fallback cleanup: strip metadata prefixes cleanly using whole-word boundaries
  let cleaned = text
    .replace(/(?:ay|ei|ai|oi)\s*number(?:\s*(?:a|e|te))?/gi, ' ')
    .replace(/\b(?:number|nombore|nambare|নাম্বারে|নম্বরে)(?:\s*(?:a|e|te))?\b/gi, ' ')
    .replace(/\b(?:akta|ekta|একটি|একটা)\b/gi, ' ')
    .replace(/\b(?:message|msg|বার্তা|মেসেজ)\b/gi, ' ')
    .replace(/\b(?:send\s*kore\s*diba|pathiye\s*dio|pathay\s*dio|send\s*koro|pathao|pathano|pathaiba|পাঠিয়ে\s*দিও|পাঠিয়ে\s*দিন|পাঠাও)\b/gi, ' ')
    .replace(/\b(?:aj|aaj|কাল|আগামীকাল|আজ|kal|kaal|tomorrow|today)(?:\s*k)?\b/gi, ' ')
    .replace(/\b(?:rat|raat|sokal|shokal|dupur|bikal|sondha|shondha|রাত|সকাল|দুপুর|বিকাল|সন্ধ্যা)\b/gi, ' ')
    .replace(/(\d{1,2}(?::\d{2})?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?|[০-৯]{1,2}(?::[০-৯]{2})?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/gi, ' ')
    .replace(/\b(?:ar|er|এর|সময়|somoy|somoi|time)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading leftover words like "diba", "k", "j", "pathao", ":"
  cleaned = cleaned.replace(/^(?:diba|dibo|dio|diyo|pathao|pathano|k|j|je|bolba|bolbe|[:：\-])\s+/i, '').trim();

  return cleaned && cleaned.length >= 2 ? cleaned : 'জরুরি বার্তা';
};

const SYSTEM_INSTRUCTION = `
You are an AI assistant for a WhatsApp bot called "Smriti" (স্মৃতি).
Your job is to analyze the user's message and return a JSON object with the action to perform.
The user speaks Bengali, Banglish, or English. Always be warm, friendly, polite, and helpful.

When the user sends greetings (hi, hello, hlw, salam), asks who you are, asks your name, asks how you are, asks what you do, or has casual conversation:
- Action: "general_reply"
- Data: {}
- "replyText": A sweet, polite, and natural response in clear Bengali.
  * For greeting ("hi", "hello", "hlw", "assalamu alaikum", etc.):
    "আসসালামু আলাইকুম! আমি স্মৃতি (Smriti), আপনার এআই অ্যাসিস্ট্যান্ট। 😊 আমি কীভাবে আপনাকে সাহায্য করতে পারি বলুন?"
  * For name question ("তোমার নাম কি?", "tumar nam ki", "who are you"):
    "আসসালামু আলাইকুম! আমার নাম স্মৃতি (Smriti), আপনার পার্সোনাল এআই অ্যাসিস্ট্যান্ট। 😊 আমি আপনাকে কীভাবে সাহায্য করতে পারি বলুন?"
  * For how are you ("কেমন আছো?", "kemon acho"):
    "আলহামদুলিল্লাহ, আমি বেশ ভালো আছি! আশা করি আপনিও ভালো আছেন। 😊 আজ আপনাকে কীভাবে সাহায্য করতে পারি বলুন?"
  * For what you do or help ("কী করতে পারো?", "help"):
    "আমি আপনার পার্সোনাল এআই অ্যাসিস্ট্যান্ট স্মৃতি (Smriti)। 😊\n\nআমি যা যা করতে পারি:\n• যেকোনো কাজের রিমাইন্ডার মনে করিয়ে দেওয়া\n• নির্ধারিত সময়ে কাউকে স্বয়ংক্রিয় মেসেজ পাঠানো\n• প্রিয়জনকে সুন্দর উইশ কার্ড পাঠিয়ে দেওয়া\n\nআপনি কী করতে চান বলুন?"

Your capabilities include:
1. Listing/viewing existing reminders ("list_reminders").
2. Deleting all reminders ("delete_all_reminders").
3. Creating reminders (for self or third-party recipients with scheduled messages) ("create_reminder").
4. Modifying/updating date, time, or title of an existing reminder ("modify_reminder").
5. Canceling a specific reminder by title ("cancel_reminder").
6. Deleting a specific reminder permanently by title ("delete_reminder").
7. Creating and sending personalized AI wish cards (Birthday, Anniversary, Eid, New Year, Congratulations, Love, Friendship, General Wishes) with images delivered directly to WhatsApp numbers ("create_wish")!
8. Friendly conversational responses ("general_reply").

Possible actions:
1. list_reminders:
   When user asks to view, check, list, or see their pending reminders or asks what reminders are due today (e.g. "আজ কি রিমাইন্ডার আছে", "আজকের রিমাইন্ডার", "সব রিমাইন্ডার দেখাও", "কি কি পেন্ডিং আছে").
   Fields in "data":
   - "filter"?: "today" | "all" (Set "today" if user specifically asks for today's reminders e.g. "আজ কি রিমাইন্ডার আছে", "আজকের রিমাইন্ডার", "aj ki reminder ache", "today's reminders". Otherwise set "all" or omit).

2. delete_all_reminders:
   When user asks to delete or clear all of their reminders.
   Bengali examples: "সব রিমাইন্ডার ডিলিট করে দাও", "সব রিমাইন্ডার মুছে দাও", "সব ডিলিট করো", "delete all reminders", "clear all reminders".
   Data: {}

3. modify_reminder:
   When user wants to edit, update, reschedule, or change the time, date, or title of an existing reminder.
   Bengali/Banglish examples: 
   - "মিটিং রিমাইন্ডার সময় পরিবর্তন করে বিকাল ৫টায় দাও"
   - "মিটিং রিমাইন্ডার কাল সকাল ১১টায় পিছিয়ে দাও"
   - "ডাক্তার রিমাইন্ডারের সময় আপডেট করো রাত ৯টায়"
   - "meeting reminder time change kore 5pm koro"
   - "update reminder meeting to tomorrow 4pm"
   Fields in "data":
   - "searchQuery": string (The title or keyword of the existing reminder to identify it)
   - "date"?: string (YYYY-MM-DD if date changed)
   - "time"?: string (HH:mm if time changed)
   - "newTitle"?: string (Optional, if user also wants to rename the reminder)

4. cancel_reminder:
   When user wants to cancel or stop a specific reminder.
   Data: { "searchQuery": string } (The title or keyword of the reminder to cancel).

5. delete_reminder:
   When user wants to delete a specific reminder permanently.
   Data: { "searchQuery": string } (The title or keyword of the reminder to delete).

5. create_wish:
   When user asks to send a birthday wish (জন্মদিনের শুভেচ্ছা), anniversary (বিবাহবার্ষিকী), Eid (ঈদ), New Year (নতুন বছর), Congratulations (অভিনন্দন), or any celebration wish/card to a phone number.
   Fields in "data":
   - "occasion": "birthday" | "anniversary" | "eid" | "newyear" | "congratulations" | "love" | "general"
   - "recipientName": string (e.g. "রাহুল", "বন্ধু", "বোন")
   - "recipientPhone": string (e.g. "01734042131")
   - "message": string (Heartfelt, warm, personalized Bengali/English wish message tailored for the occasion and recipient)
   - "date": string (YYYY-MM-DD, e.g. "2026-10-11")
   - "time": string (HH:mm, e.g. "12:00")
   - "sendNow": boolean (true if user wants it sent immediately or doesn't specify a future time/date; false if scheduled for future)

6. create_reminder:
   When user wants a task reminder for themselves or a plain scheduled text message to another number.
   Fields in "data":
   - "title": string
   - "recipientPhone"?: string
   - "customMessage"?: string
   - "date": string (YYYY-MM-DD)
   - "time": string (HH:mm)

7. general_reply (for greetings, conversational questions, or help)

Example Response for Wish:
{
  "action": "create_wish",
  "data": {
    "occasion": "birthday",
    "recipientName": "রাহুল",
    "recipientPhone": "01734042131",
    "message": "শুভ জন্মদিন রাহুল! তোমার জীবনের প্রতিটি দিন আনন্দ, সুস্বাস্থ্য এবং অনন্য সাফল্যে ভরে উঠুক।",
    "date": "2026-10-11",
    "time": "12:00",
    "sendNow": true
  },
  "replyText": "🎉 রাহুলের জন্য জন্মদিনের উইশ কার্ড প্রস্তুত করা হয়েছে! 01734042131 নম্বরে পাঠিয়ে দেওয়া হচ্ছে..."
}
OR for future scheduled wish:
{
  "action": "create_wish",
  "data": {
    "occasion": "birthday",
    "recipientName": "রাহুল",
    "recipientPhone": "01734042131",
    "message": "শুভ জন্মদিন প্রিয় বন্ধু রাহুল! তোমার আগামী দিনগুলো ভরে উঠুক অফুরন্ত আনন্দে।",
    "date": "2026-10-12",
    "time": "00:00",
    "sendNow": false
  },
  "replyText": "🎉 ঠিক আছে! কাল রাত ১২:০০ টায় 01734042131 নম্বরে রাহুলের জন্মদিনের উইশ কার্ড এবং শুভেচ্ছা বার্তা স্বয়ংক্রিয়ভাবে পাঠিয়ে দেওয়া হবে।"
}
OR for reminder:
{
  "action": "create_reminder",
  "data": {
    "title": "ডাক্তারের অ্যাপয়েন্টমেন্ট",
    "date": "2026-10-11",
    "time": "14:00"
  },
  "replyText": "আপনার রিমাইন্ডার সেট করা হয়েছে!"
}

Only return the JSON. No markdown formatting like \`\`\`json.
`;

export const analyzeMessage = async (whatsappNumber: string, userMessage: string) => {
  try {
    // Fetch settings to get API key
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const settings = await SystemSettings.findOne();
        apiKey = settings?.geminiApiKey;
      } catch (err) {}
    }

    if (!apiKey) {
      console.error("Gemini API Key is missing. Please add it in Admin Panel or .env file.");
      return {
        action: 'general_reply',
        replyText: 'দুঃখিত, সিস্টেমটি সাময়িকভাবে বন্ধ আছে। অ্যাডমিনকে জানান (API Key Missing)।'
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Helper to try models in order: gemini-3.8-flash, then gemini-2.5-flash
    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let parsedResponse: any = null;

    if (!chatHistories.has(whatsappNumber)) {
      chatHistories.set(whatsappNumber, []);
    }
    const history = chatHistories.get(whatsappNumber)!;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: SYSTEM_INSTRUCTION
        });
        const chat = model.startChat({ history });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout waiting for ${modelName}`)), 7000)
        );
        const result: any = await Promise.race([
          chat.sendMessage(userMessage),
          timeoutPromise
        ]);
        const responseText = result.response.text().trim();
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedResponse = JSON.parse(cleanJson);

        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: cleanJson }] });
        if (history.length > 10) {
          chatHistories.set(whatsappNumber, history.slice(history.length - 10));
        }
        break; // Successfully got response
      } catch (modelErr: any) {
        console.warn(`Gemini Model ${modelName} failed:`, modelErr.message || modelErr);
      }
    }

    if (parsedResponse) {
      return parsedResponse;
    }
    throw new Error("All Gemini models failed, falling back to rule-based parser");
  } catch (error) {
    console.error("AI Analysis Error (Using Fallback Parser):", error);

    // Rule-based Fallback Parser if Gemini API fails
    const text = userMessage.trim();
    const lower = text.toLowerCase();
    const bnToEn: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    const enText = text.replace(/[০-৯]/g, (m) => bnToEn[m] || m);

    // 1. Greetings & Casual Conversational Questions
    const isNameQuestion = /(?:তোমার|তুমার|আপনার|apnar|tumar|tomar)\s*(?:নাম|name)\s*(?:কি|কী|ki)|(?:who\s*are\s*you|ke\s*tumi|কে\s*তুমি|তুমি\s*কে|কে\s*আপনি)/i.test(text);
    const isHowAreYou = /(?:কেমন\s*আছো|কেমন\s*আছেন|kemon\s*acho|kemon\s*asen|kemon\s*achen|how\s*are\s*you)/i.test(text);
    const isWhatCanYouDo = /(?:কি\s*করতে\s*পারো|কী\s*করতে\s*পারো|ki\s*korte\s*paro|what\s*can\s*you\s*do|তুমি\s*কি\s*করো|help|সাহায্য)/i.test(text);
    const isGreeting = /^(?:hi|hello|hlw|hey|heyy|সালাম|হ্যালো|হাই|assalamu\s*alaikum|as[\-\s]*salamu\s*alaikum|slaam|salam|assalam)\b/i.test(text);

    if (isNameQuestion) {
      return {
        action: 'general_reply',
        replyText: 'আসসালামু আলাইকুম! আমার নাম স্মৃতি (Smriti), আপনার পার্সোনাল এআই অ্যাসিস্ট্যান্ট। 😊 আমি আপনাকে কীভাবে সাহায্য করতে পারি বলুন?'
      };
    }

    if (isHowAreYou) {
      return {
        action: 'general_reply',
        replyText: 'আলহামদুলিল্লাহ, আমি বেশ ভালো আছি! আশা করি আপনিও ভালো আছেন। 😊 আজ আপনাকে কীভাবে সাহায্য করতে পারি বলুন?'
      };
    }

    if (isWhatCanYouDo) {
      return {
        action: 'general_reply',
        replyText: 'আমি আপনার পার্সোনাল এআই অ্যাসিস্ট্যান্ট "স্মৃতি" (Smriti)। 😊\n\nআমি যা যা করতে পারি:\n• যেকোনো কাজের রিমাইন্ডার মনে করিয়ে দেওয়া\n• নির্ধারিত সময়ে কাউকে স্বয়ংক্রিয় মেসেজ পাঠানো\n• প্রিয়জনকে আকর্ষণীয় অ্যানিমেটেড উইশ কার্ড পাঠিয়ে দেওয়া\n\nআপনি কী করতে চান বলুন?'
      };
    }

    if (isGreeting) {
      return {
        action: 'general_reply',
        replyText: 'আসসালামু আলাইকুম! আমি স্মৃতি (Smriti), আপনার পার্সোনাল এআই অ্যাসিস্ট্যান্ট। 😊 আমি কীভাবে আপনাকে সাহায্য করতে পারি বলুন?'
      };
    }

    // 2. Delete All Reminders Detection (Bengali, Banglish & English)
    const isDeleteAllReminders =
      /(?:সব|সকল|all|sob|shob)(?:\s*(?:গুলা|গুলো|gula|gulo))?\s*(?:রিমাইন্ডার|reminder)?\s*.*(?:ডিলিট|মুছে|ক্লিয়ার|বাতিল|delete|clear|remove)/i.test(text) ||
      /(?:ডিলিট|মুছে|delete|clear|remove)\s*(?:সব|সকল|all|sob|shob)(?:\s*(?:গুলা|গুলো|gula|gulo))?\s*(?:রিমাইন্ডার|reminder)?/i.test(text);

    if (isDeleteAllReminders) {
      return {
        action: 'delete_all_reminders'
      };
    }

    // 3. List Reminders Detection (Bengali, Banglish & English) - Only if NOT a delete/cancel command
    const hasDeleteWord = /(?:ডিলিট|মুছে|delete|remove|ক্লিয়ার|clear|বাতিল|ক্যান্সেল|cancel)/i.test(text);
    const isListReminders = !hasDeleteWord && (
      /(?:সব\s*রিমাইন্ডার|রিমাইন্ডার\s*(?:লিস্ট|গুলো|গুলা|কয়টা|কতগুলো|কয়টা|দেখা|দেখাও|দেখতে)|list\s*reminder|show\s*(?:my\s*)?reminders?|my\s*reminders|reminder\s*list)/i.test(text) ||
      /(?:কি\s*কি\s*রিমাইন্ডার|কোন\s*কোন\s*রিমাইন্ডার|কি\s*রিমাইন্ডার|কিসের\s*রিমাইন্ডার)/i.test(text) ||
      /(?:আজ\s*কি\s*রিমাইন্ডার|আজকের\s*রিমাইন্ডার|aj\s*ki\s*reminder|ajker\s*reminder|today(?:'s)?\s*reminder)/i.test(text) ||
      /(?:পেন্ডিং|pending).*(?:রিমাইন্ডার|reminder|লিস্ট|list|আছে|ase|ache)/i.test(text) ||
      /(?:কি\s*পেন্ডিং|কী\s*পেন্ডিং|ki\s*pending|what(?:'s)?\s*pending)/i.test(text) ||
      /(?:koto\s*gula|koita|koyta|koto|how\s*many|sob|shob|list|dekhao|dekhaw|ache|ase)\b.*reminder/i.test(text) ||
      /reminder.*\b(?:koto\s*gula|koita|koyta|koto|how\s*many|ache|ase|dekhao|dekhaw|list)/i.test(text)
    );

    if (isListReminders) {
      const isToday = /(?:আজ|আজকের|aj|ajker|today)/i.test(text);
      return {
        action: 'list_reminders',
        data: {
          filter: isToday ? 'today' : 'all'
        }
      };
    }

    // 4. Modify / Reschedule / Edit Reminder Detection
    const isModifyIntent =
      /(?:পরিবর্তন|আপডেট|এডিট|বদল|reschedule|update|modify|change|পিছিয়ে|এগিয়ে)/i.test(text) &&
      (text.includes('রিমাইন্ডার') || text.toLowerCase().includes('reminder'));

    if (isModifyIntent) {
      let time: string | undefined = undefined;
      if (/(\d{1,2}|[০-৯]{1,2})(?::(\d{2}|[০-৯]{2}))?\s*(টা|টায়|টায়|am|pm|AM|PM)?/i.test(text)) {
        time = parseBengaliTime(text);
      }

      let date: string | undefined = undefined;
      const targetDate = parseRelativeDate(text, time);
      date = targetDate.toISOString().split('T')[0];

      const query = text
        .replace(/(\d{1,2}(?::\d{2})?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?|[০-৯]{1,2}(?::[০-৯]{2})?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/gi, '')
        .replace(/(?:রিমাইন্ডার(?:ের)?|reminder|সময়|সময়|তারিখ|দিন|পরিবর্তন|আপডেট|এডিট|বদল|reschedule|update|modify|change|পিছিয়ে|এগিয়ে|করো|করে|দাও|দিন|দিতে|হবে|তে|এ|কাল|আগামীকাল|আজ|সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        action: 'modify_reminder',
        data: {
          searchQuery: query || 'জরুরি',
          time,
          date
        }
      };
    }

    // 5. Cancel / Delete Specific Reminder Detection
    const isCancelOrDelete =
      /(?:ক্যান্সেল|বাতিল|cancel|ডিলিট|মুছে|delete|remove)/i.test(text) &&
      (text.includes('রিমাইন্ডার') || text.toLowerCase().includes('reminder'));

    if (isCancelOrDelete) {
      const isDelete = /(?:ডিলিট|মুছে|delete|remove)/i.test(text);
      const query = text
        .replace(/(?:রিমাইন্ডার|reminder|টা|টি|ক্যান্সেল|বাতিল|cancel|ডিলিট|মুছে|delete|remove|করে|দাও|করো|দিন|ফেলে)/gi, '')
        .trim();

      return {
        action: isDelete ? 'delete_reminder' : 'cancel_reminder',
        data: {
          searchQuery: query || 'জরুরি'
        }
      };
    }

    // 5. Wish Card Creation Detection (Birthday, Anniversary, Eid, etc.)
    const isWishIntent = text.includes('উইশ') || text.includes('wish') || text.includes('কার্ড') || text.includes('card') ||
      text.includes('জন্মদিন') || text.includes('birthday') || text.includes('বিবাহবার্ষিকী') || text.includes('বার্ষিকী') ||
      text.includes('anniversary') || text.includes('ঈদ') || text.includes('eid') || text.includes('অভিনন্দন') || text.includes('congrat');

    if (isWishIntent) {
      const phoneMatch = enText.match(/(?:\+?8801\d{9}|01\d{9})/);
      const recipientPhone = phoneMatch ? phoneMatch[0] : undefined;
      // Strip phone number digits so they don't get matched as hour/minute (e.g. +88...)
      const textWithoutPhone = recipientPhone ? enText.replace(recipientPhone, '') : enText;

      let occasion = 'general';
      let occasionBangla = 'শুভেচ্ছা';
      if (text.includes('জন্মদিন') || text.toLowerCase().includes('birthday')) {
        occasion = 'birthday';
        occasionBangla = 'জন্মদিনের';
      } else if (text.includes('বিবাহ') || text.includes('বার্ষিকী') || text.toLowerCase().includes('anniversary')) {
        occasion = 'anniversary';
        occasionBangla = 'বিবাহবার্ষিকীর';
      } else if (text.includes('ঈদ') || text.toLowerCase().includes('eid')) {
        occasion = 'eid';
        occasionBangla = 'ঈদের';
      } else if (text.includes('নতুন বছর') || text.toLowerCase().includes('new year')) {
        occasion = 'newyear';
        occasionBangla = 'নববর্ষের';
      } else if (text.includes('অভিনন্দন') || text.toLowerCase().includes('congrat')) {
        occasion = 'congratulations';
        occasionBangla = 'অভিনন্দনের';
      }

      // Check recipient name
      let recipientName = 'প্রিয়জন';
      const nameMatch = text.match(/(?:রাহুল|রনি|আরিফ|সাকিব|বন্ধু|ভাই|বোন|স্ত্রী|আম্মু|আব্বু|[A-Z][a-z]+)/);
      if (nameMatch) recipientName = nameMatch[0];

      // Time & Date
      let time = parseBengaliTime(textWithoutPhone);

      const targetDate = parseRelativeDate(text, time);
      const dateStr = targetDate.toISOString().split('T')[0];

      const hasRelativeTime = /\b(?:kal|kaal|kalke|agamikal|aj|ajke|tomorrow|today)\b/i.test(text) || text.includes('কাল') || text.includes('আজ');
      const sendNow = text.includes('এখন') || text.includes('এখনই') || (!hasRelativeTime && !textWithoutPhone.match(/(\d{1,2}|[০-৯]{1,2})\s*(টা|টায়|টায়|am|pm)/i));

      const defaultWishMessage = occasion === 'birthday'
        ? `শুভ জন্মদিন ${recipientName}! আপনার জীবনের প্রতিটি দিন অনেক আনন্দ, সুস্বাস্থ্য এবং সাফল্যে ভরে উঠুক।`
        : occasion === 'anniversary'
        ? `শুভ বিবাহবার্ষিকী! আপনাদের দুজনের পথচলা আজীবন অটুট ও আনন্দময় থাকুক।`
        : occasion === 'eid'
        ? `ঈদ মোবারক! আপনার ও আপনার পরিবারের জন্য রইল পবিত্র ঈদের অফুরন্ত শুভেচ্ছা।`
        : `অনেক অনেক আন্তরিক শুভেচ্ছা ও শুভকামনা! আপনার জীবন সুন্দর ও সাফল্যমণ্ডিত হোক।`;

      const formattedDisplayTime = formatTime12Hour(time);

      return {
        action: 'create_wish',
        data: {
          occasion,
          recipientName,
          recipientPhone: recipientPhone || '01700000000',
          message: defaultWishMessage,
          date: dateStr,
          time,
          sendNow
        },
        replyText: sendNow
          ? `🎉 ${recipientPhone || ''} নম্বরে ${recipientName}-র জন্য ${occasionBangla} উইশ কার্ড সফলভাবে পাঠিয়ে দেওয়া হচ্ছে!`
          : `🎉 ঠিক আছে! ${dateStr} সময় ${formattedDisplayTime}-এ ${recipientPhone || ''} নম্বরে ${recipientName}-র জন্য ${occasionBangla} উইশ কার্ড স্বয়ংক্রিয়ভাবে পাঠিয়ে দেওয়া হবে।`
      };
    }

    // 3. Reminder Creation or Scheduled Message Detection
    const hasBanglishDate = /\b(?:kal|kaal|kalke|kaalke|agamikal|aj|ajke|porshu)\b/i.test(text);
    if (text.includes('রিমাইন্ডার') || text.includes('মনে') || text.includes('reminder') || text.includes('মিটিং') || text.includes('কাল') || text.includes('আজ') || hasBanglishDate || text.includes('মেসেজ') || /(?:01\d{9}|\+?8801\d{9})/.test(enText)) {
      const phoneMatch = enText.match(/(?:\+?8801\d{9}|01\d{9})/);
      const recipientPhone = phoneMatch ? phoneMatch[0] : undefined;
      const textWithoutPhone = recipientPhone ? enText.replace(recipientPhone, '') : enText;

      // Extract time
      let time = parseBengaliTime(textWithoutPhone);

      // Extract date using parseRelativeDate (Banglish & Bengali aware)
      const targetDate = parseRelativeDate(text, time);
      const dateStr = targetDate.toISOString().split('T')[0];

      let customMessage: string | undefined = undefined;
      let title = text
        .replace(/(কাল|আগামীকাল|আজ|সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত|\b(?:kal|kaal|kalke|kaalke|agamikal|aj|ajke|porshu|sokal|shokal|dupur|bikal|rat)\b|[০-৯0-9]{1,2}(?::[০-৯0-9]{2})?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/gi, '')
        .replace(/(রিমাইন্ডার\s*(সেট\s*করো|দাও|রাখো|সেভ\s*করো)?|মনে\s*করিয়ে\s*দিও|reminder)/gi, '')
        .trim();

      if (recipientPhone) {
        title = `মেসেজ পাঠানো (${recipientPhone})`;
        customMessage = extractScheduledMessage(text, recipientPhone);
      }

      if (!title || title.length < 2) title = 'জরুরি কাজ';

      const formattedDisplayTime = formatTime12Hour(time);

      return {
        action: 'create_reminder',
        data: {
          title,
          recipientPhone,
          customMessage,
          date: dateStr,
          time
        },
        replyText: recipientPhone 
          ? `ঠিক আছে! সময় ${formattedDisplayTime}-এ ${recipientPhone} নম্বরে আপনার বার্তাটি পাঠিয়ে দেওয়া হবে।`
          : `আপনার রিমাইন্ডার "${title}" সময় ${formattedDisplayTime}-এ সেট করা হয়েছে!`
      };
    }

    return {
      action: 'general_reply',
      replyText: 'আমি আপনার বার্তাটি ঠিক বুঝতে পারিনি। আপনি কি কোনো কাজের রিমাইন্ডার সেট করতে চান, নাকি কাউকে উইশ কার্ড পাঠাতে চান? একটু বুঝিয়ে বললে আমি সাথে সাথে করে দেব।'
    };
  }
};

export const analyzeAudioMessage = async (whatsappNumber: string, audioBuffer: Buffer, mimeType: string) => {
  try {
    const settings = await SystemSettings.findOne();
    const apiKey = process.env.GEMINI_API_KEY || settings?.geminiApiKey;

    if (!apiKey) {
      return {
        action: 'general_reply',
        replyText: 'দুঃখিত, এআই সার্ভিস কনফিগার করা নেই।'
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash'];

    const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
    const dhakaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

    const prompt = `Please listen to this voice message carefully (spoken in Bengali or English).
Analyze what task, reminder, action (list_reminders, modify_reminder, delete_all_reminders, delete_reminder, cancel_reminder), or wish card (birthday, anniversary, eid, etc.) the user wants to send or create, and return EXACTLY the JSON action format specified in system instructions.
Today's date in Bangladesh is ${dhakaDate}. If the user says 'কাল' or 'tomorrow', set tomorrow's date.
Remember to return ONLY the raw JSON object.`;

    const audioPart = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: cleanMime
      }
    };

    let parsedResponse: any = null;
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_INSTRUCTION
        });
        const result = await model.generateContent([prompt, audioPart]);
        const responseText = result.response.text().trim();
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedResponse = JSON.parse(cleanJson);
        break;
      } catch (err: any) {
        console.warn(`Audio analysis model ${modelName} failed:`, err.message || err);
      }
    }

    if (!parsedResponse) {
      throw new Error("All models failed for audio analysis");
    }
    return parsedResponse;
  } catch (error) {
    console.error("AI Audio Analysis Error:", error);
    return {
      action: 'general_reply',
      replyText: 'দুঃখিত, আপনার ভয়েস মেসেজটি পরিষ্কারভাবে বুঝতে পারিনি। দয়া করে আবার বলুন বা টেক্সট লিখে পাঠান।'
    };
  }
};

