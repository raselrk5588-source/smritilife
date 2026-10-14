import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import User from '../models/User';
import { deliverWishCard } from './wishDeliveryService';
import { formatTime12Hour } from './aiWhatsAppService';
import { sendMetaWhatsAppButtons, userReminderState } from '../controllers/whatsappController';
import { getRamadanTimes, RAMADAN_DUAS } from './ramadanService';

export interface ActiveAlarmRinger {
  reminderId: string;
  userId: string;
  phone: string;
  title: string;
  isSehri: boolean;
  ringCount: number;
  maxRings: number;
  nextRingAt: number;
}

export const activeAlarmRingers = new Map<string, ActiveAlarmRinger>();

export const cancelAlarmRinger = (reminderIdOrUserId: string) => {
  for (const [key, val] of activeAlarmRingers.entries()) {
    if (val.reminderId === reminderIdOrUserId || val.userId === reminderIdOrUserId || key === reminderIdOrUserId) {
      activeAlarmRingers.delete(key);
      console.log(`[AlarmRinger] Alarm ringer stopped for reminder ${val.reminderId} / user ${val.userId}`);
    }
  }
};

// Send message via Meta WhatsApp API
const sendWhatsAppAlert = async (to: string, message: string) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('[ReminderScheduler] WhatsApp credentials missing');
    return false;
  }

  // Ensure phone number format (e.g. 88018...)
  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) {
    formattedTo = formattedTo.substring(1);
  } else if (formattedTo.startsWith('01')) {
    formattedTo = `88${formattedTo}`;
  }

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
        text: { body: message }
      }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[ReminderScheduler] Error sending reminder:', data);
      return false;
    }

    console.log(`✅ [ReminderScheduler] Alert sent successfully to ${formattedTo}: "${message}"`);
    return true;
  } catch (error) {
    console.error('[ReminderScheduler] Fetch error:', error);
    return false;
  }
};

export const startReminderScheduler = () => {
  console.log('⏰ Starting Smriti Reminder Scheduler (Polling every 30 seconds for Bangladesh time)...');

  const checkAndDispatchReminders = async () => {
    if (mongoose.connection.readyState !== 1) return;

    try {
      // Current Bangladesh Time (Asia/Dhaka)
      const now = new Date();
      const dhakaTimeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }); // Format: "HH:mm" e.g. "12:15"

      const dhakaDateStr = now.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Dhaka'
      }); // Format: "YYYY-MM-DD" e.g. "2026-10-11"

      // Today's start and end date for comparison
      const todayStart = new Date(`${dhakaDateStr}T00:00:00.000Z`);
      const todayEnd = new Date(`${dhakaDateStr}T23:59:59.999Z`);

      // Find pending reminders due for today with time <= currentTime
      const dueReminders = await Reminder.find({
        status: 'Pending',
        date: { $lte: todayEnd },
        time: { $lte: dhakaTimeStr }
      });

      if (dueReminders.length > 0) {
        for (const reminder of dueReminders) {
          const isSelf = !reminder.recipientPhone;
          // Atomically claim the reminder: For self-reminders, set to 'Snoozed' awaiting Yes/No confirmation
          const claimed = await Reminder.findOneAndUpdate(
            { _id: reminder._id, status: 'Pending' },
            { $set: { status: isSelf ? 'Snoozed' : 'Completed' } }
          );
          if (!claimed) continue;

          const user = await User.findById(reminder.userId);
          const senderName = user?.name || 'আপনার পরিচিত জন';
          const senderNumber = user?.whatsapp || user?.mobile;

          if (reminder.recipientPhone) {
            // Scheduled message to someone else
            const messageBody = reminder.description || reminder.title;
            
            // Check if recipient is already registered in Smriti
            const cleanRecipientNumber = reminder.recipientPhone.replace(/\D/g, '');
            const shortRecipientNumber = cleanRecipientNumber.length > 10 ? cleanRecipientNumber.slice(-10) : cleanRecipientNumber;
            const recipientUser = await User.findOne({
              $or: [
                { whatsapp: { $regex: new RegExp(shortRecipientNumber + '$') } },
                { mobile: { $regex: new RegExp(shortRecipientNumber + '$') } }
              ]
            });

            const combinedText = `${reminder.title || ''} ${reminder.description || ''} ${reminder.category || ''}`.toLowerCase();
            const isAllowedForUnregistered = /মিটিং|meeting|অ্যাপয়েন্টমেন্ট|appointment|অনুষ্ঠান|event|দাওয়াত|dawat|ইনভাইটেশন|invitation|কনফারেন্স|conference|বিয়ে|biye|সেমিনার|seminar|শুভেচ্ছা|wish|শুভ|ঈদ|eid|birthday|জন্মদিন/.test(combinedText);

            if (!recipientUser && !isAllowedForUnregistered) {
              console.warn(`[ReminderScheduler] Blocked third-party message to unregistered number ${reminder.recipientPhone} (not an allowed meeting/wish/event category).`);
              if (senderNumber) {
                await sendWhatsAppAlert(senderNumber, `⚠️ আপনার নির্ধারিত বার্তাটি (${reminder.recipientPhone}) নম্বরে পাঠানো যায়নি, কারণ নম্বরটি স্মৃতি লাইফে নিবন্ধিত নয়। অনিবন্ধিত নম্বরে শুধুমাত্র মিটিং ও শুভেচ্ছা বার্তা অনুমোদিত।`);
              }
              continue;
            }

            let promoSection = '';
            if (!recipientUser) {
              promoSection = `\n\n✨ আপনিও কি স্মৃতি লাইফ (Smriti Life) প্ল্যাটফর্ম ব্যবহার করে স্বয়ংক্রিয় রিমাইন্ডার ও বার্তা পাঠাতে চান?\nএখনই রেজিস্ট্রেশন করুন: https://smritilife.com/auth`;
            } else if (!recipientUser.isSubscribed) {
              promoSection = `\n\n✨ আপনার স্মৃতি লাইফ (Smriti Life) অ্যাকাউন্টটি সক্রিয় রাখতে সাবস্ক্রাইব করুন:\nhttps://smritilife.com/paywall`;
            }

            const thirdPartyAlert = `🔔 আসসালামু আলাইকুম!\n\n${senderName} (${senderNumber || ''}) আপনাকে একটি বার্তা পাঠিয়েছেন:\n\n💬 "${messageBody}"\n\n(বার্তাটি স্মৃতি লাইফ প্ল্যাটফর্মের মাধ্যমে স্বয়ংক্রিয়ভাবে প্রেরিত)${promoSection}`;

            await sendWhatsAppAlert(reminder.recipientPhone, thirdPartyAlert);
            console.log(`[ReminderScheduler] Dispatched third-party message to ${reminder.recipientPhone} (Registered: ${!!recipientUser})`);

            // Also confirm to the sender that their message was delivered
            if (senderNumber) {
              await sendWhatsAppAlert(senderNumber, `✅ আসসালামু আলাইকুম! ${reminder.recipientPhone} নম্বরে আপনার নির্ধারিত বার্তাটি সফলভাবে পাঠিয়ে দেওয়া হয়েছে:\n"${messageBody}"`);
            }
          } else {
            if (senderNumber) {
              const displayTime = formatTime12Hour(reminder.time);
              const isWakeup = reminder.category === 'wakeup' || reminder.category === 'alarm' || !!reminder.isAlarm;
              const isSehri = isWakeup && (
                /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(reminder.title || '') ||
                /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(reminder.category || '')
              );

              const categoryMap: Record<string, string> = {
                wakeup: isSehri ? '🌙 সেহরি ওয়েক-আপ' : '⏰ ওয়েক-আপ অ্যালার্ম',
                alarm: isSehri ? '🌙 সেহরি ওয়েক-আপ' : '⏰ ওয়েক-আপ অ্যালার্ম',
                medicine: '💊 ওষুধ',
                work: '💼 কাজ/মিটিং',
                shopping: '🛒 শপিং/বাজার',
                bill: '💳 বিল পেমেন্ট',
                event: '🎁 অনুষ্ঠান',
                other: '📌 অন্যান্য'
              };
              const catLabel = categoryMap[reminder.category] || '';
              const catText = catLabel ? `\n🏷️ ক্যাটাগরি: ${catLabel}` : '';
              const salutation = user?.honorific ? ` ${user.honorific}` : (user?.name ? ` ${user.name.split(' ')[0]}` : '');
              
              let alertBody = '';
              if (isSehri) {
                alertBody = `🌙🔔⏰ আসসালামু আলাইকুম${salutation}! সেহরির সময় হয়েছে! ঘুম থেকে উঠুন! (রিং ১/৩)\n\n📌 বিষয়: ${reminder.title}\n⏰ সময়: ${displayTime}\n\nরোজা রাখার প্রস্তুতি নিতে এবং বরকতময় সেহরি খেতে নিচের বাটনে চাপ দিন:`;
              } else if (isWakeup) {
                alertBody = `⏰🔔⏰ শুভ সকাল${salutation}! ঘুম থেকে উঠুন! (রিং ১/৩)\n\nএটি আপনার স্মৃতি ওয়েক-আপ অ্যালার্ম:\n📌 বিষয়: ${reminder.title}\n⏰ সময়: ${displayTime}\n\nআপনার ঘুম ভাঙলে নিচের বাটনে চাপ দিন:`;
              } else {
                alertBody = `🔔 আসসালামু আলাইকুম${salutation}! এটি আপনার স্মৃতির রিমাইন্ডার:${catText}\n📌 বিষয়: ${reminder.title}\n⏰ নির্ধারিত সময়: ${displayTime}`;
              }

              // Track in active state for tracking response
              userReminderState.set(reminder.userId.toString(), {
                reminderId: reminder._id.toString(),
                title: reminder.title,
                waitingForTime: false,
                expiresAt: Date.now() + 4 * 60 * 60 * 1000
              });

              // Register multi-ring loop for Wake-up / Sehri alarms (rings every 60s up to 3 times if no reply)
              if (isWakeup) {
                activeAlarmRingers.set(reminder._id.toString(), {
                  reminderId: reminder._id.toString(),
                  userId: reminder.userId.toString(),
                  phone: senderNumber,
                  title: reminder.title,
                  isSehri,
                  ringCount: 1,
                  maxRings: 3,
                  nextRingAt: Date.now() + 60 * 1000 // Ring 2 fires in 60s
                });
              }

              const buttons = isWakeup
                ? [
                    { id: `rem_done_${reminder._id}`, title: isSehri ? 'জেগে গেছি 🤲' : 'জেগে গেছি ✅' },
                    { id: `rem_reschedule_${reminder._id}`, title: '৫ মিনিট স্নুজ 💤' }
                  ]
                : [
                    { id: `rem_done_${reminder._id}`, title: 'হ্যাঁ, করেছি ✅' },
                    { id: `rem_reschedule_${reminder._id}`, title: 'না, পুনঃনির্ধারণ ⏰' }
                  ];

              const buttonsSent = await sendMetaWhatsAppButtons(senderNumber, alertBody, buttons);
              if (!buttonsSent) {
                // Fallback to text message with instructions
                const fallbackText = `${alertBody}\n\n👉 সম্পন্ন হলে লিখুন: "হ্যাঁ" বা "Yes"\n👉 পুনঃনির্ধারণ করতে লিখুন: "না" বা নতুন সময় (যেমন: "আজ বিকাল ৫টায়")`;
                await sendWhatsAppAlert(senderNumber, fallbackText);
              }
              console.log(`[ReminderScheduler] Interactive prompt sent for "${reminder.title}" to ${senderNumber}`);
            }
          }

          // If recurring (Daily or medicine), advance date to tomorrow and set status back to Pending
          if (reminder.repeat === 'Daily' || reminder.category === 'medicine') {
            const nextDate = new Date(reminder.date || new Date());
            nextDate.setDate(nextDate.getDate() + 1);
            await Reminder.findByIdAndUpdate(reminder._id, {
              date: nextDate,
              status: 'Pending'
            });
            console.log(`🔄 [ReminderScheduler] Recurring reminder "${reminder.title}" advanced to next day: ${nextDate.toISOString().split('T')[0]}`);
          }
        }
      }

      // Check and dispatch due wishes (birthday, anniversary, eid, etc.)
      const dueWishes = await Wish.find({
        status: { $in: ['Scheduled', 'Processing'] },
        scheduledAt: { $lte: new Date() }
      });

      if (dueWishes.length > 0) {
        console.log(`[ReminderScheduler] Found ${dueWishes.length} due wishes to dispatch as image cards.`);

        for (const wish of dueWishes) {
          // Atomically claim the wish so it cannot be processed more than once
          const claimed = await Wish.findOneAndUpdate(
            { _id: wish._id, status: { $in: ['Scheduled', 'Processing'] } },
            { $set: { status: 'Sent' } }
          );
          if (!claimed) continue;

          const sender = await User.findById(wish.userId);
          const senderName = sender?.name || 'আপনার শুভাকাঙ্ক্ষী';
          const senderWhatsApp = sender?.whatsapp || sender?.mobile;

          try {
            await deliverWishCard(wish, senderName, senderWhatsApp);
            console.log(`✅ [ReminderScheduler] Wish card dispatched to ${wish.recipientContact}`);
          } catch (wishErr) {
            console.error(`[ReminderScheduler] Error delivering wish card ${wish._id}:`, wishErr);
          }
        }
      }
    } catch (error) {
      console.error('[ReminderScheduler] Error checking reminders/wishes:', error);
    }
  };

  // Proactive Nightly Follow-up Check-in (Between 20:30 and 21:30 Bangladesh Time)
  const checkAndSendNightlyFollowUp = async () => {
    if (mongoose.connection.readyState !== 1) return;

    try {
      const now = new Date();
      const dhakaHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }), 10);
      const dhakaMinute = parseInt(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', minute: '2-digit', hour12: false }), 10);
      const dhakaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"

      // Strictly run between 20:30 (8:30 PM) and 21:30 (9:30 PM) Bangladesh time
      const isNightlyWindow = (dhakaHour === 20 && dhakaMinute >= 30) || (dhakaHour === 21 && dhakaMinute <= 30);
      if (!isNightlyWindow) return;

      const todayStart = new Date(`${dhakaDateStr}T00:00:00.000Z`);
      const todayEnd = new Date(`${dhakaDateStr}T23:59:59.999Z`);

      const eligibleUsers = await User.find({
        isSubscribed: true,
        lastFollowUpDate: { $ne: dhakaDateStr },
        $or: [
          { whatsapp: { $exists: true, $ne: '' } },
          { mobile: { $exists: true, $ne: '' } }
        ]
      });

      for (const user of eligibleUsers) {
        const targetNumber = user.whatsapp || user.mobile;
        if (!targetNumber) continue;

        // 1. Check if user already interacted today
        if (user.lastActiveAt) {
          const lastActiveDateStr = new Date(user.lastActiveAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
          if (lastActiveDateStr === dhakaDateStr) {
            await User.findByIdAndUpdate(user._id, { lastFollowUpDate: dhakaDateStr });
            continue;
          }
        }

        // 2. Check if user had any reminder activities today
        const todayRemindersCount = await Reminder.countDocuments({
          userId: user._id,
          $or: [
            { createdAt: { $gte: todayStart, $lte: todayEnd } },
            { date: { $gte: todayStart, $lte: todayEnd } }
          ]
        });

        if (todayRemindersCount > 0) {
          await User.findByIdAndUpdate(user._id, { lastFollowUpDate: dhakaDateStr });
          continue;
        }

        // Mark as sent today
        await User.findByIdAndUpdate(user._id, { lastFollowUpDate: dhakaDateStr });

        const salutation = user.honorific || (user.name ? user.name.split(' ')[0] : 'সুপ্রিয় গ্রাহক');
        const promptBody = `🌙 আসসালামু আলাইকুম ${salutation}!\nআশা করি আপনার আজকের দিনটি সুন্দর কেটেছে। 😊\n\nকালকের জন্য কি কোনো জরুরি কাজ, মিটিং বা ওষুধের রিমাইন্ডার সেট করে রাখতে চান? আমাকে শুধু লিখে বা মুখে বলে দিন, আমি মনে করিয়ে দেব!`;

        const buttons = [
          { id: 'followup_set_reminder', title: 'রিমাইন্ডার দেব ⏰' },
          { id: 'followup_not_today', title: 'আজকে লাগবে না 👍' }
        ];

        const buttonsSent = await sendMetaWhatsAppButtons(targetNumber, promptBody, buttons);
        if (!buttonsSent) {
          const fallbackText = `${promptBody}\n\n👉 রিমাইন্ডার দিতে লিখুন: যেমন "কাল সকাল ৯টায় মিটিং"\n👉 আজ কিছু না থাকলে লিখুন: "না" বা "লাগবে না"`;
          await sendWhatsAppAlert(targetNumber, fallbackText);
        }

        console.log(`🌙 [NightlyFollowUp] Proactive check-in dispatched to ${targetNumber} (${user.name})`);
      }
    } catch (err) {
      console.error('[NightlyFollowUp] Error running nightly follow-up:', err);
    }
  };

  // Urgent ringer loop: Fires Ring 2, 3, 4 every 60s for unanswered wake-up / Sehri alarms
  const checkAndFireAlarmRingers = async () => {
    if (mongoose.connection.readyState !== 1) return;
    if (activeAlarmRingers.size === 0) return;

    const now = Date.now();
    for (const [remId, ringer] of activeAlarmRingers.entries()) {
      if (now >= ringer.nextRingAt) {
        try {
          // Verify reminder status in database
          const reminder = await Reminder.findById(ringer.reminderId);
          if (!reminder || reminder.status === 'Completed' || reminder.status === 'Cancelled') {
            activeAlarmRingers.delete(remId);
            continue;
          }

          ringer.ringCount += 1;
          const currentRing = ringer.ringCount;
          const totalRings = ringer.maxRings;

          let ringMsg = '';
          if (ringer.isSehri) {
            if (currentRing === 2) {
              ringMsg = `🚨🌙 (রিং ২/৩) সেহরির অ্যালার্ম! ঘুম ভাঙার সময় হয়ে গেছে! সেহরির শেষ সময় আর বেশি বাকি নেই! ⏰⏰\n\n📌 বিষয়: ${ringer.title}\nঅনুগ্রহ করে এখনই বিছানা ছাড়ুন ও খাবার গ্রহণ করুন! 🤲`;
            } else {
              ringMsg = `🚨🚨🚨 (চূড়ান্ত রিং ৩/৩) সেহরির চূড়ান্ত অ্যালার্ম! আপনি এখনও ঘুম থেকে ওঠেননি! ⏰📢\n\nসময় দ্রুত শেষ হচ্ছে, এখনই সেহরি খেয়ে রোজা রাখুন! 🌙`;
            }
          } else {
            if (currentRing === 2) {
              ringMsg = `🚨🔔 (রিং ২/৩) ওয়েক-আপ অ্যালার্ম! ঘুম থেকে ওঠার জরুরি সংকেত! ⏰⏰\n\n📌 বিষয়: ${ringer.title}\nঅনুগ্রহ করে জেগে উঠুন!`;
            } else {
              ringMsg = `🚨🚨🚨 (চূড়ান্ত রিং ৩/৩) চূড়ান্ত ওয়েক-আপ সংকেত! আপনার গুরুত্বপূর্ণ কাজ অপেক্ষা করছে, আর দেরি না করে এখনই উঠে পড়ুন! ☀️`;
            }
          }

          const buttons = [
            { id: `rem_done_${ringer.reminderId}`, title: ringer.isSehri ? 'জেগে গেছি 🤲' : 'জেগে গেছি ✅' },
            { id: `rem_reschedule_${ringer.reminderId}`, title: '৫ মিনিট স্নুজ 💤' }
          ];

          const sent = await sendMetaWhatsAppButtons(ringer.phone, ringMsg, buttons);
          if (!sent) {
            await sendWhatsAppAlert(ringer.phone, `${ringMsg}\n\n👉 জেগে গেলে লিখুন: "জেগে গেছি" বা "উঠেছি"`);
          }

          console.log(`🔔 [AlarmRinger] Dispatched ring ${currentRing}/${totalRings} for reminder ${ringer.reminderId} to ${ringer.phone}`);

          if (currentRing >= totalRings) {
            activeAlarmRingers.delete(remId);
          } else {
            ringer.nextRingAt = Date.now() + 60 * 1000; // Next ring in 60s
          }
        } catch (err) {
          console.error(`[AlarmRinger] Error processing ring for ${remId}:`, err);
          activeAlarmRingers.delete(remId);
        }
      }
    }
  };

  // Automated Ramadan Sehri & Iftar Tracker for 64 Districts
  const checkAndDispatchRamadanAlerts = async () => {
    if (mongoose.connection.readyState !== 1) return;

    try {
      const now = new Date();
      const dhakaTimeStr = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }); // Format: "HH:mm"
      const dhakaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // "YYYY-MM-DD"

      const users = await User.find({
        isSubscribed: true,
        'ramadanAlerts.enabled': { $ne: false },
        $or: [
          { whatsapp: { $exists: true, $ne: '' } },
          { mobile: { $exists: true, $ne: '' } }
        ]
      });

      for (const u of users) {
        const targetNumber = u.whatsapp || u.mobile;
        if (!targetNumber) continue;

        const district = u.district || 'Dhaka';
        const times = getRamadanTimes(district, now);
        const salutation = u.honorific || (u.name ? u.name.split(' ')[0] : 'সুপ্রিয় গ্রাহক');

        // Helper: subtract minutes from "HH:mm"
        const subMinutes = (timeStr: string, mins: number): string => {
          const [h, m] = timeStr.split(':').map(Number);
          const total = h * 60 + m - mins;
          const normalized = ((total % 1440) + 1440) % 1440;
          return `${Math.floor(normalized / 60).toString().padStart(2, '0')}:${(normalized % 60).toString().padStart(2, '0')}`;
        };

        const sehriMinsBefore = u.ramadanAlerts?.sehriMinutesBefore || 40;
        const sehriAlarmTime = subMinutes(times.sehriEnd, sehriMinsBefore);
        const iftarNoticeTime = subMinutes(times.iftar, 15);
        const iftarExactTime = times.iftar;

        // 1. Sehri Wake-up Multi-Ring Alarm
        if (dhakaTimeStr === sehriAlarmTime && u.ramadanAlerts?.lastSehriAlertDate !== dhakaDateStr) {
          await User.findByIdAndUpdate(u._id, { 'ramadanAlerts.lastSehriAlertDate': dhakaDateStr });

          const sehriRem = await Reminder.create({
            userId: u._id,
            title: `সেহরির অ্যালার্ম (${times.districtBn} জেলা)`,
            date: new Date(`${dhakaDateStr}T00:00:00.000Z`),
            time: dhakaTimeStr,
            priority: 'Urgent',
            category: 'wakeup',
            repeat: 'Daily',
            status: 'Pending',
            isAlarm: true
          });

          const alertBody = `🌙🔔⏰ আসসালামু আলাইকুম ${salutation}! সেহরির সময় হয়েছে! ঘুম থেকে উঠুন! (রিং ১/৩)\n\n📍 আপনার জেলা: ${times.districtBn}\n⏳ সেহরি শেষ: ${times.sehriFormatted} (আর ${sehriMinsBefore} মিনিট বাকি)\n\nরোজা রাখার প্রস্তুতি নিতে এবং বরকতময় সেহরি খেতে নিচের বাটনে চাপ দিন:`;

          const buttons = [
            { id: `rem_done_${sehriRem._id}`, title: 'জেগে গেছি 🤲' },
            { id: `rem_reschedule_${sehriRem._id}`, title: '৫ মিনিট স্নুজ 💤' }
          ];

          activeAlarmRingers.set(sehriRem._id.toString(), {
            reminderId: sehriRem._id.toString(),
            userId: u._id.toString(),
            phone: targetNumber,
            title: sehriRem.title,
            isSehri: true,
            ringCount: 1,
            maxRings: 3,
            nextRingAt: Date.now() + 60 * 1000
          });

          const sent = await sendMetaWhatsAppButtons(targetNumber, alertBody, buttons);
          if (!sent) {
            await sendWhatsAppAlert(targetNumber, `${alertBody}\n\n👉 ঘুম ভাঙলে লিখুন: "জেগে গেছি" বা "উঠেছি"`);
          }
          console.log(`🌙 [RamadanScheduler] Automated Sehri alarm dispatched to ${targetNumber} (${times.districtBn})`);
        }

        // 2. Iftar 15-Minute Preparation Notice & Dua
        if (dhakaTimeStr === iftarNoticeTime && u.ramadanAlerts?.lastIftarNoticeDate !== dhakaDateStr) {
          await User.findByIdAndUpdate(u._id, { 'ramadanAlerts.lastIftarNoticeDate': dhakaDateStr });

          const iftarNoticeMsg = `🤲🌙 আসসালামু আলাইকুম ${salutation}!\nইফতারের আর মাত্র ১৫ মিনিট বাকি (${times.districtBn} জেলায় ${times.iftarFormatted} এ)।\n\nইফতারের প্রস্তুতি নিন এবং বেশি বেশি দোয়া ও ইস্তিগফার করুন। রাসূলুল্লাহ (সা.) বলেছেন: "ইফতারের সময় রোজাদারের দোয়া আল্লাহ কখনো ফিরিয়ে দেন না।"\n\n🍽️ ইফতারের দোয়া:\n"${RAMADAN_DUAS.iftarDua.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.iftarDua.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.iftarDua.meaning}"`;

          await sendWhatsAppAlert(targetNumber, iftarNoticeMsg);
          console.log(`🌙 [RamadanScheduler] Iftar 15-min notice dispatched to ${targetNumber} (${times.districtBn})`);
        }

        // 3. Exact Iftar Moment Alert
        if (dhakaTimeStr === iftarExactTime && u.ramadanAlerts?.lastIftarAlertDate !== dhakaDateStr) {
          await User.findByIdAndUpdate(u._id, { 'ramadanAlerts.lastIftarAlertDate': dhakaDateStr });

          const iftarMomentMsg = `🔔🌙 মাগরিবের আজান হয়েছে! ইফতারের সময় হয়ে গেছে (${times.districtBn} জেলা)!\n\nসুন্নাহ অনুযায়ী দ্রুত খেজুর বা পানি দিয়ে ইফতার সম্পন্ন করুন।\n\n🤲 ইফতারের পরের সুন্নাহ দোয়া:\n"${RAMADAN_DUAS.iftarSunnahDua.arabic}"\nউচ্চারণ: ${RAMADAN_DUAS.iftarSunnahDua.pronunciation}\nঅর্থ: "${RAMADAN_DUAS.iftarSunnahDua.meaning}"\n\nআল্লাহ আপনার আজকের সিয়াম কবুল করুন। আমিন! 🤲`;

          await sendWhatsAppAlert(targetNumber, iftarMomentMsg);
          console.log(`🌙 [RamadanScheduler] Exact Iftar moment alert dispatched to ${targetNumber} (${times.districtBn})`);
        }
      }
    } catch (err) {
      console.error('[RamadanScheduler] Error checking Ramadan alerts:', err);
    }
  };

  // Run on startup
  setTimeout(checkAndDispatchReminders, 5000);
  setTimeout(checkAndSendNightlyFollowUp, 15000);
  setTimeout(checkAndDispatchRamadanAlerts, 10000);

  // Poll every 30 seconds for reminders
  setInterval(checkAndDispatchReminders, 30000);
  // Check nightly follow-up every 2 minutes
  setInterval(checkAndSendNightlyFollowUp, 120000);
  // Check active alarm ringers every 15 seconds
  setInterval(checkAndFireAlarmRingers, 15000);
  // Check Ramadan Sehri & Iftar alerts every 30 seconds
  setInterval(checkAndDispatchRamadanAlerts, 30000);
};
