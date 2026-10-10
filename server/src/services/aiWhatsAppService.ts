import { GoogleGenerativeAI } from '@google/generative-ai';
import SystemSettings from '../models/SystemSettings';

// In-memory chat history for WhatsApp users (In production, save to Redis or DB)
const chatHistories = new Map<string, any[]>();

const SYSTEM_INSTRUCTION = `
You are an AI assistant for a WhatsApp bot called "Smriti".
Your job is to analyze the user's message and return a JSON object with the action to perform.
The user speaks Bengali or English.

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
      model: 'gemini-1.5-flash',
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
    return {
      action: 'general_reply',
      replyText: 'দুঃখিত, আমি আপনার কথা বুঝতে পারিনি। দয়া করে আবার বলুন।'
    };
  }
};
