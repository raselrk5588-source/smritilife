import mongoose from 'mongoose';
import Contact from '../models/Contact';
import User from '../models/User';
import Reminder, { IReminder } from '../models/Reminder';
import { formatTime12Hour, parseBengaliTime, parseRelativeDate } from './aiWhatsAppService';

export interface ResolvedParticipant {
  name: string;
  phone: string;
  isRegistered?: boolean;
}

/**
 * Sends a WhatsApp text message via Meta Cloud API directly
 */
export const sendMeetingWhatsAppMessage = async (to: string, text: string): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('[MeetingService] WhatsApp API credentials missing in .env');
    return false;
  }

  let formattedTo = to.trim().replace(/[^\d]/g, '');
  if (formattedTo.startsWith('880')) {
    // Already in 880XXXXXXXXXX format
  } else if (formattedTo.startsWith('01')) {
    formattedTo = `88${formattedTo}`;
  } else if (formattedTo.length === 10 && formattedTo.startsWith('1')) {
    formattedTo = `880${formattedTo}`;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
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
        console.error('[MeetingService] Error sending Meta message:', JSON.stringify(data));
        if (attempt === 2) return false;
      } else {
        console.log(`✅ [MeetingService] Meta WhatsApp sent to ${formattedTo}`);
        return true;
      }
    } catch (error) {
      console.error(`[MeetingService] Attempt ${attempt} error sending Meta message:`, error);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
};

// Common phonetic / translation map for English-Bengali names
const NAME_ALIAS_MAP: Record<string, string[]> = {
  tarek: ['তারেক', 'tareq', 'tareque', 'tarik'],
  tareq: ['তারেক', 'tarek', 'tareque', 'tarik'],
  roni: ['রনি', 'rony', 'ronie'],
  rony: ['রনি', 'roni', 'ronie'],
  rubel: ['রুবেল', 'rubal'],
  mamun: ['মামুন', 'mamoon'],
  shanto: ['শান্ত', 'santo', 'shanta'],
  santo: ['শান্ত', 'shanto'],
  akash: ['আকাশ', 'akash'],
  rakib: ['রাকিব', 'raqib'],
  rasel: ['রাসেল', 'russel', 'russell'],
  bou: ['বউ', 'bou', 'wife'],
  wife: ['বউ', 'bou', 'স্ত্রী'],
  ammu: ['আম্মু', 'মা', 'ammi', 'mom', 'mother'],
  abbu: ['আব্বু', 'বাবা', 'father', 'dad']
};

/**
 * Normalizes phone number to standard Bangladeshi 11-digit format starting with 01
 */
export const normalizePhoneNumber = (rawPhone: string): string => {
  let cleaned = (rawPhone || '').replace(/[^\d]/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

/**
 * Resolves participant names and phone numbers from the user's Contact list and Emergency contacts
 */
export const resolveMeetingParticipants = async (
  userId: mongoose.Types.ObjectId | string,
  names: string[],
  rawPhones?: string[]
): Promise<{ resolved: ResolvedParticipant[]; notFound: string[] }> => {
  const resolved: ResolvedParticipant[] = [];
  const notFound: string[] = [];
  const seenPhones = new Set<string>();

  // If raw phones are directly provided
  if (rawPhones && rawPhones.length > 0) {
    for (const p of rawPhones) {
      const norm = normalizePhoneNumber(p);
      if (norm.length >= 10 && !seenPhones.has(norm)) {
        seenPhones.add(norm);
        resolved.push({
          name: norm,
          phone: norm
        });
      }
    }
  }

  if (!names || names.length === 0) {
    return { resolved, notFound };
  }

  // Fetch user's saved contacts
  const userContacts = await Contact.find({ userId }).lean();
  const userObj = await User.findById(userId).lean();
  const emergencyContacts = userObj?.emergencyContacts || [];

  // Combine contacts for matching
  const allContacts: Array<{ name: string; nickname?: string; phone?: string }> = [
    ...userContacts.map(c => ({ name: c.name, nickname: c.nickname, phone: c.phone })),
    ...emergencyContacts.map(e => ({ name: e.name, phone: e.phone }))
  ];

  for (const rawName of names) {
    const trimmed = (rawName || '').trim();
    if (!trimmed) continue;

    // Check if the name itself is a phone number
    const asPhone = normalizePhoneNumber(trimmed);
    if (/^01\d{9}$/.test(asPhone)) {
      if (!seenPhones.has(asPhone)) {
        seenPhones.add(asPhone);
        resolved.push({ name: trimmed, phone: asPhone });
      }
      continue;
    }

    const lower = trimmed.toLowerCase();
    const aliases = NAME_ALIAS_MAP[lower] || [];
    const searchKeys = [lower, ...aliases.map(a => a.toLowerCase())];

    // Find in user's contacts
    let matchedContact = allContacts.find(c => {
      if (!c.phone) return false;
      const cName = (c.name || '').toLowerCase();
      const cNick = (c.nickname || '').toLowerCase();

      for (const k of searchKeys) {
        if (cName === k || cNick === k) return true;
        if (cName.includes(k) || (k.length >= 3 && cName.startsWith(k))) return true;
        if (cNick && (cNick.includes(k) || (k.length >= 3 && cNick.startsWith(k)))) return true;
      }
      return false;
    });

    if (matchedContact && matchedContact.phone) {
      const phoneNorm = normalizePhoneNumber(matchedContact.phone);
      if (phoneNorm && !seenPhones.has(phoneNorm)) {
        seenPhones.add(phoneNorm);
        resolved.push({
          name: matchedContact.name || trimmed,
          phone: phoneNorm
        });
      }
    } else {
      notFound.push(trimmed);
    }
  }

  return { resolved, notFound };
};

/**
 * Sends immediate WhatsApp meeting invitation to a participant
 */
export const sendMeetingInvitation = async (
  hostName: string,
  hostPhone: string,
  meeting: { title: string; date: Date; time: string; description?: string },
  participant: { name: string; phone: string }
): Promise<boolean> => {
  try {
    const displayTime = formatTime12Hour(meeting.time);
    const dateObj = new Date(meeting.date);
    const displayDate = dateObj.toLocaleDateString('bn-BD', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Dhaka'
    });

    const descLine = meeting.description && meeting.description !== meeting.title && !meeting.title.includes(meeting.description) && !/(?:bolo|bolba|k\s*bolo|reminder|রিমাইন্ডার)/i.test(meeting.description) ? `\n📝 *বিবরণ:* ${meeting.description}` : '';

    const invitationMsg = `📅 *মিটিং ইনভিটেশন (Meeting Invitation)*\n\nআসসালামু আলাইকুম *${participant.name}*!\n\nমিটিং হোস্ট *${hostName}* (${hostPhone}) আপনাকে নিম্নলিখিত মিটিংয়ে যুক্ত হওয়ার জন্য আমন্ত্রণ জানিয়েছেন:\n\n📌 *বিষয়:* ${meeting.title}\n🕒 *সময়:* ${displayTime}\n📅 *তারিখ:* ${displayDate}\n👤 *হোস্ট:* ${hostName}${descLine}\n\n💡 মিটিং শুরুর ২০ মিনিট পূর্বে আপনাকে একটি জেন্টল রিমাইন্ডার এবং মিটিংয়ের সময়ে ফাইনাল অ্যালার্ট পাঠানো হবে।\n\n_(স্মৃতি লাইফ মিটিং ম্যানেজমেন্ট প্ল্যাটফর্ম)_`;

    return await sendMeetingWhatsAppMessage(participant.phone, invitationMsg);
  } catch (err) {
    console.error('[MeetingService] Failed to send meeting invitation:', err);
    return false;
  }
};

/**
 * Sends a 20-minute gentle pre-reminder to a participant
 */
export const sendMeetingPreReminder = async (
  hostName: string,
  meeting: { title: string; date?: Date; time: string; description?: string },
  participant: { name: string; phone: string },
  minutesLeft: number = 20
): Promise<boolean> => {
  try {
    const displayTime = formatTime12Hour(meeting.time);
    const descLine = meeting.description && meeting.description !== meeting.title && !meeting.title.includes(meeting.description) && !/(?:bolo|bolba|k\s*bolo|reminder|রিমাইন্ডার)/i.test(meeting.description) ? `\n📝 *বিবরণ:* ${meeting.description}` : '';

    const preAlertMsg = `⏳ *মিটিং জেন্টল রিমাইন্ডার (Gentle Reminder)*\n\nআসসালামু আলাইকুম *${participant.name}*!\n\nআর ঠিক *${minutesLeft} মিনিট পর* (${displayTime}-এ) আপনার একটি মিটিং শুরু হতে যাচ্ছে:\n\n📌 *বিষয়:* ${meeting.title}\n👤 *হোস্ট:* ${hostName}\n🕒 *সময়:* ${displayTime}${descLine}\n\nঅনুগ্রহ করে মিটিংয়ে যোগদানের প্রস্তুতি নিন।\n\n_(স্মৃতি লাইফ নোটিফিকেশন)_`;

    return await sendMeetingWhatsAppMessage(participant.phone, preAlertMsg);
  } catch (err) {
    console.error('[MeetingService] Failed to send gentle pre-reminder:', err);
    return false;
  }
};

/**
 * Sends final meeting start alert at the meeting time
 */
export const sendMeetingFinalAlert = async (
  hostName: string,
  meeting: { title: string; date?: Date; time: string; description?: string },
  participant: { name: string; phone: string }
): Promise<boolean> => {
  try {
    const displayTime = formatTime12Hour(meeting.time);
    const descLine = meeting.description && meeting.description !== meeting.title ? `\n📝 *বিবরণ:* ${meeting.description}` : '';

    const finalAlertMsg = `🔔 *মিটিং শুরু হচ্ছে (Meeting Alert)*\n\nআসসালামু আলাইকুম *${participant.name}*!\n\nআপনার নির্ধারিত মিটিংটি *এখন শুরু হচ্ছে*:\n\n📌 *বিষয়:* ${meeting.title}\n👤 *হোস্ট:* ${hostName}\n🕒 *সময়:* ${displayTime}${descLine}\n\nঅনুগ্রহ করে এখনই মিটিংয়ে জয়েন করুন!\n\n_(স্মৃতি লাইফ নোটিফিকেশন)_`;

    return await sendMeetingWhatsAppMessage(participant.phone, finalAlertMsg);
  } catch (err) {
    console.error('[MeetingService] Failed to send final meeting alert:', err);
    return false;
  }
};

/**
 * Sends cancellation notification to a participant
 */
export const sendMeetingCancellationNotice = async (
  hostName: string,
  meeting: { title: string; date: Date; time: string },
  participant: { name: string; phone: string }
): Promise<boolean> => {
  try {
    const displayTime = formatTime12Hour(meeting.time);
    const dateObj = new Date(meeting.date);
    const displayDate = dateObj.toLocaleDateString('bn-BD', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Dhaka'
    });

    const cancelMsg = `❌ *মিটিং বাতিল সংক্রান্ত নোটিশ (Meeting Cancelled)*\n\nআসসালামু আলাইকুম *${participant.name}*!\n\nমিটিং হোস্ট *${hostName}* নিম্নলিখিত মিটিংটি বাতিল (Cancel) করেছেন:\n\n📌 *বিষয়:* ${meeting.title}\n🕒 *পূর্ব নির্ধারিত সময়:* ${displayTime}\n📅 *তারিখ:* ${displayDate}\n\nআজ এই মিটিংটি অনুষ্ঠিত হচ্ছে না।\n\n_(স্মৃতি লাইফ নোটিফিকেশন)_`;

    return await sendMeetingWhatsAppMessage(participant.phone, cancelMsg);
  } catch (err) {
    console.error('[MeetingService] Failed to send meeting cancellation notice:', err);
    return false;
  }
};

/**
 * Sends reschedule notification to a participant
 */
export const sendMeetingRescheduledNotice = async (
  hostName: string,
  meeting: { title: string; date: Date; time: string },
  participant: { name: string; phone: string },
  oldTime: string,
  newTime: string
): Promise<boolean> => {
  try {
    const oldDisplayTime = formatTime12Hour(oldTime);
    const newDisplayTime = formatTime12Hour(newTime);
    const dateObj = new Date(meeting.date);
    const displayDate = dateObj.toLocaleDateString('bn-BD', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Dhaka'
    });

    const rescheduleMsg = `🔄 *মিটিং রিশিডিউল নোটিশ (Meeting Rescheduled)*\n\nআসসালামু আলাইকুম *${participant.name}*!\n\nমিটিং হোস্ট *${hostName}* নিম্নলিখিত মিটিংটির সময় পরিবর্তন করেছেন:\n\n📌 *বিষয়:* ${meeting.title}\n🕒 *নতুন সময়:* ${newDisplayTime}\n📅 *তারিখ:* ${displayDate}\n(পূর্ববর্তী সময় ছিল: ${oldDisplayTime})\n\nঅনুগ্রহ করে পরিবর্তিত নতুন সময়ে মিটিংয়ে যোগ দেওয়ার অনুরোধ করা হচ্ছে।\n\n_(স্মৃতি লাইফ নোটিফিকেশন)_`;

    return await sendMeetingWhatsAppMessage(participant.phone, rescheduleMsg);
  } catch (err) {
    console.error('[MeetingService] Failed to send meeting rescheduled notice:', err);
    return false;
  }
};

/**
 * Intelligently extracts the meeting topic/subject from the user message,
 * removing participants, time/date, commands, and connectors.
 */
export const extractMeetingTopic = (rawText: string, participantNames: string[] = []): { title: string; cleanTopic: string } => {
  let text = (rawText || '').trim();

  // Helper to remove date, time, and participant mentions from candidate
  function cleanTopicString(str: string): string {
    let s = ' ' + str.trim() + ' ';

    // 1. Remove participant names (with possible possessive suffixes like -er / -এর / -ের / -কে / -k)
    for (const p of participantNames) {
      if (p && p.length >= 2) {
        s = s.replace(new RegExp('(\\s|[.,])' + p + '(?:-?ের|-?এর|-?er|-?কে|-?k|-?ke|-?re|-?রে|-?দের|-?der)?(?=\\s|[.,]|$)', 'gi'), ' ');
      }
    }

    // 2. Remove date and time combinations (e.g. "কাল সকাল ১০টায়", "aj rat 11:45 a", "২ টার সময়")
    s = s
      .replace(/(?:\s|^)(?:aj|ajke|আজ|আজকে|kal|kalke|কাল|কালকে|agamikal|আগামীকাল|porshu|পরশু)?\s*(?:সকাল|দুপুর|বিকাল|সন্ধ্যা|রাত|ভোর|sokal|shokal|dupur|bikal|bikale|sondha|shondha|rat|raat|vhor)?\s*[০-৯\d]{1,2}(?::[০-৯\d]{2})?\s*(?:টার\s*সময়|tar\s*somoi|tar\s*somoy|টায়|টায়|tay|টার|tar|টাইমে|সময়ে|সময়|somoi|somoy|টা|ta|am|pm)?(?:\s*(?:a|e|te|তে))?(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:কাল\s*সকাল|আজ\s*সকাল|আজ\s*দুপুর|আজ\s*রাত|কাল\s*রাত|কাল\s*দুপুর|সকাল|দুপুর|বিকাল|সন্ধ্যা|রাত|ভোর|sokal|shokal|dupur|bikal|bikale|sondha|shondha|rat|raat|vhor|aj|ajke|আজ|আজকে|kal|kalke|কাল|কালকে|agamikal|আগামীকাল)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:oder|eder|tader|ওদের|এদের|তাদের|-?দের|-?কে|-?k|-?ke|-?re|-?রে)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:bolo|bolba|bolbe|বলো|বলবে|বলবা|পাঠাও|pathao|send|দাও|দিও|dao|dio|daw)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:akta\s*reminder\s*(?:diow?|dao)?|ekta\s*reminder\s*(?:dao|dio)?|একটা\s*রিমাইন্ডার\s*(?:দিও|দাও)?|রিমাইন্ডার\s*(?:দিও|দাও)|reminder\s*(?:dio|dao)|reminder|রিমাইন্ডার)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:message|msg|মেসেজ|বার্তা)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:er\s*shathe|er\s*sathe|shathe|sathe|সাথে|এর\s*সাথে|with)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:somoi|somoy|সময়|সময়ে|টাইমে|time)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:akta|ekta|একটা|একটি)(?:\s|$)/gi, ' ')
      .replace(/(?:\s|^)(?:somporke|shomporke|সম্পর্কে|niye|নিয়ে|নিয়ে|biyoy|biyoye|বিষয়ক?|বিষয়ে|er\s*jonno|এর\s*জন্য|topic\s*a|টপিকে|er\s*opore|এর\s*ওপরে|er\s*bapare|এর\s*ব্যাপারে)(?:\s|$)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return s;
  }

  function formatTopic(topic: string): { title: string; cleanTopic: string } {
    const clean = topic.trim();
    if (/(?:মিটিং|meeting)$/i.test(clean)) {
      return { title: clean, cleanTopic: clean };
    }
    return { title: `${clean} নিয়ে মিটিং`, cleanTopic: clean };
  }

  // 1. Explicit topic label (topic: xyz / subject: xyz / বিষয়: xyz)
  const explicitMatch = text.match(/(?:topic|subject|টপিক|বিষয়|বিষয়|agenda|এজেন্ডা)\s*[:：\-]\s*(.+)$/i);
  if (explicitMatch && explicitMatch[1]) {
    const cleaned = cleanTopicString(explicitMatch[1]);
    if (cleaned.length > 1) return formatTopic(cleaned);
  }

  // 2. Topic AFTER meeting / মিটিং keyword
  // e.g. "meeting ache smriti life update somporke" or "meeting ache server maintenance niye kal 3 tay"
  const afterMatch = text.match(/(?:মিটিং|meeting)\s*(?:ache|ase|hobe|call\s*koro|ডাকো|হবে|আছে)?\s*(?:[:：\-]|on|about|for|regarding|niye|নিয়ে|নিয়ে|somporke|সম্পর্কে)?\s+(.+)$/i);
  if (afterMatch && afterMatch[1]) {
    const cleaned = cleanTopicString(afterMatch[1]);
    if (cleaned.length >= 2 && !/^(?:ache|ase|hobe|আছে|হবে|call|dak|dako|ডাকো)$/i.test(cleaned)) {
      return formatTopic(cleaned);
    }
  }

  // 3. Topic BEFORE meeting / মিটিং keyword
  // e.g. "RAC installation issue niye akta meeting ache" or "বাজেট প্ল্যান নিয়ে মিটিং"
  const beforeMatch = text.match(/(.+?)\s*(?:niye|নিয়ে|নিয়ে|somporke|সম্পর্কে|biyoy|বিষয়|biyoye|বিষয়ে|er\s*jonno|এর\s*জন্য|topic\s*a|টপিকে|er\s*meeting|এর\s*মিটিং)\s*(?:akta\s*|ekta\s*|একটা\s*)?(?:মিটিং|meeting)/i);
  if (beforeMatch && beforeMatch[1]) {
    const cleaned = cleanTopicString(beforeMatch[1]);
    if (cleaned.length >= 2) {
      return formatTopic(cleaned);
    }
  }

  // 4. Topic word attached immediately before meeting (e.g. "urgent client meeting")
  const attachedMatch = text.match(/(?:^|\s)([\w\u0980-\u09FF\s]+?)\s+(?:মিটিং|meeting)\b/i);
  if (attachedMatch && attachedMatch[1]) {
    const cleaned = cleanTopicString(attachedMatch[1]);
    if (cleaned.length >= 3) {
      return formatTopic(cleaned);
    }
  }

  return { title: 'জরুরি মিটিং', cleanTopic: 'জরুরি মিটিং' };
};

/**
 * Parses user input specifically for meeting intents (Create, Cancel, Reschedule)
 */
export const parseMeetingIntent = (rawText: string): {
  isMeeting: boolean;
  intent: 'create' | 'cancel' | 'reschedule' | 'none';
  participantNames: string[];
  topic: string;
  cleanTopic: string;
  time: string;
  targetTime?: string;
  newTime?: string;
  date?: Date;
} => {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  const hasMeetingWord = /(?:মিটিং|meeting|অ্যাপয়েন্টমেন্ট|appointment|কনফারেন্স|conference|সেমিনার|seminar)/i.test(text);

  // 1. Meeting Reschedule Intent:
  // e.g. "dupur 2 tar meeting ta 3 tay dao", "২টার মিটিং পিছিয়ে ৩টায় দাও", "আজকের মিটিং ৩টায় রিশিডিউল করো"
  const isReschedule = hasMeetingWord && /(?:পিছিয়ে|এগিয়ে|রিশিডিউল|reschedule|change|পরিবর্তন|নতুন\s*সময়)/i.test(text);
  if (isReschedule) {
    // Extract times
    const timesFound = text.match(/(?:[০-৯\d]{1,2}(?:\s*:\s*[০-৯\d]{2})?)\s*(?:টা|টায়|টায়|ta|tay|pm|am|ঘণ্টা|ঘন্টায়)?/gi) || [];
    let oldTimeStr = '';
    let newTimeStr = '';

    if (timesFound.length >= 2 && timesFound[0] && timesFound[1]) {
      oldTimeStr = parseBengaliTime(timesFound[0]);
      newTimeStr = parseBengaliTime(timesFound[1]);
    } else if (timesFound.length >= 1 && timesFound[0]) {
      newTimeStr = parseBengaliTime(timesFound[0]);
    }

    return {
      isMeeting: true,
      intent: 'reschedule',
      participantNames: [],
      topic: '',
      cleanTopic: '',
      time: newTimeStr || '15:00',
      targetTime: oldTimeStr || undefined,
      newTime: newTimeStr || undefined
    };
  }

  // 2. Meeting Cancellation Intent:
  // e.g. "dupur 2 tar meeting cancle ba aj korbo na", "২টার মিটিং বাতিল করো", "আজকের মিটিং ক্যানসেল", "আজকে মিটিং হবে না", "আজ মিটিং করবো না"
  const isCancel = (hasMeetingWord && /(?:ক্যানসেল|ক্যান্সেল|বাতিল|cancel|cancle|হবে\s*না|করবো\s*না|করব\s*না|ডিলিট|মুছে|বাদ)/i.test(text)) ||
                   /(?:আজ|আজকে|aj|ajke)\s*(?:মিটিং|meeting)\s*(?:হবে\s*না|করবো\s*না|করব\s*না|cancle|cancel|বাতিল)/i.test(text);
  if (isCancel) {
    let targetTimeStr: string | undefined = undefined;
    const timeMatch = text.match(/(?:[০-৯\d]{1,2}(?:\s*:\s*[০-৯\d]{2})?)\s*(?:টা|টায়|টায়|ta|tay|pm|am)?/i);
    if (timeMatch && timeMatch[0]) {
      targetTimeStr = parseBengaliTime(timeMatch[0]);
    }

    return {
      isMeeting: true,
      intent: 'cancel',
      participantNames: [],
      topic: '',
      cleanTopic: '',
      time: targetTimeStr || '',
      targetTime: targetTimeStr
    };
  }

  // 3. Meeting Creation Intent with Participants:
  // e.g. "bou,roni,tarek k bolo aj rat 11:45 a meeting ache smriti life update somporke"
  // "tarek roni oder akta reminder diow 2 tar somoi RAC installation issue niye akta meeting ache"
  const createMatch = text.match(/(?:^|\s)([\w\u0980-\u09FF\s,،\+]+?)\s*(?:oder|eder|tader|ওদের|এদের|তাদের|-?দের|-?কে|-?k|-?ke|-?er\s*shathe|-?এর\s*সাথে)\s*(?:একটা\s*|akta\s*|ekta\s*)?(?:রিমাইন্ডার|reminder|বার্তা|ইনভিটেশন|মেসেজ)?\s*(?:দাও|দিও|পাঠাও|send|daw|dao|dio|bolo|bolba|বলো|বলবা)?\s*(?:.*)(?:মিটিং|meeting)/i) ||
                      text.match(/(?:^|\s)([\w\u0980-\u09FF\s,،\+]+?)\s*(?:and|ar|আর|ও|এবং)\s*([\w\u0980-\u09FF]+)\s*(?:-?কে|-?k|-?ke|-?দের)?(?:\s+(?:.*))?(?:মিটিং|meeting)/i) ||
                      text.match(/(?:মিটিং|meeting)(?:\s+(?:.*))?\s*(?:shathe|সাথে|with)\s+([\w\u0980-\u09FF\s,،\+]+)/i);

  if (hasMeetingWord || createMatch) {
    const rawParticipants: string[] = [];
    if (createMatch) {
      const matchPart = createMatch[1] || '';
      const secondPart = createMatch[2] || '';
      const combined = `${matchPart} ${secondPart}`.trim();
      
      const splitNames = combined
        .split(/[,،&]|\s+(?:and|ar|আর|ও|এবং|oder|eder|tader|ওদের|এদের|তাদের)\s+/i)
        .map(n => n.trim())
        .filter(n => n && n.length >= 2 && !/^(?:reminder|akta|ekta|একটা|রিমাইন্ডার|দাও|দিও|dao|dio|daw|bolo|bolba|বলো|somoi|সময়|somoy|niye|নিয়ে|meeting|মিটিং)$/i.test(n));

      rawParticipants.push(...splitNames);
    }

    // Extract time & date
    const parsedTime = parseBengaliTime(text);
    const parsedDate = parseRelativeDate(text, parsedTime);

    // Extract clean topic and formatted title
    const { title: topicTitle, cleanTopic } = extractMeetingTopic(text, rawParticipants);

    return {
      isMeeting: true,
      intent: 'create',
      participantNames: rawParticipants,
      topic: topicTitle,
      cleanTopic,
      time: parsedTime,
      date: parsedDate
    };
  }

  return {
    isMeeting: false,
    intent: 'none',
    participantNames: [],
    topic: '',
    cleanTopic: '',
    time: '14:00'
  };
};
