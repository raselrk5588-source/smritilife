import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import User from '../models/User';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import TodoList from '../models/TodoList';
import Note from '../models/Note';
import Contact from '../models/Contact';
import AITrainingRule from '../models/AITrainingRule';
import UserDocument from '../models/UserDocument';
import SystemSettings from '../models/SystemSettings';
import { getMaintenanceStatus, updateMaintenanceCache } from '../services/maintenanceService';
import { analyzeMessage, analyzeAudioMessage, formatTime12Hour, parseBengaliTime, parseRelativeDate, matchRelativeDuration, cleanPersonName, hasExplicitDateOrDay, invalidateRulesCache } from '../services/aiWhatsAppService';
import { deliverWishCard, getOccasionImageUrl, getOccasionTitle } from '../services/wishDeliveryService';
import { cancelAlarmRinger } from '../services/reminderScheduler';
import { getRamadanTimes, matchDistrict, RAMADAN_DUAS, formatBanglaTime, BD_DISTRICTS } from '../services/ramadanService';
import {
  parseExpenseInput,
  recordExpense,
  getExpenseSummary,
  getExpenseSummaryForDate,
  getExpenseSummaryForMonth,
  detectExpenseCategory,
  buildExpenseLoggedMessage,
  buildDailyExpenseQueryMessage,
  buildMonthlyExpenseQueryMessage,
  deleteExpenseByIndex,
  deleteExpenseByTitle,
  deleteLastExpense,
  deleteAllExpensesForDate,
  buildExpenseDeletedMessage,
  buildExpenseDeleteChoiceMessage,
  enToBnDigits,
  formatTaka,
  bnToEnDigits
} from '../services/expenseService';
import { parseDebtInput, recordDebt, settleDebtByPerson, getDebtSummary, getPersonDebtSummary, buildDebtLoggedMessage, buildDebtSettledMessage, buildDebtSummaryMessage, buildPersonDebtMessage } from '../services/debtService';
import { detectDocumentCategory, saveFileToDisk, uploadBufferToMeta, findMatchingDocument, findMatchingDocumentWithVersion, convertEnglishDigitsToBengali, formatDocumentListMessage, calculateItemDuration, getDocumentBuffer } from '../services/documentService';

export interface ReminderActionState {
  reminderId: string;
  title: string;
  waitingForTime: boolean;
  expiresAt: number;
}

export interface WishPendingState {
  recipientPhone?: string;
  occasion: string;
  message?: string;
  date?: string;
  time?: string;
  sendNow?: boolean;
  waitingForName: boolean;
  expiresAt: number;
}

export interface DocumentPendingState {
  mediaId: string;
  mimeType: string;
  filename: string;
  buffer: Buffer;
  isImage: boolean;
  expiresAt: number;
}

export interface PendingReminderState {
  title: string;
  time: string;
  formattedTime: string;
  category?: string;
  customMessage?: string;
  expiresAt: number;
}

export interface ExpenseContextState {
  targetDate: Date;
  dateLabelBn: string;
  expenses: Array<{ id: string; title: string; amount: number }>;
  expiresAt: number;
}

// In-memory state tracking for active reminder prompts, wish prompts, pending document uploads, and expense context
export const userReminderState = new Map<string, ReminderActionState>();
export const userWishState = new Map<string, WishPendingState>();
export const userDocPendingState = new Map<string, DocumentPendingState>();
export const userPendingReminderState = new Map<string, PendingReminderState>();
export const lastRescheduledReminder = new Map<string, { reminderId: string; title: string; updatedAt: number }>();
export const userExpenseContext = new Map<string, ExpenseContextState>();

export interface PendingMedicineItem {
  name: string;
  routine: string[];
  mealTiming: string;
  durationDays: number;
  customTimes?: Record<string, string>;
  endDate?: Date;
  mealTimingText?: string;
}

export interface PendingMedicineState {
  medicines: PendingMedicineItem[];
  expiresAt: number;
}

export const userPendingMedicineState = new Map<string, PendingMedicineState>();

export function parseMedicinePrescriptionText(text: string): {
  medicines: PendingMedicineItem[];
  hasStartDate: boolean;
  startDate?: Date;
  startDateLabel?: string;
} | null {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const hasMedKeyword = /(?:ওষুধ|ঔষধ|মেডিসিন|tablet|medicine|capsule|ট্যাবলেট|ক্যাপসুল|ডাক্তার|প্রেসক্রিপশন|osudh|osud|ousodh|ousud|oshudh|oshud|নাপা|napa|প্যারাসিটামল|paracetamol|সেক্লো|seclo|অ্যান্টাসিড|antacid|গ্যাস্ট্রিক|গ্যাস|gas|gastric|ফ্ল্যাজিল|flagyl|অ্যামোক্সিসিলিন|amoxicillin|এজিথ্রোমাইসিন|azithromycin|ম্যাক্সপ্রো|maxpro|সারজেল|sergel|প্যানটনিক|pantonic|প্যানটোপ্রাজল|pantoprazole|অমিপ্রাজল|omeprazole|মন্টিন|montene|মোন্টাস|montas|হিস্টাসিন|histasin|ফেভেক্স|fexofenadine|ফেক্সো|ক্যালসিয়াম|calcium|ভিটামিন|vitamin|প্রেসার|ডায়াবেটিস|ইনসুলিন|সিরাপ|syrup)/i.test(lower);
  
  const hasDosagePattern = /(?:১\+১\+১|1\+1\+1|১\+০\+১|1\+0\+1|০\+১\+১|0\+1\+1|১\+০\+০|1\+0\+0|০\+০\+১|0\+0\+1|\b[১-৩1-3]\s*বেলা\b|\b[১-৩1-3]\s*bela\b|\b[১-৩1-3]\s*bar\b|\b[১-৩1-3]\s*times\b|সকাল|দুপুর|রাত|sokal|dupur|rat|shokal|raat|bikele?|সন্ধ্যা)/i.test(lower);
  
  const hasDuration = /(?:[০-৯\d]+)\s*(?:দিন|din|days?|সপ্তাহ|weeks?|মাস|months?)|(?:[০-৯\d]+)\s*(?:তারিখ|তারিখে|tarik|tarikh|october|november|december|january|february|march|april|may|june|july|august|september|অক্টোবর|নভেম্বর|ডিসেম্বর|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর)?\s*(?:পর্যন্ত|porjonto|porjanto|till|until)|(?:পর্যন্ত|porjonto|porjanto|till|until)\s*(\d{1,2}|[০-৯]{1,2})/i.test(lower);

  // Must match either (medKeyword && (dosage || duration)) OR (dosage && duration)
  if (!((hasMedKeyword && (hasDosagePattern || hasDuration)) || (hasDosagePattern && hasDuration))) {
    return null;
  }

  const bnToEnMap: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const bnDigits: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  const toBn = (n: number | string) => n.toString().replace(/\d/g, d => bnDigits[d] || d);

  // Live Bangladesh Date
  const now = new Date();
  const dhakaStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const [curYear, curMonth, curDay] = dhakaStr.split('-').map(Number);
  const todayDhaka = new Date(Date.UTC(curYear, curMonth - 1, curDay, 0, 0, 0));

  // Detect explicit start date
  let hasStartDate = false;
  let startDate: Date = todayDhaka;
  let startDateLabel = 'আজ';

  if (/\b(?:আজ|আজকে|aj|ajke|today|এখন|akhon)\s*(?:থেকে|theke)?\b/i.test(lower)) {
    hasStartDate = true;
    startDate = todayDhaka;
    startDateLabel = 'আজ';
  } else if (/\b(?:কাল|কালকে|আগামীকাল|kal|kalke|agamikal|tomorrow)\s*(?:থেকে|theke)?\b/i.test(lower)) {
    hasStartDate = true;
    const tomorrow = new Date(todayDhaka);
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = tomorrow;
    startDateLabel = 'আগামীকাল';
  } else if (/\b(?:পরশু|পরশুদিন|porshu)\s*(?:থেকে|theke)?\b/i.test(lower)) {
    hasStartDate = true;
    const porshu = new Date(todayDhaka);
    porshu.setDate(porshu.getDate() + 2);
    startDate = porshu;
    startDateLabel = 'পরশু';
  } else {
    const dateMatch = lower.match(/(\d{1,2}|[০-৯]{1,2})\s*(?:তারিখ|তারিখে|tarik|tarikh)\s*(?:থেকে|theke)?/i);
    if (dateMatch) {
      const dNum = parseInt(dateMatch[1].replace(/[০-৯]/g, m => bnDigits[m] || m), 10);
      if (dNum >= 1 && dNum <= 31) {
        hasStartDate = true;
        let tMonth = curMonth - 1;
        let tYear = curYear;
        if (dNum < curDay) {
          tMonth += 1;
          if (tMonth > 11) { tMonth = 0; tYear += 1; }
        }
        startDate = new Date(Date.UTC(tYear, tMonth, dNum, 0, 0, 0));
        startDateLabel = `${dNum} তারিখ`;
      }
    }
  }

  // Detect target End Date (e.g. "27 tarikh porjonto", "27 October porjonto", "আগামী ২৭ তারিখ পর্যন্ত")
  let explicitEndDate: Date | undefined = undefined;
  const endMatch = lower.match(/(\d{1,2}|[০-৯]{1,2})\s*(?:তারিখ|তারিখে|tarik|tarikh|october|november|december|january|february|march|april|may|june|july|august|september|অক্টোবর|নভেম্বর|ডিসেম্বর|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর)?\s*(?:পর্যন্ত|porjonto|porjanto|till|until)/i)
    || lower.match(/(?:পর্যন্ত|porjonto|porjanto|till|until)\s*(\d{1,2}|[০-৯]{1,2})/i);

  if (endMatch) {
    const dNum = parseInt(endMatch[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m), 10);
    if (dNum >= 1 && dNum <= 31) {
      let tMonth = curMonth - 1;
      let tYear = curYear;
      if (dNum < curDay) {
        tMonth += 1;
        if (tMonth > 11) { tMonth = 0; tYear += 1; }
      }
      explicitEndDate = new Date(Date.UTC(tYear, tMonth, dNum, 0, 0, 0, 0));
      hasStartDate = true; // When an explicit end date is given, start date defaults to today
    }
  }

  let rawSegments = raw
    .replace(/^(?:ডাক্তার|doctor|প্রেসক্রিপশন|prescription)[^\n:;,]*[:;,-]?\s*/i, '')
    .split(/(?:\r?\n|;|(?<=\b(?:দিন|din|days?))\s*[,&]\s*|(?<=\b(?:দিন|din|days?))\s+(?:আর|এবং|and)\s+|(?<=\b(?:খাব|হবে|khete\s*hbe))\s*[,&]\s*|\b[১-৯\d]+\.\s+)/i)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (rawSegments.length === 0) rawSegments = [raw];

  const medicines: PendingMedicineItem[] = [];

  for (const seg of rawSegments) {
    const segLower = seg.toLowerCase();

    // Duration extraction
    let durationDays = 7;
    const durMatch = segLower.match(/([০-৯\d]+)\s*(?:দিন|din|days?)/i);
    const weekMatch = segLower.match(/([০-৯\d]+)\s*(?:সপ্তাহ|weeks?)/i);
    const monthMatch = segLower.match(/([০-৯\d]+)\s*(?:মাস|months?)/i);

    if (durMatch) {
      const numStr = durMatch[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m);
      durationDays = parseInt(numStr, 10) || 7;
    } else if (weekMatch) {
      const numStr = weekMatch[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m);
      durationDays = (parseInt(numStr, 10) || 1) * 7;
    } else if (monthMatch) {
      const numStr = monthMatch[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m);
      durationDays = (parseInt(numStr, 10) || 1) * 30;
    } else if (explicitEndDate) {
      durationDays = Math.max(1, Math.round((explicitEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    // Routine & custom slot times extraction
    let routine: string[] = [];
    const customTimes: Record<string, string> = {};

    if (/১\+১\+১|1\+1\+1|৩\s*বেলা|3\s*bela|সকাল.*দুপুর.*রাত|sokal.*dupur.*rat|তিন\s*বেলা/i.test(segLower)) {
      routine = ['সকাল', 'দুপুর', 'রাত'];
    } else if (/১\+০\+১|1\+0\+1|২\s*বেলা|2\s*bela|সকাল.*রাত|sokal.*rat|দুই\s*বেলা/i.test(segLower)) {
      routine = ['সকাল', 'রাত'];
    } else if (/সকাল.*দুপুর|sokal.*dupur|১\+১\+০|1\+1\+0/i.test(segLower)) {
      routine = ['সকাল', 'দুপুর'];
    } else if (/দুপুর.*রাত|dupur.*rat|০\+১\+১|0\+1\+1/i.test(segLower)) {
      routine = ['দুপুর', 'রাত'];
    } else if (/০\+০\+১|0\+0\+1|\b(?:রাত|রাতে|rate|raate)\b/i.test(segLower)) {
      routine = ['রাত'];
    } else if (/১\+০\+০|1\+0\+0|\b(?:সকাল|সকালে|sokal|shokal)\b/i.test(segLower)) {
      routine = ['সকাল'];
    } else if (/০\+১\+০|0\+1\+0|\b(?:দুপুর|দুপুরে|dupur)\b/i.test(segLower)) {
      routine = ['দুপুর'];
    } else {
      routine = ['সকাল', 'রাত'];
    }

    // Specific slot time overrides (e.g. "sokal 10 tay", "রাত ৯টায়")
    const sokalTime = segLower.match(/(?:sokal|shokal|সকাল)\s*(\d{1,2}|[০-৯]{1,2})/i);
    if (sokalTime) {
      const h = parseInt(sokalTime[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m), 10);
      if (h >= 1 && h <= 12) {
        customTimes['সকাল'] = `${h.toString().padStart(2, '0')}:00`;
      }
    }
    const ratTime = segLower.match(/(?:rat|raat|rate|রাত|রাতে)\s*(\d{1,2}|[০-৯]{1,2})/i);
    if (ratTime) {
      let h = parseInt(ratTime[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m), 10);
      if (h < 12 && h >= 1) h += 12;
      customTimes['রাত'] = `${h.toString().padStart(2, '0')}:00`;
    }

    // Meal timing extraction with minutes (e.g. "khabar 30 minutes age", "খাবারের ৩০ মিনিট আগে")
    let mealTiming = 'after';
    let mealTimingText = 'খাবারের পরে';
    const isBefore = /(?:খাবারের\s*আগে|খাওয়ার\s*আগে|khabarer\s*age|khawar\s*age|khabar\s*.*age|khawar\s*.*age|before\s*(?:food|meal))/i.test(segLower) ||
                     /(?:গ্যাস্ট্রিক|গ্যাস|seclo|সেক্লো|সারজেল|sergel|maxpro|ম্যাক্সপ্রো|pantoprazole|প্যানটনিক)/i.test(segLower);

    const minMatch = segLower.match(/(\d{1,2}|[০-৯]{1,2})\s*(?:minute|minutes|min|mins|mnt|মিনিট)\s*(?:age|pore|আগে|পরে)/i)
      || segLower.match(/(?:age|pore|আগে|পরে)\s*(\d{1,2}|[০-৯]{1,2})\s*(?:minute|min|মিনিট)/i);

    if (minMatch) {
      const mNum = parseInt(minMatch[1].replace(/[০-৯]/g, m => bnToEnMap[m] || m), 10);
      if (mNum > 0 && mNum <= 120) {
        mealTiming = isBefore ? `before:${mNum}` : `after:${mNum}`;
        mealTimingText = isBefore ? `খাবারের ${toBn(mNum)} মিনিট আগে` : `খাবারের ${toBn(mNum)} মিনিট পরে`;
      }
    } else if (isBefore) {
      mealTiming = 'before';
      mealTimingText = 'খাবারের আগে';
    }

    // Clean medicine name preserving strength/dosage (e.g. "sanbur(30)" -> "Sanbur (30)", "napa 500" -> "Napa 500")
    let cleanName = seg;
    cleanName = cleanName.replace(/mone\s*koriye\s*di[ow]|মনে\s*করিয়ে\s*দিও/gi, '');
    cleanName = cleanName.replace(/\b(?:aj\s*thake|আজ\s*থেকে|aj\s*theke|আজকে\s*থেকে)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:aj|ajke|kal|kalke|আজ|আজকে|কাল|কালকে)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:agami|আগামী)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:\d{1,2}|[০-৯]{1,2})\s*(?:tarikh|tarik|তারিখ|তারিখে|october|november|december|january|february|march|april|may|june|july|august|september|অক্টোবর|নভেম্বর|ডিসেম্বর|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর)?\s*(?:porjonto|porjanto|পর্যন্ত)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:khete\s*hobe|খেতে\s*হবে|khete\s*hbe|khawa\s*lagbe|খাওয়া\s*লাগবে)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:khabar|khabarer|khawar|খাবারের|খাওয়ার)\s*(?:\d{1,2}|[০-৯]{1,2})?\s*(?:minutes?|mins?|মিনিট)?\s*(?:age|pore|আগে|পরে)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:before|after)\s*(?:food|meal)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:sokal|dupur|rat|shokal|raat|সকাল|দুপুর|রাত)\s*(?:\d{1,2}|[০-৯]{1,2})?\s*(?:tay|ta|টায়|টায়)?\b/gi, '');
    cleanName = cleanName.replace(/\b(?:\d{1,2}|[০-৯]{1,2})\s*(?:tay|ta|টায়|টায়)\b/gi, '');
    cleanName = cleanName.replace(/\b[১-৩1-3]\s*(?:bela|বেলা)\s*(?:kore|করে)?\b/gi, '');
    cleanName = cleanName.replace(/\b(?:ey|ei|এই)?\s*(?:osudh|osud|oshudh|oshud|ওষুধ|ঔষধ|medicine|tablet|ট্যাবলেট)\s*(?:ta|টি|টা)?\b/gi, '');
    cleanName = cleanName.replace(/\b(?:r|ar|এবং|আর)\b/gi, '');
    cleanName = cleanName.replace(/\b(?:doctor|ডাক্তার|আমাকে|আমারে|আমার|দিছে|দিয়েছে)\b/gi, '');
    cleanName = cleanName.replace(/[.,:;!\?_]+/g, ' ').replace(/\s+/g, ' ').trim();
    cleanName = cleanName.replace(/([a-zA-Z\u0980-\u09FF]+)\((\d+)\)/g, '$1 ($2)');
    if (cleanName.length > 0) cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    if (!cleanName || cleanName.length < 2) {
      cleanName = 'ওষুধ';
    }

    medicines.push({
      name: cleanName,
      routine,
      mealTiming,
      mealTimingText,
      durationDays,
      customTimes,
      endDate: explicitEndDate
    });
  }

  if (medicines.length === 0) return null;

  return {
    medicines,
    hasStartDate,
    startDate,
    startDateLabel
  };
}

export async function createMedicineRemindersFromPending(
  userId: any,
  medicines: PendingMedicineItem[],
  startDate: Date
): Promise<{ count: number; startDateBn: string; routineSummary: string }> {
  const routineTimes: Record<string, string> = {
    'সকাল': '08:30',
    'Morning': '08:30',
    'দুপুর': '13:30',
    'Afternoon': '13:30',
    'রাত': '21:00',
    'Night': '21:00'
  };

  const bnDigits: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  const toBn = (n: number | string) => n.toString().replace(/\d/g, d => bnDigits[d] || d);

  const slotMedsMap: Record<string, Array<{
    name: string;
    mealTiming: string;
    durationDays: number;
    startDate: Date;
    endDate: Date;
    customTime?: string;
  }>> = {
    'সকাল': [],
    'দুপুর': [],
    'রাত': []
  };

  let maxDuration = 7;
  let overallEndDate: Date | null = null;

  for (const med of medicines) {
    const duration = med.durationDays || 7;
    if (duration > maxDuration) maxDuration = duration;

    const startD = new Date(startDate);
    startD.setHours(0, 0, 0, 0);

    const endD = med.endDate ? new Date(med.endDate) : new Date(startD);
    if (!med.endDate) {
      endD.setDate(endD.getDate() + duration - 1);
    }
    endD.setHours(0, 0, 0, 0);
    if (!overallEndDate || endD > overallEndDate) {
      overallEndDate = endD;
    }

    for (const rItem of med.routine) {
      const slotKey = rItem.includes('সকাল') || rItem.toLowerCase().includes('morning') ? 'সকাল'
        : rItem.includes('দুপুর') || rItem.toLowerCase().includes('afternoon') ? 'দুপুর'
        : 'রাত';

      const customTime = med.customTimes?.[slotKey];

      // Check if already in slot
      const existing = slotMedsMap[slotKey].find(m => m.name.toLowerCase() === med.name.toLowerCase());
      if (existing) {
        existing.mealTiming = med.mealTiming || 'after';
        existing.durationDays = duration;
        existing.startDate = startD;
        existing.endDate = endD;
        if (customTime) existing.customTime = customTime;
      } else {
        slotMedsMap[slotKey].push({
          name: med.name,
          mealTiming: med.mealTiming || 'after',
          durationDays: duration,
          startDate: startD,
          endDate: endD,
          customTime
        });
      }
    }
  }

  // Create or merge slot reminders
  let totalSlots = 0;
  const slotSummaries: string[] = [];

  const slotIcons: Record<string, string> = {
    'সকাল': '🌅',
    'দুপুর': '☀️',
    'রাত': '🌙'
  };

  for (const slotKey of ['সকাল', 'দুপুর', 'রাত'] as const) {
    const medsForSlot = slotMedsMap[slotKey];
    if (medsForSlot.length === 0) continue;

    const slotTitle = `${slotKey}ের ওষুধ`;
    const slotCustomTime = medsForSlot.find(m => m.customTime)?.customTime;
    const slotTime = slotCustomTime || routineTimes[slotKey] || '08:30';

    const existing = await Reminder.findOne({
      userId,
      category: 'medicine',
      medicineRoutine: slotKey,
      status: { $in: ['Pending', 'Snoozed'] }
    });

    if (existing) {
      let combined = existing.medicines || [];
      for (const m of medsForSlot) {
        const idx = combined.findIndex(item => item.name.toLowerCase() === m.name.toLowerCase());
        if (idx >= 0) combined[idx] = m;
        else combined.push(m);
      }
      existing.medicines = combined;
      existing.status = 'Pending';
      existing.time = slotTime;
      existing.date = startDate;
      await existing.save();
      totalSlots++;
    } else {
      await Reminder.create({
        userId,
        title: slotTitle,
        category: 'medicine',
        description: `${slotKey}ের ওষুধের তালিকা (${medsForSlot.length}টি)`,
        date: startDate,
        time: slotTime,
        repeat: 'Daily',
        medicineRoutine: slotKey,
        medicines: medsForSlot,
        status: 'Pending',
        isAlarm: false
      });
      totalSlots++;
    }

    const itemsText = medsForSlot.map(m => {
      let timing = 'খাবারের পরে';
      if (m.mealTiming?.includes(':')) {
        const [dir, mins] = m.mealTiming.split(':');
        timing = dir === 'before' ? `খাবারের ${toBn(mins)} মিনিট আগে` : `খাবারের ${toBn(mins)} মিনিট পরে`;
      } else if (m.mealTiming === 'before') {
        timing = 'খাবারের আগে';
      }
      return `   • ${m.name} (${toBn(m.durationDays)} দিন, ${timing})`;
    }).join('\n');

    slotSummaries.push(`${slotIcons[slotKey]} *${slotTitle}* (⏰ ${formatTime12Hour(slotTime)}):\n${itemsText}`);
  }

  const startDayBn = startDate.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Asia/Dhaka'
  });

  const endDayBn = overallEndDate ? overallEndDate.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Dhaka'
  }) : '';

  const startDateBn = endDayBn
    ? `${startDayBn} (মেয়াদ: ${toBn(maxDuration)} দিন, ${endDayBn} পর্যন্ত)`
    : startDayBn;

  return {
    count: totalSlots,
    startDateBn,
    routineSummary: slotSummaries.join('\n\n')
  };
}

export interface AggregatedMedicine {
  name: string;
  durationDays: number;
  startDate?: Date;
  endDate?: Date;
  routines: Array<{
    slot: string;
    time: string;
    mealTiming: string;
  }>;
  status: string;
}

/**
 * Phonetic Romanization helper for Bengali text to enable cross-script matching (e.g. "নাপা" <-> "napa")
 */
export function romanizeBengali(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
    'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
    'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', 'ং': 'ng', 'ঃ': '', 'ঁ': ''
  };
  return str.split('').map(ch => map[ch] !== undefined ? map[ch] : ch).join('').toLowerCase();
}

/**
 * Levenshtein distance for typo tolerance
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

/**
 * Match a medicine query against user's saved medicine names with fuzzy/typo/anagram/romanization tolerance (e.g. "pana" -> "napa", "নাপা" -> "napa")
 */
export function matchMedicineName(query: string, candidateNames: string[]): string | null {
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ');
  const romanQ = romanizeBengali(cleanQ);
  const words = cleanQ.split(/\s+/).filter(w => w.length >= 2);

  for (const name of candidateNames) {
    const cleanName = name.toLowerCase().trim();
    if (!cleanName) continue;
    const romanName = romanizeBengali(cleanName);

    // Direct substring in query or romanized query
    if (cleanQ.includes(cleanName) || (romanName && romanQ.includes(romanName))) {
      return name;
    }

    // Check individual words against candidate and its romanized form
    for (const w of words) {
      const romanW = romanizeBengali(w);
      const queryVars = Array.from(new Set([w, romanW].filter(Boolean)));
      const candVars = Array.from(new Set([cleanName, romanName].filter(Boolean)));

      for (const qv of queryVars) {
        for (const cv of candVars) {
          // Exact match
          if (qv === cv) return name;

          // Anagram match (e.g. "pana" vs "napa")
          if (qv.length >= 3 && cv.length >= 3 && Math.abs(qv.length - cv.length) <= 1) {
            const sortedQ = qv.split('').sort().join('');
            const sortedC = cv.split('').sort().join('');
            if (sortedQ === sortedC) return name;
          }

          // Collapsed duplicate letters (e.g. "naapa" -> "napa", "paana" -> "pana")
          const collapsedQ = qv.replace(/(.)\1+/g, '$1');
          const collapsedC = cv.replace(/(.)\1+/g, '$1');
          if (collapsedQ === collapsedC) return name;
          if (collapsedQ.length >= 3 && collapsedC.length >= 3) {
            if (collapsedQ.split('').sort().join('') === collapsedC.split('').sort().join('')) {
              return name;
            }
          }

          // Levenshtein edit distance
          if (cv.length >= 3 && qv.length >= 3 && Math.abs(cv.length - qv.length) <= 2) {
            const dist = levenshteinDistance(qv, cv);
            if (cv.length <= 5 && dist <= 1) return name;
            if (cv.length > 5 && dist <= 2) return name;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Fetch and aggregate all distinct medicines for a user from their active and past reminders
 */
export async function getAggregatedMedicines(userId: any): Promise<AggregatedMedicine[]> {
  const reminders = await Reminder.find({ userId, category: 'medicine' }).sort({ date: 1 });
  const map = new Map<string, AggregatedMedicine>();

  for (const rem of reminders) {
    const slot = rem.medicineRoutine || (
      rem.time < '12:00' ? 'সকাল' : rem.time < '17:00' ? 'দুপুর' : 'রাত'
    );
    const time = rem.time || '08:30';

    if (rem.medicines && Array.isArray(rem.medicines) && rem.medicines.length > 0) {
      for (const m of rem.medicines) {
        const key = m.name.toLowerCase().trim();
        const timing = m.mealTiming || rem.mealTiming || 'after';
        const existing = map.get(key);

        if (existing) {
          if (!existing.routines.some(r => r.slot === slot)) {
            existing.routines.push({ slot, time, mealTiming: timing });
          }
          if (m.endDate && (!existing.endDate || new Date(m.endDate) > new Date(existing.endDate))) {
            existing.endDate = m.endDate;
          }
          if (m.durationDays && m.durationDays > existing.durationDays) {
            existing.durationDays = m.durationDays;
          }
        } else {
          map.set(key, {
            name: m.name.trim(),
            durationDays: m.durationDays || 7,
            startDate: m.startDate,
            endDate: m.endDate,
            routines: [{ slot, time, mealTiming: timing }],
            status: rem.status
          });
        }
      }
    } else {
      // Legacy single medicine reminder
      const cleanName = rem.title ? rem.title.replace(/\s*\([^)]*\)/g, '').trim() : 'ওষুধ';
      const key = cleanName.toLowerCase().trim();
      const timing = rem.mealTiming || 'after';
      const existing = map.get(key);

      if (existing) {
        if (!existing.routines.some(r => r.slot === slot)) {
          existing.routines.push({ slot, time, mealTiming: timing });
        }
        if (rem.endDate && (!existing.endDate || new Date(rem.endDate) > new Date(existing.endDate))) {
          existing.endDate = rem.endDate;
        }
      } else {
        map.set(key, {
          name: cleanName,
          durationDays: rem.durationDays || 7,
          startDate: rem.startDate || rem.date,
          endDate: rem.endDate,
          routines: [{ slot, time, mealTiming: timing }],
          status: rem.status
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Handle user questions about medicine duration and remaining days ("নাপা আর কয়দিন খাব?", "pana koi din ache", "khabo r koto din")
 */
export async function handleMedicineInquiry(userId: any, queryText: string, userHonorific?: string): Promise<string | null> {
  const clean = queryText.toLowerCase().trim();

  // Check if intent is inquiring about duration / remaining days / medicine status
  const hasDurationIntent = /(?:কয়দিন|কদ্দিন|কতদিন|কত\s*দিন|কয়\s*দিন|koi\s*din|koto\s*din|koy\s*din|koddin|how\s*many\s*days|শেষ\s*হবে|বাকি|baki|চলবে|খাব|খাবো|khabo|খেতে\s*হবে|khete\s*hobe|khete\s*hbe|খাওয়া\s*লাগবে|খাবো\s*আর|খাব\s*আর|khabo\s*ar|রিমাইন্ডার\s*কি|কখন\s*খাব|কখন\s*খাবো)/i.test(clean);
  const hasMedicineIntent = /(?:ওষুধ|ঔষধ|মেডিসিন|medicine|med|ট্যাবলেট|tablet|কোর্স|course)/i.test(clean);
  const hasDirectRemainingIntent = /(?:khabo\s*r\s*koto\s*din|r\s*koto\s*din\s*khabo|r\s*koy\s*din\s*khabo|r\s*koi\s*din\s*khabo|khete\s*hobe\s*r\s*(?:koto|koi|koy)\s*din|r\s*(?:koto|koi|koy)\s*din\s*khete\s*hobe|আর\s*কত\s*দিন\s*খাব|আর\s*কয়\s*দিন\s*খাব|কত\s*দিন\s*খেতে\s*হবে|কয়\s*দিন\s*খেতে\s*হবে|আর\s*কত\s*দিন\s*খেতে\s*হবে|আর\s*কয়\s*দিন\s*খেতে\s*হবে|r\s*(?:koto|koi|koy)\s*din\s*baki|আর\s*কত\s*দিন\s*বাকি|আর\s*কয়\s*দিন\s*বাকি)/i.test(clean);

  const aggregated = await getAggregatedMedicines(userId);
  const candidateNames = aggregated.map(m => m.name);
  const matchedMedName = matchMedicineName(clean, candidateNames);

  // If neither medicine word, matched medicine name, nor direct remaining course question is present, return null
  if (!matchedMedName && !hasMedicineIntent && !hasDirectRemainingIntent) {
    return null;
  }

  // Must have an inquiry or status intent
  const isAskingForStatus = hasDurationIntent || hasMedicineIntent || hasDirectRemainingIntent || clean.includes('status') || clean.includes('reminder');
  if (!isAskingForStatus) {
    return null;
  }

  const isEng = isPureEnglishText(queryText);
  const salutation = userHonorific ? ` ${userHonorific}` : '';
  const bnDigits: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  const toBn = (n: number) => n.toString().replace(/\d/g, d => bnDigits[d] || d);
  const slotIcons: Record<string, string> = { 'সকাল': '🌅', 'দুপুর': '☀️', 'রাত': '🌙' };

  if (aggregated.length === 0) {
    return isEng
      ? `💊 You currently don't have any medicine reminders saved${salutation}. You can send me your prescription (e.g. "Napa morning noon night 7 days") and I'll schedule them for you!`
      : `💊 আপনার কোনো ওষুধের রিমাইন্ডার বর্তমানে সেভ করা নেই${salutation}।\n\nআপনি প্রেসক্রিপশন বা ওষুধের নাম ও নিয়ম লিখে পাঠালে (যেমন: *"নাপা সকাল দুপুর রাত ৭ দিন"*) আমি স্বয়ংক্রিয়ভাবে রিমাইন্ডার সেট করে দেবো! 🌸`;
  }

  // Determine target medicine: either explicitly matched (e.g. "pana", "napa") OR if user only has 1 medicine registered
  const targetMed = matchedMedName
    ? aggregated.find(m => m.name.toLowerCase() === matchedMedName.toLowerCase())
    : (aggregated.length === 1 ? aggregated[0] : null);

  // Case 1: Specific single medicine requested or only 1 medicine exists -> answer ONLY for that medicine
  if (targetMed) {
    const now = new Date();
    const end = targetMed.endDate ? new Date(targetMed.endDate) : null;
    const diffDays = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isEnded = (end && diffDays <= 0) || targetMed.status === 'Completed';

    if (isEnded) {
      return isEng
        ? `💊 *${targetMed.name}*: The ${targetMed.durationDays}-day course for this medicine is already completed! ✅`
        : `💊 আপনার *${targetMed.name}* ওষুধের ${toBn(targetMed.durationDays)} দিনের কোর্স ইতিমধ্যে শেষ হয়ে গেছে! ✅`;
    }

    const endBnDate = end ? end.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' }) : '';
    const endEnDate = end ? end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }) : '';

    const routinesText = targetMed.routines.map(r => {
      const tLabel = r.mealTiming === 'before' ? (isEng ? 'Before food' : 'খাবারের আগে') : (isEng ? 'After food' : 'খাবারের পরে');
      return `  • ${slotIcons[r.slot] || '⏰'} *${r.slot}* (${formatTime12Hour(r.time)}) - ${tLabel}`;
    }).join('\n');

    return isEng
      ? `💊 *${targetMed.name}* Medicine Reminder${salutation}:\n\n⏱️ *Remaining:* ${diffDays > 0 ? diffDays : 1} day(s) ${endEnDate ? `(Ends: ${endEnDate})` : ''}\n📅 *Total Course:* ${targetMed.durationDays} days\n\n⏰ *Routine:*\n${routinesText}`
      : `💊 আপনার *${targetMed.name}* ওষুধের তথ্য${salutation}:\n\n⏱️ *বাকি আছে:* আর *${toBn(diffDays > 0 ? diffDays : 1)} দিন* ${endBnDate ? `(শেষ হবে: ${endBnDate})` : ''}\n📅 *মোট কোর্স:* ${toBn(targetMed.durationDays)} দিন\n\n⏰ *খাওয়ার রুটিন:*\n${routinesText}`;
  }

  // Case 2: General medicine query with multiple medicines (e.g. "আমার ওষুধ আর কয়দিন বাকি?", "khabo r koto din")
  const now = new Date();
  const lines = aggregated.map((m, idx) => {
    const end = m.endDate ? new Date(m.endDate) : null;
    const diffDays = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isEnded = (end && diffDays <= 0) || m.status === 'Completed';
    const endBnDate = end ? end.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' }) : '';
    const statusStr = isEnded ? '✓ কোর্স সম্পন্ন' : `বাকি ${toBn(diffDays > 0 ? diffDays : 1)} দিন (শেষ: ${endBnDate})`;
    const routineStr = m.routines.map(r => `${r.slot} [${r.mealTiming === 'before' ? 'আগে' : 'পরে'}]`).join(', ');

    return `${toBn(idx + 1)}. 💊 *${m.name}* - ${statusStr}\n   ⏰ রুটিন: ${routineStr}`;
  }).join('\n\n');

  return `📋 আপনার চলমান ওষুধের রিমাইন্ডার তালিকা${salutation}:\n\n${lines}\n\n💡 নির্দিষ্ট কোনো ওষুধ সম্পর্কে জানতে নাম লিখে জিজ্ঞেস করতে পারেন (যেমন: *"নাপা আর কয়দিন খাব?"*)।`;
}

/**
 * Helper to detect if a message is written in pure English (not Bangla or phonetic Banglish)
 */
export const isPureEnglishText = (text: string): boolean => {
  if (!text) return false;
  // If text contains Bengali script characters (0980-09FF), it's Bengali
  if (/[\u0980-\u09FF]/.test(text)) return false;

  const clean = text.toLowerCase().trim();

  // Common Banglish markers
  const banglishMarkers = /\b(?:kemon|acho|aso|achen|asen|bhalo|valo|tumi|apni|tumar|tomar|apnar|amar|amr|amake|koro|korun|dao|daw|pathao|pathan|dekhaw|dekhan|chai|khuje|mone|koriye|dio|diyo|shokal|sokal|dupur|bikal|bikele|sondha|shondha|raat|rat|pore|por|aj|aaj|ajke|aajke|kal|kaal|kalke|porshu|kothay|ase|ache|nai|hobena|hobe|bhai|vai|apu|bhaiya|chif|chief|seheri|sehri|sahari|romjan|ramadan|iftar|baki|khata|hisab|taka|poisa|ghonta|ghinta|ghanta|gonta|ginta|boro|choto|eta|oita|aita|brta)\b/i;
  if (banglishMarkers.test(clean)) return false;

  const englishWords = clean.match(/\b[a-z]{2,}\b/g) || [];
  if (englishWords.length === 0) return false;

  const commonEnglish = new Set([
    'hi', 'hello', 'hey', 'good', 'morning', 'afternoon', 'evening', 'night',
    'how', 'are', 'you', 'who', 'what', 'can', 'do', 'help', 'set', 'reminder',
    'alarm', 'meeting', 'tomorrow', 'today', 'tonight', 'for', 'at', 'pm', 'am',
    'please', 'thank', 'thanks', 'show', 'list', 'my', 'all', 'tasks', 'notes',
    'send', 'message', 'to', 'call', 'is', 'the', 'and', 'with', 'in', 'on',
    'about', 'cancel', 'delete', 'modify', 'update', 'time', 'date', 'wish',
    'birthday', 'happy', 'document', 'documents', 'prescription', 'file', 'files',
    'vault', 'card', 'download', 'view', 'need', 'want', 'wake', 'up'
  ]);

  const matchedEnglish = englishWords.filter((w) => commonEnglish.has(w));
  return matchedEnglish.length >= 1 && matchedEnglish.length / englishWords.length >= 0.5;
};

// Function to send interactive buttons via Meta API
export const sendMetaWhatsAppButtons = async (
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string
): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return false;

  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) formattedTo = formattedTo.substring(1);
  else if (formattedTo.startsWith('01')) formattedTo = `88${formattedTo}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedTo,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            ...(footerText ? { footer: { text: footerText.substring(0, 60) } } : {}),
            action: {
              buttons: buttons.slice(0, 3).map(b => ({
                type: 'reply',
                reply: {
                  id: b.id,
                  title: b.title.substring(0, 20)
                }
              }))
            }
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn(`[WhatsAppButtons] Attempt ${attempt} button error:`, data);
        if (attempt === 2) return false;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`✅ [WhatsAppButtons] Interactive buttons sent successfully to ${formattedTo}`);
        return true;
      }
    } catch (err) {
      console.error(`[WhatsAppButtons] Network exception attempt ${attempt}:`, err);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return false;
};

/**
 * Helper to detect user honorific/salutation choice in Bengali or English
 */
export const extractHonorificChoice = (text: string, isAlreadySet: boolean = false): string | null => {
  if (!text) return null;
  const clean = text.trim();
  const cmdMatch = clean.match(/^(?:\/title|\/honorific|\/callme|\/সম্বোধন)\s+(.+)$/i);
  const target = (cmdMatch ? cmdMatch[1] : clean).trim().toLowerCase();

  // 1. Explicit title instruction/phrase:
  // Requires explicit words like "আমাকে এখন থেকে বস বলবা", "আমাকে বস ডাকবেন", "আমাকে স্যার বলবেন", "এখন থেকে বস বলবেন", "call me boss", "vai bolben"
  const phraseMatch = target.match(/(?:(?:আমাকে|আমায়|amake|amay)\s*(?:এখন\s*থেকে|akhon\s*theke)?|(?:এখন\s*থেকে|akhon\s*theke)\s*(?:আমাকে|আমায়|amake|amay)?)\s+(চিফ|chief|chife|cheif|স্যার|sir|shir|স্যর|সার|বস|boss|bos|ভাই|ভাইয়া|ভায়া|ভাইরে|ভাইজান|vai|vaia|vaiya|vhai|vhaia|bhai|bhaiya|bhaia|bro|brother|আপু|আপি|আপা|আপ্পি|apu|api|apa|apuu|appu|sis|sister|ম্যাডাম|মেডাম|madam|ma'am|mam|medam)(?:\s*(?:বলে|হিসেবে))?\s*(?:ডাকবেন|সম্বোধন\s*করবেন|বলবেন|ডাকো|বলো|ডাকিস|বলিস|বলবা|ডাকবা|dakben|dakba|bolben|bolba)?/i) ||
    target.match(/(?:call\s+me)\s+(chief|sir|boss|bhai|vai|apu|madam)/i) ||
    target.match(/(চিফ|chief|chife|cheif|স্যার|sir|shir|স্যর|সার|বস|boss|bos|ভাই|ভাইয়া|ভায়া|ভাইরে|ভাইজান|vai|vaia|vaiya|vhai|vhaia|bhai|bhaiya|bhaia|bro|brother|আপু|আপি|আপা|আপ্পি|apu|api|apa|apuu|appu|sis|sister|ম্যাডাম|মেডাম|madam|ma'am|mam|medam)\s+(?:বলে|হিসেবে)\s+(?:ডাকবেন|সম্বোধন\s*করবেন|বলবেন|ডাকো|বলো|ডাকিস|বলিস|বলবা|ডাকবা|dakben|dakba|bolben|bolba)/i);

  if (phraseMatch || cmdMatch) {
    const raw = (cmdMatch ? cmdMatch[1] : phraseMatch ? (phraseMatch[1] || phraseMatch[2]) : '').toLowerCase();
    if (/চিফ|chief|chife|cheif/.test(raw)) return 'চিফ';
    if (/স্যার|sir|shir|স্যর|সার/.test(raw)) return 'স্যার';
    if (/বস|boss|bos/.test(raw)) return 'বস';
    if (/ভাই|ভাইয়া|ভায়া|vai|vaia|vaiya|vhai|vhaia|bhai|bhaiya|bro|brother/.test(raw)) return 'ভাই';
    if (/আপু|আপি|আপা|apu|api|apa|sis|sister/.test(raw)) return 'আপু';
    if (/ম্যাডাম|madam|ma'am|mam/.test(raw)) return 'ম্যাডাম';
  }

  // CRITICAL: If honorific is ALREADY SET, a standalone word (like "boss", "vai", "sir") MUST NEVER CHANGE it!
  // It ONLY changes if the user explicitly commanded above (e.g. "আমাকে এখন থেকে বস বলবা" or "/callme boss").
  if (isAlreadySet) {
    return null;
  }

  // 2. ONLY during initial onboarding (!isAlreadySet), accept standalone title words:
  // e.g. "vai", "vaia", "ভাই", "sir", "chief", "chife", "boss", "apu"
  const exactSingle = target.replace(/[।.,!?🎖️👔👑❤️🌸✨🤝\s]/g, '');
  if (/^(?:চিফ|chief|chife|cheif)$/i.test(exactSingle)) return 'চিফ';
  if (/^(?:স্যার|স্যর|সার|sir|shir)$/i.test(exactSingle)) return 'স্যার';
  if (/^(?:বস|boss|bos)$/i.test(exactSingle)) return 'বস';
  if (/^(?:ভাই|ভাইয়া|ভায়া|ভাইরে|ভাইজান|vai|vaia|vaiya|vhai|vhaia|bhai|bhaiya|bhaia|bro|brother)$/i.test(exactSingle)) return 'ভাই';
  if (/^(?:আপু|আপি|আপা|আপ্পি|apu|api|apa|apuu|appu|sis|sister)$/i.test(exactSingle)) return 'আপু';
  if (/^(?:ম্যাডাম|মেডাম|madam|ma'am|mam|medam)$/i.test(exactSingle)) return 'ম্যাডাম';

  // 3. Also during initial onboarding, accept conversational phrases like:
  // "vai bolchi", "vai bolbo", "vaiya bolben", "chife dakben", "sir dako"
  const notAction = !/\b(?:reminder|রিমাইন্ডার|ওষুধ|মিটিং|meeting|note|নোট|wish|উইশ|card|কার্ড|todo|টুডু)\b/i.test(target);
  if (notAction) {
    if (/\b(?:vai|vaia|vaiya|vhai|vhaia|bhai|bhaiya|bhaia|ভাই|ভাইয়া|ভায়া|ভাইরে)\b/i.test(target)) return 'ভাই';
    if (/\b(?:apu|api|apa|আপু|আপি|আপা)\b/i.test(target)) return 'আপু';
    if (/\b(?:চিফ|chief|chife|cheif)\b/i.test(target)) return 'চিফ';
    if (/^(?:স্যার|স্যর|সার|sir|shir)\b/i.test(target)) return 'স্যার';
    if (/^(?:বস|boss|bos)\b/i.test(target)) return 'বস';
    if (/^(?:ম্যাডাম|মেডাম|madam|ma'am|mam)\b/i.test(target)) return 'ম্যাডাম';
  }

  return null;
};

// Function to send an interactive CTA URL button via Meta API (opens website link in browser)
export const sendMetaWhatsAppCtaUrl = async (
  to: string,
  bodyText: string,
  displayText: string,
  url: string,
  headerText?: string,
  footerText?: string
): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return false;

  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) formattedTo = formattedTo.substring(1);
  else if (formattedTo.startsWith('01')) formattedTo = `88${formattedTo}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const interactivePayload: any = {
        type: 'cta_url',
        body: { text: bodyText },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: displayText.substring(0, 20),
            url: url
          }
        }
      };

      if (headerText) {
        interactivePayload.header = {
          type: 'text',
          text: headerText.substring(0, 60)
        };
      }
      if (footerText) {
        interactivePayload.footer = {
          text: footerText.substring(0, 60)
        };
      }

      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedTo,
          type: 'interactive',
          interactive: interactivePayload
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn(`[WhatsAppCtaUrl] Attempt ${attempt} error:`, data);
        if (attempt === 2) return false;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`✅ [WhatsAppCtaUrl] CTA URL button sent successfully to ${formattedTo}`);
        return true;
      }
    } catch (err) {
      console.error(`[WhatsAppCtaUrl] Network exception attempt ${attempt}:`, err);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return false;
};

// Function to send interactive list menu via Meta API (Bottom-sheet native selector)
export const sendMetaWhatsAppListMenu = async (
  to: string,
  bodyText: string,
  buttonTitle: string,
  sectionTitle: string,
  rows: Array<{ id: string; title: string; description?: string }>
): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId || rows.length === 0) return false;

  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) formattedTo = formattedTo.substring(1);
  else if (formattedTo.startsWith('01')) formattedTo = `88${formattedTo}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedTo,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: bodyText },
            action: {
              button: buttonTitle.substring(0, 20),
              sections: [
                {
                  title: sectionTitle.substring(0, 24),
                  rows: rows.slice(0, 10).map(r => ({
                    id: r.id,
                    title: r.title.substring(0, 24),
                    description: r.description ? r.description.substring(0, 72) : undefined
                  }))
                }
              ]
            }
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn(`[WhatsAppListMenu] Attempt ${attempt} list menu error:`, data);
        if (attempt === 2) return false;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`✅ [WhatsAppListMenu] Interactive list menu sent successfully to ${formattedTo}`);
        return true;
      }
    } catch (err) {
      console.error(`[WhatsAppListMenu] Network exception attempt ${attempt}:`, err);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return false;
};

// Function to send a message via Meta API
export const sendMetaWhatsAppMessage = async (to: string, text: string): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('WhatsApp API credentials missing in .env');
    return false;
  }

  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) formattedTo = formattedTo.substring(1);
  else if (formattedTo.startsWith('01')) formattedTo = `88${formattedTo}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedTo,
          type: 'text',
          text: { body: text }
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error('Error sending Meta message:', data);
        if (attempt === 2) return false;
      } else {
        console.log(`✅ Meta WhatsApp Reply sent to ${formattedTo}: "${text}"`);
        return true;
      }
    } catch (error) {
      console.error(`Attempt ${attempt} error sending Meta message:`, error);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
};

// Function to download any media (audio, voice, image, document) from Meta API
export const downloadMetaMedia = async (mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!metaRes.ok) {
      console.error('Failed to get Meta media URL:', await metaRes.text());
      return null;
    }
    const metaData = (await metaRes.json()) as any;
    const mediaUrl = metaData.url;
    const mimeType = metaData.mime_type || 'application/octet-stream';

    const fileRes = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(20000)
    });
    if (!fileRes.ok) {
      console.error('Failed to download media bytes:', fileRes.status);
      return null;
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch (error) {
    console.error('Error downloading Meta media file:', error);
    return null;
  }
};
const downloadMetaAudio = downloadMetaMedia;

// Function to send a document or image to WhatsApp via Meta API
export const sendMetaWhatsAppFile = async (
  to: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  caption?: string
): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return false;

  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) formattedTo = formattedTo.substring(1);
  else if (formattedTo.startsWith('01')) formattedTo = `88${formattedTo}`;

  const mediaId = await uploadBufferToMeta(buffer, filename, mimeType);
  if (!mediaId) {
    console.error('[WhatsAppFile] Failed to upload buffer to Meta');
    return false;
  }

  const isImage = mimeType.startsWith('image/');
  const type = isImage ? 'image' : 'document';
  const bodyPayload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type
  };

  if (isImage) {
    bodyPayload.image = {
      id: mediaId,
      ...(caption ? { caption: caption.substring(0, 1024) } : {})
    };
  } else {
    bodyPayload.document = {
      id: mediaId,
      filename: filename.substring(0, 255),
      ...(caption ? { caption: caption.substring(0, 1024) } : {})
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(15000)
    });

    const data = (await res.json()) as any;
    if (res.ok) {
      console.log(`✅ [WhatsAppFile] Sent ${type} (${filename}) to ${formattedTo}`);
      return true;
    } else {
      console.error(`[WhatsAppFile] Error response from Meta:`, data);
      return false;
    }
  } catch (err) {
    console.error(`[WhatsAppFile] Network error:`, err);
    return false;
  }
};

// Function to trigger native WhatsApp "typing..." indicator and mark message as read
const sendMetaTypingIndicator = (messageId: string) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId || !messageId) return;

  try {
    fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: {
          type: 'text'
        }
      }),
      signal: AbortSignal.timeout(5000)
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success) {
          console.log(`💬 [WhatsAppTyping] Typing indicator active for message: ${messageId}`);
        } else {
          console.log(`💬 [WhatsAppTyping] Response for message ${messageId}:`, data);
        }
      })
      .catch(err => {
        console.warn('[WhatsAppTyping] Non-blocking indicator error:', err?.message || err);
      });
  } catch (err) {
    // Non-blocking
  }
};

// Webhook Verification (Required by Meta)
export const verifyWebhook = (req: Request, res: Response) => {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

// Handle Incoming Messages
export const receiveWebhook = async (req: Request, res: Response) => {
  // Always return 200 OK immediately to WhatsApp to prevent retries
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('--- INCOMING WEBHOOK ---');
    console.dir(body, { depth: null });

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message = messages[0];
        const fromNumber = message.from; // Sender's phone number
        
        let userMessage = '';
        let buttonId = '';
        let isAudio = false;
        let audioMediaId = '';
        let audioMimeType = 'audio/ogg';

        let isMediaDoc = false;
        let isImage = false;
        let isDocument = false;
        let mediaDocId = '';
        let mediaDocMimeType = '';
        let mediaDocFilename = '';
        let mediaDocCaption = '';

        if (message.type === 'text') {
          userMessage = message.text?.body || '';
        } else if (message.type === 'interactive') {
          if (message.interactive?.type === 'button_reply') {
            buttonId = message.interactive.button_reply?.id || '';
            userMessage = message.interactive.button_reply?.title || '';
          } else if (message.interactive?.type === 'list_reply') {
            buttonId = message.interactive.list_reply?.id || '';
            userMessage = message.interactive.list_reply?.title || '';
          }
        } else if (message.type === 'button') {
          buttonId = message.button?.payload || '';
          userMessage = message.button?.text || '';
        } else if (message.type === 'audio' || message.type === 'voice') {
          isAudio = true;
          audioMediaId = message.audio?.id || message.voice?.id || '';
          audioMimeType = message.audio?.mime_type || message.voice?.mime_type || 'audio/ogg';
        } else if (message.type === 'image') {
          isMediaDoc = true;
          isImage = true;
          mediaDocId = message.image?.id || '';
          mediaDocMimeType = message.image?.mime_type || 'image/jpeg';
          mediaDocCaption = (message.image?.caption || '').trim();
          mediaDocFilename = `image_${Date.now()}.jpg`;
          userMessage = mediaDocCaption;
        } else if (message.type === 'document') {
          isMediaDoc = true;
          isDocument = true;
          mediaDocId = message.document?.id || '';
          mediaDocMimeType = message.document?.mime_type || 'application/pdf';
          mediaDocFilename = message.document?.filename || `doc_${Date.now()}.pdf`;
          mediaDocCaption = (message.document?.caption || '').trim();
          userMessage = mediaDocCaption;
        }

        if (!fromNumber || (!userMessage && !isAudio && !isMediaDoc && !buttonId && message.type !== 'contacts' && message.type !== 'location')) return;

        // Check Maintenance Mode
        const maintStatus = await getMaintenanceStatus();
        if (maintStatus.isMaintenanceMode) {
          const rawTrim = (userMessage || '').trim();
          if (/^\/maint(?:enance)?\s+off$/i.test(rawTrim)) {
            updateMaintenanceCache({ isMaintenanceMode: false });
            await SystemSettings.updateOne({}, { $set: { isMaintenanceMode: false } });
            await sendMetaWhatsAppMessage(fromNumber, '✅ মেইনটেন্যান্স মোড সফলভাবে বন্ধ করা হয়েছে। স্মৃতি এখন সবার জন্য পুরোদমে লাইভ!');
            return;
          }

          await sendMetaWhatsAppMessage(
            fromNumber,
            `🛠️ *${maintStatus.maintenanceTitle}*\n\n${maintStatus.maintenanceMessage}\n\n⏳ *আনুমানিক সময়:* ${maintStatus.maintenanceEstimatedTime}\n\nসিস্টেম সচল হওয়া মাত্রই আপনি পুনরায় সব ফিচার স্বাভাবিকভাবে ব্যবহার করতে পারবেন। আপনার সহযোগিতার জন্য ধন্যবাদ! 🙏`
          );
          return;
        }

        // Show native WhatsApp "typing..." status & read receipt while AI processes the request
        if (message.id) {
          sendMetaTypingIndicator(message.id);
        }

        // WhatsApp cloud API sends number with country code without +
        // Using a regex to match the end of the number is safer to find the user
        const shortNumber = fromNumber.length > 10 ? fromNumber.slice(-10) : fromNumber;
        const user = await User.findOne({
          $or: [
            { whatsapp: { $regex: new RegExp(shortNumber + '$') } },
            { mobile: { $regex: new RegExp(shortNumber + '$') } }
          ]
        });

        if (!user || user.isSubscribed === false) {
          const bodyMsg = user && !user.isSubscribed
            ? 'দুঃখিত, আপনার Smriti Life সাবস্ক্রিপশনটি বর্তমানে সক্রিয় নয়। AI রিমাইন্ডার ও অ্যাসিস্ট্যান্টের সকল সুবিধা উপভোগ করতে SmritiLife-এ সাবস্ক্রিপশন করুন।'
            : 'দুঃখিত, এই নম্বরটি Smriti Life অ্যাপে নিবন্ধিত নয়। আমাদের AI রিমাইন্ডার ও অ্যাসিস্ট্যান্ট সেবা ব্যবহার করতে SmritiLife-এ সাবস্ক্রিপশন করুন।';

          const sent = await sendMetaWhatsAppCtaUrl(
            fromNumber,
            bodyMsg,
            'SmritiLife',
            'https://smritilife.com',
            'স্মৃতি লাইফ (SmritiLife)',
            'ব্রাউজারে ওপেন করতে বাটনে ক্লিক করুন'
          );

          if (!sent) {
            // Fallback standard text message with direct clickable URL
            await sendMetaWhatsAppMessage(
              fromNumber,
              `${bodyMsg}\n\n👉 https://smritilife.com\n(লিঙ্কে ক্লিক করে ব্রাউজারে ওপেন করুন)`
            );
          }
          return;
        }

        // Update user activity timestamp (non-blocking for returning users)
        user.lastActiveAt = new Date();
        if (!user.whatsapp) {
          user.whatsapp = fromNumber;
          await user.save();
        } else {
          User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
        }

        // --- STEP 0A: Handle WhatsApp Shared Contact Card (vCard) ---
        if (message.type === 'contacts' && message.contacts && message.contacts.length > 0) {
          const c = message.contacts[0];
          const contactName = c.name?.formatted_name || c.name?.first_name || 'পরিচিত ব্যক্তি';
          const rawPhone = c.phones?.[0]?.phone || c.phones?.[0]?.wa_id || '';
          const contactPhone = rawPhone.replace(/[^\d+]/g, '');
          const contactEmail = c.emails?.[0]?.email || '';

          let savedContact = null;
          if (contactPhone) {
            const shortContactPhone = contactPhone.length > 10 ? contactPhone.slice(-10) : contactPhone;
            savedContact = await Contact.findOne({
              userId: user._id,
              phone: { $regex: new RegExp(shortContactPhone + '$') }
            });
          }
          if (!savedContact) {
            savedContact = await Contact.findOne({
              userId: user._id,
              name: { $regex: new RegExp('^' + contactName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            });
          }

          if (savedContact) {
            savedContact.name = contactName;
            if (contactPhone) savedContact.phone = contactPhone;
            if (contactEmail) savedContact.email = contactEmail;
            await savedContact.save();
          } else {
            savedContact = await Contact.create({
              userId: user._id,
              name: contactName,
              phone: contactPhone,
              email: contactEmail,
              relationship: 'Other'
            });
          }

          await sendMetaWhatsAppMessage(
            fromNumber,
            `📇 আপনার শেয়ার করা কন্ট্যাক্ট কার্ড থেকে *${contactName}* এর তথ্য সেভ করা হয়েছে!\n\n📞 ফোন: ${contactPhone || 'দেওয়া নেই'}${contactEmail ? `\n✉️ ইমেইল: ${contactEmail}` : ''}\n\n💡 এখন থেকে আপনি সরাসরি বলতে পারেন:\n_"${contactName}কে মেসেজ দাও যে কালকের মিটিং বাতিল"_\nস্মৃতি স্বয়ংক্রিয়ভাবে তার এই নম্বরে মেসেজ পাঠাবে!`
          );
          return;
        }

        // --- STEP 0B: Handle WhatsApp Native Shared Location Pin (message.type === 'location') ---
        if (message.type === 'location' && message.location) {
          const loc = message.location;
          const lat = loc.latitude;
          const lng = loc.longitude;
          const locName = (loc.name || '').trim();
          const locAddress = (loc.address || '').trim();
          const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          const title = locName || (locAddress ? locAddress.split(',')[0].trim() : 'সংরক্ষিত লোকেশন');
          const addressText = locAddress || `${lat}, ${lng}`;

          const cleanTitleRegex = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
          let note = await Note.findOne({ userId: user._id, title: cleanTitleRegex });

          if (note) {
            note.content = `${title}\n${addressText}\n📍 Google Maps: ${googleMapsUrl}`;
            note.category = 'Location';
            note.type = 'Location';
            note.location = { latitude: lat, longitude: lng, address: addressText, mapUrl: googleMapsUrl };
            await note.save();
          } else {
            await Note.create({
              userId: user._id,
              title,
              content: `${title}\n${addressText}\n📍 Google Maps: ${googleMapsUrl}`,
              category: 'Location',
              type: 'Location',
              location: { latitude: lat, longitude: lng, address: addressText, mapUrl: googleMapsUrl }
            });
          }

          const salutation = user.honorific ? ` ${user.honorific}` : '';
          const cardBody = `📍 আসসালামু আলাইকুম${salutation}!\nআপনার শেয়ার করা লোকেশন পিন সফলভাবে স্মৃতিতে সংরক্ষণ করে রেখেছি:\n\n📌 নাম: *${title}*${locAddress ? `\n🗺️ ঠিকানা: ${locAddress}` : ''}\n\n💡 পরবর্তীতে এই লোকেশন বা ম্যাপ পেতে লিখুন:\n"${title} দাও" বা "সব লোকেশন দেখাও"`;

          const sent = await sendMetaWhatsAppCtaUrl(
            fromNumber,
            cardBody,
            'ম্যাপ ওপেন করুন 🗺️',
            googleMapsUrl,
            `📍 ${title.substring(0, 50)}`,
            'ট্যাপ করে সরাসরি গুগল ম্যাপসে রুট দেখুন'
          );

          if (!sent) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `${cardBody}\n\n🔗 গুগল ম্যাপস লিঙ্ক:\n${googleMapsUrl}`
            );
          }
          return;
        }

        // --- STEP 0C: Handle WhatsApp Native Document & Image Storage ---
        if (isMediaDoc && mediaDocId) {
          const media = await downloadMetaMedia(mediaDocId);
          if (!media || !media.buffer) {
            await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, ফাইলটি ডাউনলোড করা সম্ভব হয়নি। অনুগ্রহ করে আবার পাঠান।');
            return;
          }

          if (mediaDocCaption && mediaDocCaption.trim()) {
            const rawTitle = mediaDocCaption.trim().replace(/^(এটা|ita|aita|eta|amr|amar|আমার)\s+/i, '').trim();
            const title = rawTitle || (isImage ? 'প্রেসক্রিপশন / ছবি' : mediaDocFilename);
            const { category, tags } = detectDocumentCategory(title + ' ' + mediaDocFilename);
            const diskResult = await saveFileToDisk(media.buffer, mediaDocFilename, media.mimeType || mediaDocMimeType);

            await UserDocument.create({
              userId: user._id,
              mobile: fromNumber,
              title,
              fileName: diskResult.fileName,
              fileUrl: diskResult.fileUrl,
              fileSize: diskResult.fileSize,
              mimeType: media.mimeType || mediaDocMimeType,
              category,
              tags,
              metaMediaId: mediaDocId,
              fileData: media.buffer.toString('base64')
            });

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            await sendMetaWhatsAppMessage(
              fromNumber,
              `✅ *আপনার ফাইলটি সফলভাবে মেমোরিতে সংরক্ষণ করেছি${salutation}!* 📁\n\n📄 *ফাইলের নাম:* ${title}\n📂 *ক্যাটাগরি:* ${category}\n📅 *তারিখ:* ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n💡 *পরবর্তীতে ফাইল বা ব্যবহারের হিসাব পেতে যেকোনো সময় লিখুন:*\n👉 *"আমার ${title} দাও"*\n👉 *"${title} কবে সেভ করা হয়েছিল?"* বা *"${title} কয়দিন চলছে?"*\nস্মৃতি তৎক্ষণাৎ ছবি ও তারিখসহ হিসাব পাঠিয়ে দেবে!`
            );
            return;
          } else {
            userDocPendingState.set(fromNumber, {
              mediaId: mediaDocId,
              mimeType: media.mimeType || mediaDocMimeType,
              filename: mediaDocFilename,
              buffer: media.buffer,
              isImage,
              expiresAt: Date.now() + 10 * 60 * 1000
            });

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            await sendMetaWhatsAppMessage(
              fromNumber,
              `📄 *আসসালামু আলাইকুম${salutation}! আপনার ${isImage ? 'ছবিটি' : 'ডকুমেন্টটি'} পেয়েছি।*\n\nএই ফাইলটি স্মৃতিতে কি নামে সেভ করে রাখবো?\n\n(যেমন লিখে পাঠান: *"আমার প্রেসক্রিপশন"*, *"আম্মুর ব্লাড টেস্ট রিপোর্ট"*, *"এনআইডি কার্ড"* ইত্যাদি)`
            );
            return;
          }
        }

        const cleanText = (userMessage || '').trim();

        // If user had uploaded a document earlier and was asked for a title:
        if (userDocPendingState.has(fromNumber)) {
          const pending = userDocPendingState.get(fromNumber)!;
          if (Date.now() > pending.expiresAt) {
            userDocPendingState.delete(fromNumber);
          } else if (cleanText && !cleanText.startsWith('/') && cleanText.length < 100) {
            const rawTitle = cleanText.replace(/^(এটা|ita|aita|eta|amr|amar|আমার)\s+/i, '').trim();
            const title = rawTitle || (pending.isImage ? 'সংরক্ষিত ছবি' : pending.filename);
            const { category, tags } = detectDocumentCategory(title + ' ' + pending.filename);
            const diskResult = await saveFileToDisk(pending.buffer, pending.filename, pending.mimeType);

            await UserDocument.create({
              userId: user._id,
              mobile: fromNumber,
              title,
              fileName: diskResult.fileName,
              fileUrl: diskResult.fileUrl,
              fileSize: diskResult.fileSize,
              mimeType: pending.mimeType,
              category,
              tags,
              metaMediaId: pending.mediaId,
              fileData: pending.buffer.toString('base64')
            });

            userDocPendingState.delete(fromNumber);

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            await sendMetaWhatsAppMessage(
              fromNumber,
              `✅ *আপনার ফাইলটি "${title}" নামে সফলভাবে সেভ করা হয়েছে${salutation}!* 📁\n\n📂 *ক্যাটাগরি:* ${category}\n📅 *তারিখ:* ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n💡 *পরবর্তীতে ফাইল বা ব্যবহারের হিসাব পেতে লিখুন:*\n👉 *"আমার ${title} দাও"*\n👉 *"${title} কবে সেভ করা হয়েছিল?"* বা *"${title} কয়দিন চলছে?"*`
            );
            return;
          }
        }

        // --- STEP 0C-1: Handle /start smritilife or initial onboarding greetings ---
        const isStartCommand =
          /^\/(?:start|help)(?:\s+smritilife)?$/i.test(cleanText) ||
          cleanText.toLowerCase() === '/start smritilife' ||
          /^(?:hi|hello|hey|start|শুরু|হেলো|হাই|সালাম|আসসালামু\s*আলাইকুম)\s*(?:smritilife|স্মৃতি|life)?$/i.test(cleanText);

        if (isStartCommand) {
          const userName = user.name && user.name !== 'নতুন ব্যবহারকারী' ? user.name : '';
          const salutation = user.honorific ? ` ${user.honorific}` : (userName ? ` ভাই` : '');
          const greetingName = userName ? ` ${userName}` : '';

          const startMsg = `🎉 *আসসালামু আলাইকুম${greetingName}! স্মৃতি লাইফে স্বাগতম!* 🤖\n\nআমি আপনার এআই অ্যাসিস্ট্যান্ট। রিমাইন্ডার, দৈনিক খরচ বা নোট রাখতে সরাসরি মেসেজ দিন।\n\nকথা শুরু করতে যেকোনো রিমাইন্ডার বা খরচ লিখে পাঠান! 😊`;

          await sendMetaWhatsAppMessage(fromNumber, startMsg);
          return;
        }

        // --- STEP 0D: Handle Document Retrieval & Item Lifespan Tracking ("আমার প্রেসক্রিপশন দাও", "Tishu box ta kobe save kora hoyechilo", "সিলিন্ডার কয়দিন চলছে") ---
        const isDocListQuery = /^(?:\/docs|\/files|ফাইলগুলো|ডকুমেন্টগুলো|সব\s*ফাইল|লিস্ট\s*ফাইল)\b/i.test(cleanText) ||
          /(?:আমার|amr|amar)?\s*(?:কি\s*কি|কোন\s*কোন|সব|সকল|list)?\s*(?:ফাইল|ডকুমেন্ট|কাগজ|প্রেসক্রিপশন|রিপোর্ট|file|doc|document)\s*(?:আছে|দেখাও|দেখান|লিস্ট|list|সব\s*দেখাও)/i.test(cleanText);

        if (isDocListQuery) {
          const docs = await UserDocument.find({ userId: user._id }).sort({ createdAt: -1 });
          const listMsg = formatDocumentListMessage(docs);
          await sendMetaWhatsAppMessage(fromNumber, listMsg);
          return;
        }

        const isTrackingOrDateQuery =
          /(?:কবে|কবেকার|কত\s*দিন|কয়\s*দিন|কদ্দিন|তারিখ|তারিখে|দিন\s*হলো|দিন\s*গেছে|চলছে|চলতেছে|কিনেছি|কিনেছিলাম|এনেছি|এনেছিলাম|নিয়েছি|নিয়েছিলাম|সেভ\s*(?:করেছি|করেছিলাম|করছি|করা|হয়েছিল|হয়েছে)|আপলোড\s*(?:করেছি|করেছিলাম|করছি|করা|হয়েছিল|হয়েছে)|রাখলাম|রেখেছি|kobe|kobekar|koto\s*din|koy\s*din|koddin|tarikh|tarikhe|din\s*holo|din\s*geche|cholche|choltese|kinesi|kinesilam|enechi|enesilam|niesi|niesilam|save\s*(?:koresi|koresilam|korsi|kora|hoyechilo|hoyeche)|upload\s*(?:koresi|koresilam|korsi|kora|hoyechilo|hoyeche)|rekhechi|rakhlam|when\s*(?:was|did)|how\s*(?:many\s*days|long))\b/i.test(cleanText);

        const hasFetchIntent =
          /(?:দাও|দিবেন|দিস|দেন|পাঠাও|পাঠান|দেখাও|দেখান|চাই|খুঁজো|খুঁজে\s*দাও|কোথায়|আছে\s*কিনা|ছবি|ফাইল|কাগজ|ডকুমেন্ট|রশিদ|প্রেসক্রিপশন|রিপোর্ট|রিসিপ্ট|dao|daw|dis|diben|den|pathao|pathan|pathaba|dehao|dekhaw|dekhan|chai|cay|lagbe|khojo|khujo|khuje\s*dao|kothay|ase|ache|pic|image|photo|chobi|file|doc|document|prescription|report)\b/i.test(cleanText);

        const isShortQuery = cleanText.split(/\s+/).length <= 4;
        const userDocsCount = await UserDocument.countDocuments({ userId: user._id });

        if (userDocsCount > 0 && (hasFetchIntent || isTrackingOrDateQuery || isShortQuery)) {
          const docResult = await findMatchingDocumentWithVersion(user._id.toString(), cleanText);
          const isEng = isPureEnglishText(cleanText);

          // If user specifically requested a year that doesn't exist for this document
          if (docResult.yearNotFound && docResult.targetYear) {
            const yrBn = convertEnglishDigitsToBengali(docResult.targetYear);
            const otherYearsBn = docResult.otherAvailableYears.map(convertEnglishDigitsToBengali).join(', ');
            const otherYearsEn = docResult.otherAvailableYears.join(', ');
            const sampleYr = docResult.otherAvailableYears[0];
            const sampleYrBn = convertEnglishDigitsToBengali(sampleYr);

            const msg = isEng
              ? `⚠️ No file for year *${docResult.targetYear}* was found for "${docResult.itemKeyword}".\n\n💡 However, you have files saved for year(s): *${otherYearsEn}*.\nTo retrieve that year, send: "${sampleYr} ${docResult.itemKeyword}".`
              : `⚠️ আপনার *${yrBn}* সালের কোনো "${docResult.itemKeyword}" স্মৃতি মেমোরিতে খুঁজে পাওয়া যায়নি।\n\n💡 তবে আপনার মেমোরিতে *${otherYearsBn}* সালের ফাইল সংরক্ষিত আছে।\nসেটি দেখতে চাইলে লিখুন: "${sampleYrBn} সালের ${docResult.itemKeyword} দাও"।`;

            await sendMetaWhatsAppMessage(fromNumber, msg);
            return;
          }

          const doc = docResult.doc;
          if (doc) {
            console.log(`[WhatsAppDoc] Found matching document "${doc.title}" for query: "${cleanText}" (isTracking: ${isTrackingOrDateQuery}, matchedYear: ${docResult.targetYear})`);
            const fileBuffer = await getDocumentBuffer(doc);
            const duration = calculateItemDuration(doc.createdAt);
            const yrBn = docResult.targetYear ? convertEnglishDigitsToBengali(docResult.targetYear) : '';
            const otherYearsBn = docResult.otherAvailableYears.map(convertEnglishDigitsToBengali).join(', ');
            const otherYearsEn = docResult.otherAvailableYears.join(', ');

            // Construct additional multi-year guidance if other years exist
            let multiYearNote = '';
            if (docResult.otherAvailableYears.length > 0) {
              const sampleYr = docResult.otherAvailableYears[0];
              const sampleYrBn = convertEnglishDigitsToBengali(sampleYr);
              multiYearNote = isEng
                ? `\n\n💡 Note: You also have files saved for year(s): *${otherYearsEn}*.\nTo get a specific year, send: "${sampleYr} ${doc.title}".`
                : `\n\n💡 তথ্য: আপনার কাছে *${otherYearsBn}* সালের ফাইলও সংরক্ষিত আছে।\nনির্দিষ্ট সালের ফাইল পেতে লিখুন: "${sampleYrBn} সালের ${doc.title} দাও"।`;
            }

            if (isTrackingOrDateQuery) {
              const msg = isEng
                ? `📦 *${doc.title}* ${docResult.matchedByYear ? `(${docResult.targetYear}) ` : ''}Tracking & Memory Details:\n\n📅 *Saved Date:* ${duration.savedDateEn} (${duration.savedTimeEn})\n⏱️ *Active Duration:* ${duration.durationTextEn}\n📁 *Category:* ${doc.category}${multiYearNote}\n\n💡 Here is the original photo you saved to track this item:`
                : `📦 *${doc.title}* ${docResult.matchedByYear ? `(${yrBn} সাল) ` : ''}এর মেমোরি ও ট্র্যাকিং তথ্য:\n\n📅 *সেভ করার তারিখ:* ${duration.savedDateBn} (${duration.savedTimeBn})\n⏱️ *কতদিন চলছে:* ${duration.durationTextBn}\n📁 *ক্যাটাগরি:* ${doc.category}${multiYearNote}\n\n💡 জিনিসটি আপনি কবে সেভ করেছিলেন তা মনে করিয়ে দিতে নিচে সংরক্ষিত ছবিটি দেওয়া হলো ভাই:`;
              await sendMetaWhatsAppMessage(fromNumber, msg);
            } else {
              const msg = isEng
                ? `📄 Here is your ${docResult.matchedByYear ? `*${docResult.targetYear}* ` : ''}saved file: *${doc.title}* (${doc.category})\n📅 Saved: ${duration.savedDateEn} (${duration.savedTimeEn})\n⏱️ Active: ${duration.durationTextEn}${multiYearNote}`
                : `📄 এই যে আপনার ${docResult.matchedByYear ? `*${yrBn}* সালের ` : ''}সংরক্ষিত ফাইল: *${doc.title}* (${doc.category})\n📅 সেভ তারিখ: ${duration.savedDateBn} (${duration.savedTimeBn})\n⏱️ সময়কাল: ${duration.durationTextBn}${multiYearNote}`;
              await sendMetaWhatsAppMessage(fromNumber, msg);
            }

            if (fileBuffer) {
              const caption = isEng
                ? `📸 ${doc.title} ${docResult.matchedByYear ? `(${docResult.targetYear}) ` : ''}• Saved: ${duration.savedDateEn}`
                : `📸 ${doc.title} ${docResult.matchedByYear ? `(${yrBn}) ` : ''}• সেভ: ${duration.savedDateBn}`;
              const sent = await sendMetaWhatsAppFile(
                fromNumber,
                fileBuffer,
                doc.fileName,
                doc.mimeType,
                caption
              );
              if (!sent && !isTrackingOrDateQuery) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `⚠️ ফাইলটি হোয়াটসঅ্যাপে সরাসরি পাঠানো সম্ভব হয়নি। অনুগ্রহ করে ওয়েব পোর্টাল থেকে ডাউনলোড করুন: ${process.env.APP_URL || 'https://smriti.life'}/app/documents`
                );
              }
            }
            return;
          }
        }

        // If user explicitly asked for a known document type but doesn't have it saved:
        const isExplicitDocRequest = hasFetchIntent && /(?:প্রেসক্রিপশন|prescription|রিপোর্ট|report|এনআইডি|nid|সার্টিফিকেট|certificate|রিসিপ্ট|receipt|বিল|bill|দলিল|পাসপোর্ট|passport|কাগজ|ডকুমেন্ট|document)\b/i.test(cleanText);
        if (isExplicitDocRequest) {
          await sendMetaWhatsAppMessage(
            fromNumber,
            `📁 ভাই, এই নামে কোনো ফাইল আপনার স্মৃতি মেমোরিতে সেভ করা নেই।\n\nআপনি ফাইলটি (ছবি বা PDF) আমাকে পাঠিয়ে ক্যাপশনে নামটি লিখলে আমি মেমোরিতে সেভ করে রাখবো এবং পরবর্তীতে চাওয়ামাত্র পাঠিয়ে দেবো!`
          );
          return;
        }

        // --- STEP 0E.1: Handle Medicine Duration / Remaining Days Inquiry ("নাপা কয়দিন খাব", "pana koi din ache", "khabo r koto din") ---
        const medicineAnswer = await handleMedicineInquiry(user._id, cleanText, user.honorific);
        if (medicineAnswer) {
          await sendMetaWhatsAppMessage(fromNumber, medicineAnswer);
          return;
        }

        // --- STEP 0E.2: Handle Medicine Course Reminder ("নাপা সকাল দুপুর রাত ৭ দিন", "সেক্লো সকাল রাত খাবারের আগে ৭ দিন") ---
        const medParseResult = parseMedicinePrescriptionText(cleanText);
        if (medParseResult && medParseResult.medicines.length > 0) {
          if (medParseResult.hasStartDate && medParseResult.startDate) {
            const result = await createMedicineRemindersFromPending(user._id, medParseResult.medicines, medParseResult.startDate);
            const salutation = user.honorific ? ` ${user.honorific}` : '';
            const confirmMsg = `✅ আলহামদুলিল্লাহ${salutation}! আপনার ওষুধের রিমাইন্ডার সফলভাবে সেট করা হয়েছে!\n\n📅 *কোর্স শুরুর তারিখ:* ${result.startDateBn}\n\n${result.routineSummary}\n\nসুস্থ থাকতে নিয়ম মেনে সময়মতো ওষুধ খেয়ে নিন! স্মৃতি লাইফ আপনাকে প্রতিটি সময়ে স্মরণ করিয়ে দেবে। 🌸🩺`;
            await sendMetaWhatsAppMessage(fromNumber, confirmMsg);
            return;
          } else {
            userPendingMedicineState.set(user._id.toString(), {
              medicines: medParseResult.medicines,
              expiresAt: Date.now() + 30 * 60 * 1000
            });

            const medListPreview = medParseResult.medicines.map((m, idx) => {
              const mealLabel = m.mealTiming === 'before' ? 'খাবারের আগে' : 'খাবারের পরে';
              return `${idx + 1}. 💊 *${m.name}* (${m.durationDays} দিন • ${m.routine.join(', ')}) [${mealLabel}]`;
            }).join('\n');

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            const askStartDateMsg = `💊 আপনার ওষুধের বিবরণ পেয়েছি${salutation}:\n\n${medListPreview}\n\n📅 *আপনি কবে থেকে ওষুধ খাওয়া শুরু করবেন?*\n👉 লিখে জানান: *"আজ থেকে"*, *"কাল থেকে"*, অথবা নির্দিষ্ট তারিখ যেমন *"১৮ তারিখ"*`;

            await sendMetaWhatsAppMessage(fromNumber, askStartDateMsg);
            return;
          }
        }

        // --- STEP 0: Handle WhatsApp Chat AI Training (/teach, /train, /rules, /unlearn) ---
        const teachMatch = cleanText.match(/^(?:\/teach|\/train|\/rule|ট্রেন|শেখাও|রুল)\s+(.+)$/is);
        const isListRules = /^(?:\/rules|\/listrules|নিয়মগুলো|রুলস|কি কি শিখেছো)\b/i.test(cleanText);
        const unlearnMatch = cleanText.match(/^(?:\/unlearn|\/removerule|\/delete_rule)\s+(.+)$/is);

        if (teachMatch || isListRules || unlearnMatch) {
          // Authorized Trainer Numbers: 01844697056, 01307065500, 01734042131
          const AUTHORIZED_TRAINERS = ['01844697056', '01307065500', '01734042131'];
          const cleanSender = fromNumber.replace(/\D/g, '');
          const isAuthorizedTrainer = AUTHORIZED_TRAINERS.some(num => {
            const shortNum = num.replace(/\D/g, '').slice(-10);
            return cleanSender.endsWith(shortNum);
          });

          if (!isAuthorizedTrainer) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `⛔ দুঃখিত, আপনি স্মৃতিকে নতুন নিয়ম শেখানোর অনুমোদিত অ্যাডমিন নন। শুধুমাত্র নির্দিষ্ট অ্যাডমিন নম্বর থেকেই AI ট্রেইনিং কমান্ড কার্যকর হবে।`
            );
            return;
          }
        }

        if (teachMatch) {
          const ruleContent = teachMatch[1].trim();
          if (ruleContent.length < 3) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `⚠️ অনুগ্রহ করে নিয়মটি স্পষ্টভাবে লিখুন। যেমন:\n/teach যখন ইউজার বলবে সালাম, তখন 'ওয়ালাইকুম আসসালাম' বলবে।`
            );
            return;
          }

          // Parse optional example: "Rule... Example: user -> output"
          const newRule = await AITrainingRule.create({
            rule: ruleContent,
            addedBy: fromNumber,
            isActive: true
          });
          invalidateRulesCache();

          await sendMetaWhatsAppMessage(
            fromNumber,
            `🧠 আলহামদুলিল্লাহ! স্মৃতি এই নতুন নিয়মটি সফলভাবে শিখে নিয়েছে:\n\n📌 "${ruleContent}"\n\nএখন থেকে আপনার AI স্বয়ংক্রিয়ভাবে এই নিয়ম মেনে উত্তর ও অ্যাকশন পরিচালনা করবে!`
          );
          return;
        }

        if (isListRules) {
          const rules = await AITrainingRule.find({ isActive: true }).sort({ createdAt: -1 }).limit(10);
          if (rules.length === 0) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🧠 বর্তমানে কোনো কাস্টম শেখানো নিয়ম নেই। নতুন নিয়ম শেখাতে লিখুন:\n/teach [আপনার নিয়ম]`
            );
          } else {
            const listText = rules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n\n');
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🧠 স্মৃতিকে শেখানো বর্তমান নিয়মসমূহ (${rules.length}টি):\n\n${listText}\n\n💡 কোনো নিয়ম মুছে ফেলতে লিখুন:\n/unlearn [নিয়মের শব্দ/সংখ্যা]`
            );
          }
          return;
        }

        if (unlearnMatch) {
          const target = unlearnMatch[1].trim();
          const deleted = await AITrainingRule.findOneAndDelete({
            $or: [
              { rule: { $regex: new RegExp(target, 'i') } },
              { _id: target.length === 24 ? target : undefined }
            ]
          });

          if (deleted) {
            invalidateRulesCache();
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🗑️ নিয়মটি সফলভাবে স্মৃতি থেকে মুছে ফেলা হয়েছে:\n"${deleted.rule}"`
            );
          } else {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `দুঃখিত, "${target}" মেলানো কোনো নিয়ম খুঁজে পাওয়া যায়নি। নিয়মগুলো দেখতে /rules লিখুন।`
            );
          }
          return;
        }

        // --- STEP 1: Handle Interactive Button / List Menu Clicks ---
        if (buttonId.startsWith('honorific_')) {
          let chosen = '';
          if (buttonId === 'honorific_chief') chosen = 'চিফ';
          else if (buttonId === 'honorific_sir') chosen = 'স্যার';
          else if (buttonId === 'honorific_boss') chosen = 'বস';
          else if (buttonId === 'honorific_bhai') chosen = 'ভাই';
          else if (buttonId === 'honorific_apu') chosen = 'আপু';
          else if (buttonId === 'honorific_madam') chosen = 'ম্যাডাম';

          if (chosen) {
            user.honorific = chosen;
            await user.save();
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🎉 অনেক ধন্যবাদ ${chosen}! এখন থেকে আমি আপনাকে সবসময় "${chosen}" বলেই সম্বোধন করব। 🤝\n\nবলুন ${chosen}, আজকে আপনাকে কীভাবে সাহায্য করতে পারি? যেমন:\n• রিমাইন্ডার বা অ্যালার্ম সেট করতে (লিখে বা ভয়েস পাঠিয়ে)\n• জন্মদিনের শুভেচ্ছা বা উইশ কার্ড পাঠাতে\n• কেনাকাটার তালিকা বা নোট সেভ করতে`
            );
            return;
          }
        }

        if (buttonId.startsWith('todo_toggle_')) {
          // Format: todo_toggle_{listId}_{itemId}
          const parts = buttonId.replace('todo_toggle_', '').split('_');
          const listId = parts[0];
          const itemId = parts[1];

          const todoList = await TodoList.findById(listId);
          if (todoList) {
            if (itemId === 'all') {
              // Mark all remaining items as completed
              todoList.items.forEach(it => {
                it.completed = true;
                it.completedAt = new Date();
              });
              await todoList.save();

              let listText = `🎉 দারুণ! *${todoList.title}*-এর সব কাজ সম্পন্ন হয়েছে!\n\n`;
              listText += `📋 *${todoList.title}*   (সব সম্পন্ন)\n`;
              listText += `─────────────────\n`;
              todoList.items.forEach(it => {
                listText += `☑️ ~${it.text}~\n`;
              });
              await sendMetaWhatsAppMessage(fromNumber, listText.trim());
              return;
            }

            const item = todoList.items.find(i => i.id === itemId);
            if (item) {
              item.completed = !item.completed;
              if (item.completed) item.completedAt = new Date();
              await todoList.save();

              const remaining = todoList.items.filter(i => !i.completed).length;
              const remainingText = `${remaining}টি বাকি`;
              let listText = `📋 *${todoList.title}*   (${remainingText})\n`;
              listText += `─────────────────\n`;
              todoList.items.forEach(it => {
                const box = it.completed ? '☑️' : '◻️';
                const textFormatted = it.completed ? `~${it.text}~` : it.text;
                listText += `${box} ${textFormatted}\n`;
              });

              const uncheckedItems = todoList.items.filter(i => !i.completed);
              if (uncheckedItems.length > 0) {
                // Interactive List Menu: Native Bottom Sheet Selector with all pending items!
                const rows = uncheckedItems.slice(0, 9).map(it => ({
                  id: `todo_toggle_${todoList._id}_${it.id}`,
                  title: `☑️ ${it.text.substring(0, 20)}`,
                  description: 'ট্যাপ করে সম্পন্ন করুন'
                }));

                // Add an option to complete all if more than 1 item
                if (uncheckedItems.length > 1) {
                  rows.push({
                    id: `todo_toggle_${todoList._id}_all`,
                    title: '✅ সবগুলো সম্পন্ন করুন',
                    description: 'একসাথে সব আইটেম টিক দিন'
                  });
                }

                const listSent = await sendMetaWhatsAppListMenu(
                  fromNumber,
                  listText.trim(),
                  'আইটেম সম্পন্ন করুন 📋',
                  'বাকি থাকা আইটেমসমূহ',
                  rows
                );

                if (!listSent) {
                  await sendMetaWhatsAppMessage(fromNumber, listText.trim());
                }
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `${listText.trim()}\n\n🎉 অসাধারণ! "${todoList.title}"-এর সব কাজ সম্পন্ন হয়েছে!`
                );
              }
              return;
            }
          }
        }

        if (buttonId === 'followup_set_reminder') {
          const salutation = user.honorific ? ` ${user.honorific}` : '';
          await sendMetaWhatsAppMessage(
            fromNumber,
            `📝 জি${salutation}, বলুন! কাল কয়টায় কী মনে করিয়ে দিতে হবে? যেমন: "কাল সকাল ৯টায় মিটিং" বা "রাত ১০টায় ওষুধ খাওয়া"। আপনি লিখে বা অডিও পাঠিয়ে দিতে পারেন।`
          );
          return;
        }

        if (buttonId === 'followup_not_today') {
          const salutation = user.honorific ? ` ${user.honorific}` : '';
          await sendMetaWhatsAppMessage(
            fromNumber,
            `🌙 চমৎকার${salutation}! কোনো প্রয়োজন হলে যেকোনো সময় জানাবেন। শুভ রাত্রি, ভালো থাকবেন! 🌟`
          );
          return;
        }

        if (buttonId.startsWith('rem_done_')) {
          const remId = buttonId.replace('rem_done_', '');
          cancelAlarmRinger(remId);
          const reminder = await Reminder.findById(remId);
          if (reminder && reminder.repeat && reminder.repeat !== 'Once') {
            await Reminder.findByIdAndUpdate(remId, { status: 'Pending' });
          } else {
            await Reminder.findByIdAndUpdate(remId, { status: 'Completed' });
          }
          userReminderState.delete(user._id.toString());
          const title = reminder?.title || 'কাজটি';
          const salutation = user.honorific ? ` ${user.honorific}` : '';
          const isSehri = /সেহরি|সাহরি|রোজা|রমজান|sehri|sahari|ramadan/i.test(title);

          if (isSehri) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🤲 মাশাআল্লাহ${salutation}! সেহরির খাবার খেয়ে রোজা রাখার নিয়ত করে নিন। আল্লাহ আপনার রোজা কবুল করুন। 🌙`
            );
          } else if (reminder?.category === 'wakeup' || reminder?.isAlarm) {
            const dhakaH = parseInt(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }), 10);
            let ackMsg = `☀️ শুভ সকাল${salutation}! আপনার ঘুম ভাঙার সংকেত নিশ্চিত করা হলো। দিনটি সফল ও সুন্দর হোক!`;
            if (dhakaH >= 12 && dhakaH < 16) {
              ackMsg = `☕ আপনার দুপুরের বিশ্রামের সংকেত নিশ্চিত করা হলো${salutation}! বাকি দিনটি সুন্দর ও কর্মচঞ্চল কাটুক!`;
            } else if (dhakaH >= 16 && dhakaH < 19) {
              ackMsg = `🌅 শুভ বিকাল${salutation}! আপনার বিশ্রামের সংকেত নিশ্চিত করা হলো। আনন্দময় সন্ধ্যা কাটুক!`;
            } else if (dhakaH >= 19 || dhakaH < 4) {
              ackMsg = `🌙 আপনার ঘুম ভাঙার সংকেত নিশ্চিত করা হলো${salutation}! আপনার রাতের সময় শুভ হোক!`;
            } else if (dhakaH >= 4 && dhakaH < 6) {
              ackMsg = `🌸 শুভ ভোর${salutation}! আপনার ঘুম ভাঙার সংকেত নিশ্চিত করা হলো। দিনটি বরকতময় হোক!`;
            }
            await sendMetaWhatsAppMessage(fromNumber, ackMsg);
          } else {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🎉 দারুণ${salutation}! "${title}" সফলভাবে সম্পন্ন হিসেবে মার্ক করা হলো। আপনার দিনটি শুভ হোক!`
            );
          }
          return;
        }

        if (buttonId.startsWith('rem_reschedule_')) {
          const remId = buttonId.replace('rem_reschedule_', '');
          cancelAlarmRinger(remId);
          const reminder = await Reminder.findById(remId);

          const isWakeup = reminder?.category === 'wakeup' || reminder?.category === 'alarm' || !!reminder?.isAlarm;
          if (isWakeup && reminder) {
            // Automatic 5-minute snooze for wake-up and Sehri alarms
            const now = new Date();
            const dhakaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
            dhakaNow.setMinutes(dhakaNow.getMinutes() + 5);
            const newHours = dhakaNow.getHours().toString().padStart(2, '0');
            const newMins = dhakaNow.getMinutes().toString().padStart(2, '0');
            const newTime = `${newHours}:${newMins}`;

            await Reminder.findByIdAndUpdate(remId, {
              time: newTime,
              status: 'Pending'
            });
            userReminderState.delete(user._id.toString());

            await sendMetaWhatsAppMessage(
              fromNumber,
              `💤 অ্যালার্মটি ৫ মিনিটের জন্য স্নুজ করা হলো (পরবর্তী অ্যালার্ম: ${formatTime12Hour(newTime)})। ঠিক ৫ মিনিট পর আপনাকে আবার ডাকা হবে!`
            );
            return;
          }

          userReminderState.set(user._id.toString(), {
            reminderId: remId,
            title: reminder?.title || 'রিমাইন্ডারটি',
            waitingForTime: true,
            expiresAt: Date.now() + 2 * 60 * 60 * 1000
          });
          await sendMetaWhatsAppMessage(
            fromNumber,
            `⏰ কোনো সমস্যা নেই! আপনি কখন বা কোন সময়ে এটি পুনঃনির্ধারণ করতে চান বলুন (যেমন: "আজ বিকাল ৫টায়" বা "কাল সকাল ১০টায়")।`
          );
          return;
        }

        // --- STEP 2: Handle Pending Wish Name Response ---
        const activeWishState = userWishState.get(user._id.toString());
        if (activeWishState && activeWishState.expiresAt > Date.now() && activeWishState.waitingForName) {
          const isCancel = /^(?:cancel|বাতিল|না|থাক|দরকার\s*নাই|লাগবে\s*না)\b/i.test(cleanText.trim());
          if (isCancel) {
            userWishState.delete(user._id.toString());
            await sendMetaWhatsAppMessage(fromNumber, 'উইশ পাঠানোর অনুরোধ বাতিল করা হয়েছে।');
            return;
          }

          // If user sends a completely new action command or phone number, cancel the pending wish and proceed with the new command
          const isNewAction = /(?:\+?8801\d{9}|01\d{9})/.test(cleanText) ||
            /\b(?:reminder|রিমাইন্ডার|মিটিং|meeting|note|নোট|todo|টুডু|checklist|লোকেশন|location)\b/i.test(cleanText) ||
            (/\b(?:wish|উইশ|birthday|জন্মদিন)\b/i.test(cleanText) && /\b(?:send|pathao|পাঠাও|দাও|daw|dao|pathu)\b/i.test(cleanText));

          if (isNewAction) {
            userWishState.delete(user._id.toString());
            // Fall through to process as a fresh command!
          } else {
            let extractedName = cleanText
              .replace(/^(?:তার\s*নাম|নাম|recipient|name(?:\s+is)?|it(?:\s+is)?|for)\s*[:=]?\s*/i, '')
              .replace(/^(?:হলো|হল|হচ্ছে)\s*[:=]?\s*/i, '')
              .replace(/[।\.,!?]/g, '')
              .trim();

            if (/^(?:skip|no|নাই)\b/i.test(extractedName) || !extractedName || extractedName.length < 2) {
              extractedName = 'প্রিয়জন';
            } else {
              // Capitalize first letter of each word if English
              if (/^[a-z]/i.test(extractedName)) {
                extractedName = extractedName
                  .split(/\s+/)
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
              }
            }

            userWishState.delete(user._id.toString());

            const occasion = activeWishState.occasion || 'birthday';
            const occasionTitle = getOccasionTitle(occasion);
            const recipientPhone = activeWishState.recipientPhone;
            const sendNow = activeWishState.sendNow !== false;

            let message = activeWishState.message;
            if (!message || message.includes('প্রিয়জন')) {
              message = occasion === 'birthday'
                ? `শুভ জন্মদিন ${extractedName}! আপনার জীবনের প্রতিটি দিন অনেক আনন্দ, সুস্বাস্থ্য এবং সাফল্যে ভরে উঠুক।`
                : occasion === 'anniversary'
                ? `শুভ বিবাহবার্ষিকী ${extractedName}! আপনাদের দুজনের পথচলা আজীবন অটুট ও আনন্দময় থাকুক।`
                : occasion === 'eid'
                ? `ঈদ মোবারক ${extractedName}! আপনার ও আপনার পরিবারের জন্য রইল পবিত্র ঈদের অফুরন্ত শুভেচ্ছা।`
                : `অনেক অনেক আন্তরিক শুভেচ্ছা ও শুভকামনা, ${extractedName}! আপনার জীবন সুন্দর ও সাফল্যমণ্ডিত হোক।`;
            } else {
              message = message.replace(/প্রিয়জন/g, extractedName);
            }

            const smartCardId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
            const imageUrl = getOccasionImageUrl(occasion);

            let scheduledAt = new Date();
            if (!sendNow && activeWishState.date) {
              const timeStr = activeWishState.time || '10:00';
              const bdIso = `${activeWishState.date}T${timeStr}:00+06:00`;
              const parsedDate = new Date(bdIso);
              if (!isNaN(parsedDate.getTime())) scheduledAt = parsedDate;
            }

            const newWish = await Wish.create({
              userId: user._id,
              recipientName: extractedName,
              recipientContact: recipientPhone,
              occasion,
              message,
              isSmartCard: true,
              smartCardId,
              cardData: {
                image: imageUrl,
                title: occasionTitle,
                senderName: user.name || 'আপনার শুভাকাঙ্ক্ষী',
                animation: 'envelope'
              },
              scheduledAt,
              deliveryMethod: ['WhatsApp'],
              status: sendNow ? 'Sent' : 'Scheduled'
            });

            if (sendNow && recipientPhone) {
              await deliverWishCard(newWish, user.name || 'আপনার শুভাকাঙ্ক্ষী');
              await sendMetaWhatsAppMessage(
                fromNumber,
                `🎉 ঠিক আছে! ${recipientPhone} নম্বরে ${extractedName}-র জন্য ${occasionTitle} কার্ড এবং শুভেচ্ছা বার্তা সফলভাবে পাঠিয়ে দেওয়া হয়েছে!`
              );
            } else {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `🎉 ঠিক আছে! ${extractedName}-র জন্য ${occasionTitle} কার্ডটি নির্ধারিত সময়ে ${recipientPhone || ''} নম্বরে স্বয়ংক্রিয়ভাবে পাঠিয়ে দেওয়া হবে।`
              );
            }
            return;
          }
        }

        // --- STEP 2.5: Handle Conversational Yes / No / Reschedule for Active Reminders ---
        let activeState = userReminderState.get(user._id.toString());

        // If not in memory state, check if there is a recently alerted/snoozed reminder in DB
        if (!activeState || activeState.expiresAt < Date.now()) {
          const recentSnoozed = await Reminder.findOne({
            userId: user._id,
            status: 'Snoozed'
          }).sort({ updatedAt: -1 });

          if (recentSnoozed) {
            activeState = {
              reminderId: recentSnoozed._id.toString(),
              title: recentSnoozed.title,
              waitingForTime: false,
              expiresAt: Date.now() + 2 * 60 * 60 * 1000
            };
            userReminderState.set(user._id.toString(), activeState);
          }
        }

        const isYesIntent = /^(?:হ্যাঁ|হ্যা|হাঁ|হুম|জি|করেছি|করছি|হয়ে\s*গেছে|হয়েগেছে|সম্পন্ন|yes|done|completed|yep|yeah|koresi|hoise|join\s*koresi|জেগে\s*গেছি|জেগেছি|উঠেছি|উঠে\s*গেছি|উঠেগেছি|jegechi|uthechi|uthesi)\b/i.test(cleanText);
        const isSnoozeIntent = /^(?:স্নুজ|snooze|৫\s*মিনিট|5\s*mnt|5\s*min|পরে\s*ডাকো|pore\s*dako)\b/i.test(cleanText);
        const isNoIntent = /^(?:না|নো|না\s*করিনি|না\s*করি\s*নাই|করি\s*নাই|করিনি|no|nope|reschedule|kori\s*ni|hoy\s*ni|join\s*kori\s*ni)\b/i.test(cleanText);

        if (activeState && isYesIntent) {
          cancelAlarmRinger(activeState.reminderId);
          const activeRem = await Reminder.findById(activeState.reminderId);
          if (activeRem && activeRem.repeat && activeRem.repeat !== 'Once') {
            await Reminder.findByIdAndUpdate(activeState.reminderId, { status: 'Pending' });
          } else {
            await Reminder.findByIdAndUpdate(activeState.reminderId, { status: 'Completed' });
          }
          userReminderState.delete(user._id.toString());
          const isSehri = /সেহরি|সাহরি|রোজা|রমজান|sehri|sahari|ramadan/i.test(activeState.title);
          if (isSehri) {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🤲 মাশাআল্লাহ! সেহরির খাবার খেয়ে রোজা রাখার নিয়ত করে নিন। আল্লাহ আপনার রোজা কবুল করুন। 🌙`
            );
          } else {
            await sendMetaWhatsAppMessage(
              fromNumber,
              `🎉 চমৎকার! "${activeState.title}" সফলভাবে সম্পন্ন হিসেবে মার্ক করা হলো!`
            );
          }
          return;
        }

        if (activeState && isSnoozeIntent) {
          cancelAlarmRinger(activeState.reminderId);
          const now = new Date();
          const dhakaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
          dhakaNow.setMinutes(dhakaNow.getMinutes() + 5);
          const newHours = dhakaNow.getHours().toString().padStart(2, '0');
          const newMins = dhakaNow.getMinutes().toString().padStart(2, '0');
          const newTime = `${newHours}:${newMins}`;

          await Reminder.findByIdAndUpdate(activeState.reminderId, {
            time: newTime,
            status: 'Pending'
          });
          userReminderState.delete(user._id.toString());

          await sendMetaWhatsAppMessage(
            fromNumber,
            `💤 অ্যালার্মটি ৫ মিনিটের জন্য স্নুজ করা হলো (পরবর্তী অ্যালার্ম: ${formatTime12Hour(newTime)})। ঠিক ৫ মিনিট পর আপনাকে আবার ডাকা হবে!`
          );
          return;
        }

        // Check if user has an active reminder waiting for time OR if user is correcting a recently rescheduled/alerted reminder
        const recentRescheduled = lastRescheduledReminder.get(user._id.toString());
        const isRecentCorrection = !!(
          recentRescheduled &&
          Date.now() - recentRescheduled.updatedAt < 15 * 60 * 1000 &&
          /^(?:না|নো|আরে\s*না|এটা\s*না|ওটা\s*না|ভুল\s*হয়েছে|ভুল|সংশোধন|change|na|no|are\s*eta\s*na|eta\s*na|oita\s*na|vul|bhul|mistake)\b/i.test(cleanText)
        );

        const targetState = activeState || (isRecentCorrection ? {
          reminderId: recentRescheduled!.reminderId,
          title: recentRescheduled!.title,
          waitingForTime: true,
          expiresAt: Date.now() + 15 * 60 * 1000
        } : null);

        if (targetState && (isNoIntent || isRecentCorrection || targetState.waitingForTime)) {
          const relDuration = matchRelativeDuration(cleanText);
          const hasTimeMatch = cleanText.match(/(?:(\d{1,2}|[০-৯]{1,2})(?::(\d{2}|[০-৯]{2}))?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/i);

          if (relDuration !== null || (hasTimeMatch && hasTimeMatch[1])) {
            const parsedTime = parseBengaliTime(cleanText);
            const targetDate = parseRelativeDate(cleanText, parsedTime);

            await Reminder.findByIdAndUpdate(targetState.reminderId, {
              time: parsedTime,
              date: targetDate,
              status: 'Pending'
            });

            // Clean up any accidental dummy reminder (like "নির্ধারিত কাজ") created within the last 5 minutes
            await Reminder.deleteMany({
              userId: user._id,
              title: /নির্ধারিত কাজ/i,
              createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
            });

            // Remember for 15 minutes so immediate corrections ("না এটা না...") continue to target this reminder
            lastRescheduledReminder.set(user._id.toString(), {
              reminderId: targetState.reminderId,
              title: targetState.title,
              updatedAt: Date.now()
            });

            userReminderState.delete(user._id.toString());

            const isEng = isPureEnglishText(cleanText);
            if (isEng) {
              const dStrEng = targetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' });
              await sendMetaWhatsAppMessage(
                fromNumber,
                `✅ All set! Your reminder "${targetState.title}" has been rescheduled:\n⏰ New Time: ${formatTime12Hour(parsedTime)} (${dStrEng})`
              );
            } else {
              const dStr = targetDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' });
              await sendMetaWhatsAppMessage(
                fromNumber,
                `✅ ঠিক আছে! "${targetState.title}" রিমাইন্ডারটি পুনঃনির্ধারণ করা হলো:\n⏰ নতুন সময়: ${formatTime12Hour(parsedTime)} (${dStr})`
              );
            }
            return;
          }

          // If no time is provided yet, prompt for time
          targetState.waitingForTime = true;
          userReminderState.set(user._id.toString(), targetState);
          const isEng = isPureEnglishText(cleanText);
          await sendMetaWhatsAppMessage(
            fromNumber,
            isEng
              ? `⏰ No problem! When would you like to reschedule this reminder? (e.g., "in 1 hour", "today at 5 PM", or "tomorrow at 10 AM")`
              : `⏰ কোনো সমস্যা নেই! আপনি কখন বা কোন সময়ে রিমাইন্ডারটি পুনঃনির্ধারণ করতে চান বলুন (যেমন: "১ ঘণ্টা পর", "আজ বিকাল ৫টায়" বা "কাল সকাল ১০টায়")।`
          );
          return;
        }

        // Check if user was asked for a date/day for a pending reminder
        if (userPendingReminderState.has(user._id.toString())) {
          const pending = userPendingReminderState.get(user._id.toString())!;
          if (Date.now() > pending.expiresAt) {
            userPendingReminderState.delete(user._id.toString());
          } else if (cleanText && !cleanText.startsWith('/')) {
            let reminderTime = pending.time;
            const hasNewTime = cleanText.match(/(?:(\d{1,2}|[০-৯]{1,2})(?::(\d{2}|[০-৯]{2}))?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/i);
            if (hasNewTime && hasNewTime[1]) {
              reminderTime = parseBengaliTime(cleanText);
            }

            const targetDate = parseRelativeDate(cleanText, reminderTime);

            await Reminder.create({
              userId: user._id,
              title: pending.title,
              description: pending.customMessage,
              date: targetDate,
              time: reminderTime,
              priority: 'Medium',
              category: pending.category || 'General',
              repeat: 'Once',
              status: 'Pending',
              isAlarm: false
            });

            userPendingReminderState.delete(user._id.toString());

            const formattedTime = formatTime12Hour(reminderTime);
            const isEng = isPureEnglishText(cleanText);
            const dateStrBn = targetDate.toLocaleDateString('bn-BD', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Dhaka'
            });
            const dateStrEn = targetDate.toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Dhaka'
            });

            const confirmMsg = isEng
              ? `⏰ Your reminder *"${pending.title}"* has been successfully set!\n📅 *Date:* ${dateStrEn}\n⏰ *Time:* ${formattedTime}`
              : `⏰ আপনার রিমাইন্ডার *"${pending.title}"* সফলভাবে সেট করা হয়েছে!\n📅 *তারিখ:* ${dateStrBn}\n⏰ *সময়:* ${formattedTime}`;

            await sendMetaWhatsAppMessage(fromNumber, confirmMsg);
            return;
          }
        }

        // Check if user is responding to a pending medicine prescription course question ("কবে থেকে ওষুধ শুরু করবেন?")
        if (userPendingMedicineState.has(user._id.toString())) {
          const pendingMed = userPendingMedicineState.get(user._id.toString())!;
          if (Date.now() > pendingMed.expiresAt) {
            userPendingMedicineState.delete(user._id.toString());
          } else if (cleanText && !cleanText.startsWith('/')) {
            const isCancel = /^(?:না|নো|থাক|বাতিল|cancel|দরকার\s*নাই|লাগবে\s*না)\b/i.test(cleanText.trim());
            if (isCancel) {
              userPendingMedicineState.delete(user._id.toString());
              await sendMetaWhatsAppMessage(fromNumber, 'ওষুধের রিমাইন্ডার সেট করার অনুরোধ বাতিল করা হয়েছে।');
              return;
            }

            // Determine start date from user's response
            const now = new Date();
            const dhakaStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
            const [curYear, curMonth, curDay] = dhakaStr.split('-').map(Number);
            const todayDhaka = new Date(Date.UTC(curYear, curMonth - 1, curDay, 0, 0, 0));

            let startDate = todayDhaka;
            const lowerResp = cleanText.toLowerCase();

            if (/\b(?:কাল|কালকে|আগামীকাল|kal|kalke|agamikal|tomorrow)\b/i.test(lowerResp)) {
              const tomorrow = new Date(todayDhaka);
              tomorrow.setDate(tomorrow.getDate() + 1);
              startDate = tomorrow;
            } else if (/\b(?:পরশু|পরশুদিন|porshu)\b/i.test(lowerResp)) {
              const porshu = new Date(todayDhaka);
              porshu.setDate(porshu.getDate() + 2);
              startDate = porshu;
            } else {
              const dateMatch = lowerResp.match(/(\d{1,2}|[০-৯]{1,2})\s*(?:তারিখ|তারিখে|tarik|tarikh)?/i);
              if (dateMatch) {
                const bnDigits: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                const dNum = parseInt(dateMatch[1].replace(/[০-৯]/g, m => bnDigits[m] || m), 10);
                if (dNum >= 1 && dNum <= 31) {
                  let tMonth = curMonth - 1;
                  let tYear = curYear;
                  if (dNum < curDay) {
                    tMonth += 1;
                    if (tMonth > 11) { tMonth = 0; tYear += 1; }
                  }
                  startDate = new Date(Date.UTC(tYear, tMonth, dNum, 0, 0, 0));
                }
              }
            }

            const result = await createMedicineRemindersFromPending(user._id, pendingMed.medicines, startDate);
            userPendingMedicineState.delete(user._id.toString());

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            const confirmMsg = `✅ আলহামদুলিল্লাহ${salutation}! আপনার ওষুধের রিমাইন্ডার সফলভাবে সেট করা হয়েছে!\n\n📅 *কোর্স শুরুর তারিখ:* ${result.startDateBn}\n\n${result.routineSummary}\n\nসুস্থ থাকতে নিয়ম মেনে সময়মতো ওষুধ খেয়ে নিন! স্মৃতি লাইফ আপনাকে প্রতিটি সময়ে স্মরণ করিয়ে দেবে। 🌸🩺`;

            await sendMetaWhatsAppMessage(fromNumber, confirmMsg);
            return;
          }
        }

        // --- STEP 2.8: Handle User Honorific/Salutation (Explicit Change or Initial Onboarding) ---
        const selectedTitle = extractHonorificChoice(cleanText, !!user.honorific);
        if (selectedTitle) {
          user.honorific = selectedTitle;
          await user.save();
          await sendMetaWhatsAppMessage(
            fromNumber,
            `🎉 অনেক ধন্যবাদ ${selectedTitle}! এখন থেকে আমি আপনাকে সবসময় "${selectedTitle}" বলেই সম্বোধন করব। 🤝\n\nবলুন ${selectedTitle}, আজকে আপনাকে কীভাবে সাহায্য করতে পারি? যেমন:\n• রিমাইন্ডার বা অ্যালার্ম সেট করতে (লিখে বা ভয়েস পাঠিয়ে)\n• জন্মদিনের শুভেচ্ছা বা উইশ কার্ড পাঠাতে\n• কেনাকাটার তালিকা বা নোট সেভ করতে`
          );
          return;
        }

        // If user has not chosen an honorific yet, check if they sent a direct command or just a greeting
        if (!user.honorific && !buttonId) {
          const isExplicitCommand = /ঘুম|ghum|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|উঠি|uthi|utha|uthe|uthai|তুলে|tule|তুলে দাও|তুলে দিও|ডেকে|deke|ডাকা|dake|ডাকবা|dakba|ডেকে দিও|ডেকে দাও|mnt|min|minute|মিনিট|ঘণ্টা|ghonta|ghanta|মনে|mone|রিমাইন্ডার|reminder|নোট|note|লিস্ট|list|বাজার|মিটিং|meeting|ওষুধ|medicine|উইশ|wish|কার্ড|card|রমজান|romjan|ramadan|সেহরি|সাহরি|sehri|sahari|ইফতার|iftar/i.test(cleanText);

          if (!isExplicitCommand) {
            const onboardingPrompt = `আসসালামু আলাইকুম! স্মৃতি লাইফে (Smriti Life) আপনাকে স্বাগতম। 🌸\n\nআমি আপনার সার্বক্ষণিক এআই পার্সোনাল অ্যাসিস্ট্যান্ট। আমি আপনাকে কীভাবে সম্বোধন করব? অনুগ্রহ করে নিচের যেকোনো একটি সিলেক্ট করুন বা লিখে জানান:`;
            const buttons = [
              { id: 'honorific_chief', title: 'চিফ (Chief) 🎖️' },
              { id: 'honorific_sir', title: 'স্যার (Sir) 👔' },
              { id: 'honorific_bhai', title: 'ভাই (Bhai) 🤝' }
            ];
            const buttonsSent = await sendMetaWhatsAppButtons(
              fromNumber,
              onboardingPrompt,
              buttons,
              'অথবা বস / আপু লিখে জানান'
            );
            if (!buttonsSent) {
              const fallbackText = `${onboardingPrompt}\n\n• চিফ (Chief)\n• স্যার (Sir)\n• ভাই (Bhai)\n• বস (Boss)\n• আপু (Apu)\n\n👉 যেকোনো একটি লিখে রিপ্লাই দিন।`;
              await sendMetaWhatsAppMessage(fromNumber, fallbackText);
            }
            return;
          } else {
            user.honorific = 'ভাই';
            await user.save();
          }
        }

        // --- STEP 2.8: Ramadan & Islamic Fast-Path (0 Cost, Instant Response) ---
        // 1. District Setup / Update
        const districtMatch = cleanText.match(/(?:আমার\s*জেলা|জেলা|district|location|লোকেশন|আমি\s*আছি|ami\s*achi|বাসা)\s*[:=]?\s*([a-zA-Z\u0980-\u09FF\s]+)/i);
        if (districtMatch && districtMatch[1] && districtMatch[1].trim().length >= 3 && !/কখন|সময়|time|কবে|আজ|কাল/i.test(districtMatch[1])) {
          const matchedD = matchDistrict(districtMatch[1].trim());
          user.district = matchedD.nameEn;
          await user.save();

          const times = getRamadanTimes(matchedD.nameEn);
          await sendMetaWhatsAppMessage(
            fromNumber,
            `📍 আলহামদুলিল্লাহ! আপনার জেলা *${matchedD.nameBn}* সফলভাবে সেট করা হলো। 🌙\n\nআজকের সময়সূচি:\n⏰ সেহরি শেষ সময়: *${times.sehriFormatted}*\n🍽️ ইফতারের সময়: *${times.iftarFormatted}*\n\nস্মৃতি লাইফ প্রতিদিন আপনাকে সেহরি ও ইফতারের পূর্বে স্বয়ংক্রিয়ভাবে স্মরণ করিয়ে দেবে! 🤲`
          );
          return;
        }

        // 2. Iftar Time Query
        const isIftarQuery = /(?:ইফতার|iftar)\s*(?:কখন|কবে|time|সময়|somoy|koytay|kobe|আজ|aj|আজকে|ajke)/i.test(cleanText) ||
                             /(?:আজ|আজকে|aj|ajke)?\s*(?:ইফতারের\s*সময়|iftar\s*time|ইফতার\s*কখন)/i.test(cleanText);
        if (isIftarQuery) {
          const userDist = user.district || 'Dhaka';
          const times = getRamadanTimes(userDist);

          // Calculate remaining time
          const now = new Date();
          const currentDhakaTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
          const [cH, cM] = currentDhakaTime.split(':').map(Number);
          const [iH, iM] = times.iftar.split(':').map(Number);
          const currentTotal = cH * 60 + cM;
          const iftarTotal = iH * 60 + iM;
          const diffMins = iftarTotal - currentTotal;

          let countdownText = '';
          if (diffMins > 0) {
            const leftH = Math.floor(diffMins / 60);
            const leftM = diffMins % 60;
            countdownText = `\n⏳ ইফতারের বাকি: *${leftH > 0 ? `${leftH} ঘণ্টা ` : ''}${leftM} মিনিট*`;
          } else if (diffMins >= -30) {
            countdownText = `\n🎉 আলহামদুলিল্লাহ! ইফতারের সময় চলছে, দ্রুত ইফতার সম্পন্ন করুন!`;
          }

          await sendMetaWhatsAppMessage(
            fromNumber,
            `🌙 *আজকের ইফতারের সময়সূচি (${times.districtBn} জেলা):*\n\n🍽️ ইফতারের সময়: *${times.iftarFormatted}*${countdownText}\n\n🤲 *ইফতারের দোয়া:*\n"${RAMADAN_DUAS.iftarDua.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.iftarDua.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.iftarDua.meaning}"\n\n(জেলা পরিবর্তন করতে লিখুন: "আমার জেলা চট্টগ্রাম" বা আপনার জেলার নাম)`
          );
          return;
        }

        // 3. Sehri Time Query
        const isSehriQuery = /(?:সেহরি|সাহরি|sehri|sahari)\s*(?:কখন|কবে|time|সময়|somoy|koytay|kobe|শেষ|sesh)/i.test(cleanText) ||
                             /(?:সেহরির\s*সময়|sehri\s*time|সেহরি\s*কখন|সাহরি\s*কখন)/i.test(cleanText);
        if (isSehriQuery && !cleanText.match(/তুলে|ডেকে|দেও|দাও|dio|daw|ডাকবা|উঠা|alarm|অ্যালার্ম/i)) {
          const userDist = user.district || 'Dhaka';
          const times = getRamadanTimes(userDist);

          await sendMetaWhatsAppMessage(
            fromNumber,
            `🌙 *সেহরির সময়সূচি (${times.districtBn} জেলা):*\n\n⏰ সেহরি শেষ সময়: *${times.sehriFormatted}*\n🕌 ফজরের আজান: *${formatBanglaTime(times.fajr)}*\n\n🤲 *রোজার নিয়ত:*\n"${RAMADAN_DUAS.sehriNiyyat.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.sehriNiyyat.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.sehriNiyyat.meaning}"\n\n💡 সেহরিতে ওয়েক-আপ অ্যালার্ম দিতে বলুন: "প্রতিদিন সেহরিতে ডেকে দিও"`
          );
          return;
        }

        // 4. Ramadan Duas Query
        const isDuaQuery = /(?:রোজার\s*নিয়ত|সেহরির\s*দোয়া|ইফতারের\s*দোয়া|রোজার\s*দোয়া|sehri\s*dua|iftar\s*dua)/i.test(cleanText);
        if (isDuaQuery) {
          await sendMetaWhatsAppMessage(
            fromNumber,
            `🤲 *পবিত্র রমজানের প্রয়োজনীয় দোয়াসমূহ:*\n\n1️⃣ *${RAMADAN_DUAS.sehriNiyyat.title}:*\n"${RAMADAN_DUAS.sehriNiyyat.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.sehriNiyyat.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.sehriNiyyat.meaning}"\n\n2️⃣ *${RAMADAN_DUAS.iftarDua.title}:*\n"${RAMADAN_DUAS.iftarDua.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.iftarDua.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.iftarDua.meaning}"\n\n3️⃣ *${RAMADAN_DUAS.iftarSunnahDua.title}:*\n"${RAMADAN_DUAS.iftarSunnahDua.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.iftarSunnahDua.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.iftarSunnahDua.meaning}"`
          );
          return;
        }

        // 5. 5 Daily Prayer Times Query (Year-round for all 64 districts)
        const isPrayerQuery = /(?:নামাজের?\s*সময়|নামাজের?\s*ওয়াক্ত|namaj|namaz|prayer\s*time|ওয়াক্তের?\s*সময়|আজকের\s*নামাজ|আজকে\s*নামাজ|আজ\s*নামাজ|ফজর\s*কখন|জোহর\s*কখন|আসর\s*কখন|মাগরিব\s*কখন|এশা\s*কখন|পাঁচ\s*ওয়াক্ত)/i.test(cleanText) &&
                              !cleanText.match(/মনে|রিমাইন্ডার|reminder|লিস্ট|ডাক|তুলে|alarm/i);
        if (isPrayerQuery) {
          const userDist = user.district || 'Dhaka';
          const times = getRamadanTimes(userDist);

          await sendMetaWhatsAppMessage(
            fromNumber,
            `🕌 *আজকের ৫ ওয়াক্ত নামাজের সময়সূচি*\n📍 জেলা: *${times.districtBn}*\n📅 ${times.hijriDay} ${times.hijriMonthName} ${times.hijriYear} হিজরি\n\n• ফজর: *${times.prayers.fajrFormatted}* (সেহরি শেষ: ${times.sehriFormatted})\n• সূর্যোদয়: *${times.prayers.sunriseFormatted}*\n• জোহর: *${times.prayers.dhuhrFormatted}*\n• আসর: *${times.prayers.asrFormatted}*\n• মাগরিব: *${times.prayers.maghribFormatted}* (ইফতার)\n• এশা: *${times.prayers.ishaFormatted}*\n\n💡 জেলা পরিবর্তন করতে লিখুন: "আমার জেলা চট্টগ্রাম" বা আপনার জেলার নাম`
          );
          return;
        }

        // --- STEP 2.9: Daily Expense Tracker Fast-Path (0 Cost, Instant Response) ---
        // Allow expense commands, queries and deletions (yesterday, day before yesterday, specific dates like '10 oct', months)
        const isReminderAction = /মনে\s*করিয়ে|ডাকবে|তুলে\s*দিও|wake\s*me|অ্যালার্ম|alarm/i.test(cleanText);
        if (!isReminderAction) {
          // 2.9A: Expense Deletion Handling (Explicit expense delete or Active expense context delete)
          const hasDeleteVerb = /(?:ডিলিট|মুছে|মুছ|delete|remove|ক্লিয়ার|বাতিল|cancel|বাদ|ফেলে)/i.test(cleanText);
          const hasExplicitReminder = /(?:রিমাইন্ডার|reminder|অ্যালার্ম|alarm|সেহরি|সাহরি|রোজা)/i.test(cleanText);
          const hasExplicitNote = /(?:নোট|note)/i.test(cleanText);
          const hasExplicitContact = /(?:কন্ট্যাক্ট|contact|নম্বর)/i.test(cleanText);
          const hasExplicitTodo = /(?:টু-ডু|todo|চেকলিস্ট|checklist)/i.test(cleanText);
          const hasExplicitExpense = /(?:খরচ|khoroc|khoros|expense|expenses|ব্যয়|ব্যায়|খাতা)/i.test(cleanText);

          const expContext = userExpenseContext.get(user._id.toString());
          const isExpContextActive = !!(expContext && expContext.expiresAt > Date.now() && expContext.expenses.length > 0);

          if (hasDeleteVerb && !hasExplicitReminder && !hasExplicitNote && !hasExplicitContact && !hasExplicitTodo) {
            if (hasExplicitExpense || isExpContextActive) {
              // 1. Delete ALL expenses for date
              if (/(?:সব|সকল|all|sob|shob)\s*(?:খরচ|khoroc|khoros|expense)/i.test(cleanText)) {
                const targetDate = expContext?.targetDate || new Date();
                const dateLabel = expContext?.dateLabelBn || 'আজকের';
                const delRes = await deleteAllExpensesForDate(user._id, targetDate);
                userExpenseContext.delete(user._id.toString());
                if (delRes.deletedCount > 0) {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `🗑️ আপনার ${dateLabel} সব (${enToBnDigits(delRes.deletedCount)}টি) খরচের এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে!\n\n📅 চলতি মাসের নতুন মোট: ${formatTaka(delRes.monthTotal)}`
                  );
                } else {
                  await sendMetaWhatsAppMessage(fromNumber, `আপনার ওই তারিখে কোনো খরচের এন্ট্রি ছিল না।`);
                }
                return;
              }

              // 2. Delete by Index (e.g. "1 number delete kore daw", "১ নম্বরটা ডিলিট করো", "শেষেরটা ডিলিট করো")
              let targetIndex: number | undefined = undefined;
              const enDigits = bnToEnDigits(cleanText);
              const indexMatch = enDigits.match(/(\d+)\s*(?:number|nmbr|numbr|no|নম্বর|নাম্বার|নং)?\s*(?:ta|ti|টা|টি)?/i);
              if (indexMatch) {
                targetIndex = parseInt(indexMatch[1], 10);
              } else if (/(?:protom|first|প্রথম)(?:\s*(?:ta|ti|টা|টি))?/i.test(cleanText)) {
                targetIndex = 1;
              } else if (/(?:last|shesh|শেষ|লাস্ট)(?:\s*(?:ta|ti|er\s*ta|এর\s*টা|টা|টি))?/i.test(cleanText)) {
                targetIndex = -1;
              }

              if (targetIndex !== undefined) {
                const targetDate = expContext?.targetDate || new Date();
                const dateLabel = expContext?.dateLabelBn || 'আজকের';
                const result = await deleteExpenseByIndex(user._id, targetDate, targetIndex);
                if (result) {
                  if (result.remainingCount > 0) {
                    userExpenseContext.set(user._id.toString(), {
                      targetDate,
                      dateLabelBn: dateLabel,
                      expenses: result.remainingExpenses.map(e => ({ id: e._id.toString(), title: e.title, amount: e.amount })),
                      expiresAt: Date.now() + 15 * 60 * 1000
                    });
                  } else {
                    userExpenseContext.delete(user._id.toString());
                  }
                  const reply = buildExpenseDeletedMessage(
                    result.deletedExpense.title,
                    result.deletedExpense.amount,
                    result.dateTotal,
                    result.monthTotal,
                    dateLabel
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                  return;
                } else {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `দুঃখিত, ${targetIndex === -1 ? 'সর্বশেষ' : enToBnDigits(targetIndex) + ' নম্বরে'} কোনো খরচের এন্ট্রি পাওয়া যায়নি।`
                  );
                  return;
                }
              }

              // 3. Delete by Title/Keyword (e.g. "rate dinner delete koro", "লাঞ্চ ডিলিট করো")
              const cleanedQuery = cleanText
                .replace(/(?:খরচ|khoroc|khoros|expense|expenses|হিসাব|ব্যয়|ব্যয়|টা|টি|ডিলিট|মুছে|মুছ|delete|remove|ক্লিয়ার|বাতিল|cancel|বাদ|ফেলে|করে|দাও|করো|দিন|dao|daw|koro|kore)/gi, '')
                .trim();

              if (cleanedQuery.length >= 2) {
                const targetDate = expContext?.targetDate || new Date();
                const result = await deleteExpenseByTitle(user._id, targetDate, cleanedQuery);
                if (result) {
                  if (result.remainingCount > 0) {
                    userExpenseContext.set(user._id.toString(), {
                      targetDate,
                      dateLabelBn: expContext?.dateLabelBn || 'আজকের',
                      expenses: result.remainingExpenses.map(e => ({ id: e._id.toString(), title: e.title, amount: e.amount })),
                      expiresAt: Date.now() + 15 * 60 * 1000
                    });
                  } else {
                    userExpenseContext.delete(user._id.toString());
                  }
                  const reply = buildExpenseDeletedMessage(
                    result.deletedExpense.title,
                    result.deletedExpense.amount,
                    result.dateTotal,
                    result.monthTotal,
                    expContext?.dateLabelBn || 'আজকের'
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                  return;
                }
              }

              // 4. Context is active and user sent generic delete command (like "delete kore daw" in the screenshot)
              if (isExpContextActive && expContext) {
                if (expContext.expenses.length === 1) {
                  const result = await deleteExpenseByIndex(user._id, expContext.targetDate, 1);
                  if (result) {
                    userExpenseContext.delete(user._id.toString());
                    const reply = buildExpenseDeletedMessage(
                      result.deletedExpense.title,
                      result.deletedExpense.amount,
                      result.dateTotal,
                      result.monthTotal,
                      expContext.dateLabelBn
                    );
                    await sendMetaWhatsAppMessage(fromNumber, reply);
                    return;
                  }
                } else if (expContext.expenses.length > 1) {
                  const choiceReply = buildExpenseDeleteChoiceMessage(expContext.expenses, expContext.dateLabelBn);
                  await sendMetaWhatsAppMessage(fromNumber, choiceReply);
                  return;
                }
              }

              // 5. Explicit "last expense" delete without active context
              if (hasExplicitExpense && /(?:last|shesh|লাস্ট|শেষ)/i.test(cleanText)) {
                const result = await deleteLastExpense(user._id);
                if (result) {
                  const reply = buildExpenseDeletedMessage(
                    result.deletedExpense.title,
                    result.deletedExpense.amount,
                    result.dateTotal,
                    result.monthTotal,
                    'আজকের'
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                  return;
                } else {
                  await sendMetaWhatsAppMessage(fromNumber, 'আপনার কোনো খরচের এন্ট্রি পাওয়া যায়নি।');
                  return;
                }
              }
            }
          }

          // 2.9B: Standard Expense Query & Logging
          const parsedExpense = parseExpenseInput(cleanText);
          if (parsedExpense) {
            if (parsedExpense.isQuery) {
              if (parsedExpense.queryType === 'monthly') {
                if (parsedExpense.monthYear) {
                  const mSummary = await getExpenseSummaryForMonth(
                    user._id,
                    parsedExpense.monthYear.year,
                    parsedExpense.monthYear.month,
                    parsedExpense.monthYear.monthLabelBn
                  );
                  const reply = buildMonthlyExpenseQueryMessage(
                    mSummary.monthTotal,
                    mSummary.monthCount,
                    mSummary.categoryBreakdown,
                    mSummary.monthLabelBn
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                } else {
                  const summary = await getExpenseSummary(user._id);
                  const reply = buildMonthlyExpenseQueryMessage(
                    summary.monthTotal,
                    summary.monthCount,
                    summary.categoryBreakdown,
                    'চলতি মাসের'
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                }
              } else {
                // Daily query (Today, Yesterday, Day before yesterday, Specific Date like 10 Oct)
                const targetDate = parsedExpense.targetDate || new Date();
                const dSummary = await getExpenseSummaryForDate(
                  user._id,
                  targetDate,
                  parsedExpense.dateLabelBn || 'আজকের'
                );
                // Save conversation context for follow-up deletions or edits
                userExpenseContext.set(user._id.toString(), {
                  targetDate,
                  dateLabelBn: dSummary.dateLabelBn || 'আজকের',
                  expenses: dSummary.dateExpenses.map(e => ({ id: e._id.toString(), title: e.title, amount: e.amount })),
                  expiresAt: Date.now() + 15 * 60 * 1000
                });
                const reply = buildDailyExpenseQueryMessage(
                  dSummary.dateExpenses,
                  dSummary.dateTotal,
                  dSummary.monthTotal,
                  dSummary.dateLabelBn
                );
                await sendMetaWhatsAppMessage(fromNumber, reply);
              }
              return;
            } else if (parsedExpense.title && parsedExpense.amount) {
              const expDate = parsedExpense.expenseDate || new Date();
              await recordExpense(user._id, parsedExpense.title, parsedExpense.amount, parsedExpense.paymentMethod, expDate);
              const dSummary = await getExpenseSummaryForDate(user._id, expDate, parsedExpense.dateLabelBn || 'আজকের');
              // Save conversation context for follow-up deletions or edits
              userExpenseContext.set(user._id.toString(), {
                targetDate: expDate,
                dateLabelBn: parsedExpense.dateLabelBn || 'আজকের',
                expenses: dSummary.dateExpenses.map(e => ({ id: e._id.toString(), title: e.title, amount: e.amount })),
                expiresAt: Date.now() + 15 * 60 * 1000
              });
              const cat = detectExpenseCategory(parsedExpense.title);
              const reply = buildExpenseLoggedMessage(
                parsedExpense.title,
                parsedExpense.amount,
                cat,
                dSummary.dateTotal,
                dSummary.monthTotal,
                parsedExpense.dateLabelBn
              );
              await sendMetaWhatsAppMessage(fromNumber, reply);
              return;
            }
          }
        }

        // --- STEP 2.10: Udhar / Debt Tracker Fast-Path (0 Cost, Instant Response) ---
        if (!isReminderAction) {
          const parsedDebt = parseDebtInput(cleanText);
          if (parsedDebt) {
            if (parsedDebt.isQuery) {
              if (parsedDebt.queryType === 'person' && parsedDebt.personName) {
                const personSummary = await getPersonDebtSummary(user._id, parsedDebt.personName);
                if (personSummary) {
                  const reply = buildPersonDebtMessage(personSummary);
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                } else {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `👤 *${parsedDebt.personName}*-এর সাথে কোনো আগের ধার-দেনা বা বাকি লেনদেন পাওয়া যায়নি।`
                  );
                }
              } else {
                // Overall summary
                const overallSummary = await getDebtSummary(user._id);
                const reply = buildDebtSummaryMessage(overallSummary);
                await sendMetaWhatsAppMessage(fromNumber, reply);
              }
              return;
            } else if (parsedDebt.isSettlement && parsedDebt.personName && parsedDebt.amount) {
              // Settle repayment / refund
              const settlementResult = await settleDebtByPerson(
                user._id,
                parsedDebt.personName,
                parsedDebt.amount,
                parsedDebt.settlementType || 'received'
              );
              const reply = buildDebtSettledMessage(
                settlementResult.personName,
                settlementResult.settledTotal,
                parsedDebt.settlementType || 'received',
                settlementResult.remainingForPerson
              );
              await sendMetaWhatsAppMessage(fromNumber, reply);
              return;
            } else if (parsedDebt.type && parsedDebt.personName && parsedDebt.amount) {
              // New debt entry (lent or borrowed)
              const savedDebt = await recordDebt(
                user._id,
                parsedDebt.personName,
                parsedDebt.amount,
                parsedDebt.type,
                { notes: parsedDebt.notes }
              );
              // Calculate updated person balance
              const personSummary = await getPersonDebtSummary(user._id, parsedDebt.personName);
              const remaining = parsedDebt.type === 'lent'
                ? (personSummary?.totalLentRemaining || parsedDebt.amount)
                : (personSummary?.totalBorrowedRemaining || parsedDebt.amount);

              const reply = buildDebtLoggedMessage(
                savedDebt.personName,
                savedDebt.amount,
                savedDebt.type,
                remaining
              );
              await sendMetaWhatsAppMessage(fromNumber, reply);
              return;
            }
          }
        }

        // --- STEP 3: Regular AI Message & Audio Analysis ---
        let aiResponse: any;

        if (isAudio && audioMediaId) {
          console.log(`🎤 Received WhatsApp Voice Note from ${fromNumber}. Downloading audio...`);
          const audioData = await downloadMetaAudio(audioMediaId);
          if (audioData) {
            aiResponse = await analyzeAudioMessage(fromNumber, audioData.buffer, audioData.mimeType, user.honorific);
          } else {
            await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, আপনার ভয়েস মেসেজটি ডাউনলোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
            return;
          }
        } else {
          console.log(`📩 Received WhatsApp Message from ${fromNumber}: "${userMessage}"`);
          aiResponse = await analyzeMessage(fromNumber, userMessage, user.honorific);
        }

        switch (aiResponse.action) {
          case 'create_wish':
            if (aiResponse.data) {
              const wishData = aiResponse.data;
              const recipientPhone = wishData.recipientPhone;
              const occasion = wishData.occasion || 'birthday';
              const occasionTitle = getOccasionTitle(occasion);
              const sendNow = wishData.sendNow !== false;

              if (!recipientPhone) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `দয়া করে যার জন্য ${occasionTitle} কার্ড পাঠাতে চান তার WhatsApp নম্বরটি উল্লেখ করুন (যেমন: "017XXXXXXXX নম্বরে জন্মদিনের শুভেচ্ছা পাঠাও")।`
                );
                break;
              }

              // If recipient name is missing or not provided, ask the user for recipient's name first!
              if (!wishData.recipientName || wishData.needsRecipientName || wishData.recipientName === 'প্রিয়জন') {
                userWishState.set(user._id.toString(), {
                  recipientPhone,
                  occasion,
                  message: wishData.message,
                  date: wishData.date,
                  time: wishData.time,
                  sendNow,
                  waitingForName: true,
                  expiresAt: Date.now() + 30 * 60 * 1000
                });

                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `🎉 আপনি কার জন্য ${occasionTitle} কার্ড পাঠাতে চান? কার্ডে নাম দেখানোর জন্য তার নামটি লিখুন (যেমন: "সুমন" বা "রাহুল")।`
                );
                break;
              }

              const recipientName = wishData.recipientName;
              const message = wishData.message || `শুভ ${occasionTitle}! আপনার জীবন সুন্দর ও আনন্দময় হোক।`;
              const imageUrl = wishData.imageUrl || getOccasionImageUrl(occasion);

              // Generate smart card ID for shareable animation link
              const smartCardId = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

              let scheduledAt = new Date();
              if (!sendNow && wishData.date) {
                const timeStr = wishData.time || '10:00';
                const bdIso = `${wishData.date}T${timeStr}:00+06:00`;
                const parsedDate = new Date(bdIso);
                if (!isNaN(parsedDate.getTime())) {
                  scheduledAt = parsedDate;
                }
              }

              const newWish = await Wish.create({
                userId: user._id,
                recipientName,
                recipientContact: recipientPhone,
                occasion,
                message,
                isSmartCard: true,
                smartCardId,
                cardData: {
                  image: imageUrl,
                  title: occasionTitle,
                  senderName: user.name || 'আপনার শুভাকাঙ্ক্ষী',
                  animation: 'envelope'
                },
                scheduledAt,
                deliveryMethod: ['WhatsApp'],
                status: sendNow ? 'Sent' : 'Scheduled'
              });

              if (sendNow && recipientPhone) {
                // Send wish card image to the recipient immediately!
                await deliverWishCard(newWish, user.name || 'আপনার শুভাকাঙ্ক্ষী');
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  aiResponse.replyText || `🎉 ${recipientPhone} নম্বরে ${recipientName}-র জন্য ${occasionTitle} কার্ড ও বার্তা সফলভাবে পাঠিয়ে দেওয়া হয়েছে!`
                );
              } else {
                // Scheduled for future delivery by reminderScheduler
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  aiResponse.replyText || `🎉 ঠিক আছে! নির্ধারিত সময়ে ${recipientPhone || ''} নম্বরে ${occasionTitle} কার্ড স্বয়ংক্রিয়ভাবে পাঠিয়ে দেওয়া হবে।`
                );
              }
            }
            break;

          case 'list_reminders': {
            const isToday = aiResponse.data?.filter === 'today';
            const queryFilter: any = {
              userId: user._id,
              status: 'Pending'
            };

            if (isToday) {
              const dhakaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
              const todayStart = new Date(`${dhakaDateStr}T00:00:00.000+06:00`);
              const todayEnd = new Date(`${dhakaDateStr}T23:59:59.999+06:00`);
              queryFilter.date = { $gte: todayStart, $lte: todayEnd };
            }

            const reminders = await Reminder.find(queryFilter).sort({ date: 1, time: 1 });

            if (reminders.length === 0) {
              if (isToday) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  '📋 আজ আপনার কোনো পেন্ডিং রিমাইন্ডার নেই।\n\nনতুন রিমাইন্ডার সেট করতে বার্তা পাঠান (যেমন: "আজ বিকাল ৫টায় মিটিং রিমাইন্ডার")।'
                );
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  '📋 আপনার বর্তমানে কোনো পেন্ডিং রিমাইন্ডার নেই।\n\nনতুন রিমাইন্ডার সেট করতে বার্তা পাঠান (যেমন: "কাল সকাল ১০টায় মিটিং রিমাইন্ডার")।'
                );
              }
            } else {
              const headerTitle = isToday
                ? `📋 আজ আপনার *${reminders.length}টি* পেন্ডিং রিমাইন্ডার রয়েছে:`
                : `📋 আপনার মোট *${reminders.length}টি* পেন্ডিং রিমাইন্ডার রয়েছে:`;

              let text = `${headerTitle}\n\n`;
              reminders.forEach((r, idx) => {
                const dStr = r.date ? new Date(r.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '';
                const timeStr = formatTime12Hour(r.time);
                text += `${idx + 1}. 📌 *${r.title}*\n   ⏰ সময়: ${timeStr} (${dStr})\n\n`;
              });
              text += `💡 *এডিট বা ডিলিট করতে:* নম্বর দিয়ে বলুন (যেমন: "১ নম্বর সময় ৫টায় দাও" বা "২ নম্বর ডিলিট করো")`;
              await sendMetaWhatsAppMessage(fromNumber, text.trim());
            }
            break;
          }

          case 'modify_reminder': {
            const data = aiResponse.data || {};
            const itemIndex = typeof data.index === 'number' ? data.index : undefined;
            const query = (data.searchQuery || '').trim();

            if (!data.time && !data.date && !data.newTitle) {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `✏️ আপনি এই রিমাইন্ডারে কী পরিবর্তন করতে চান বলুন (যেমন: "নতুন সময় বিকাল ৫টায় দাও" বা "কালকের বদলে পরশু দাও")।`
              );
              break;
            }

            const updateFields: any = {};
            if (data.time) updateFields.time = data.time;
            if (data.date) updateFields.date = new Date(data.date);
            if (data.newTitle) updateFields.title = data.newTitle.trim();
            updateFields.status = 'Pending';

            let updatedReminder = null;

            if (itemIndex !== undefined) {
              const pendingReminders = await Reminder.find({ userId: user._id, status: 'Pending' }).sort({ date: 1, time: 1 });
              let target = null;
              if (itemIndex === -1 && pendingReminders.length > 0) {
                target = pendingReminders[pendingReminders.length - 1];
              } else if (itemIndex >= 1 && itemIndex <= pendingReminders.length) {
                target = pendingReminders[itemIndex - 1];
              }

              if (target) {
                updatedReminder = await Reminder.findByIdAndUpdate(target._id, updateFields, { new: true });
                if (updatedReminder) {
                  const dStr = updatedReminder.date ? new Date(updatedReminder.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '';
                  const formattedTime = formatTime12Hour(updatedReminder.time);
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `✏️ আপনার ${itemIndex === -1 ? 'সর্বশেষ' : itemIndex + ' নম্বর'} রিমাইন্ডার "${updatedReminder.title}" সফলভাবে আপডেট করা হয়েছে!\n⏰ নতুন সময়: ${formattedTime} (${dStr})`
                  );
                  break;
                }
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `দুঃখিত, ${itemIndex} নম্বরে কোনো পেন্ডিং রিমাইন্ডার খুঁজে পাওয়া যায়নি।`
                );
                break;
              }
            }

            if (query) {
              updatedReminder = await Reminder.findOneAndUpdate(
                {
                  userId: user._id,
                  title: { $regex: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
                },
                updateFields,
                { new: true }
              );

              if (updatedReminder) {
                const dStr = updatedReminder.date ? new Date(updatedReminder.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '';
                const formattedTime = formatTime12Hour(updatedReminder.time);
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `✏️ "${updatedReminder.title}" রিমাইন্ডারটি সফলভাবে আপডেট করা হয়েছে!\n⏰ নতুন সময়: ${formattedTime} (${dStr})`
                );
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `দুঃখিত, "${query}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`
                );
              }
            } else {
              await sendMetaWhatsAppMessage(
                fromNumber,
                'কোন রিমাইন্ডারটি এবং কী পরিবর্তন করতে চান তা উল্লেখ করুন (যেমন: "১ নম্বরটা বিকাল ৫টায় দাও" বা "মিটিং ৫টায় দাও")।'
              );
            }
            break;
          }

          case 'delete_all_reminders': {
            const hasExplicitReminder = /(?:রিমাইন্ডার|reminder|অ্যালার্ম|alarm)/i.test(cleanText);
            const hasAllWord = /(?:সব|সকল|all|sob|shob)/i.test(cleanText);

            // Safety Guard: NEVER delete all reminders on generic phrases without explicit reminder mention
            if (!hasExplicitReminder || !hasAllWord) {
              const expContext = userExpenseContext.get(user._id.toString());
              if (expContext && expContext.expiresAt > Date.now() && expContext.expenses.length > 0) {
                if (expContext.expenses.length === 1) {
                  const result = await deleteExpenseByIndex(user._id, expContext.targetDate, 1);
                  if (result) {
                    userExpenseContext.delete(user._id.toString());
                    const reply = buildExpenseDeletedMessage(
                      result.deletedExpense.title,
                      result.deletedExpense.amount,
                      result.dateTotal,
                      result.monthTotal,
                      expContext.dateLabelBn
                    );
                    await sendMetaWhatsAppMessage(fromNumber, reply);
                    break;
                  }
                } else {
                  const choiceReply = buildExpenseDeleteChoiceMessage(expContext.expenses, expContext.dateLabelBn);
                  await sendMetaWhatsAppMessage(fromNumber, choiceReply);
                  break;
                }
              }

              await sendMetaWhatsAppMessage(
                fromNumber,
                '⚠️ আপনি কী ডিলিট করতে চান অনুগ্রহ করে স্পষ্ট করে বলুন (যেমন: "সব রিমাইন্ডার ডিলিট করো", "১ নম্বর রিমাইন্ডার ডিলিট করো" বা "১ নম্বর খরচ ডিলিট করো")।'
              );
              break;
            }

            const count = await Reminder.countDocuments({ userId: user._id });
            if (count === 0) {
              await sendMetaWhatsAppMessage(fromNumber, 'আপনার বর্তমানে কোনো রিমাইন্ডার সেভ করা নেই।');
            } else {
              await Reminder.deleteMany({ userId: user._id });
              await sendMetaWhatsAppMessage(fromNumber, `🗑️ আপনার সব (${enToBnDigits(count)}টি) রিমাইন্ডার সফলভাবে মুছে ফেলা হয়েছে!`);
            }
            break;
          }

          case 'create_reminder':
            if (aiResponse.data) {
              const cleanTitle = (aiResponse.data.title || 'নতুন রিমাইন্ডার').trim();
              const customMsg = aiResponse.data.customMessage || aiResponse.data.description || '';

              // Safety Guard: If title or user message mentions expense/khoroc and no wake-up/alarm command, treat as expense query
              if (/(?:খরচ|khoroc|khoros|expense)/i.test(cleanTitle + ' ' + userMessage) && !/মনে|ডাক|তুলে|alarm|wake/i.test(userMessage)) {
                console.log(`[SafetyGuard] Redirecting misclassified expense query away from create_reminder: "${userMessage}"`);
                const summary = await getExpenseSummaryForDate(user._id, new Date(), 'আজকের');
                const reply = buildDailyExpenseQueryMessage(summary.dateExpenses, summary.dateTotal, summary.monthTotal, 'আজকের');
                await sendMetaWhatsAppMessage(fromNumber, reply);
                break;
              }

              const sendNow = !!aiResponse.data.sendNow;
              const reminderDate = new Date(aiResponse.data.date || new Date());
              let reminderTime = aiResponse.data.time || '10:00';
              let formattedTime = formatTime12Hour(reminderTime);

              // 1. Gather all target recipients (Multi-contact broadcast support)
              const resolvedRecipients: Array<{ name: string; phone: string }> = [];
              const notFoundNames: string[] = [];

              if (aiResponse.data.broadcastAll) {
                // Broadcast to all saved contacts
                const allContacts = await Contact.find({ userId: user._id, phone: { $exists: true, $ne: '' } });
                for (const c of allContacts) {
                  if (c.phone) {
                    const cleanP = c.phone.replace(/[\s\-\(\)]/g, '');
                    if (cleanP && !resolvedRecipients.some(r => r.phone === cleanP)) {
                      resolvedRecipients.push({ name: c.name, phone: cleanP });
                    }
                  }
                }

                if (resolvedRecipients.length === 0) {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    '⚠️ আপনার কনট্যাক্ট লিস্টে কোনো সংরক্ষিত নম্বর পাওয়া যায়নি। আগে কন্ট্যাক্ট সেভ করুন:\n"রনির নম্বর সেভ করো: 017XXXXXXXX"'
                  );
                  break;
                }
              } else {
                // Collect explicit phones
                const rawPhones: string[] = [];
                if (aiResponse.data.recipientPhone) rawPhones.push(aiResponse.data.recipientPhone);
                if (Array.isArray(aiResponse.data.recipientPhones)) {
                  rawPhones.push(...aiResponse.data.recipientPhones);
                }

                for (const p of rawPhones) {
                  const cleanP = p.replace(/[\s\-\(\)]/g, '');
                  if (cleanP && !resolvedRecipients.some(r => r.phone === cleanP)) {
                    resolvedRecipients.push({ name: cleanP, phone: cleanP });
                  }
                }

                // Collect names from recipientNames array or single recipientName
                const namesToLookup: string[] = [];
                if (Array.isArray(aiResponse.data.recipientNames)) {
                  namesToLookup.push(...aiResponse.data.recipientNames);
                } else if (aiResponse.data.recipientName) {
                  namesToLookup.push(...aiResponse.data.recipientName.split(/[,&]|\s+(?:and|ar|আর|ও|এবং)\s+/i));
                } else if (aiResponse.data.title?.includes('মেসেজ পাঠানো (')) {
                  const inTitle = aiResponse.data.title.match(/মেসেজ\s*পাঠানো\s*\(([^)]+)\)/)?.[1];
                  if (inTitle) namesToLookup.push(...inTitle.split(/[,&]|\s+(?:and|ar|আর|ও|এবং)\s+/i));
                }

                for (const rawN of namesToLookup) {
                  const cleanedName = cleanPersonName(rawN).name;
                  if (!cleanedName || cleanedName.length < 2) continue;

                  const matchedContact = await Contact.findOne({
                    userId: user._id,
                    $or: [
                      { name: { $regex: new RegExp(`^${cleanedName}$`, 'i') } },
                      { nickname: { $regex: new RegExp(`^${cleanedName}$`, 'i') } },
                      { name: { $regex: new RegExp(cleanedName, 'i') } }
                    ]
                  });

                  if (matchedContact && matchedContact.phone) {
                    const cleanP = matchedContact.phone.replace(/[\s\-\(\)]/g, '');
                    if (cleanP && !resolvedRecipients.some(r => r.phone === cleanP)) {
                      resolvedRecipients.push({ name: matchedContact.name, phone: cleanP });
                    }
                  } else {
                    if (!notFoundNames.includes(cleanedName)) {
                      notFoundNames.push(cleanedName);
                    }
                  }
                }
              }

              // 2. If recipients were expected but none could be resolved:
              if (notFoundNames.length > 0 && resolvedRecipients.length === 0) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `⚠️ আপনার কনট্যাক্ট লিস্টে "${notFoundNames.join(', ')}" নামে কোনো নম্বর খুঁজে পাওয়া যায়নি।\n\n💡 আগে নম্বরটি সেভ করুন:\n"রনির নম্বর সেভ করো: 017XXXXXXXX"\nঅথবা সরাসরি নম্বর দিয়ে মেসেজ পাঠান (যেমন: "017XXXXXXXX নম্বরে মেসেজ দাও...")`
                );
                break;
              }

              // 3. If there are resolved recipients (Multi or Single Contact Message):
              if (resolvedRecipients.length > 0) {
                const senderName = user.name || 'আপনার পরিচিত জন';
                const senderNumber = user.whatsapp || user.mobile || '';

                // Check if message content qualifies as an allowed formal category for unregistered numbers
                const combinedText = `${cleanTitle || ''} ${customMsg || ''} ${cleanText || ''}`.toLowerCase();
                const isAllowedForUnregistered = /মিটিং|meeting|অ্যাপয়েন্টমেন্ট|appointment|অনুষ্ঠান|event|দাওয়াত|dawat|ইনভাইটেশন|invitation|কনফারেন্স|conference|বিয়ে|biye|সেমিনার|seminar|শুভেচ্ছা|wish|শুভ|ঈদ|eid|birthday|জন্মদিন/.test(combinedText);

                const allowedRecipients: Array<{ name: string; phone: string; isRegistered: boolean }> = [];
                const blockedRecipients: Array<{ name: string; phone: string }> = [];

                for (const target of resolvedRecipients) {
                  const cleanTargetPhone = target.phone.replace(/\D/g, '');
                  const shortTargetPhone = cleanTargetPhone.length > 10 ? cleanTargetPhone.slice(-10) : cleanTargetPhone;
                  const recipientUser = await User.findOne({
                    $or: [
                      { whatsapp: { $regex: new RegExp(shortTargetPhone + '$') } },
                      { mobile: { $regex: new RegExp(shortTargetPhone + '$') } }
                    ]
                  });

                  if (!recipientUser && !isAllowedForUnregistered) {
                    blockedRecipients.push(target);
                  } else {
                    allowedRecipients.push({ ...target, isRegistered: !!recipientUser });
                  }
                }

                // If all recipients are unregistered and message is NOT an allowed category (meeting/wish/event):
                if (allowedRecipients.length === 0 && blockedRecipients.length > 0) {
                  const blockedList = blockedRecipients.map(b => `*${b.name}* (${b.phone})`).join(', ');
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `⚠️ দুঃখিত! ${blockedList} নম্বরটি স্মৃতি লাইফে এখনও নিবন্ধিত (Registered) নয়।\n\nনিরাপত্তা ও অ্যান্টি-স্প্যাম পলিসি অনুযায়ী, অনিবন্ধিত নম্বরে শুধুমাত্র নির্ধারিত বার্তা (যেমন: মিটিং রিমাইন্ডার, শুভেচ্ছা বার্তা/উইশ বা অনুষ্ঠান) পাঠানো সম্ভব।\n\n💡 তাকে স্মৃতি লাইফে রেজিস্ট্রেশন করতে বলতে পারেন:\nhttps://smritilife.com/auth`
                  );
                  break;
                }

                for (const target of allowedRecipients) {
                  // If sendNow is true, dispatch message immediately via WhatsApp
                  if (sendNow && customMsg) {
                    let promoSection = '';
                    if (!target.isRegistered) {
                      promoSection = `\n\n✨ আপনিও কি স্মৃতি লাইফ (Smriti Life) ব্যবহার করে স্বয়ংক্রিয় রিমাইন্ডার ও বার্তা পাঠাতে চান?\nরেজিস্ট্রেশন করুন: https://smritilife.com/auth`;
                    }
                    const thirdPartyAlert = `🔔 আসসালামু আলাইকুম!\n\n${senderName} (${senderNumber}) আপনাকে একটি বার্তা পাঠিয়েছেন:\n\n💬 "${customMsg}"\n\n(বার্তাটি স্মৃতি লাইফ প্ল্যাটফর্মের মাধ্যমে স্বয়ংক্রিয়ভাবে প্রেরিত)${promoSection}`;
                    await sendMetaWhatsAppMessage(target.phone, thirdPartyAlert);
                  }

                  // Record in Reminder collection
                  await Reminder.create({
                    userId: user._id,
                    title: `মেসেজ পাঠানো (${target.name})`,
                    description: customMsg,
                    recipientPhone: target.phone,
                    date: reminderDate,
                    time: reminderTime,
                    priority: 'Medium',
                    category: isAllowedForUnregistered ? 'meeting' : 'message',
                    repeat: 'Once',
                    status: sendNow ? 'Completed' : 'Pending'
                  });
                }

                // Compose confirmation message to sender
                const count = allowedRecipients.length;
                let replyMsg = '';
                if (sendNow) {
                  replyMsg = `✅ আপনার কনট্যাক্ট লিস্ট থেকে ${count} জনকে এখনই বার্তাটি সফলভাবে পাঠিয়ে দেওয়া হয়েছে:\n\n`;
                } else {
                  replyMsg = `✅ আপনার কনট্যাক্ট লিস্ট থেকে ${count} জনকে সময় ${formattedTime}-এ বার্তা পাঠানোর শিডিউল সেট করা হয়েছে:\n\n`;
                }

                allowedRecipients.forEach((r, idx) => {
                  replyMsg += `${idx + 1}. 👤 *${r.name}* (${r.phone})${r.isRegistered ? ' [স্মৃতি ইউজার]' : ''}\n`;
                });

                if (customMsg) {
                  replyMsg += `\n💬 বার্তা: "${customMsg}"`;
                }

                if (blockedRecipients.length > 0) {
                  const blockedNames = blockedRecipients.map(b => `${b.name} (${b.phone})`).join(', ');
                  replyMsg += `\n\n⚠️ দ্রষ্টব্য: ${blockedNames} নম্বরটি স্মৃতি লাইফে নিবন্ধিত না থাকায় বার্তা পাঠানো যায়নি (অনিবন্ধিত নম্বরে শুধুমাত্র মিটিং ও শুভেচ্ছা বার্তা অনুমোদিত)।`;
                }

                if (notFoundNames.length > 0) {
                  replyMsg += `\n\n⚠️ দ্রষ্টব্য: "${notFoundNames.join(', ')}" নামে কোনো নম্বর আপনার কন্ট্যাক্ট লিস্টে পাওয়া যায়নি।`;
                }

                await sendMetaWhatsAppMessage(fromNumber, replyMsg.trim());
              } else {
                // 4. Regular self-reminder
                const isMedicine = aiResponse.data.category === 'medicine' || 
                                   /ওষুধ|ঔষধ|মেডিসিন|tablet|medicine|capsule|নাপা|গ্যাস্ট্রিক|প্যারাসিটামল|প্রেসার|ডায়াবেটিস/i.test(cleanTitle) ||
                                   /ওষুধ|ঔষধ|মেডিসিন|tablet|medicine|capsule|নাপা|গ্যাস্ট্রিক|প্যারাসিটামল|প্রেসার|ডায়াবেটিস/i.test(customMsg || '') ||
                                   /ওষুধ|ঔষধ|মেডিসিন|tablet|medicine|capsule|নাপা|গ্যাস্ট্রিক|প্যারাসিটামল|প্রেসার|ডায়াবেটিস/i.test(cleanText);

                const isMonthly = /প্রতি\s*মাসের?|প্রতিমাস|মাসিক|monthly|every\s*month|poti\s*mas|proti\s*mas|poti\s*mash|proti\s*mash/i.test(cleanText) ||
                                  aiResponse.data.repeat === 'Monthly';

                const isWeekly = /প্রতি\s*সপ্তাহ|সাপ্তাহিক|weekly|every\s*week|protisoptaho|proti\s*shoptaho/i.test(cleanText) ||
                                 aiResponse.data.repeat === 'Weekly';

                const isDaily = (!isMonthly && !isWeekly) && (isMedicine || 
                                /প্রতিদিন|দৈনিক|রোজ|রোজই|daily|everyday|every\s*day|protidin|potidin|roj|sob\s*din|shob\s*din/i.test(cleanText) ||
                                aiResponse.data.repeat === 'Daily');

                const isSehri = /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(cleanTitle) ||
                                /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(cleanText);

                const isWakeup = isSehri || aiResponse.data.category === 'wakeup' || aiResponse.data.category === 'alarm' || /ঘুম|ঘুমের|ঘুমিয়ে|ঘুমাবো|ঘুমাব|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|ডেকে|ডাকা|ডেকে দিও|ডেকে দাও|ডাকবা|উঠাবা|ঘুম ভাঙা|ঘুম ভাঙ্গানি/i.test(cleanTitle) || /ঘুম|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|ডেকে|ঘুম ভাঙা/i.test(cleanText);
                const finalCategory = isMedicine ? 'medicine' : (isWakeup ? 'wakeup' : (aiResponse.data.category || 'General'));
                const finalRepeat = isMonthly ? 'Monthly' : (isWeekly ? 'Weekly' : (isDaily ? 'Daily' : (aiResponse.data.repeat || 'Once')));

                let finalTitle = cleanTitle;
                if (isSehri && (!finalTitle || /^(সেহরি|সাহরি|রমজান|romjan|sahari|sehri)$/i.test(finalTitle.trim()) || finalTitle.length < 5)) {
                  finalTitle = 'সেহরির জন্য ঘুম থেকে ওঠা 🌙';
                }

                // Default Sehri time to 04:00 AM if no time was explicitly mentioned
                if (isSehri && reminderTime === '10:00' && !cleanText.match(/\b(?:10|১০)\b/)) {
                  reminderTime = '04:00';
                  formattedTime = '04:00 AM';
                }

                // 1. Detect if user explicitly stated a date, day of week, or relative day/duration in their text
                const hasDateOrDay = hasExplicitDateOrDay(cleanText);

                // 2. If no date/day/duration was mentioned, and it's a one-time general reminder (not recurring, not alarm/sehri, not immediate send):
                if (!hasDateOrDay && finalRepeat === 'Once' && !isWakeup && !isSehri && !sendNow && !aiResponse.data?.relativeMinutes) {
                  userPendingReminderState.set(user._id.toString(), {
                    title: finalTitle,
                    time: reminderTime,
                    formattedTime,
                    category: finalCategory,
                    customMessage: customMsg,
                    expiresAt: Date.now() + 15 * 60 * 1000
                  });

                  const isEng = isPureEnglishText(cleanText);
                  const askDateMsg = isEng
                    ? `⏰ Got it! The time is set to *${formattedTime}* for: *"${finalTitle}"*.\n\n📅 Which date or day would you like to set this reminder for?\n(e.g., *Today*, *Tomorrow*, *Next Sunday*, or *18 October*)`
                    : `⏰ আপনার *"${finalTitle}"* রিমাইন্ডারের সময় *${formattedTime}* পেয়েছি।\n\n📅 কিন্তু আপনি এটি **কোন দিন বা কোন বারে** সেট করতে চান?\n(যেমন লিখে জানান: *আজকে*, *আগামীকাল*, *আগামী রবিবার*, বা *১৮ তারিখ*)`;

                  await sendMetaWhatsAppMessage(fromNumber, askDateMsg);
                  break;
                }

                // 3. Calculate accurate target date using our enhanced weekday & date parser:
                let calculatedDate = hasDateOrDay ? parseRelativeDate(cleanText, reminderTime) : reminderDate;

                if (isMonthly) {
                  const bnToEnMap: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                  const textNormalized = cleanText.replace(/[০-৯]/g, (m) => bnToEnMap[m] || m);
                  const dayMatch = textNormalized.match(/(?:প্রতি\s*মাসের?|poti\s*mas(?:[\s_]*ar)?|proti\s*mas(?:[\s_]*er)?)\s*(\d{1,2})\s*(?:তারিখ|তারিখে|tarik|tarikh|date)?/i) ||
                                   textNormalized.match(/\b(\d{1,2})\s*(?:তারিখ|তারিখে|tarik|tarikh)\b/i);

                  const now = new Date();
                  const dhakaStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
                  const [curYear, curMonth, curDay] = dhakaStr.split('-').map(Number);

                  let targetDay = dayMatch ? parseInt(dayMatch[1], 10) : (reminderDate.getDate() || 1);
                  if (targetDay < 1 || targetDay > 31) targetDay = 1;

                  let targetMonth = curMonth - 1; // 0-indexed in JS Date
                  let targetYear = curYear;

                  // If this month's target day has already passed today, start from next month
                  if (targetDay < curDay) {
                    targetMonth += 1;
                    if (targetMonth > 11) {
                      targetMonth = 0;
                      targetYear += 1;
                    }
                  }

                  calculatedDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0));
                }

                await Reminder.create({
                  userId: user._id,
                  title: finalTitle,
                  description: customMsg,
                  date: calculatedDate,
                  time: reminderTime,
                  priority: 'Medium',
                  category: finalCategory,
                  repeat: finalRepeat,
                  status: 'Pending',
                  isAlarm: isWakeup
                });

                let reply = '';
                if (isSehri) {
                  const repeatStr = finalRepeat === 'Daily' ? 'প্রতিদিন ' : '';
                  reply = `🌙🔔 আপনার সেহরি ওয়েক-আপ অ্যালার্ম "${finalTitle}" ${repeatStr}ভোর ${formattedTime}-এ সফলভাবে সেট করা হয়েছে! নির্ধারিত সময়ে আপনাকে ঘুম থেকে তোলার জন্য উচ্চশব্দে রিং অ্যালার্ম বাজবে।`;
                } else {
                  const icon = isMedicine ? '💊' : (isWakeup ? '⏰🔔' : '⏰');
                  let repeatStr = '';
                  let dateInfo = '';

                  if (finalRepeat === 'Daily') {
                    repeatStr = 'প্রতিদিন ';
                  } else if (finalRepeat === 'Weekly') {
                    const weekdayName = calculatedDate.toLocaleDateString('bn-BD', { weekday: 'long', timeZone: 'Asia/Dhaka' });
                    repeatStr = `প্রতি সপ্তাহে (${weekdayName}) `;
                  } else if (finalRepeat === 'Monthly') {
                    const dNum = calculatedDate.getDate();
                    const dBn = dNum.toString().replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]);
                    repeatStr = `প্রতি মাসের ${dBn} তারিখে `;
                    const firstDateBn = calculatedDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
                    dateInfo = `\n📅 *প্রথম রিমাইন্ডার:* ${firstDateBn}\n\n💡 স্মৃতি প্রতি মাসের নির্ধারিত তারিখে স্বয়ংক্রিয়ভাবে আপনাকে মনে করিয়ে দেবে।`;
                  } else {
                    const dateBn = calculatedDate.toLocaleDateString('bn-BD', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Asia/Dhaka'
                    });
                    dateInfo = `\n📅 *তারিখ:* ${dateBn}`;
                  }

                  reply = `${icon} আপনার ${isMedicine ? 'ওষুধের ' : (isWakeup ? 'ওয়েক-আপ অ্যালার্ম ' : '')}রিমাইন্ডার *"${finalTitle}"* ${repeatStr}সময় *${formattedTime}*-এ সফলভাবে সেট করা হয়েছে!${dateInfo}`;
                }

                await sendMetaWhatsAppMessage(fromNumber, reply);
              }
            }
            break;

          case 'cancel_reminder': {
            const data = aiResponse.data || {};
            const itemIndex = typeof data.index === 'number' ? data.index : undefined;
            const query = (data.searchQuery || '').trim();

            let reminderToCancel = null;

            if (itemIndex !== undefined) {
              const pendingReminders = await Reminder.find({ userId: user._id, status: 'Pending' }).sort({ date: 1, time: 1 });
              if (itemIndex === -1 && pendingReminders.length > 0) {
                reminderToCancel = pendingReminders[pendingReminders.length - 1];
              } else if (itemIndex >= 1 && itemIndex <= pendingReminders.length) {
                reminderToCancel = pendingReminders[itemIndex - 1];
              }

              if (reminderToCancel) {
                reminderToCancel.status = 'Cancelled';
                await reminderToCancel.save();
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `⚠️ আপনার ${itemIndex === -1 ? 'সর্বশেষ' : itemIndex + ' নম্বর'} রিমাইন্ডার "${reminderToCancel.title}" সফলভাবে বাতিল (Cancel) করা হয়েছে।`
                );
                break;
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `দুঃখিত, ${itemIndex} নম্বরে কোনো পেন্ডিং রিমাইন্ডার খুঁজে পাওয়া যায়নি।`
                );
                break;
              }
            }

            if (query) {
              reminderToCancel = await Reminder.findOneAndUpdate(
                { 
                  userId: user._id, 
                  title: { $regex: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                  status: { $ne: 'Cancelled' }
                },
                { status: 'Cancelled' },
                { new: true }
              );
              if (reminderToCancel) {
                await sendMetaWhatsAppMessage(fromNumber, `⚠️ "${reminderToCancel.title}" রিমাইন্ডারটি সফলভাবে বাতিল (Cancel) করা হয়েছে।`);
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${query}" নামের কোনো সক্রিয় রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি বাতিল করতে চান তার নম্বর বা নাম উল্লেখ করুন (যেমন: "১ নম্বরটা ক্যান্সেল করো")।');
            }
            break;
          }

          case 'delete_reminder': {
            const data = aiResponse.data || {};
            const itemIndex = typeof data.index === 'number' ? data.index : undefined;
            const query = (data.searchQuery || '').trim();

            let reminderToDelete = null;

            if (itemIndex !== undefined) {
              const pendingReminders = await Reminder.find({ userId: user._id, status: 'Pending' }).sort({ date: 1, time: 1 });
              if (itemIndex === -1 && pendingReminders.length > 0) {
                reminderToDelete = pendingReminders[pendingReminders.length - 1];
              } else if (itemIndex >= 1 && itemIndex <= pendingReminders.length) {
                reminderToDelete = pendingReminders[itemIndex - 1];
              }

              if (reminderToDelete) {
                await Reminder.findByIdAndDelete(reminderToDelete._id);
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `🗑️ আপনার ${itemIndex === -1 ? 'সর্বশেষ' : itemIndex + ' নম্বর'} রিমাইন্ডার "${reminderToDelete.title}" সফলভাবে ডিলিট করা হয়েছে!`
                );
                break;
              } else {
                // If not found in reminders, check if user was referring to expense in active context
                const expContext = userExpenseContext.get(user._id.toString());
                if (expContext && expContext.expiresAt > Date.now()) {
                  const result = await deleteExpenseByIndex(user._id, expContext.targetDate, itemIndex);
                  if (result) {
                    if (result.remainingCount > 0) {
                      userExpenseContext.set(user._id.toString(), {
                        targetDate: expContext.targetDate,
                        dateLabelBn: expContext.dateLabelBn,
                        expenses: result.remainingExpenses.map(e => ({ id: e._id.toString(), title: e.title, amount: e.amount })),
                        expiresAt: Date.now() + 15 * 60 * 1000
                      });
                    } else {
                      userExpenseContext.delete(user._id.toString());
                    }
                    const reply = buildExpenseDeletedMessage(
                      result.deletedExpense.title,
                      result.deletedExpense.amount,
                      result.dateTotal,
                      result.monthTotal,
                      expContext.dateLabelBn
                    );
                    await sendMetaWhatsAppMessage(fromNumber, reply);
                    break;
                  }
                }
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `দুঃখিত, ${itemIndex} নম্বরে কোনো পেন্ডিং রিমাইন্ডার পাওয়া যায়নি।`
                );
                break;
              }
            }

            if (query) {
              reminderToDelete = await Reminder.findOneAndDelete({
                userId: user._id,
                title: { $regex: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
              });
              if (reminderToDelete) {
                await sendMetaWhatsAppMessage(fromNumber, `🗑️ "${reminderToDelete.title}" রিমাইন্ডারটি সফলভাবে ডিলিট করা হয়েছে।`);
              } else {
                // Check if query matches an expense
                const expResult = await deleteExpenseByTitle(user._id, new Date(), query);
                if (expResult) {
                  const reply = buildExpenseDeletedMessage(
                    expResult.deletedExpense.title,
                    expResult.deletedExpense.amount,
                    expResult.dateTotal,
                    expResult.monthTotal,
                    'আজকের'
                  );
                  await sendMetaWhatsAppMessage(fromNumber, reply);
                  break;
                }
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${query}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি ডিলিট করতে চান তার নম্বর বা নাম উল্লেখ করুন (যেমন: "১ নম্বরটা ডিলিট করো")।');
            }
            break;
          }

          case 'manage_todolist': {
            const data = aiResponse.data || {};
            const type = data.type || 'create';
            let listTitle = (data.title || 'আজকের টু-ডু').trim();
            const rawItems: string[] = Array.isArray(data.items) ? data.items : [];
            const itemText = data.itemText ? data.itemText.trim() : '';

            let category = 'general';
            if (/বাজার|shopping/i.test(listTitle)) category = 'shopping';
            else if (/আজকের|daily|আজ/i.test(listTitle)) category = 'daily';
            else if (/কাজ|work/i.test(listTitle)) category = 'work';

            let todoList = await TodoList.findOne({
              userId: user._id,
              title: { $regex: new RegExp(listTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
            });

            if (type === 'create') {
              const newItems = rawItems.map(txt => ({
                id: Math.random().toString(36).substring(2, 9),
                text: txt.trim(),
                completed: false
              })).filter(i => i.text.length > 0);

              if (todoList) {
                // If list already exists, update/replace or merge items
                todoList.items = newItems;
                await todoList.save();
              } else {
                todoList = await TodoList.create({
                  userId: user._id,
                  title: listTitle,
                  category,
                  items: newItems
                });
              }

              const remaining = todoList.items.filter(i => !i.completed).length;
              const remainingText = `${remaining}টি বাকি`;
              let listCard = `লিস্ট করে রেখেছি।\n\n`;
              listCard += `📋 *${todoList.title}*   (${remainingText})\n`;
              listCard += `─────────────────\n`;
              todoList.items.forEach(it => {
                const box = it.completed ? '☑️' : '◻️';
                listCard += `${box} ${it.text}\n`;
              });

              const uncheckedItems = todoList.items.filter(i => !i.completed);
              if (uncheckedItems.length > 0) {
                const listId = todoList._id;
                const rows = uncheckedItems.slice(0, 9).map(it => ({
                  id: `todo_toggle_${listId}_${it.id}`,
                  title: `☑️ ${it.text.substring(0, 20)}`,
                  description: 'ট্যাপ করে সম্পন্ন করুন'
                }));
                if (uncheckedItems.length > 1) {
                  rows.push({
                    id: `todo_toggle_${listId}_all`,
                    title: '✅ সবগুলো সম্পন্ন করুন',
                    description: 'একসাথে সব আইটেম টিক দিন'
                  });
                }
                const listSent = await sendMetaWhatsAppListMenu(
                  fromNumber,
                  listCard.trim(),
                  'আইটেম সম্পন্ন করুন 📋',
                  'বাকি থাকা আইটেমসমূহ',
                  rows
                );
                if (!listSent) await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
              } else {
                await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
              }
            } else if (type === 'add_items') {
              const itemsToAdd = rawItems.map(txt => ({
                id: Math.random().toString(36).substring(2, 9),
                text: txt.trim(),
                completed: false
              })).filter(i => i.text.length > 0);

              if (!todoList) {
                todoList = await TodoList.create({
                  userId: user._id,
                  title: listTitle,
                  category,
                  items: itemsToAdd
                });
              } else {
                todoList.items.push(...itemsToAdd);
                await todoList.save();
              }

              const remaining = todoList.items.filter(i => !i.completed).length;
              const remainingText = `${remaining}টি বাকি`;
              let listCard = `*${todoList.title}*-এ যোগ করেছি।\n\n`;
              listCard += `📋 *${todoList.title}*   (${remainingText})\n`;
              listCard += `─────────────────\n`;
              todoList.items.forEach(it => {
                const box = it.completed ? '☑️' : '◻️';
                const textFormatted = it.completed ? `~${it.text}~` : it.text;
                listCard += `${box} ${textFormatted}\n`;
              });

              const uncheckedItems = todoList.items.filter(i => !i.completed);
              if (uncheckedItems.length > 0) {
                const listId = todoList._id;
                const rows = uncheckedItems.slice(0, 9).map(it => ({
                  id: `todo_toggle_${listId}_${it.id}`,
                  title: `☑️ ${it.text.substring(0, 20)}`,
                  description: 'ট্যাপ করে সম্পন্ন করুন'
                }));
                if (uncheckedItems.length > 1) {
                  rows.push({
                    id: `todo_toggle_${listId}_all`,
                    title: '✅ সবগুলো সম্পন্ন করুন',
                    description: 'একসাথে সব আইটেম টিক দিন'
                  });
                }
                const listSent = await sendMetaWhatsAppListMenu(
                  fromNumber,
                  listCard.trim(),
                  'আইটেম সম্পন্ন করুন 📋',
                  'বাকি থাকা আইটেমসমূহ',
                  rows
                );
                if (!listSent) await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
              } else {
                await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
              }
            } else if (type === 'complete_item' && itemText) {
              if (todoList) {
                const matchedItem = todoList.items.find(i => i.text.toLowerCase().includes(itemText.toLowerCase()));
                if (matchedItem) {
                  matchedItem.completed = true;
                  matchedItem.completedAt = new Date();
                  await todoList.save();

                  const remaining = todoList.items.filter(i => !i.completed).length;
                  const remainingText = `${remaining}টি বাকি`;
                  let listCard = `🎉 "${matchedItem.text}" সম্পন্ন হিসেবে মার্ক করা হলো!\n\n`;
                  listCard += `📋 *${todoList.title}*   (${remainingText})\n`;
                  listCard += `─────────────────\n`;
                  todoList.items.forEach(it => {
                    const box = it.completed ? '☑️' : '◻️';
                    const textFormatted = it.completed ? `~${it.text}~` : it.text;
                    listCard += `${box} ${textFormatted}\n`;
                  });

                  const uncheckedItems = todoList.items.filter(i => !i.completed);
                  if (uncheckedItems.length > 0) {
                    const listId = todoList._id;
                    const rows = uncheckedItems.slice(0, 9).map(it => ({
                      id: `todo_toggle_${listId}_${it.id}`,
                      title: `☑️ ${it.text.substring(0, 20)}`,
                      description: 'ট্যাপ করে সম্পন্ন করুন'
                    }));
                    if (uncheckedItems.length > 1) {
                      rows.push({
                        id: `todo_toggle_${listId}_all`,
                        title: '✅ সবগুলো সম্পন্ন করুন',
                        description: 'একসাথে সব আইটেম টিক দিন'
                      });
                    }
                    const listSent = await sendMetaWhatsAppListMenu(
                      fromNumber,
                      listCard.trim(),
                      'আইটেম সম্পন্ন করুন 📋',
                      'বাকি থাকা আইটেমসমূহ',
                      rows
                    );
                    if (!listSent) await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
                  } else {
                    await sendMetaWhatsAppMessage(fromNumber, `${listCard.trim()}\n\n🎉 সব কাজ সম্পন্ন হয়েছে!`);
                  }
                } else {
                  await sendMetaWhatsAppMessage(fromNumber, `লিস্টে "${itemText}" খুঁজে পাওয়া যায়নি।`);
                }
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `আপনার "${listTitle}" নামের কোনো তালিকা পাওয়া যায়নি।`);
              }
            } else {
              // View / List
              if (!todoList || todoList.items.length === 0) {
                const anyList = await TodoList.findOne({ userId: user._id }).sort({ updatedAt: -1 });
                if (anyList && anyList.items.length > 0) {
                  todoList = anyList;
                }
              }

              if (!todoList || todoList.items.length === 0) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `📋 বর্তমানে কোনো টু-ডু বা চেকলিস্ট নেই।\nনতুন লিস্ট তৈরি করতে লিখুন:\n"আজকের টু-ডু লিস্ট করো: কাজ ১, কাজ ২, কাজ ৩"`
                );
              } else {
                const remaining = todoList.items.filter(i => !i.completed).length;
                const remainingText = `${remaining}টি বাকি`;
                let listCard = `📋 *${todoList.title}*   (${remainingText})\n`;
                listCard += `─────────────────\n`;
                todoList.items.forEach(it => {
                  const box = it.completed ? '☑️' : '◻️';
                  const textFormatted = it.completed ? `~${it.text}~` : it.text;
                  listCard += `${box} ${textFormatted}\n`;
                });

                const uncheckedItems = todoList.items.filter(i => !i.completed);
                if (uncheckedItems.length > 0) {
                  const listId = todoList._id;
                  const rows = uncheckedItems.slice(0, 9).map(it => ({
                    id: `todo_toggle_${listId}_${it.id}`,
                    title: `☑️ ${it.text.substring(0, 20)}`,
                    description: 'ট্যাপ করে সম্পন্ন করুন'
                  }));
                  if (uncheckedItems.length > 1) {
                    rows.push({
                      id: `todo_toggle_${listId}_all`,
                      title: '✅ সবগুলো সম্পন্ন করুন',
                      description: 'একসাথে সব আইটেম টিক দিন'
                    });
                  }
                  const listSent = await sendMetaWhatsAppListMenu(
                    fromNumber,
                    listCard.trim(),
                    'আইটেম সম্পন্ন করুন 📋',
                    'বাকি থাকা আইটেমসমূহ',
                    rows
                  );
                  if (!listSent) await sendMetaWhatsAppMessage(fromNumber, listCard.trim());
                } else {
                  await sendMetaWhatsAppMessage(fromNumber, `${listCard.trim()}\n\n🎉 এই তালিকার সব কাজ সম্পন্ন!`);
                }
              }
            }
            break;
          }

          case 'save_location': {
            const data = aiResponse.data || {};
            let title = (data.title || 'সংরক্ষিত লোকেশন').trim();
            let address = (data.address || title).trim();

            const mapQuery = address.toLowerCase().includes('dhaka') || address.includes('ঢাকা') || address.toLowerCase().includes('bangladesh')
              ? address
              : `${address}, Dhaka, Bangladesh`;
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

            const cleanTitleRegex = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            let note = await Note.findOne({ userId: user._id, title: cleanTitleRegex });

            if (note) {
              note.content = `${title}\n${address}\n📍 Google Maps: ${googleMapsUrl}`;
              note.category = 'Location';
              note.type = 'Location';
              note.location = { address, mapUrl: googleMapsUrl };
              await note.save();
            } else {
              note = await Note.create({
                userId: user._id,
                title,
                content: `${title}\n${address}\n📍 Google Maps: ${googleMapsUrl}`,
                category: 'Location',
                type: 'Location',
                location: { address, mapUrl: googleMapsUrl }
              });
            }

            const salutation = user.honorific ? ` ${user.honorific}` : '';
            const cardBody = `📍 আসসালামু আলাইকুম${salutation}!\nআপনার "${title}" লোকেশনটি সফলভাবে স্মৃতিতে সংরক্ষণ করে রেখেছি।\n\n🗺️ ঠিকানা: ${address}\n\n💡 পরবর্তীতে এই লোকেশন বা ম্যাপ পেতে লিখুন:\n"${title} দাও" বা "সব লোকেশন দেখাও"`;

            const sent = await sendMetaWhatsAppCtaUrl(
              fromNumber,
              cardBody,
              'ম্যাপ ওপেন করুন 🗺️',
              googleMapsUrl,
              `📍 ${title.substring(0, 50)}`,
              'ট্যাপ করে সরাসরি গুগল ম্যাপসে রুট দেখুন'
            );

            if (!sent) {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `${cardBody}\n\n🔗 গুগল ম্যাপস লিঙ্ক:\n${googleMapsUrl}`
              );
            }
            break;
          }

          case 'save_note': {
            const data = aiResponse.data || {};
            let title = (data.title || 'ব্যক্তিগত তথ্য').trim();
            let content = (data.content || '').trim();
            const category = data.category || (/ঠিকানা|address|বাসা|অফিস/i.test(title) ? 'Address' : 'Personal');

            if (!content) {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `কোন তথ্যটি সংরক্ষণ করতে চান তা উল্লেখ করুন (যেমন: "${title}: বাড়ি ১২, রোড ৪, ধানমন্ডি")।`
              );
              break;
            }

            // Check if existing note exists for this user with same or similar title
            const cleanTitleRegex = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            let note = await Note.findOne({ userId: user._id, title: cleanTitleRegex });

            if (note) {
              note.content = content;
              note.category = category;
              await note.save();
              await sendMetaWhatsAppMessage(
                fromNumber,
                `✏️ আপনার *${note.title}* সফলভাবে আপডেট করা হয়েছে!\n\n📍 ${content}\n\n💡 জানতে চাইলে যেকোনো সময় লিখুন: "${note.title} দাও"`
              );
            } else {
              note = await Note.create({
                userId: user._id,
                title,
                content,
                category,
                type: 'Personal'
              });
              await sendMetaWhatsAppMessage(
                fromNumber,
                `💾 আপনার *${title}* স্মৃতিতে সংরক্ষণ করে রেখেছি!\n\n📍 ${content}\n\n💡 পরবর্তীতে জানতে চাইলে যেকোনো সময় লিখুন: "${title} দাও"`
              );
            }
            break;
          }

          case 'get_note': {
            const data = aiResponse.data || {};
            let query = (data.searchQuery || '').trim();

            // If asking for all notes
            if (!query || query === 'সব' || /সব|সকল|all|নোটগুলো|নোটগুলা|নোট\s*লিস্ট/i.test(query)) {
              const allNotes = await Note.find({ userId: user._id }).sort({ updatedAt: -1 });
              if (allNotes.length === 0) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `📋 আপনার কোনো পার্সোনাল তথ্য বা নোট সেভ করা নেই।\n\nতথ্য সেভ করতে লিখুন:\n"বাসার ঠিকানা: বাড়ি ১২, রোড ৪, ধানমন্ডি"\n"আমার রক্তের গ্রুপ: O+"`
                );
              } else {
                let text = `📋 আপনার সংরক্ষিত তথ্য ও নোটসমূহ (${allNotes.length}টি):\n\n`;
                allNotes.forEach((n, idx) => {
                  text += `${idx + 1}. 📌 *${n.title}*:\n   ${n.content}\n\n`;
                });
                text += `💡 নির্দিষ্ট কোনো তথ্য জানতে লিখুন: "[নাম] দাও" (যেমন: "বাসার ঠিকানা দাও")\n💡 ডিলিট করতে লিখুন: "[নাম] ডিলিট করো"`;
                await sendMetaWhatsAppMessage(fromNumber, text.trim());
              }
              break;
            }

            // Search by specific title or content
            const coreQuery = query
              .replace(/(?:আমার|amr|amar|টা|টি|ta|ti|দাও|বলো|বলোতো|কি|কী|কত|কতো|খুঁজে|daw|dao|ki|bolo|koto)/gi, '')
              .trim();

            const searchRegex = new RegExp((coreQuery || query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            let matchedNote = await Note.findOne({
              userId: user._id,
              $or: [
                { title: searchRegex },
                { content: searchRegex }
              ]
            });

            // Keyword fallbacks
            if (!matchedNote) {
              if (/অফিস|office|work|কর্মস্থল/i.test(query)) {
                matchedNote = await Note.findOne({
                  userId: user._id,
                  $or: [
                    { title: /অফিস|office|work|কর্মস্থল/i },
                    { content: /অফিস|office/i }
                  ]
                });
              } else if (/বাসা|বাড়ি|bari|basa|basha|home|ঘরের/i.test(query)) {
                matchedNote = await Note.findOne({
                  userId: user._id,
                  $or: [
                    { title: /বাসা|বাড়ি|basa|basha|home/i },
                    { content: /বাসা|বাড়ি|basa|home/i }
                  ]
                });
              } else if (/address|ঠিকানা|অ্যাড্রেস|এড্রেস/i.test(query)) {
                const addressNotes = await Note.find({
                  userId: user._id,
                  $or: [
                    { title: /ঠিকানা|address|বাসা|অফিস/i },
                    { category: 'Address' }
                  ]
                });
                if (addressNotes.length === 1) {
                  matchedNote = addressNotes[0];
                } else if (addressNotes.length > 1) {
                  let text = `📍 আপনার সংরক্ষিত ঠিকানাসমূহ:\n\n`;
                  addressNotes.forEach((an, idx) => {
                    text += `${idx + 1}. *${an.title}*:\n   ${an.content}\n\n`;
                  });
                  await sendMetaWhatsAppMessage(fromNumber, text.trim());
                  break;
                }
              } else if (/রক্ত|blood/i.test(query)) {
                matchedNote = await Note.findOne({ userId: user._id, title: /রক্ত|blood/i });
              } else if (/ওয়াইফাই|wifi/i.test(query)) {
                matchedNote = await Note.findOne({ userId: user._id, title: /ওয়াইফাই|wifi/i });
              } else if (/এনআইডি|nid/i.test(query)) {
                matchedNote = await Note.findOne({ userId: user._id, title: /এনআইডি|nid/i });
              }
            }

            if (matchedNote) {
              const mapUrl = matchedNote.location?.mapUrl || matchedNote.content.match(/https?:\/\/[^\s]+/)?.[0];
              if (mapUrl && (matchedNote.category === 'Location' || matchedNote.category === 'Address')) {
                const addr = matchedNote.location?.address || matchedNote.content.replace(/📍\s*Google Maps:.*$/s, '').trim();
                const cardBody = `📌 *${matchedNote.title}*\n\n🗺️ ঠিকানা: ${addr}`;
                const sent = await sendMetaWhatsAppCtaUrl(
                  fromNumber,
                  cardBody,
                  'ম্যাপ ওপেন করুন 🗺️',
                  mapUrl,
                  `📍 ${matchedNote.title.substring(0, 50)}`,
                  'ট্যাপ করে সরাসরি গুগল ম্যাপসে রুট দেখুন'
                );
                if (!sent) {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `📌 আপনার সংরক্ষিত *${matchedNote.title}*:\n\n📍 ${matchedNote.content}`
                  );
                }
              } else {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `📌 আপনার সংরক্ষিত *${matchedNote.title}*:\n\n📍 ${matchedNote.content}`
                );
              }
            } else {
              // Fallback: Check if user has a matching saved document / item
              const docResult = await findMatchingDocumentWithVersion(user._id.toString(), query || cleanText);
              const isEng = isPureEnglishText(cleanText);

              if (docResult.yearNotFound && docResult.targetYear) {
                const yrBn = convertEnglishDigitsToBengali(docResult.targetYear);
                const otherYearsBn = docResult.otherAvailableYears.map(convertEnglishDigitsToBengali).join(', ');
                const otherYearsEn = docResult.otherAvailableYears.join(', ');
                const sampleYr = docResult.otherAvailableYears[0];
                const sampleYrBn = convertEnglishDigitsToBengali(sampleYr);

                const msg = isEng
                  ? `⚠️ No file for year *${docResult.targetYear}* was found for "${docResult.itemKeyword}".\n\n💡 However, you have files saved for year(s): *${otherYearsEn}*.\nTo retrieve that year, send: "${sampleYr} ${docResult.itemKeyword}".`
                  : `⚠️ আপনার *${yrBn}* সালের কোনো "${docResult.itemKeyword}" স্মৃতি মেমোরিতে খুঁজে পাওয়া যায়নি।\n\n💡 তবে আপনার মেমোরিতে *${otherYearsBn}* সালের ফাইল সংরক্ষিত আছে।\nসেটি দেখতে চাইলে লিখুন: "${sampleYrBn} সালের ${docResult.itemKeyword} দাও"।`;

                await sendMetaWhatsAppMessage(fromNumber, msg);
                break;
              }

              const doc = docResult.doc;
              if (doc) {
                const duration = calculateItemDuration(doc.createdAt);
                const fileBuffer = await getDocumentBuffer(doc);
                const yrBn = docResult.targetYear ? convertEnglishDigitsToBengali(docResult.targetYear) : '';
                const otherYearsBn = docResult.otherAvailableYears.map(convertEnglishDigitsToBengali).join(', ');
                const otherYearsEn = docResult.otherAvailableYears.join(', ');

                let multiYearNote = '';
                if (docResult.otherAvailableYears.length > 0) {
                  const sampleYr = docResult.otherAvailableYears[0];
                  const sampleYrBn = convertEnglishDigitsToBengali(sampleYr);
                  multiYearNote = isEng
                    ? `\n\n💡 Note: You also have files saved for year(s): *${otherYearsEn}*.\nTo get a specific year, send: "${sampleYr} ${doc.title}".`
                    : `\n\n💡 তথ্য: আপনার কাছে *${otherYearsBn}* সালের ফাইলও সংরক্ষিত আছে।\nনির্দিষ্ট সালের ফাইল পেতে লিখুন: "${sampleYrBn} সালের ${doc.title} দাও"।`;
                }

                if (isEng) {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `📦 *${doc.title}* ${docResult.matchedByYear ? `(${docResult.targetYear}) ` : ''}Tracking & Memory Details:\n\n📅 *Saved Date:* ${duration.savedDateEn} (${duration.savedTimeEn})\n⏱️ *Active Duration:* ${duration.durationTextEn}\n📁 *Category:* ${doc.category}${multiYearNote}\n\n💡 Here is the original photo you saved to track this item:`
                  );
                } else {
                  await sendMetaWhatsAppMessage(
                    fromNumber,
                    `📦 *${doc.title}* ${docResult.matchedByYear ? `(${yrBn} সাল) ` : ''}এর মেমোরি ও ট্র্যাকিং তথ্য:\n\n📅 *সেভ করার তারিখ:* ${duration.savedDateBn} (${duration.savedTimeBn})\n⏱️ *কতদিন চলছে:* ${duration.durationTextBn}\n📁 *ক্যাটাগরি:* ${doc.category}${multiYearNote}\n\n💡 জিনিসটি আপনি কবে সেভ করেছিলেন তা মনে করিয়ে দিতে নিচে সংরক্ষিত ছবিটি দেওয়া হলো ভাই:`
                  );
                }

                if (fileBuffer) {
                  const caption = isEng
                    ? `📸 ${doc.title} ${docResult.matchedByYear ? `(${docResult.targetYear}) ` : ''}• Saved: ${duration.savedDateEn}`
                    : `📸 ${doc.title} ${docResult.matchedByYear ? `(${yrBn}) ` : ''}• সেভ: ${duration.savedDateBn}`;
                  await sendMetaWhatsAppFile(
                    fromNumber,
                    fileBuffer,
                    doc.fileName,
                    doc.mimeType,
                    caption
                  );
                }
                break;
              }

              await sendMetaWhatsAppMessage(
                fromNumber,
                `দুঃখিত, আপনার "${query}" সম্পর্কিত কোনো তথ্য স্মৃতিতে সেভ করা নেই।\n\n💡 এটি সেভ করতে লিখুন: "${query}: [আপনার তথ্য]"`
              );
            }
            break;
          }

          case 'get_location': {
            const data = aiResponse.data || {};
            let query = (data.searchQuery || '').trim();

            if (!query || query === 'সব' || /সব|সকল|all|লিস্ট|list|লোকেশনগুলো|লোকেশনগুলা/i.test(query)) {
              const locations = await Note.find({
                userId: user._id,
                $or: [{ category: 'Location' }, { category: 'Address' }]
              }).sort({ updatedAt: -1 });

              if (locations.length === 0) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  '📍 আপনার কোনো সংরক্ষিত লোকেশন নেই।\n\nনতুন লোকেশন সেভ করতে লিখুন:\n"এই লোকেশনটা সেভ করো: গুলশান ১ বন্ধুর বাসা"\nঅথবা সরাসরি হোয়াটসঅ্যাপে লোকেশন পিন শেয়ার করুন।'
                );
              } else {
                let msg = `📍 আপনার সংরক্ষিত লোকেশনসমূহ (${locations.length}টি):\n\n`;
                locations.forEach((loc, idx) => {
                  const addr = loc.location?.address || loc.content.split('\n')[1] || loc.content.replace(/📍\s*Google Maps:.*$/s, '').trim();
                  msg += `${idx + 1}. 📌 *${loc.title}*\n   🗺️ ${addr.substring(0, 60)}\n\n`;
                });
                msg += `💡 নির্দিষ্ট কোনো লোকেশন বা ম্যাপ বাটন পেতে লিখুন: "[জায়গার নাম] দাও" (যেমন: "গুলশান ১ দাও")`;
                await sendMetaWhatsAppMessage(fromNumber, msg.trim());
              }
              break;
            }

            // Search for specific location
            const coreQuery = query
              .replace(/(?:আমার|amr|amar|এর|র|er|ar|টা|টি|ta|ti|দাও|বলো|বলোতো|কি|কী|কোথায়|kothay|খুঁজে|লোকেশন|ঠিকানা|এড্রেস|address|location|daw|dao|ki|bolo)/gi, '')
              .trim();

            const searchRegex = new RegExp((coreQuery || query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            let matchedLoc = await Note.findOne({
              userId: user._id,
              $or: [
                { title: searchRegex },
                { content: searchRegex },
                { 'location.address': searchRegex }
              ]
            });

            if (!matchedLoc) {
              matchedLoc = await Note.findOne({
                userId: user._id,
                $or: [{ category: 'Location' }, { category: 'Address' }]
              }).sort({ updatedAt: -1 });
            }

            if (matchedLoc) {
              const addr = matchedLoc.location?.address || matchedLoc.content.replace(/📍\s*Google Maps:.*$/s, '').trim();
              const mapUrl = matchedLoc.location?.mapUrl ||
                matchedLoc.content.match(/https?:\/\/[^\s]+/)?.[0] ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr + ', Dhaka, Bangladesh')}`;

              const cardBody = `📌 *${matchedLoc.title}*\n\n🗺️ ঠিকানা: ${addr}`;

              const sent = await sendMetaWhatsAppCtaUrl(
                fromNumber,
                cardBody,
                'ম্যাপ ওপেন করুন 🗺️',
                mapUrl,
                `📍 ${matchedLoc.title.substring(0, 50)}`,
                'ট্যাপ করে সরাসরি গুগল ম্যাপসে রুট দেখুন'
              );

              if (!sent) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  `📍 *${matchedLoc.title}*\n🗺️ ${addr}\n\n🔗 গুগল ম্যাপস লিঙ্ক:\n${mapUrl}`
                );
              }
            } else {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `দুঃখিত, "${query}" সম্পর্কিত কোনো সংরক্ষিত লোকেশন খুঁজে পাওয়া যায়নি।\n\nনতুন লোকেশন সেভ করতে লিখুন:\n"লোকেশন সেভ করো: [জায়গার নাম ও ঠিকানা]"`
              );
            }
            break;
          }

          case 'delete_note': {
            const data = aiResponse.data || {};
            let query = (data.searchQuery || '').trim();
            const coreQuery = query
              .replace(/(?:নোট|ঠিকানা|অ্যাড্রেস|এড্রেস|ডিলিট|মুছে|delete|remove|করে|দাও|করো|দিন)/gi, '')
              .trim();

            const searchRegex = new RegExp((coreQuery || query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            let deletedNote = await Note.findOneAndDelete({
              userId: user._id,
              $or: [
                { title: searchRegex },
                { content: searchRegex }
              ]
            });

            if (!deletedNote) {
              if (/বাসা|বাড়ি|bari|basha|home/i.test(query)) {
                deletedNote = await Note.findOneAndDelete({ userId: user._id, title: /বাসা|বাড়ি|home/i });
              } else if (/অফিস|office/i.test(query)) {
                deletedNote = await Note.findOneAndDelete({ userId: user._id, title: /অফিস|office/i });
              } else if (/রক্ত|blood/i.test(query)) {
                deletedNote = await Note.findOneAndDelete({ userId: user._id, title: /রক্ত|blood/i });
              }
            }

            if (deletedNote) {
              await sendMetaWhatsAppMessage(fromNumber, `🗑️ আপনার "${deletedNote.title}" সফলভাবে মুছে ফেলা হয়েছে।`);
            } else {
              await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${query}" নামের কোনো নোট বা তথ্য খুঁজে পাওয়া যায়নি।`);
            }
            break;
          }

          case 'save_contact': {
            const data = aiResponse.data || {};
            const rawContactName = (data.name || '').trim();
            const contactPhone = (data.phone || '').replace(/[\s\-\(\)]/g, '').trim();

            if (!rawContactName || !contactPhone) {
              await sendMetaWhatsAppMessage(
                fromNumber,
                'অনুগ্রহ করে নাম ও নম্বর স্পষ্টভাবে লিখুন। যেমন:\n"রনির নম্বর সেভ করো: 017XXXXXXXX"'
              );
              break;
            }

            const cleaned = cleanPersonName(rawContactName);
            const contactName = cleaned.name;
            const relationship = data.relationship || cleaned.relationship || 'Friend';
            const cleanPhone = contactPhone.startsWith('01') ? contactPhone : contactPhone.replace(/^\+?88/, '');
            const shortPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

            let existingContact = await Contact.findOne({
              userId: user._id,
              $or: [
                { phone: cleanPhone },
                { phone: `88${cleanPhone}` },
                { phone: { $regex: new RegExp(shortPhone + '$') } },
                { name: { $regex: new RegExp(`^${contactName}$`, 'i') } }
              ]
            });

            if (existingContact) {
              existingContact.name = contactName;
              existingContact.phone = cleanPhone;
              if (relationship) existingContact.relationship = relationship;
              await existingContact.save();
              await sendMetaWhatsAppMessage(
                fromNumber,
                `✏️ আপনার কনট্যাক্ট *${contactName}*-র নম্বর সফলভাবে আপডেট করা হয়েছে:\n\n📞 ${cleanPhone}\n\n💡 এখন থেকে "${contactName}-কে মেসেজ দাও..." বললে স্মৃতি স্বয়ংক্রিয়ভাবে এই নম্বরে বার্তা পাঠাবে।`
              );
            } else {
              await Contact.create({
                userId: user._id,
                name: contactName,
                phone: cleanPhone,
                relationship: relationship
              });
              await sendMetaWhatsAppMessage(
                fromNumber,
                `💾 আপনার কনট্যাক্ট লিস্টে *${contactName}* সফলভাবে সেভ করা হয়েছে!\n\n📞 ${cleanPhone}\n\n💡 এখন থেকে "${contactName}-কে মেসেজ দাও..." বললে স্মৃতি স্বয়ংক্রিয়ভাবে এই নম্বরে বার্তা পাঠাবে।`
              );
            }
            break;
          }

          case 'get_contact': {
            const data = aiResponse.data || {};
            const query = (data.searchQuery || '').trim();

            if (!query || query === 'সব' || /সব|সকল|all|লিস্ট|list/i.test(query)) {
              const contacts = await Contact.find({ userId: user._id }).sort({ name: 1 });
              if (contacts.length === 0) {
                await sendMetaWhatsAppMessage(
                  fromNumber,
                  '📋 আপনার কনট্যাক্ট লিস্টে কোনো নম্বর সেভ করা নেই।\nনতুন নম্বর সেভ করতে লিখুন:\n"রনির নম্বর সেভ করো: 017XXXXXXXX"'
                );
              } else {
                let msg = `👥 আপনার সংরক্ষিত কন্ট্যাক্টসমূহ (${contacts.length}টি):\n\n`;
                contacts.forEach((c, idx) => {
                  msg += `${idx + 1}. 👤 *${c.name}*\n   📞 ${c.phone} (${c.relationship || 'Friend'})\n\n`;
                });
                msg += `💡 মেসেজ পাঠাতে লিখুন: "[নাম]-কে মেসেজ দাও যে [বার্তা]"`;
                await sendMetaWhatsAppMessage(fromNumber, msg.trim());
              }
              break;
            }

            const matchedContact = await Contact.findOne({
              userId: user._id,
              $or: [
                { name: { $regex: new RegExp(query, 'i') } },
                { nickname: { $regex: new RegExp(query, 'i') } }
              ]
            });

            if (matchedContact) {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `👤 *${matchedContact.name}*\n📞 ফোন: ${matchedContact.phone}\n👥 সম্পর্ক: ${matchedContact.relationship || 'Friend'}\n\n💡 মেসেজ পাঠাতে লিখুন: "${matchedContact.name}-কে মেসেজ দাও যে [আপনার বার্তা]"`
              );
            } else {
              await sendMetaWhatsAppMessage(
                fromNumber,
                `দুঃখিত, আপনার কনট্যাক্ট লিস্টে "${query}" নামের কোনো নম্বর খুঁজে পাওয়া যায়নি।\n\nসেভ করতে লিখুন: "${query}-র নম্বর সেভ করো: 017XXXXXXXX"`
              );
            }
            break;
          }

          case 'general_reply':
          default:
            await sendMetaWhatsAppMessage(fromNumber, aiResponse.replyText || 'দুঃখিত, বুঝতে পারিনি।');
            break;
        }
      }
    }
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
  }
};
