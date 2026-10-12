import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import User from '../models/User';
import { deliverWishCard } from './wishDeliveryService';
import { formatTime12Hour } from './aiWhatsAppService';
import { sendMetaWhatsAppButtons, userReminderState } from '../controllers/whatsappController';

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
              const alertBody = `🔔 আসসালামু আলাইকুম! এটি আপনার স্মৃতির রিমাইন্ডার:\n\n📌 বিষয়: ${reminder.title}\n⏰ নির্ধারিত সময়: ${displayTime}`;

              // Track in active state for tracking response
              userReminderState.set(reminder.userId.toString(), {
                reminderId: reminder._id.toString(),
                title: reminder.title,
                waitingForTime: false,
                expiresAt: Date.now() + 4 * 60 * 60 * 1000
              });

              const buttons = [
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

  // Run on startup
  setTimeout(checkAndDispatchReminders, 5000);

  // Poll every 30 seconds for precision
  setInterval(checkAndDispatchReminders, 30000);
};
