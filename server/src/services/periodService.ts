import mongoose from 'mongoose';
import PeriodCycle, { IPeriodCycle } from '../models/PeriodCycle';
import Reminder from '../models/Reminder';
import { bnToEnDigits, enToBnDigits } from './expenseService';

export interface PeriodComputedStatus {
  hasRecord: boolean;
  cycleLength: number;
  periodDuration: number;
  reminderEnabled: boolean;
  lastPeriodStart?: Date;
  nextExpectedDate?: Date;
  lastPeriodBn?: string;
  nextExpectedBn?: string;
  currentCycleDay?: number;
  daysRemaining?: number;
  isLate?: boolean;
  lateDays?: number;
  phaseKey?: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'late';
  phaseLabelBn?: string;
  phaseAdviceBn?: string;
  history: Array<{
    _id?: string;
    startDate: Date;
    startDateBn: string;
    cycleDays?: number;
    notes?: string;
  }>;
}

const bnMonths: Record<string, number> = {
  'জানুয়ারি': 0, 'জানুয়ারি': 0, 'january': 0, 'jan': 0,
  'ফেব্রুয়ারি': 1, 'ফেব্রুয়ারি': 1, 'february': 1, 'feb': 1,
  'মার্চ': 2, 'march': 2, 'mar': 2,
  'এপ্রিল': 3, 'april': 3, 'apr': 3,
  'মে': 4, 'may': 4,
  'জুন': 5, 'june': 5, 'jun': 5,
  'জুলাই': 6, 'july': 6, 'jul': 6,
  'আগস্ট': 7, 'august': 7, 'aug': 7,
  'সেপ্টেম্বর': 8, 'september': 8, 'sep': 8, 'sept': 8,
  'অক্টোবর': 9, 'october': 9, 'oct': 9,
  'নভেম্বর': 10, 'november': 10, 'nov': 10,
  'ডিসেম্বর': 11, 'december': 11, 'dec': 11
};

export const formatDateBn = (d: Date): string => {
  return d.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dhaka'
  });
};

export const getDhakaMidnight = (date: Date = new Date()): Date => {
  const dhakaStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const [y, m, d] = dhakaStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
};

/**
 * Quick pre-filter: is this message about period / menstrual cycle tracking?
 */
export const looksPeriodRelated = (text: string): boolean => {
  if (!text) return false;
  return /(?:পিরিয়ড|পিরিয়ড|মাসিক|মেনস্ট্রুয়াল|মেন্স|period|priod|menstrual|masik|mashik|menses|cycle\s*day|সাইকেল\s*ডে|সাইকেলের\s*কত\s*দিন|সাইকেলের\s*কয়দিন)/i.test(text);
};

/**
 * Sync automatic polite WhatsApp reminder 2 days before next expected period date
 */
export const syncPeriodWhatsAppReminder = async (
  userId: string | mongoose.Types.ObjectId,
  nextExpectedDate: Date,
  enabled: boolean
): Promise<void> => {
  try {
    // Remove previous auto-generated period reminders for this user
    await Reminder.deleteMany({
      userId,
      title: /হেলথ রুটিন রিমাইন্ডার|পিরিয়ড রিমাইন্ডার/i
    });

    if (!enabled) return;

    const alertDate = new Date(nextExpectedDate);
    alertDate.setUTCDate(alertDate.getUTCDate() - 2);

    const nowMidnight = getDhakaMidnight();
    const targetDate = alertDate >= nowMidnight ? alertDate : nextExpectedDate;

    if (targetDate >= nowMidnight) {
      const nextBn = formatDateBn(nextExpectedDate);
      await Reminder.create({
        userId,
        title: `🌸 হেলথ রুটিন রিমাইন্ডার (সম্ভাব্য তারিখ: ${nextBn})`,
        description: `আপনার পরবর্তী মাসিক রুটিন সাইকেল ${nextBn} তারিখের দিকে শুরু হতে পারে। প্রয়োজনীয় প্রস্তুতি ও যত্ন নিন। 🌸`,
        date: targetDate,
        time: '09:00',
        priority: 'High',
        category: 'General',
        repeat: 'Once',
        status: 'Pending',
        isAlarm: false
      });
    }
  } catch (err) {
    console.error('Error syncing period WhatsApp reminder:', err);
  }
};

/**
 * Compute live cycle day count, remaining days, and phase info for a user
 */
export const getPeriodStatus = async (
  userId: string | mongoose.Types.ObjectId
): Promise<PeriodComputedStatus> => {
  const doc = await PeriodCycle.findOne({ userId });
  if (!doc) {
    return {
      hasRecord: false,
      cycleLength: 28,
      periodDuration: 5,
      reminderEnabled: true,
      history: []
    };
  }

  const today = getDhakaMidnight();
  const lastStart = getDhakaMidnight(new Date(doc.lastPeriodStart));
  const cycleLength = doc.cycleLength || 28;
  const periodDuration = doc.periodDuration || 5;

  const nextExpected = new Date(lastStart);
  nextExpected.setUTCDate(nextExpected.getUTCDate() + cycleLength);

  // Day 1 is the day period started
  const diffFromStartMs = today.getTime() - lastStart.getTime();
  const currentCycleDay = Math.max(1, Math.floor(diffFromStartMs / (1000 * 60 * 60 * 24)) + 1);

  const diffToNextMs = nextExpected.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffToNextMs / (1000 * 60 * 60 * 24));

  const isLate = daysRemaining < 0;
  const lateDays = isLate ? Math.abs(daysRemaining) : 0;

  let phaseKey: PeriodComputedStatus['phaseKey'] = 'follicular';
  let phaseLabelBn = 'স্বাভাবিক সময় (Follicular Phase)';
  let phaseAdviceBn = 'শরীরচর্চা ও পুষ্টিকর খাবার বজায় রাখুন।';

  if (currentCycleDay <= periodDuration) {
    phaseKey = 'menstrual';
    phaseLabelBn = `পিরিয়ড চলছে (${enToBnDigits(currentCycleDay)}তম দিন)`;
    phaseAdviceBn = 'পর্যাপ্ত বিশ্রাম নিন, হালকা গরম পানি পান করুন এবং আয়রনসমৃদ্ধ খাবার খান।';
  } else if (isLate) {
    phaseKey = 'late';
    phaseLabelBn = `${enToBnDigits(lateDays)} দিন ওভারডিউ (Late)`;
    phaseAdviceBn = 'নির্ধারিত সময়ের চেয়ে দেরি হচ্ছে। নতুন শুরু হলে তারিখ আপডেট করুন।';
  } else if (daysRemaining <= 3) {
    phaseKey = 'luteal';
    phaseLabelBn = 'পরবর্তী সাইকেলের কাছাকাছি (Pre-Period)';
    phaseAdviceBn = 'আগামী কয়েক দিনের মধ্যে নতুন সাইকেল শুরু হতে পারে, প্রয়োজনীয় প্রস্তুতি রাখুন।';
  } else if (currentCycleDay >= Math.round(cycleLength / 2) - 2 && currentCycleDay <= Math.round(cycleLength / 2) + 2) {
    phaseKey = 'ovulation';
    phaseLabelBn = 'ওভুলেশন সময় (Ovulation Window)';
    phaseAdviceBn = 'এটি সাইকেলের মাঝামাঝি সময়। পর্যাপ্ত পানি পান করুন।';
  } else if (currentCycleDay > Math.round(cycleLength / 2) + 2) {
    phaseKey = 'luteal';
    phaseLabelBn = 'লুটিয়াল ফেজ (Luteal Phase)';
    phaseAdviceBn = 'পর্যাপ্ত ঘুম ও সুষম খাবার নিশ্চিত করুন।';
  }

  const sortedHistory = [...(doc.history || [])]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .map((h: any) => ({
      _id: h._id?.toString(),
      startDate: h.startDate,
      startDateBn: formatDateBn(new Date(h.startDate)),
      cycleDays: h.cycleDays,
      notes: h.notes
    }));

  return {
    hasRecord: true,
    cycleLength,
    periodDuration,
    reminderEnabled: doc.reminderEnabled !== false,
    lastPeriodStart: lastStart,
    nextExpectedDate: nextExpected,
    lastPeriodBn: formatDateBn(lastStart),
    nextExpectedBn: formatDateBn(nextExpected),
    currentCycleDay,
    daysRemaining,
    isLate,
    lateDays,
    phaseKey,
    phaseLabelBn,
    phaseAdviceBn,
    history: sortedHistory
  };
};

/**
 * Log a new period start date and recalculate cycle
 */
export const logPeriodStart = async (
  userId: string | mongoose.Types.ObjectId,
  startDateInput: Date | string,
  options?: { cycleLength?: number; periodDuration?: number; notes?: string }
): Promise<PeriodComputedStatus> => {
  const startMidnight = getDhakaMidnight(new Date(startDateInput));
  let doc = await PeriodCycle.findOne({ userId });

  if (!doc) {
    const cLen = options?.cycleLength || 28;
    const pDur = options?.periodDuration || 5;
    const nextExp = new Date(startMidnight);
    nextExp.setUTCDate(nextExp.getUTCDate() + cLen);

    doc = await PeriodCycle.create({
      userId,
      cycleLength: cLen,
      periodDuration: pDur,
      lastPeriodStart: startMidnight,
      nextExpectedDate: nextExp,
      reminderEnabled: true,
      history: [
        {
          startDate: startMidnight,
          notes: options?.notes,
          loggedAt: new Date()
        }
      ]
    });
  } else {
    if (options?.cycleLength && options.cycleLength >= 18 && options.cycleLength <= 45) {
      doc.cycleLength = options.cycleLength;
    }
    if (options?.periodDuration && options.periodDuration >= 2 && options.periodDuration <= 12) {
      doc.periodDuration = options.periodDuration;
    }

    // Avoid duplicate entry for the exact same start date
    const existingIdx = doc.history.findIndex(
      h => getDhakaMidnight(new Date(h.startDate)).getTime() === startMidnight.getTime()
    );

    if (existingIdx >= 0) {
      if (options?.notes) doc.history[existingIdx].notes = options.notes;
    } else {
      doc.history.push({
        startDate: startMidnight,
        notes: options?.notes,
        loggedAt: new Date()
      });
    }

    // Sort history chronologically ascending to calculate intervals
    doc.history.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const validCycles: number[] = [];
    for (let i = 1; i < doc.history.length; i++) {
      const prev = getDhakaMidnight(new Date(doc.history[i - 1].startDate));
      const curr = getDhakaMidnight(new Date(doc.history[i].startDate));
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      doc.history[i - 1].cycleDays = diffDays;
      if (diffDays >= 20 && diffDays <= 42) {
        validCycles.push(diffDays);
      }
    }

    // Auto-refine cycleLength if user didn't explicitly override and we have valid intervals
    if (!options?.cycleLength && validCycles.length > 0) {
      const recent = validCycles.slice(-4);
      const avg = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
      if (avg >= 21 && avg <= 40) {
        doc.cycleLength = avg;
      }
    }

    const latestEntry = doc.history[doc.history.length - 1];
    doc.lastPeriodStart = latestEntry ? latestEntry.startDate : startMidnight;

    const nextExp = new Date(getDhakaMidnight(new Date(doc.lastPeriodStart)));
    nextExp.setUTCDate(nextExp.getUTCDate() + doc.cycleLength);
    doc.nextExpectedDate = nextExp;

    await doc.save();
  }

  await syncPeriodWhatsAppReminder(userId, doc.nextExpectedDate, doc.reminderEnabled !== false);
  return await getPeriodStatus(userId);
};

/**
 * Update cycle settings (cycleLength, periodDuration, reminderEnabled)
 */
export const updatePeriodSettings = async (
  userId: string | mongoose.Types.ObjectId,
  settings: { cycleLength?: number; periodDuration?: number; reminderEnabled?: boolean }
): Promise<PeriodComputedStatus> => {
  const doc = await PeriodCycle.findOne({ userId });
  if (!doc) {
    return await getPeriodStatus(userId);
  }

  if (settings.cycleLength && settings.cycleLength >= 18 && settings.cycleLength <= 45) {
    doc.cycleLength = settings.cycleLength;
  }
  if (settings.periodDuration && settings.periodDuration >= 2 && settings.periodDuration <= 12) {
    doc.periodDuration = settings.periodDuration;
  }
  if (typeof settings.reminderEnabled === 'boolean') {
    doc.reminderEnabled = settings.reminderEnabled;
  }

  const nextExp = new Date(getDhakaMidnight(new Date(doc.lastPeriodStart)));
  nextExp.setUTCDate(nextExp.getUTCDate() + doc.cycleLength);
  doc.nextExpectedDate = nextExp;

  await doc.save();
  await syncPeriodWhatsAppReminder(userId, doc.nextExpectedDate, doc.reminderEnabled !== false);
  return await getPeriodStatus(userId);
};

/**
 * Delete a history entry or reset period tracker
 */
export const deletePeriodEntry = async (
  userId: string | mongoose.Types.ObjectId,
  historyId?: string
): Promise<PeriodComputedStatus> => {
  const doc = await PeriodCycle.findOne({ userId });
  if (!doc) return await getPeriodStatus(userId);

  if (!historyId || historyId === 'all') {
    await PeriodCycle.deleteOne({ userId });
    await syncPeriodWhatsAppReminder(userId, new Date(), false);
    return await getPeriodStatus(userId);
  }

  doc.history = doc.history.filter((h: any) => h._id?.toString() !== historyId);
  if (doc.history.length === 0) {
    await PeriodCycle.deleteOne({ userId });
    await syncPeriodWhatsAppReminder(userId, new Date(), false);
    return await getPeriodStatus(userId);
  }

  doc.history.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const latest = doc.history[doc.history.length - 1];
  doc.lastPeriodStart = latest.startDate;

  const nextExp = new Date(getDhakaMidnight(new Date(doc.lastPeriodStart)));
  nextExp.setUTCDate(nextExp.getUTCDate() + doc.cycleLength);
  doc.nextExpectedDate = nextExp;

  await doc.save();
  await syncPeriodWhatsAppReminder(userId, doc.nextExpectedDate, doc.reminderEnabled !== false);
  return await getPeriodStatus(userId);
};

/**
 * Parse natural language date from period message (today, yesterday, "5 tarikh", "10 october")
 */
export const extractDateFromPeriodMessage = (text: string): Date => {
  const today = getDhakaMidnight();
  const clean = bnToEnDigits(text.toLowerCase());

  if (/(?:গতকাল|কালকে|yesterday|gotokal|kalke)/i.test(clean)) {
    const yest = new Date(today);
    yest.setUTCDate(yest.getUTCDate() - 1);
    return yest;
  }

  if (/(?:পরশু|porshu)/i.test(clean)) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - 2);
    return d;
  }

  const daysAgoMatch = clean.match(/(\d{1,2})\s*(?:দিন\s*আগে|din\s*age|days?\s*ago)/i);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1], 10);
    if (n >= 1 && n <= 40) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - n);
      return d;
    }
  }

  // Check explicit day + month (e.g. "10 october", "October ar 14 tarik", "অক্টোবর মাসের ১৪ তারিখ", "৫ নভেম্বর")
  for (const [mName, mIdx] of Object.entries(bnMonths)) {
    const regex = new RegExp(
      `(\\d{1,2})(?:st|nd|rd|th|শে|ই|এ)?\\s*(?:তারিখ|তারিখে|tarikh|tarik|tarikhe)?\\s*(?:of\\s*)?${mName}\\b|\\b${mName}(?:ের)?\\s*(?:মাসের|মাসে|maser|mase|mas|month)?\\s*(?:এর|এ|er|ar|e|a|of)?\\s*(\\d{1,2})`,
      'i'
    );
    const match = clean.match(regex);
    if (match) {
      const dayNum = parseInt(match[1] || match[2], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        let yr = today.getUTCFullYear();
        let candidate = new Date(Date.UTC(yr, mIdx, dayNum, 0, 0, 0));
        if (candidate.getTime() > today.getTime() + 24 * 60 * 60 * 1000) {
          candidate = new Date(Date.UTC(yr - 1, mIdx, dayNum, 0, 0, 0));
        }
        return candidate;
      }
    }
  }

  // Check "5 tarikh" / "৫ তারিখে"
  const tarikhMatch = clean.match(/(\d{1,2})\s*(?:তারিখ|তারিখে|tarikh|tarik|tarikhe)/i);
  if (tarikhMatch) {
    const dayNum = parseInt(tarikhMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      let yr = today.getUTCFullYear();
      let mo = today.getUTCMonth();
      let candidate = new Date(Date.UTC(yr, mo, dayNum, 0, 0, 0));
      // If that day is in the future this month, it was last month
      if (candidate.getTime() > today.getTime()) {
        mo -= 1;
        if (mo < 0) {
          mo = 11;
          yr -= 1;
        }
        candidate = new Date(Date.UTC(yr, mo, dayNum, 0, 0, 0));
      }
      return candidate;
    }
  }

  return today;
};

/**
 * Format concise WhatsApp status reply for Period Cycle Tracker
 */
export const formatPeriodStatusWhatsApp = (status: PeriodComputedStatus, isJustLogged: boolean = false): string => {
  if (!status.hasRecord) {
    return (
      `🌸 *পিরিয়ড ও সাইকেল ট্র্যাকার*\n\n` +
      `আপনার এখনো কোনো পিরিয়ড শুরুর তারিখ সেভ করা নেই।\n\n` +
      `💡 শুরু করতে লিখুন:\n` +
      `• *"আজ থেকে পিরিয়ড শুরু"*\n` +
      `• *"৫ তারিখ পিরিয়ড শুরু হয়েছিল"*`
    );
  }

  const header = isJustLogged
    ? `🌸 *পিরিয়ড সাইকেল সেভ হয়েছে!*`
    : `🌸 *আপনার পিরিয়ড ও সাইকেল আপডেট*`;

  const dayCountLine = `⏱️ *বর্তমান সাইকেল:* ${enToBnDigits(status.currentCycleDay || 1)}তম দিন চলছে *(Day ${status.currentCycleDay} of ${status.cycleLength})*`;
  const lastDateLine = `📅 *সর্বশেষ শুরু:* ${status.lastPeriodBn}`;
  const nextDateLine = `🗓️ *পরবর্তী সম্ভাব্য তারিখ:* ${status.nextExpectedBn}`;

  let remainingLine = '';
  if (status.isLate && (status.lateDays || 0) > 0) {
    remainingLine = `⚠️ *স্ট্যাটাস:* নির্ধারিত সময়ের চেয়ে *${enToBnDigits(status.lateDays || 0)} দিন দেরি (Late)* চলছে`;
  } else if (status.daysRemaining === 0) {
    remainingLine = `🔔 *স্ট্যাটাস:* আজ আপনার পরবর্তী সম্ভাব্য তারিখ!`;
  } else {
    remainingLine = `⏳ *বাকি আছে:* আর *${enToBnDigits(status.daysRemaining || 0)} দিন*`;
  }

  return (
    `${header}\n\n` +
    `${dayCountLine}\n` +
    `${lastDateLine}\n` +
    `${nextDateLine}\n` +
    `${remainingLine}\n` +
    `💡 *অবস্থা:* ${status.phaseLabelBn}`
  );
};

/**
 * Handle incoming WhatsApp text if it is related to Period / Menstrual Cycle Tracking
 */
export const handleWhatsAppPeriodCommand = async (
  userId: string | mongoose.Types.ObjectId
, text: string
): Promise<string | null> => {
  if (!looksPeriodRelated(text)) return null;

  const clean = text.trim();
  const enDigitsText = bnToEnDigits(clean);

  // 1. Delete / Reset command
  if (/(?:delete|del|remove|reset|ডিলিট|মুছে|রিসেট)/i.test(clean)) {
    await deletePeriodEntry(userId, 'all');
    return `🗑️ আপনার পিরিয়ড ও সাইকেল ট্র্যাকারের তথ্য মুছে ফেলা হয়েছে।`;
  }

  // 2. Cycle length setting command (e.g. "আমার পিরিয়ড সাইকেল ৩০ দিনের", "period cycle 30 days")
  const cycleSetMatch = enDigitsText.match(/(?:সাইকেল|cycle)\s*(\d{2})\s*(?:দিন|দিনের|days?|din)?/i);
  if (cycleSetMatch && !/(?:শুরু|হয়েছে|হইছে|started|start)/i.test(clean)) {
    const newLen = parseInt(cycleSetMatch[1], 10);
    if (newLen >= 18 && newLen <= 45) {
      const updated = await updatePeriodSettings(userId, { cycleLength: newLen });
      if (updated.hasRecord) {
        return `✅ আপনার সাইকেল *${enToBnDigits(newLen)} দিন* সেট করা হয়েছে!\n\n` + formatPeriodStatusWhatsApp(updated, false);
      }
      return `✅ আপনার পিরিয়ড সাইকেল *${enToBnDigits(newLen)} দিন* হিসেবে সেট করা হয়েছে। পিরিয়ড শুরুর তারিখ সেভ করতে লিখুন: *"আজ থেকে পিরিয়ড শুরু"*।`;
    }
  }

  // 3. Inquiry / Day count query (e.g. "পিরিয়ডের কত দিন চলছে", "পরের পিরিয়ড কবে", "period kobe", "priod day count")
  const isQuestion =
    /\?$/.test(clean) ||
    /(?:কবে|কত\s*দিন|কয়\s*দিন|কততম|দিন\s*চলছে|ডেট\s*কবে|পরের|নেক্সট|বাকি\s*কত|হিসাব|স্ট্যাটাস|ট্রেকার|ট্র্যাকার|kobe|koto\s*din|koy\s*din|koi\s*din|cholche|next|status|count|baki|koto|kokhon)/i.test(clean);

  const hasExplicitDateInMsg =
    /(?:আজ|আজকে|গতকাল|কালকে|পরশু|তারিখ|তারিখে|দিন\s*আগে|aj|ajke|gotokal|kalke|porshu|yesterday|today|tarikh|tarik|tarikhe|din\s*age|days?\s*ago|জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)/i.test(clean);

  const isLogIntent =
    /(?:শুরু|সুরু|হয়েছিল|হইছিল|হয়েছে|হইছে|হলো|হল|সেভ|লগ|আজ\s*থেকে|কাল\s*থেকে|তারিখ\s*থেকে|started|start|suru|shuru|hoyechilo|hoichilo|hoisilo|hoyesilo|hoyeche|hoise|holo|save|log)/i.test(clean) ||
    (hasExplicitDateInMsg && !isQuestion);

  if (isLogIntent && !/(?:কবে\s*(?:শুরু|সুরু)?\s*হবে|কবে\s*হবে|kobe\s*hobe|kobe\s*(?:suru|shuru|start)\s*hobe|next\s*(?:period|priod)\s*kobe)/i.test(clean)) {
    const startDate = extractDateFromPeriodMessage(clean);
    const updated = await logPeriodStart(userId, startDate);
    return formatPeriodStatusWhatsApp(updated, true);
  }

  if (isQuestion || looksPeriodRelated(clean)) {
    const status = await getPeriodStatus(userId);
    return formatPeriodStatusWhatsApp(status, false);
  }

  return null;
};

