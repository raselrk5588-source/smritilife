import { Request, Response } from 'express';
import User from '../models/User';
import Reminder from '../models/Reminder';
import { analyzeMessage } from '../services/aiWhatsAppService';

// Function to send a message via Meta API
const sendMetaWhatsAppMessage = async (to: string, text: string) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('WhatsApp API credentials missing in .env');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
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
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      console.error('Error sending Meta message:', data);
    }
  } catch (error) {
    console.error('Fetch error sending Meta message:', error);
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
        if (message.type === 'text') {
          userMessage = message.text.body;
        }

        if (!fromNumber || !userMessage) return;

        // WhatsApp cloud API sends number with country code without +
        // Using a regex to match the end of the number is safer to find the user
        const shortNumber = fromNumber.length > 10 ? fromNumber.slice(-10) : fromNumber;
        const user = await User.findOne({ whatsapp: { $regex: new RegExp(shortNumber + '$') } });

        if (!user) {
          await sendMetaWhatsAppMessage(fromNumber, 'দুঃখিত, এই নম্বরটি Smriti অ্যাপে নিবন্ধিত নয়। দয়া করে আপনার প্রোফাইলে গিয়ে WhatsApp নম্বর আপডেট করুন।');
          return;
        }

        // Use AI to analyze the message
        const aiResponse = await analyzeMessage(fromNumber, userMessage);

        switch (aiResponse.action) {
          case 'create_reminder':
            if (aiResponse.data) {
              await Reminder.create({
                userId: user._id,
                title: aiResponse.data.title || 'New Reminder',
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
