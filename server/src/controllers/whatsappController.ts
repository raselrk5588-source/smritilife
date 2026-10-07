import { Request, Response } from 'express';
import twilio from 'twilio';
import User from '../models/User';
import Reminder from '../models/Reminder';
import { analyzeMessage } from '../services/aiWhatsAppService';

const MessagingResponse = twilio.twiml.MessagingResponse;

export const receiveWebhook = async (req: Request, res: Response) => {
  const twiml = new MessagingResponse();

  try {
    const { Body, From } = req.body;

    if (!From || !Body) {
      res.status(400).send('Missing Body or From parameter');
      return;
    }

    const whatsappNumber = From.replace('whatsapp:', '');
    const userMessage = Body.trim();

    // Find user in database
    const user = await User.findOne({ whatsapp: whatsappNumber });

    if (!user) {
      twiml.message('দুঃখিত, এই নম্বরটি Smriti অ্যাপে নিবন্ধিত নয়। দয়া করে আপনার প্রোফাইলে গিয়ে WhatsApp নম্বর আপডেট করুন।');
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Use AI to analyze the message
    const aiResponse = await analyzeMessage(whatsappNumber, userMessage);

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
          twiml.message(aiResponse.replyText || 'রিমাইন্ডার সেট করা হয়েছে!');
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
            twiml.message(`"${reminderToCancel.title}" রিমাইন্ডারটি ক্যান্সেল করা হয়েছে।`);
          } else {
            twiml.message(`দুঃখিত, "${aiResponse.data.searchQuery}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
          }
        } else {
          twiml.message('কোন রিমাইন্ডারটি ক্যান্সেল করতে চান তা বুঝতে পারিনি।');
        }
        break;

      case 'delete_reminder':
        if (aiResponse.data && aiResponse.data.searchQuery) {
          const reminderToDelete = await Reminder.findOneAndDelete({
            userId: user._id,
            title: { $regex: new RegExp(aiResponse.data.searchQuery, 'i') }
          });
          if (reminderToDelete) {
            twiml.message(`"${reminderToDelete.title}" রিমাইন্ডারটি ডিলিট করা হয়েছে।`);
          } else {
            twiml.message(`দুঃখিত, "${aiResponse.data.searchQuery}" নামের কোনো রিমাইন্ডার খুঁজে পাওয়া যায়নি।`);
          }
        } else {
          twiml.message('কোন রিমাইন্ডারটি ডিলিট করতে চান তা বুঝতে পারিনি।');
        }
        break;

      case 'general_reply':
      default:
        twiml.message(aiResponse.replyText || 'দুঃখিত, বুঝতে পারিনি।');
        break;
    }

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    twiml.message('দুঃখিত, সার্ভারে একটি সমস্যা হয়েছে।');
    res.type('text/xml').send(twiml.toString());
  }
};
