import { Request, Response } from 'express';
import User from '../models/User';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import { analyzeMessage, analyzeAudioMessage, formatTime12Hour, parseBengaliTime, parseRelativeDate } from '../services/aiWhatsAppService';
import { deliverWishCard, getOccasionImageUrl, getOccasionTitle } from '../services/wishDeliveryService';

export interface ReminderActionState {
  reminderId: string;
  title: string;
  waitingForTime: boolean;
  expiresAt: number;
}

// In-memory state tracking for active reminder prompts
export const userReminderState = new Map<string, ReminderActionState>();

// Function to send interactive buttons via Meta API
export const sendMetaWhatsAppButtons = async (
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
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

// Function to send a message via Meta API
const sendMetaWhatsAppMessage = async (to: string, text: string) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('WhatsApp API credentials missing in .env');
    return;
  }

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
          to: to,
          type: 'text',
          text: { body: text }
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error('Error sending Meta message:', data);
      } else {
        console.log(`✅ Meta WhatsApp Reply sent to ${to}: "${text}"`);
      }
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} error sending Meta message:`, error);
      if (attempt === 2) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

// Function to download voice audio from Meta API
const downloadMetaAudio = async (mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> => {
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
    const mimeType = metaData.mime_type || 'audio/ogg';

    const fileRes = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!fileRes.ok) {
      console.error('Failed to download media bytes:', fileRes.status);
      return null;
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch (error) {
    console.error('Error downloading Meta audio file:', error);
    return null;
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

        if (message.type === 'text') {
          userMessage = message.text?.body || '';
        } else if (message.type === 'interactive') {
          if (message.interactive?.type === 'button_reply') {
            buttonId = message.interactive.button_reply?.id || '';
            userMessage = message.interactive.button_reply?.title || '';
          }
        } else if (message.type === 'button') {
          buttonId = message.button?.payload || '';
          userMessage = message.button?.text || '';
        } else if (message.type === 'audio' || message.type === 'voice') {
          isAudio = true;
          audioMediaId = message.audio?.id || message.voice?.id || '';
          audioMimeType = message.audio?.mime_type || message.voice?.mime_type || 'audio/ogg';
        }

        if (!fromNumber || (!userMessage && !isAudio && !buttonId)) return;

        // WhatsApp cloud API sends number with country code without +
        // Using a regex to match the end of the number is safer to find the user
        const shortNumber = fromNumber.length > 10 ? fromNumber.slice(-10) : fromNumber;
        const user = await User.findOne({
          $or: [
            { whatsapp: { $regex: new RegExp(shortNumber + '$') } },
            { mobile: { $regex: new RegExp(shortNumber + '$') } }
          ]
        });

        if (!user) {
          await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, এই নম্বরটি Smriti অ্যাপে নিবন্ধিত নয়। দয়া করে আপনার প্রোফাইলে গিয়ে WhatsApp নম্বর আপডেট করুন।');
          return;
        }

        // If user whatsapp was not set, link it now
        if (!user.whatsapp) {
          user.whatsapp = fromNumber;
          await user.save();
        }

        // --- STEP 1: Handle Interactive Button Clicks ---
        if (buttonId.startsWith('rem_done_')) {
          const remId = buttonId.replace('rem_done_', '');
          const reminder = await Reminder.findByIdAndUpdate(remId, { status: 'Completed' }, { new: true });
          userReminderState.delete(user._id.toString());
          const title = reminder?.title || 'কাজটি';
          await sendMetaWhatsAppMessage(
            fromNumber,
            `🎉 দারুণ! "${title}" সফলভাবে সম্পন্ন হিসেবে মার্ক করা হলো। আপনার দিনটি শুভ হোক!`
          );
          return;
        }

        if (buttonId.startsWith('rem_reschedule_')) {
          const remId = buttonId.replace('rem_reschedule_', '');
          const reminder = await Reminder.findById(remId);
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

        // --- STEP 2: Handle Conversational Yes / No / Reschedule for Active Reminders ---
        const cleanText = userMessage.trim();
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

        const isYesIntent = /^(?:হ্যাঁ|হ্যা|হাঁ|হুম|জি|করেছি|করছি|হয়ে\s*গেছে|হয়েগেছে|সম্পন্ন|yes|done|completed|yep|yeah|koresi|hoise|join\s*koresi)\b/i.test(cleanText);
        const isNoIntent = /^(?:না|নো|না\s*করিনি|না\s*করি\s*নাই|করি\s*নাই|করিনি|no|nope|reschedule|kori\s*ni|hoy\s*ni|join\s*kori\s*ni)\b/i.test(cleanText);

        if (activeState && isYesIntent) {
          await Reminder.findByIdAndUpdate(activeState.reminderId, { status: 'Completed' });
          userReminderState.delete(user._id.toString());
          await sendMetaWhatsAppMessage(
            fromNumber,
            `🎉 চমৎকার! "${activeState.title}" সফলভাবে সম্পন্ন হিসেবে মার্ক করা হলো!`
          );
          return;
        }

        if (activeState && (isNoIntent || activeState.waitingForTime)) {
          // Check if message has a time mentioned (e.g. "না, বিকাল ৫টায় দাও" or just "বিকাল ৫টায়")
          const hasTimeMatch = cleanText.match(/(?:(\d{1,2}|[০-৯]{1,2})(?::(\d{2}|[০-৯]{2}))?\s*(?:টা|টায়|টায়|am|pm|AM|PM)?)/i);
          if (hasTimeMatch && hasTimeMatch[1]) {
            const parsedTime = parseBengaliTime(cleanText);
            const targetDate = parseRelativeDate(cleanText, parsedTime);
            await Reminder.findByIdAndUpdate(activeState.reminderId, {
              time: parsedTime,
              date: targetDate,
              status: 'Pending'
            });
            userReminderState.delete(user._id.toString());
            const dStr = targetDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', timeZone: 'Asia/Dhaka' });
            await sendMetaWhatsAppMessage(
              fromNumber,
              `✅ ঠিক আছে! "${activeState.title}" রিমাইন্ডারটি পুনঃনির্ধারণ করা হলো:\n⏰ নতুন সময়: ${formatTime12Hour(parsedTime)} (${dStr})`
            );
            return;
          }

          // If no time is provided yet, prompt for time
          activeState.waitingForTime = true;
          userReminderState.set(user._id.toString(), activeState);
          await sendMetaWhatsAppMessage(
            fromNumber,
            `⏰ কোনো সমস্যা নেই! আপনি কখন বা কোন সময়ে রিমাইন্ডারটি পুনঃনির্ধারণ করতে চান বলুন (যেমন: "আজ বিকাল ৫টায়" বা "কাল সকাল ১০টায়")।`
          );
          return;
        }

        // --- STEP 3: Regular AI Message & Audio Analysis ---
        let aiResponse: any;

        if (isAudio && audioMediaId) {
          console.log(`🎤 Received WhatsApp Voice Note from ${fromNumber}. Downloading audio...`);
          const audioData = await downloadMetaAudio(audioMediaId);
          if (audioData) {
            aiResponse = await analyzeAudioMessage(fromNumber, audioData.buffer, audioData.mimeType);
          } else {
            await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, আপনার ভয়েস মেসেজটি ডাউনলোড করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
            return;
          }
        } else {
          console.log(`📩 Received WhatsApp Message from ${fromNumber}: "${userMessage}"`);
          aiResponse = await analyzeMessage(fromNumber, userMessage);
        }

        switch (aiResponse.action) {
          case 'create_wish':
            if (aiResponse.data) {
              const wishData = aiResponse.data;
              const recipientPhone = wishData.recipientPhone;
              const recipientName = wishData.recipientName || 'প্রিয়জন';
              const occasion = wishData.occasion || 'birthday';
              const occasionTitle = getOccasionTitle(occasion);
              const message = wishData.message || `শুভ ${occasionTitle}! আপনার জীবন সুন্দর ও আনন্দময় হোক।`;
              const imageUrl = wishData.imageUrl || getOccasionImageUrl(occasion);
              const sendNow = wishData.sendNow !== false;

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
              const todayStart = new Date(`${dhakaDateStr}T00:00:00.000Z`);
              const todayEnd = new Date(`${dhakaDateStr}T23:59:59.999Z`);
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
              text += `💡 পরিবর্তন করতে: "[নাম] রিমাইন্ডারের সময় ৫টায় দাও"\n💡 ডিলিট করতে: "[নাম] ডিলিট করো" অথবা "সব রিমাইন্ডার ডিলিট করে দাও"`;
              await sendMetaWhatsAppMessage(fromNumber, text.trim());
            }
            break;
          }

          case 'modify_reminder': {
            if (aiResponse.data && aiResponse.data.searchQuery) {
              const query = aiResponse.data.searchQuery.trim();
              const updateFields: any = {};
              if (aiResponse.data.time) updateFields.time = aiResponse.data.time;
              if (aiResponse.data.date) updateFields.date = new Date(aiResponse.data.date);
              if (aiResponse.data.newTitle) updateFields.title = aiResponse.data.newTitle.trim();
              // Reset status to Pending in case it was Cancelled or Sent
              updateFields.status = 'Pending';

              const updatedReminder = await Reminder.findOneAndUpdate(
                {
                  userId: user._id,
                  title: { $regex: new RegExp(query, 'i') }
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
                  `দুঃখিত, "${query}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি। আপনার সব রিমাইন্ডার দেখতে "সব রিমাইন্ডার দেখাও" লিখুন।`
                );
              }
            } else {
              await sendMetaWhatsAppMessage(
                fromNumber,
                'কোন রিমাইন্ডারটি এবং কী পরিবর্তন করতে চান তা উল্লেখ করুন (যেমন: "মিটিং রিমাইন্ডার সময় ৫টায় দাও")।'
              );
            }
            break;
          }

          case 'delete_all_reminders': {
            const count = await Reminder.countDocuments({ userId: user._id });
            if (count === 0) {
              await sendMetaWhatsAppMessage(fromNumber, 'আপনার বর্তমানে কোনো রিমাইন্ডার সেভ করা নেই।');
            } else {
              await Reminder.deleteMany({ userId: user._id });
              await sendMetaWhatsAppMessage(fromNumber, `🗑️ আপনার সব (${count}টি) রিমাইন্ডার সফলভাবে মুছে ফেলা হয়েছে!`);
            }
            break;
          }

          case 'create_reminder':
            if (aiResponse.data) {
              const cleanTitle = (aiResponse.data.title || 'নতুন রিমাইন্ডার').trim();
              const category = aiResponse.data.recipientPhone ? 'message' : (aiResponse.data.category || 'General');
              await Reminder.create({
                userId: user._id,
                title: cleanTitle,
                description: aiResponse.data.customMessage || aiResponse.data.description,
                recipientPhone: aiResponse.data.recipientPhone || undefined,
                date: new Date(aiResponse.data.date || new Date()),
                time: aiResponse.data.time || '10:00',
                priority: 'Medium',
                category: category,
                repeat: 'Once',
                status: 'Pending'
              });
              await sendMetaWhatsAppMessage(
                fromNumber,
                aiResponse.replyText || `আপনার রিমাইন্ডার "${cleanTitle}" সেট করা হয়েছে!`
              );
            }
            break;

          case 'cancel_reminder':
            if (aiResponse.data && aiResponse.data.searchQuery) {
              const query = aiResponse.data.searchQuery.trim();
              const reminderToCancel = await Reminder.findOneAndUpdate(
                { 
                  userId: user._id, 
                  title: { $regex: new RegExp(query, 'i') },
                  status: { $ne: 'Cancelled' }
                },
                { status: 'Cancelled' },
                { new: true }
              );
              if (reminderToCancel) {
                await sendMetaWhatsAppMessage(fromNumber, `⚠️ "${reminderToCancel.title}" রিমাইন্ডারটি সফলভাবে বাতিল (Cancel) করা হয়েছে।`);
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${query}" নামের কোনো সক্রিয় রিমাইন্ডার খুঁজে পাওয়া যায়নি। আপনার রিমাইন্ডার দেখতে "সব রিমাইন্ডার দেখাও" লিখুন।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি বাতিল করতে চান তার নাম লিখুন (যেমন: "মিটিং রিমাইন্ডার ক্যান্সেল করো")।');
            }
            break;

          case 'delete_reminder':
            if (aiResponse.data && aiResponse.data.searchQuery) {
              const query = aiResponse.data.searchQuery.trim();
              const reminderToDelete = await Reminder.findOneAndDelete({
                userId: user._id,
                title: { $regex: new RegExp(query, 'i') }
              });
              if (reminderToDelete) {
                await sendMetaWhatsAppMessage(fromNumber, `🗑️ "${reminderToDelete.title}" রিমাইন্ডারটি সফলভাবে ডিলিট করা হয়েছে।`);
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${query}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি। আপনার সব রিমাইন্ডার দেখতে "সব রিমাইন্ডার দেখাও" লিখুন।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি ডিলিট করতে চান তার নাম লিখুন (যেমন: "মিটিং ডিলিট করো" অথবা "সব রিমাইন্ডার ডিলিট করে দাও")।');
            }
            break;

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
