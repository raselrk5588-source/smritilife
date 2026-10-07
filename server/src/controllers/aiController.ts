import { Request, Response } from 'express';

// Note: In production, we will use actual AI SDKs (OpenAI/Gemini).
// For now, this is a mock implementation that returns structured JSON.

export const parseCommand = async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    
    // Simple mock logic for demonstration
    let intent = "unknown";
    let parsedData = {};

    if (command.toLowerCase().includes('phone') || command.toLowerCase().includes('call') || command.includes('ফোন')) {
      intent = "create_reminder";
      parsedData = {
        title: "রাকিবকে ফোন করা",
        date: new Date().toISOString().split('T')[0],
        time: "10:00",
        timezone: "Asia/Dhaka"
      };
    } else if (command.toLowerCase().includes('birthday') || command.includes('জন্মদিন')) {
      intent = "create_special_date";
      parsedData = {
        title: "Rakib's Birthday",
        type: "Birthday",
        date: "1995-09-28",
        recurring: true
      };
    } else {
      intent = "create_note";
      parsedData = {
        title: "Quick Note",
        content: command
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
