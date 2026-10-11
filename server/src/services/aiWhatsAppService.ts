import { GoogleGenerativeAI } from '@google/generative-ai';
import SystemSettings from '../models/SystemSettings';

// In-memory chat history for WhatsApp users (In production, save to Redis or DB)
const chatHistories = new Map<string, any[]>();

const SYSTEM_INSTRUCTION = `
You are an AI assistant for a WhatsApp bot called "Smriti".
Your job is to analyze the user's message and return a JSON object with the action to perform.
The user speaks Bengali or English. When greeting, always greet with "আসসালামু আলাইকুম! আমি Smriti AI অ্যাসিস্ট্যান্ট।" 

Your ONLY capabilities are adding, canceling, and deleting reminders. 
You CANNOT create or manage wishes. If the user asks about wishes, politely inform them that they need to use the Smriti Application directly to manage wishes.

Possible actions:
1. create_reminder
2. cancel_reminder (to mark a reminder as Cancelled)
3. delete_reminder (to permanently delete a reminder)
4. general_reply (for greetings, unknown requests, or requests about wishes)

Format your response EXACTLY as a JSON object, like this:
{
  "action": "create_reminder",
  "data": {
    "title": "Meeting with John",
    "date": "2026-10-10",
    "time": "14:00"
  },
  "replyText": "আপনার রিমাইন্ডার সেট করা হয়েছে!"
}
OR
{
  "action": "delete_reminder",
  "data": {
    "searchQuery": "Meeting with John" // Provide a keyword or title the user wants to delete/cancel
  },
  "replyText": "আপনার রিমাইন্ডারটি ডিলিট করা হয়েছে!"
}
OR
{
  "action": "general_reply",
  "replyText": "উইশ তৈরি করতে দয়া করে Smriti অ্যাপ ব্যবহার করুন। আমি শুধু রিমাইন্ডার সেট বা ডিলিট করতে পারি।"
}

Only return the JSON. No markdown formatting like \`\`\`json.
`;

export const analyzeMessage = async (whatsappNumber: string, userMessage: string) => {
  try {
    // Fetch settings to get API key
    const settings = await SystemSettings.findOne();
    const apiKey = process.env.GEMINI_API_KEY || settings?.geminiApiKey;

    if (!apiKey) {
      console.error("Gemini API Key is missing. Please add it in Admin Panel or .env file.");
      return {
        action: 'general_reply',
        replyText: 'দুঃখিত, সিস্টেমটি সাময়িকভাবে বন্ধ আছে। অ্যাডমিনকে জানান (API Key Missing)।'
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    if (!chatHistories.has(whatsappNumber)) {
      chatHistories.set(whatsappNumber, []);
    }
    const history = chatHistories.get(whatsappNumber)!;

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text().trim();

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedResponse = JSON.parse(cleanJson);

    history.push({ role: 'user', parts: [{ text: userMessage }] });
    history.push({ role: 'model', parts: [{ text: cleanJson }] });

    if (history.length > 10) {
      chatHistories.set(whatsappNumber, history.slice(history.length - 10));
    }

    return parsedResponse;
  } catch (error) {
    console.error("AI Analysis Error:", error);

    // Rule-based Fallback Parser if Gemini API fails
    const text = userMessage.trim();
    const bnToEn: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    const enText = text.replace(/[০-৯]/g, (m) => bnToEn[m] || m);

    // 1. Greetings
    if (/^(hi|hello|hey|সালাম|হ্যালো|কেমন আছো|কেমন আছেন|kemon acho)/i.test(text)) {
      return {
        action: 'general_reply',
        replyText: 'আসসালামু আলাইকুম! আমি Smriti অ্যাসিস্ট্যান্ট। আপনি আমাকে WhatsApp-এ কোনো কাজের রিমাইন্ডার সেট বা ডিলিট করতে বলতে পারেন।'
      };
    }

    // 2. Reminder Creation Detection
    if (text.includes('রিমাইন্ডার') || text.includes('মনে') || text.includes('reminder') || text.includes('মিটিং') || text.includes('কাল') || text.includes('আজ')) {
      // Extract time
      let time = '10:00';
      const timeMatch = enText.match(/(\d{1,2})(?::(\d{2}))?\s*(টা|টায়|টায়|am|pm|AM|PM)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const minute = timeMatch[2] || '00';
        if (text.includes('বিকাল') || text.includes('বিকেল') || text.includes('সন্ধ্যা') || text.includes('রাত') || (timeMatch[3] && timeMatch[3].toLowerCase() === 'pm')) {
          if (hour < 12) hour += 12;
        }
        time = `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
      }

      // Extract date (কাল = tomorrow, আজ = today)
      const targetDate = new Date();
      if (text.includes('কাল') || text.includes('আগামীকাল') || text.toLowerCase().includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      const dateStr = targetDate.toISOString().split('T')[0];

      // Extract title
      let title = text
        .replace(/(কাল|আগামীকাল|আজ|সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত|[০-৯0-9]{1,2}(?::[০-৯0-9]{2})?\s*(টা|টায়|টায়|am|pm|AM|PM)?)/gi, '')
        .replace(/(রিমাইন্ডার\s*(সেট\s*করো|দাও|রাখো|সেভ\s*করো)?|মনে\s*করিয়ে\s*দিও|reminder)/gi, '')
        .trim();

      if (!title || title.length < 2) title = 'জরুরি কাজ';

      return {
        action: 'create_reminder',
        data: {
          title,
          date: dateStr,
          time
        },
        replyText: `আপনার রিমাইন্ডার "${title}" সময় ${time}-এ সেট করা হয়েছে!`
      };
    }

    return {
      action: 'general_reply',
      replyText: 'দুঃখিত, আমি আপনার কথা বুঝতে পারিনি। দয়া করে সহজ ভাষায় রিমাইন্ডারটি বলুন (যেমন: কাল সকাল ১০টায় মিটিং রিমাইন্ডার)।'
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
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
    const dhakaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

    const prompt = `Please listen to this voice message carefully (spoken in Bengali or English).
Analyze what task or reminder the user wants to set, cancel, or delete, and return EXACTLY the JSON action format specified in system instructions.
Today's date in Bangladesh is ${dhakaDate}. If the user says 'কাল' or 'tomorrow', set tomorrow's date.
Remember to return ONLY the raw JSON object.`;

    const audioPart = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: cleanMime
      }
    };

    const result = await model.generateContent([prompt, audioPart]);
    const responseText = result.response.text().trim();

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedResponse = JSON.parse(cleanJson);
    return parsedResponse;
  } catch (error) {
    console.error("AI Audio Analysis Error:", error);
    return {
      action: 'general_reply',
      replyText: 'দুঃখিত, আপনার ভয়েস মেসেজটি পরিষ্কারভাবে বুঝতে পারিনি। দয়া করে আবার বলুন বা টেক্সট লিখে পাঠান।'
    };
  }
};

