import { Request, Response } from 'express';
import { matchRelativeDuration } from '../services/aiWhatsAppService';

export const parseCommand = async (req: Request, res: Response) => {
  const extractTime = (text: string): string => {
    // 1. Check relative duration first (e.g. "20 mnt por", "20 minute por", "আধা ঘণ্টা পর")
    const relativeMins = matchRelativeDuration(text);
    if (relativeMins !== null) {
      const now = new Date();
      const dhakaTimeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const [cHour, cMin] = dhakaTimeStr.split(':').map(Number);
      const totalMinutes = cHour * 60 + cMin + relativeMins;
      const finalHour = Math.floor(totalMinutes / 60) % 24;
      const finalMin = totalMinutes % 60;
      return `${finalHour.toString().padStart(2, '0')}:${finalMin.toString().padStart(2, '0')}`;
    }

    let time = "10:00"; // default
    
    // Convert Bengali numbers to English for regex
    const bnToEn: Record<string, string> = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
    let enText = text.replace(/[০-৯]/g, (m) => bnToEn[m] || m);
  
    // Match something like "5:00 টা", "10 টা", "5pm"
    const timeMatch = enText.match(/(\d{1,2})(?::(\d{2}))?\s*(টা|টায়|am|pm|AM|PM)?/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] || "00";
      
      if (enText.includes("বিকাল") || enText.includes("বিকেল") || enText.includes("সন্ধ্যা") || enText.includes("রাত") || timeMatch[3]?.toLowerCase() === 'pm') {
        if (hour < 12) hour += 12;
      }
      
      time = `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    return time;
  };

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
    
    let intent = "unknown";
    let parsedData: any = {};

    const isSehri = /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(command);
    const isDaily = /প্রতিদিন|দৈনিক|রোজ|রোজই|daily|everyday|every\s*day|protidin|potidin|roj|sob\s*din|shob\s*din/i.test(command);
    const isWakeup = isSehri || /ঘুম|ঘুমের|ঘুমিয়ে|ঘুমাবো|ঘুমাব|ঘুমাচ্ছি|nap|dip\s*nap|deep\s*nap|rest|বিশ্রাম|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|তুলে|ডেকে|ডাকা|ডেকে দিও|ডেকে দাও|তুলে দিও|তুলে দাও|ঘুম ভাঙা|ঘুম ভাঙ্গানি/i.test(command);

    if (isWakeup) {
      intent = "create_reminder";
      const rawSubject = extractSubject(command);
      let cleanTitle = (rawSubject && rawSubject.length > 2 && !/^(আমাকে|ডেকে|তুলে|ঘুম)\b/i.test(rawSubject))
        ? rawSubject 
        : (isSehri ? "সেহরির জন্য ঘুম থেকে ওঠা 🌙" : "ঘুম থেকে ওঠা (ওয়েক-আপ অ্যালার্ম)");
      if (isSehri && (!cleanTitle || cleanTitle.includes('ঘুম থেকে ওঠা'))) {
        cleanTitle = "সেহরির জন্য ঘুম থেকে ওঠা 🌙";
      }

      let parsedTime = extractTime(command);
      if (isSehri && (!parsedTime || parsedTime === '10:00')) {
        parsedTime = '04:00';
      }

      parsedData = {
        title: cleanTitle,
        date: new Date().toISOString().split('T')[0],
        time: parsedTime,
        category: "wakeup",
        isAlarm: true,
        repeat: isDaily ? "Daily" : "Once",
        timezone: "Asia/Dhaka"
      };
    } else if (command.toLowerCase().includes('phone') || command.toLowerCase().includes('call') || command.includes('ফোন') || command.includes('রিমাইন্ডার') || command.includes('মনে') || command.includes('কাল') || command.includes('আজ')) {
      intent = "create_reminder";
      parsedData = {
        title: extractSubject(command),
        date: new Date().toISOString().split('T')[0],
        time: extractTime(command),
        category: "General",
        timezone: "Asia/Dhaka"
      };
    } else if (command.toLowerCase().includes('birthday') || command.includes('জন্মদিন') || command.includes('উইশ')) {
      intent = "create_special_date";
      parsedData = {
        title: extractSubject(command),
        type: "Birthday",
        date: "1995-09-28",
        recurring: true
      };
    } else if (command.toLowerCase().includes('note') || command.includes('নোট')) {
      intent = "create_note";
      parsedData = {
        title: "Quick Note",
        content: command
      };
    } else {
      // Default to reminder
      intent = "create_reminder";
      parsedData = {
        title: extractSubject(command),
        date: new Date().toISOString().split('T')[0],
        time: extractTime(command),
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

export const generateWish = async (req: Request, res: Response) => {
  try {
    const { person, occasion, tone, language } = req.body;
    
    // Mock AI generation
    const generatedWish = `Happy ${occasion}, ${person}! Wishing you a day filled with happiness and a year filled with joy.`;
    
    res.json({
      success: true,
      wish: generatedWish
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
