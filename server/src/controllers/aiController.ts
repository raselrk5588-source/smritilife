import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { matchRelativeDuration, parseBengaliTime, parseRelativeDate, transcribeAudioMessage } from '../services/aiWhatsAppService';
import { handleMedicineInquiry } from './whatsappController';
import { parseExpenseInput, recordExpense, detectExpenseCategory } from '../services/expenseService';
import Reminder from '../models/Reminder';
import Note from '../models/Note';
import UserDocument from '../models/UserDocument';
import SystemSettings from '../models/SystemSettings';

export const parseCommand = async (req: Request, res: Response) => {
  const extractSubject = (text: string): string => {
    let subject = text;
    
    // Convert Bengali numbers to English for regex
    const bnToEn: Record<string, string> = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
    let enText = text.replace(/[০-৯]/g, (m) => bnToEn[m] || m);
    
    // Try to remove relative time segments like "20 minute por", "20 mnt por"
    subject = subject.replace(/(\d+)\s*(?:minute|minutes|min|mins|mnt|mnts|mint|mints|m|মিনিট(?:ের)?|মি\.)\s*(?:por|pore|porer|পরে|পর|বাদ|বাদে|later|after)?/gi, '');
    subject = subject.replace(/(?:adha|adho|আধা|অর্ধেক|der|দেড়|দেড়|\d+)\s*(?:ghont[ao]|ghant[ao]|hour|hours|hr|hrs|ঘণ্টা(?:র)?|ঘন্টা(?:র)?)\s*(?:por|pore|porer|পরে|পর|বাদ|বাদে|later|after)?/gi, '');

    // Try to remove clock time segments like "5 টা", "সন্ধ্যা 7:00 টায়"
    const timeRegex = /(সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)?\s*(\d{1,2})(?::\d{2})?\s*(টা|টায়|am|pm|AM|PM)?/g;
    subject = subject.replace(timeRegex, '');

    const fillers = [
      "এর একটা রিমাইন্ডার সেট করে দাও",
      "একটা রিমাইন্ডার সেট করে দাও",
      "রিমাইন্ডার সেট করে দাও",
      "রিমাইন্ডার সেট করো",
      "রিমাইন্ডার দাও",
      "রিমাইন্ডার",
      "আমাকে মনে করিয়ে দিও",
      "মনে করিয়ে দিও",
      "মনে করিয়ে দিন",
      "নোট করো",
      "নোট করে রাখো",
      "লিখে রাখো",
      "সেট করে দাও",
      "সেট করো",
      "ডেকে দিও",
      "ডেকে দাও",
      "তুলে দিও",
      "তুলে দাও",
      "ঘুম থেকে",
      "ঘুমের",
      "ঘুমাবো",
      "ঘুমাব",
      "দিতে হবে",
      "করতে হবে",
      "আমাকে",
      "আমার"
    ];
    
    fillers.forEach(filler => {
      subject = subject.replace(new RegExp(filler, 'gi'), '');
    });
    
    // Clean up extra spaces and prepositions
    subject = subject.replace(/\s+/g, ' ').trim();
    if (subject.endsWith(" এর")) subject = subject.slice(0, -3).trim();
    if (subject.endsWith("এর")) subject = subject.slice(0, -2).trim();
    if (subject.endsWith(" কে")) subject = subject.slice(0, -3).trim();
    if (subject.startsWith("যে ")) subject = subject.slice(3).trim();
    if (subject.startsWith("জে ")) subject = subject.slice(3).trim();
    
    return subject || text;
  };

  try {
    const { command } = req.body;
    const userId = (req as any).user?.id || (req as any).user?._id;

    if (userId && command) {
      const medAnswer = await handleMedicineInquiry(userId, command);
      if (medAnswer) {
        return res.json({
          success: true,
          data: {
            intent: "medicine_inquiry",
            title: "💊 ওষুধের রিমাইন্ডার তথ্য",
            content: medAnswer,
            message: medAnswer
          }
        });
      }

      // Check if command is an expense tracker command
      const parsedExp = parseExpenseInput(command);
      if (parsedExp && parsedExp.amount && parsedExp.title && !parsedExp.isQuery && !/(?:রিমাইন্ডার|reminder|অ্যালার্ম|alarm|নোট|note)/i.test(command)) {
        const expDate = parsedExp.expenseDate || new Date();
        await recordExpense(userId, parsedExp.title, parsedExp.amount, parsedExp.paymentMethod || 'cash', expDate);
        return res.json({
          success: true,
          data: {
            intent: "expense_logged",
            title: parsedExp.title,
            amount: parsedExp.amount,
            message: `💸 খরচ "${parsedExp.title}" (৳${parsedExp.amount}) সফলভাবে সংরক্ষণ করা হয়েছে!`
          }
        });
      }
    }
    
    let intent = "unknown";
    let parsedData: any = {};

    const isSehri = /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(command);
    const isDaily = /প্রতিদিন|দৈনিক|রোজ|রোজই|daily|everyday|every\s*day|protidin|potidin|roj|sob\s*din|shob\s*din/i.test(command);
    const isWakeup = isSehri || /ঘুম|ঘুমের|ঘুমিয়ে|ঘুমাবো|ঘুমাব|ঘুমাচ্ছি|nap|dip\s*nap|deep\s*nap|rest|বিশ্রাম|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|তুলে|ডেকে|ডাকা|ডেকে দিও|ডেকে দাও|তুলে দিও|তুলে দাও|ঘুম ভাঙা|ঘুম ভাঙ্গানি/i.test(command);
    const isNote = /(?:নোট\s*(?:করে|করো|রাখো|কর|লিখে|তুল)|note|লিখে\s*রাখো|টুকে\s*রাখো|মনে\s*রেখো)/i.test(command);
    const isExplicitReminder = /(?:রিমাইন্ডার|reminder|অ্যালার্ম|alarm|মনে\s*করিয়ে|mone\s*koriye|deke\s*dio|ডেকে\s*দিও)/i.test(command);
    const isDoc = /(?:ডকুমেন্ট|প্রেসক্রিপশন|প্রেস্ক্রিপশন|সার্টিফিকেট|রিপোর্ট|ভল্ট|document|prescription|vault)/i.test(command);
    const isDelete = /(?:ডিলিট|মুছে|delete|remove|ফেলে|ক্লিয়ার|বাতিল|ক্যান্সেল)/i.test(command);
    if (isDelete) {
      if (isDoc) {
        let doc: any = null;
        if (userId) {
          const rawSub = extractSubject(command);
          if (rawSub && rawSub.length >= 2) {
            doc = await UserDocument.findOneAndDelete({ userId, title: { $regex: new RegExp(rawSub, 'i') } });
          }
          if (!doc) {
            doc = await UserDocument.findOneAndDelete({ userId }).sort({ createdAt: -1 });
          }
        }
        return res.json({
          success: true,
          data: {
            intent: "delete_success",
            message: doc ? `ডকুমেন্ট "${doc.title}" সফলভাবে ডিলিট করা হয়েছে!` : "ডকুমেন্টটি সফলভাবে ডিলিট করা হয়েছে!"
          }
        });
      } else if (isNote) {
        let note: any = null;
        if (userId) {
          const rawSub = extractSubject(command);
          if (rawSub && rawSub.length >= 2) {
            note = await Note.findOneAndDelete({ userId, title: { $regex: new RegExp(rawSub, 'i') } });
          }
          if (!note) {
            note = await Note.findOneAndDelete({ userId }).sort({ createdAt: -1 });
          }
        }
        return res.json({
          success: true,
          data: {
            intent: "delete_success",
            message: note ? `নোট "${note.title}" সফলভাবে মুছে ফেলা হয়েছে!` : "নোটটি সফলভাবে মুছে ফেলা হয়েছে!"
          }
        });
      } else {
        let rem: any = null;
        if (userId) {
          const rawSub = extractSubject(command);
          if (rawSub && rawSub.length >= 2) {
            rem = await Reminder.findOneAndDelete({
              userId,
              $or: [
                { title: { $regex: new RegExp(rawSub, 'i') } },
                { description: { $regex: new RegExp(rawSub, 'i') } },
                { 'medicines.name': { $regex: new RegExp(rawSub, 'i') } }
              ]
            });
          }
          if (!rem) {
            rem = await Reminder.findOneAndDelete({ userId }).sort({ date: 1, time: 1 });
          }
        }
        return res.json({
          success: true,
          data: {
            intent: "delete_success",
            message: rem ? `রিমাইন্ডার "${rem.title}" সফলভাবে ডিলিট করা হয়েছে!` : "রিমাইন্ডারটি সফলভাবে ডিলিট করা হয়েছে!"
          }
        });
      }
    }

    const computedTime = parseBengaliTime(command);
    const computedDateObj = parseRelativeDate(command, computedTime);
    const computedDateStr = computedDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

    if (isWakeup) {
      intent = "create_reminder";
      const rawSubject = extractSubject(command);
      let cleanTitle = (rawSubject && rawSubject.length > 2 && !/^(আমাকে|ডেকে|তুলে|ঘুম)\b/i.test(rawSubject))
        ? rawSubject 
        : (isSehri ? "সেহরির জন্য ঘুম থেকে ওঠা 🌙" : "ঘুম থেকে ওঠা (ওয়েক-আপ অ্যালার্ম)");
      if (isSehri && (!cleanTitle || cleanTitle.includes('ঘুম থেকে ওঠা'))) {
        cleanTitle = "সেহরির জন্য ঘুম থেকে ওঠা 🌙";
      }

      let parsedTime = computedTime;
      if (isSehri && (!parsedTime || parsedTime === '10:00')) {
        parsedTime = '04:00';
      }

      parsedData = {
        title: cleanTitle,
        date: computedDateStr,
        time: parsedTime,
        category: "wakeup",
        isAlarm: true,
        repeat: isDaily ? "Daily" : "Once",
        timezone: "Asia/Dhaka"
      };
    } else if (isNote && !isExplicitReminder) {
      intent = "create_note";
      const cleanContent = command.replace(/^(?:একটি|একটা|akta|ekta)?\s*(?:নোট\s*(?:করে\s*রাখো|করো|রাখো|কর|লিখে)|লিখে\s*রাখো|note\s*(?:kore\s*rakho|koro|rakh)|save\s*note|\bnote)\s*[:：\-]?\s*(?:যে\s*)?/gi, '').trim();
      let shortTitle = 'নোট';
      if (cleanContent.includes(':') || cleanContent.includes('：')) {
        shortTitle = cleanContent.split(/[:：]/)[0].trim().slice(0, 30);
      } else {
        const words = cleanContent.split(/\s+/);
        let t = '';
        for (const w of words) {
          if ((t + ' ' + w).trim().length > 25) break;
          t = (t + ' ' + w).trim();
        }
        shortTitle = t || 'নোট';
      }
      parsedData = {
        title: shortTitle,
        content: cleanContent || command
      };
    } else if (isDoc && !isExplicitReminder) {
      intent = "document_vault";
      parsedData = {
        title: "ডকুমেন্ট ভল্ট",
        content: command
      };
    } else if (command.toLowerCase().includes('phone') || command.toLowerCase().includes('call') || command.includes('ফোন') || command.includes('রিমাইন্ডার') || command.includes('মনে') || command.includes('কাল') || command.includes('আজ')) {
      intent = "create_reminder";
      parsedData = {
        title: extractSubject(command),
        date: computedDateStr,
        time: computedTime,
        category: "General",
        timezone: "Asia/Dhaka"
      };
    } else if (command.toLowerCase().includes('birthday') || command.includes('জন্মদিন') || command.includes('উইশ')) {
      intent = "create_special_date";
      parsedData = {
        title: extractSubject(command),
        type: "Birthday",
        date: computedDateStr,
        recurring: true
      };
    } else {
      // Default to reminder
      intent = "create_reminder";
      parsedData = {
        title: extractSubject(command),
        date: computedDateStr,
        time: computedTime,
        category: "General",
        timezone: "Asia/Dhaka"
      };
    }

    res.json({
      success: true,
      data: {
        intent,
        ...parsedData
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const transcribeVoice = async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, message: 'Audio data is required' });
    }
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const text = await transcribeAudioMessage(audioBuffer, mimeType || 'audio/webm');
    res.json({ success: true, text });
  } catch (error: any) {
    console.error('transcribeVoice endpoint error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateWish = async (req: Request, res: Response) => {
  try {
    const { person, occasion, tone, language, extraPrompt } = req.body;
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const settings = await SystemSettings.findOne();
        apiKey = settings?.geminiApiKey;
      } catch (dbErr) {}
    }

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        });

        const prompt = `Write a heartfelt, personalized ${language === 'en' ? 'English' : 'Bengali'} greeting/wish message.
Recipient: "${person || 'Loved one'}"
Occasion: "${occasion || 'Birthday'}"
Tone/Style: "${tone || 'Warm & Loving'}"
${extraPrompt ? `Special Note/Context: "${extraPrompt}"` : ''}

Rules:
1. Return ONLY the message lines (2-3 sentences), separated by newlines.
2. Do NOT add markdown tags, JSON, or introductory conversational text.`;

        const result = await model.generateContent(prompt);
        const wishText = result.response.text().trim();
        if (wishText) {
          return res.json({ success: true, wish: wishText });
        }
      } catch (aiErr) {
        console.warn('Gemini generateWish error, using template fallback:', aiErr);
      }
    }

    // High quality fallback
    const fallbackMap: Record<string, string> = {
      birthday: `শুভ জন্মদিন ${person || 'প্রিয়জন'}! আপনার জীবনের প্রতিটি দিন ভরে উঠুক অনাবিল আনন্দ আর সাফল্যে। অনেক অনেক শুভকামনা!`,
      anniversary: `শুভ বিবাহবার্ষিকী ${person || 'প্রিয়জন'}! আপনাদের ভালোবাসার বন্ধন অটুট থাকুক চিরদিন।`,
      eid: `ঈদ মোবারক ${person || 'প্রিয়জন'}! এই ঈদের আনন্দ ছড়িয়ে পড়ুক আপনার পুরো পরিবারে।`,
      newyear: `শুভ নববর্ষ ${person || 'প্রিয়জন'}! নতুন বছর আপনার জীবনে বয়ে নিয়ে আসুক অফুরন্ত খুশি ও সাফল্য।`,
      general: `আপনার জন্য রইল আন্তরিক শুভেচ্ছা ও অফুরন্ত ভালোবাসা!`
    };

    const wish = fallbackMap[occasion?.toLowerCase()] || `শুভকামনা রইল ${person || 'প্রিয়জন'}! আপনার জীবনের সকল চাওয়া পূর্ণ হোক।`;
    res.json({ success: true, wish });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const parseVoiceWish = async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const settings = await SystemSettings.findOne();
        apiKey = settings?.geminiApiKey;
      } catch (dbErr) {}
    }

    const computedTime = parseBengaliTime(command);
    const computedDateObj = parseRelativeDate(command, computedTime);
    const computedDateStr = computedDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

    // Extract any phone number in command (e.g. 017XXXXXXXX, 018..., etc.)
    const phoneMatch = command.replace(/[\s\-]/g, '').match(/(?:\+?88)?01[3-9]\d{8}/);
    const extractedPhone = phoneMatch ? (phoneMatch[0].startsWith('+88') ? phoneMatch[0].slice(3) : phoneMatch[0].startsWith('88') ? phoneMatch[0].slice(2) : phoneMatch[0]) : '';

    let geminiData: any = null;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600
          }
        });

        const prompt = `Analyze this Bengali/English wish instruction from a user: "${command}"
Task:
1. Identify the occasion: "birthday" | "anniversary" | "eid" | "newyear" | "valentine" | "mothersday" | "fathersday" | "congratulations" | "love" | "general"
2. Identify the recipient name/relation (e.g. "স্ত্রী", "বন্ধু", "মা", "রাহুল", "সহধর্মিণী")
3. Compose a beautiful, heartfelt Bengali wish message (2-3 sentences) suitable for this person and occasion.
4. Set a suitable Bengali title (e.g. "শুভ জন্মদিন", "শুভ বিবাহবার্ষিকী", "ঈদ মোবারক").

Return ONLY a raw JSON object with this exact shape:
{
  "occasion": "birthday",
  "recipient": "স্ত্রী",
  "title": "শুভ জন্মদিন",
  "body": [
    "প্রিয় স্ত্রী,",
    "শুভ জন্মদিন! তোমার জীবনের প্রতিটি দিন যেন সুখ, শান্তি ও অনাবিল ভালোবাসায় ভরে থাকে।",
    "সারাজীবন এভাবে আমার পাশে থাকার জন্য তোমাকে অনেক ধন্যবাদ।"
  ]
}`;

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout for parseVoiceWish')), 10000)
        );

        const result: any = await Promise.race([
          model.generateContent(prompt),
          timeoutPromise
        ]);

        const rawText = result.response.text().trim();
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          geminiData = JSON.parse(jsonMatch[0]);
        }
      } catch (gemErr) {
        console.warn('Gemini parseVoiceWish fallback:', gemErr);
      }
    }

    // Fallback if Gemini failed or no API key
    if (!geminiData) {
      let occasion = 'birthday';
      let title = 'শুভ জন্মদিন';
      if (/বিবাহ|বার্ষিকী|anniversary/i.test(command)) {
        occasion = 'anniversary';
        title = 'শুভ বিবাহবার্ষিকী';
      } else if (/ঈদ|eid/i.test(command)) {
        occasion = 'eid';
        title = 'ঈদ মোবারক';
      } else if (/নববর্ষ|new\s*year/i.test(command)) {
        occasion = 'newyear';
        title = 'শুভ নববর্ষ';
      } else if (/ভালোবাসা|valentine/i.test(command)) {
        occasion = 'valentine';
        title = 'শুভ ভালোবাসা দিবস';
      } else if (/মা\s*দিবস|আম্মু|মা/i.test(command)) {
        occasion = 'mothersday';
        title = 'শুভ মা দিবস';
      } else if (/বাবা\s*দিবস|আব্বু|বাবা/i.test(command)) {
        occasion = 'fathersday';
        title = 'শুভ বাবা দিবস';
      }

      let recipient = 'প্রিয়জন';
      if (/স্ত্রী|বউ|সহধর্মিণী|wife/i.test(command)) recipient = 'স্ত্রী';
      else if (/মা|আম্মু|আম্মা|mom|mother/i.test(command)) recipient = 'মা';
      else if (/বাবা|আব্বু|আব্বা|dad|father/i.test(command)) recipient = 'বাবা';
      else if (/বন্ধু|দোস্ত|ফ্রেন্ড|friend/i.test(command)) recipient = 'বন্ধু';
      else if (/ভাই|ভাইয়া|bhai/i.test(command)) recipient = 'ভাই';
      else if (/বোন|অপু|apu|sister/i.test(command)) recipient = 'বোন';

      geminiData = {
        occasion,
        recipient,
        title,
        body: [
          `প্রিয় ${recipient},`,
          `${title}! তোমার হাসিমুখ যেন চিরকাল এমন উজ্জ্বল থাকে। জীবনের প্রতিটি পদক্ষেপে তোমার জন্য রইল অফুরন্ত শুভকামনা।`,
          `সবসময় ভালো থেকো এবং সুস্থ থেকো।`
        ]
      };
    }

    res.json({
      success: true,
      data: {
        ...geminiData,
        recipientPhone: extractedPhone,
        date: computedDateStr,
        time: computedTime
      }
    });
  } catch (error: any) {
    console.error('parseVoiceWish error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
