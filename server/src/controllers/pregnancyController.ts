import { Request, Response } from 'express';
import Pregnancy from '../models/Pregnancy';

// Helper: Calculate Gestational Age
export const calculateGestationalAge = (lmpDate: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lmpDate).getTime();
  const totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const currentWeek = Math.min(42, Math.floor(totalDays / 7) + 1);
  const currentDayInWeek = totalDays % 7;
  return { totalDays, currentWeek, currentDayInWeek };
};

// GET /api/pregnancy
export const getPregnancy = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'অননুমোদিত অনুরোধ' });

    const pregnancy = await Pregnancy.findOne({ userId });
    if (!pregnancy) {
      return res.status(200).json({ pregnancy: null });
    }

    // Dynamic stats
    const now = new Date();
    const dueTime = new Date(pregnancy.dueDate).getTime();
    const daysRemaining = Math.max(0, Math.ceil((dueTime - now.getTime()) / (1000 * 60 * 60 * 24)));

    let gestational = { totalDays: 0, currentWeek: 1, currentDayInWeek: 0 };
    if (pregnancy.lmpDate) {
      gestational = calculateGestationalAge(pregnancy.lmpDate);
    } else {
      // Calculate from due date (280 days total)
      const inferredLmp = new Date(pregnancy.dueDate);
      inferredLmp.setDate(inferredLmp.getDate() - 280);
      gestational = calculateGestationalAge(inferredLmp);
    }

    let trimester = 1;
    if (gestational.currentWeek >= 28) trimester = 3;
    else if (gestational.currentWeek >= 14) trimester = 2;

    const progressPercent = Math.min(100, Math.round((gestational.totalDays / 280) * 100));

    return res.status(200).json({
      pregnancy,
      stats: {
        totalDays: gestational.totalDays,
        currentWeek: gestational.currentWeek,
        currentDayInWeek: gestational.currentDayInWeek,
        daysRemaining,
        trimester,
        progressPercent
      }
    });
  } catch (error: any) {
    console.error('[PregnancyController] getPregnancy error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// POST /api/pregnancy - Setup or Update
export const setupPregnancy = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'অননুমোদিত অনুরোধ' });

    const { method, lmpDate, dueDate, conceptionDate, babyNickname, weeklyReminderEnabled } = req.body;

    let finalLmp: Date | undefined;
    let finalDue: Date;

    if (method === 'lmp' && lmpDate) {
      finalLmp = new Date(lmpDate);
      finalDue = new Date(finalLmp);
      finalDue.setDate(finalDue.getDate() + 280); // Naegele's rule: LMP + 280 days
    } else if (method === 'dueDate' && dueDate) {
      finalDue = new Date(dueDate);
      finalLmp = new Date(finalDue);
      finalLmp.setDate(finalLmp.getDate() - 280);
    } else if (method === 'conception' && conceptionDate) {
      const conc = new Date(conceptionDate);
      finalLmp = new Date(conc);
      finalLmp.setDate(finalLmp.getDate() - 14); // conception ~ day 14 of cycle
      finalDue = new Date(finalLmp);
      finalDue.setDate(finalDue.getDate() + 280);
    } else if (dueDate) {
      finalDue = new Date(dueDate);
      finalLmp = new Date(finalDue);
      finalLmp.setDate(finalLmp.getDate() - 280);
    } else if (lmpDate) {
      finalLmp = new Date(lmpDate);
      finalDue = new Date(finalLmp);
      finalDue.setDate(finalDue.getDate() + 280);
    } else {
      return res.status(400).json({ message: 'দয়া করে শেষ পিরিয়ডের তারিখ (LMP) অথবা প্রসবের সম্ভাব্য তারিখ (EDD) প্রদান করুন।' });
    }

    const pregnancy = await Pregnancy.findOneAndUpdate(
      { userId },
      {
        userId,
        status: 'active',
        method: method || 'lmp',
        lmpDate: finalLmp,
        dueDate: finalDue,
        conceptionDate: conceptionDate ? new Date(conceptionDate) : undefined,
        babyNickname: babyNickname || 'সোনামণি',
        weeklyReminderEnabled: weeklyReminderEnabled !== undefined ? !!weeklyReminderEnabled : true
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      message: 'মাতৃত্ব প্রোফাইল সফলভাবে তৈরি হয়েছে! 🌸',
      pregnancy
    });
  } catch (error: any) {
    console.error('[PregnancyController] setupPregnancy error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// POST /api/pregnancy/kick - Log Kicks
export const logKick = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'অননুমোদিত অনুরোধ' });

    const { count, durationMinutes, notes } = req.body;
    if (typeof count !== 'number' || count <= 0) {
      return res.status(400).json({ message: 'সঠিক কিক সংখ্যা দিন' });
    }

    const pregnancy = await Pregnancy.findOne({ userId, status: 'active' });
    if (!pregnancy) {
      return res.status(404).json({ message: 'সক্রিয় প্রেগন্যান্সি প্রোফাইল পাওয়া যায়নি' });
    }

    pregnancy.kickLogs.unshift({
      date: new Date(),
      count,
      durationMinutes: durationMinutes || undefined,
      notes: notes || undefined
    });

    // Keep last 60 kick logs
    if (pregnancy.kickLogs.length > 60) {
      pregnancy.kickLogs = pregnancy.kickLogs.slice(0, 60);
    }

    await pregnancy.save();

    return res.status(200).json({
      message: 'বেবি কিক সফলভাবে সংরক্ষণ করা হয়েছে! 👶',
      kickLogs: pregnancy.kickLogs
    });
  } catch (error: any) {
    console.error('[PregnancyController] logKick error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// POST /api/pregnancy/visit - Add or Update Doctor Visit
export const addOrUpdateVisit = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) return res.status(401).json({ message: 'অননুমোদিত অনুরোধ' });

    const { visitId, date, title, doctorName, notes, isCompleted } = req.body;
    if (!date || !title) {
      return res.status(400).json({ message: 'তারিখ ও বিষয় প্রয়োজন' });
    }

    const pregnancy = await Pregnancy.findOne({ userId, status: 'active' });
    if (!pregnancy) {
      return res.status(404).json({ message: 'সক্রিয় প্রেগন্যান্সি প্রোফাইল পাওয়া যায়নি' });
    }

    if (visitId) {
      const visit = pregnancy.doctorVisits.find(v => v._id?.toString() === visitId);
      if (visit) {
        visit.date = new Date(date);
        visit.title = title;
        if (doctorName !== undefined) visit.doctorName = doctorName;
        if (notes !== undefined) visit.notes = notes;
        if (isCompleted !== undefined) visit.isCompleted = isCompleted;
      }
    } else {
      pregnancy.doctorVisits.push({
        date: new Date(date),
        title,
        doctorName: doctorName || undefined,
        notes: notes || undefined,
        isCompleted: !!isCompleted
      });
      // Sort visits by date ascending
      pregnancy.doctorVisits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    await pregnancy.save();

    return res.status(200).json({
      message: 'ডাক্তারের ভিজিট সফলভাবে সংরক্ষণ করা হয়েছে! 🩺',
      doctorVisits: pregnancy.doctorVisits
    });
  } catch (error: any) {
    console.error('[PregnancyController] addOrUpdateVisit error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// DELETE /api/pregnancy/visit/:visitId
export const deleteVisit = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { visitId } = req.params;

    const pregnancy = await Pregnancy.findOne({ userId, status: 'active' });
    if (!pregnancy) {
      return res.status(404).json({ message: 'সক্রিয় প্রোফাইল পাওয়া যায়নি' });
    }

    pregnancy.doctorVisits = pregnancy.doctorVisits.filter(v => v._id?.toString() !== visitId);
    await pregnancy.save();

    return res.status(200).json({
      message: 'ভিজিট মুছে ফেলা হয়েছে',
      doctorVisits: pregnancy.doctorVisits
    });
  } catch (error: any) {
    console.error('[PregnancyController] deleteVisit error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// PUT /api/pregnancy/settings
export const updatePregnancySettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { weeklyReminderEnabled, babyNickname, status } = req.body;

    const pregnancy = await Pregnancy.findOne({ userId });
    if (!pregnancy) {
      return res.status(404).json({ message: 'প্রোফাইল পাওয়া যায়নি' });
    }

    if (weeklyReminderEnabled !== undefined) pregnancy.weeklyReminderEnabled = !!weeklyReminderEnabled;
    if (babyNickname) pregnancy.babyNickname = babyNickname.trim();
    if (status) pregnancy.status = status;

    await pregnancy.save();

    return res.status(200).json({
      message: 'সেটিংস আপডেট হয়েছে',
      pregnancy
    });
  } catch (error: any) {
    console.error('[PregnancyController] updateSettings error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};

// DELETE /api/pregnancy - Reset or Archive
export const resetPregnancy = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    await Pregnancy.findOneAndDelete({ userId });
    return res.status(200).json({ message: 'মাতৃত্ব ট্র্যাকার রিসেট করা হয়েছে' });
  } catch (error: any) {
    console.error('[PregnancyController] resetPregnancy error:', error);
    return res.status(500).json({ message: 'সার্ভার সমস্যা হয়েছে', error: error.message });
  }
};
