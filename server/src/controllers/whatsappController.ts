import { Request, Response } from 'express';
import User from '../models/User';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import { analyzeMessage, analyzeAudioMessage } from '../services/aiWhatsAppService';
import { deliverWishCard, getOccasionImageUrl, getOccasionTitle } from '../services/wishDeliveryService';

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
        let isAudio = false;
        let audioMediaId = '';
        let audioMimeType = 'audio/ogg';

        if (message.type === 'text') {
          userMessage = message.text?.body || '';
        } else if (message.type === 'audio' || message.type === 'voice') {
          isAudio = true;
          audioMediaId = message.audio?.id || message.voice?.id || '';
          audioMimeType = message.audio?.mime_type || message.voice?.mime_type || 'audio/ogg';
        }

        if (!fromNumber || (!userMessage && !isAudio)) return;

        // WhatsApp cloud API sends number with country code without +
        // Using a regex to match the end of the number is safer to find the user
        const shortNumber = fromNumber.length > 10 ? fromNumber.slice(-10) : fromNumber;
        const user = await User.findOne({ whatsapp: { $regex: new RegExp(shortNumber + '$') } });

        if (!user) {
          await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, এই নম্বরটি Smriti অ্যাপে নিবন্ধিত নয়। দয়া করে আপনার প্রোফাইলে গিয়ে WhatsApp নম্বর আপডেট করুন।');
          return;
        }

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
                scheduledAt = new Date(`${wishData.date}T${timeStr}:00.000Z`);
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

          case 'create_reminder':
            if (aiResponse.data) {
              await Reminder.create({
                userId: user._id,
                title: aiResponse.data.title || 'New Reminder',
                description: aiResponse.data.customMessage || aiResponse.data.description,
                recipientPhone: aiResponse.data.recipientPhone || undefined,
                date: new Date(aiResponse.data.date || new Date()),
                time: aiResponse.data.time || '10:00',
                priority: 'Medium',
                category: 'General',
                repeat: 'Once',
                status: 'Pending'
              });
              await sendMetaWhatsAppMessage(fromNumber, aiResponse.replyText || 'রিমাইন্ডার সেট করা হয়েছে!');
            }
            break;

          case 'cancel_reminder':
            if (aiResponse.data && aiResponse.data.searchQuery) {
              const reminderToCancel = await Reminder.findOneAndUpdate(
                { 
                  userId: user._id, 
                  title: { $regex: new RegExp(aiResponse.data.searchQuery, 'i') },
                  status: { $ne: 'Cancelled' }
                },
                { status: 'Cancelled' },
                { new: true }
              );
              if (reminderToCancel) {
                await sendMetaWhatsAppMessage(fromNumber, `"${reminderToCancel.title}" রিমাইন্ডারটি ক্যান্সেল করা হয়েছে।`);
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${aiResponse.data.searchQuery}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি ক্যান্সেল করতে চান তা বুঝতে পারিনি।');
            }
            break;

          case 'delete_reminder':
            if (aiResponse.data && aiResponse.data.searchQuery) {
              const reminderToDelete = await Reminder.findOneAndDelete({
                userId: user._id,
                title: { $regex: new RegExp(aiResponse.data.searchQuery, 'i') }
              });
              if (reminderToDelete) {
                await sendMetaWhatsAppMessage(fromNumber, `"${reminderToDelete.title}" রিমাইন্ডারটি ডিলিট করা হয়েছে।`);
              } else {
                await sendMetaWhatsAppMessage(fromNumber, `দুঃখিত, "${aiResponse.data.searchQuery}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
              }
            } else {
              await sendMetaWhatsAppMessage(fromNumber, 'কোন রিমাইন্ডারটি ডিলিট করতে চান তা বুঝতে পারিনি।');
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
