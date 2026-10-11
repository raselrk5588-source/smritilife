import mongoose from 'mongoose';
import Reminder from '../models/Reminder';
import User from '../models/User';

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
        console.log(`[ReminderScheduler] Found ${dueReminders.length} due reminders at Dhaka time ${dhakaTimeStr}`);

        for (const reminder of dueReminders) {
          // Atomically claim the reminder so NO other process or duplicate tick can process it
          const claimed = await Reminder.findOneAndUpdate(
            { _id: reminder._id, status: 'Pending' },
            { $set: { status: 'Completed' } }
          );
          if (!claimed) continue;

          const user = await User.findById(reminder.userId);
          const senderName = user?.name || 'আপনার পরিচিত জন';
          const senderNumber = user?.whatsapp || user?.mobile;

          if (reminder.recipientPhone) {
            // Scheduled message to someone else
            const messageBody = reminder.description || reminder.title;
            const thirdPartyAlert = `🔔 আসসালামু আলাইকুম!\n\n${senderName} (${senderNumber || ''}) আপনাকে একটি বার্তা পাঠিয়েছেন:\n\n💬 "${messageBody}"\n\n(বার্তাটি স্মৃতি প্ল্যাটফর্মের মাধ্যমে স্বয়ংক্রিয়ভাবে প্রেরিত)`;

            await sendWhatsAppAlert(reminder.recipientPhone, thirdPartyAlert);
            console.log(`[ReminderScheduler] Dispatched third-party message to ${reminder.recipientPhone}`);

            // Also confirm to the sender that their message was delivered
            if (senderNumber) {
              await sendWhatsAppAlert(senderNumber, `✅ আসসালামু আলাইকুম! ${reminder.recipientPhone} নম্বরে আপনার নির্ধারিত বার্তাটি সফলভাবে পাঠিয়ে দেওয়া হয়েছে:\n"${messageBody}"`);
            }
          } else {
            // Standard reminder for self
            if (senderNumber) {
              const alertText = `🔔 আসসালামু আলাইকুম! এটি আপনার স্মৃতির রিমাইন্ডার:\n\n📌 বিষয়: ${reminder.title}\n⏰ নির্ধারিত সময়: ${reminder.time}\n\nআপনার কাজটি সুন্দরভাবে সম্পন্ন হোক!`;
              
              await sendWhatsAppAlert(senderNumber, alertText);
              console.log(`[ReminderScheduler] Reminder "${reminder.title}" dispatched & marked Completed.`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ReminderScheduler] Error checking reminders:', error);
    }
  };

  // Run on startup
  setTimeout(checkAndDispatchReminders, 5000);

  // Poll every 30 seconds for precision
  setInterval(checkAndDispatchReminders, 30000);
};
