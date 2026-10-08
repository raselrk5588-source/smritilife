import { Request, Response } from 'express';

// Note: In production, we will use actual AI SDKs (OpenAI/Gemini).
// For now, this is a mock implementation that returns structured JSON.

export const parseCommand = async (req: Request, res: Response) => {
  const extractTime = (text: string): string => {
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
    
    // Try to remove time segments like "5 টা", "সন্ধ্যা 7:00 টায়"
    const timeRegex = /(সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)?\s*(\d{1,2})(?::\d{2})?\s*(টা|টায়|am|pm|AM|PM)?/g;
    subject = enText.replace(timeRegex, '');

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
    
    // Simple mock logic for demonstration
    let intent = "unknown";
    let parsedData = {};

    if (command.toLowerCase().includes('phone') || command.toLowerCase().includes('call') || command.includes('ফোন') || command.includes('রিমাইন্ডার') || command.includes('মনে') || command.includes('কাল') || command.includes('আজ')) {
      intent = "create_reminder";
      parsedData = {
        title: extractSubject(command),
        date: new Date().toISOString().split('T')[0],
        time: extractTime(command),
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
