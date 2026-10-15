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
import { analyzeMessage, analyzeAudioMessage, formatTime12Hour, parseBengaliTime, parseRelativeDate, cleanPersonName, invalidateRulesCache } from '../services/aiWhatsAppService';
import { deliverWishCard, getOccasionImageUrl, getOccasionTitle } from '../services/wishDeliveryService';
import { cancelAlarmRinger } from '../services/reminderScheduler';
import { getRamadanTimes, matchDistrict, RAMADAN_DUAS, formatBanglaTime, BD_DISTRICTS } from '../services/ramadanService';
import { parseExpenseInput, recordExpense, getExpenseSummary, getExpenseSummaryForDate, getExpenseSummaryForMonth, detectExpenseCategory, buildExpenseLoggedMessage, buildDailyExpenseQueryMessage, buildMonthlyExpenseQueryMessage } from '../services/expenseService';
import { parseDebtInput, recordDebt, settleDebtByPerson, getDebtSummary, getPersonDebtSummary, buildDebtLoggedMessage, buildDebtSettledMessage, buildDebtSummaryMessage, buildPersonDebtMessage } from '../services/debtService';
import { detectDocumentCategory, saveFileToDisk, uploadBufferToMeta, findMatchingDocument, formatDocumentListMessage } from '../services/documentService';

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

// In-memory state tracking for active reminder prompts, wish prompts, and pending document uploads
export const userReminderState = new Map<string, ReminderActionState>();
export const userWishState = new Map<string, WishPendingState>();
export const userDocPendingState = new Map<string, DocumentPendingState>();

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
              `✅ *আপনার ফাইলটি সফলভাবে মেমোরিতে সংরক্ষণ করেছি${salutation}!* 📁\n\n📄 *ফাইলের নাম:* ${title}\n📂 *ক্যাটাগরি:* ${category}\n📅 *তারিখ:* ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n💡 *পরবর্তীতে ফাইলটি পেতে:* যেকোনো সময় লিখুন—\n👉 *"আমার ${title} দাও"* বা *"প্রেসক্রিপশনটা পাঠাও"*\nস্মৃতি তৎক্ষণাৎ আপনার ফাইলটি পাঠিয়ে দেবে!`
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
              `✅ *আপনার ফাইলটি "${title}" নামে সফলভাবে সেভ করা হয়েছে${salutation}!* 📁\n\n📂 *ক্যাটাগরি:* ${category}\n📅 *তারিখ:* ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n💡 ভবিষ্যতে ফাইলটি প্রয়োজন হলে শুধু লিখবেন:\n👉 *"আমার ${title} দাও"*`
            );
            return;
          }
        }

        // --- STEP 0D: Handle Document Retrieval & Listing ("আমার প্রেসক্রিপশন দাও", "রিপোর্ট পাঠাও", "সব ফাইল দেখাও") ---
        const isDocListQuery = /^(?:\/docs|\/files|ফাইলগুলো|ডকুমেন্টগুলো|সব\s*ফাইল|লিস্ট\s*ফাইল)\b/i.test(cleanText) ||
          /(?:আমার|amr|amar)?\s*(?:কি\s*কি|কোন\s*কোন|সব|সকল|list)?\s*(?:ফাইল|ডকুমেন্ট|কাগজ|প্রেসক্রিপশন|রিপোর্ট|file|doc|document)\s*(?:আছে|দেখাও|দেখান|লিস্ট|list|সব\s*দেখাও)/i.test(cleanText);

        if (isDocListQuery) {
          const docs = await UserDocument.find({ userId: user._id }).sort({ createdAt: -1 });
          const listMsg = formatDocumentListMessage(docs);
          await sendMetaWhatsAppMessage(fromNumber, listMsg);
          return;
        }

        const isDocFetchQuery =
          /(?:আমাকে|দাও|পাঠাও|পাঠান|দিবেন|দেখান|দেখাও|খুঁজে\s*দাও|chai|dao|pathao|pathan|dehao|dekhan|send|show|give|fetch)\s*(?:amar|amr|আমার|মায়ের|আম্মুর|বাবার|আব্বুর)?\s*(.+)/i.test(cleanText) ||
          /(?:প্রেসক্রিপশন|প্রেস্ক্রিপশন|prescription|রিপোর্ট|report|টেস্ট|test|এনআইডি|nid|সার্টিফিকেট|certificate|রিসিপ্ট|receipt|ভাউচার|বিল|bill)\s*(?:দাও|পাঠাও|পাঠান|দিবেন|দেখান|চাই|dao|pathao|pathan|dehao|dekhan|chai)/i.test(cleanText) ||
          /(?:আমার|আম্মুর|আব্বুর|মায়ের|বাবার)\s*(?:প্রেসক্রিপশন|প্রেস্ক্রিপশন|prescription|রিপোর্ট|report|এনআইডি|nid)\b/i.test(cleanText);

        if (isDocFetchQuery) {
          const doc = await findMatchingDocument(user._id.toString(), cleanText);
          if (doc) {
            let fileBuffer: Buffer | null = null;
            const diskPath = path.join(__dirname, '../../uploads/documents', path.basename(doc.fileUrl));
            if (fs.existsSync(diskPath)) {
              fileBuffer = await fs.promises.readFile(diskPath);
            } else if (doc.fileData) {
              fileBuffer = Buffer.from(doc.fileData, 'base64');
            }

            if (fileBuffer) {
              await sendMetaWhatsAppMessage(fromNumber, `📄 এই যে আপনার সংরক্ষিত ফাইল: *${doc.title}* (${doc.category})`);
              await sendMetaWhatsAppFile(
                fromNumber,
                fileBuffer,
                doc.fileName,
                doc.mimeType,
                `📄 ${doc.title}`
              );
              return;
            }
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
          const reminder = await Reminder.findByIdAndUpdate(remId, { status: 'Completed' }, { new: true });
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
          await Reminder.findByIdAndUpdate(activeState.reminderId, { status: 'Completed' });
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
        // Allow expense commands and queries (yesterday, day before yesterday, specific dates like '10 oct', months)
        const isReminderAction = /মনে\s*করিয়ে|ডাকবে|তুলে\s*দিও|wake\s*me|অ্যালার্ম|alarm/i.test(cleanText);
        if (!isReminderAction) {
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
              text += `💡 *এডিট বা ডিলিট করতে:* নম্বর দিয়ে বলুন (যেমন: "১ নম্বর সময় ৫টায় দাও" বা "২ নম্বর ডিলিট করো")`;
              await sendMetaWhatsAppMessage(fromNumber, text.trim());
            }
            break;
          }

          case 'modify_reminder': {
            const data = aiResponse.data || {};
            const itemIndex = typeof data.index === 'number' ? data.index : undefined;
            const query = (data.searchQuery || '').trim();

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

                const isDaily = isMedicine || 
                                /প্রতিদিন|দৈনিক|রোজ|রোজই|daily|everyday|every\s*day|protidin|potidin|roj|sob\s*din|shob\s*din/i.test(cleanText) ||
                                aiResponse.data.repeat === 'Daily';

                const isSehri = /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(cleanTitle) ||
                                /সেহরি|সাহরি|সেহেরি|সাহেরি|রোজা|রমজান|sehri|sahari|seheri|saheri|romjan|ramadan/i.test(cleanText);

                const isWakeup = isSehri || aiResponse.data.category === 'wakeup' || aiResponse.data.category === 'alarm' || /ঘুম|ঘুমের|ঘুমিয়ে|ঘুমাবো|ঘুমাব|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|ডেকে|ডাকা|ডেকে দিও|ডেকে দাও|ডাকবা|উঠাবা|ঘুম ভাঙা|ঘুম ভাঙ্গানি/i.test(cleanTitle) || /ঘুম|wake|alarm|অ্যালার্ম|উঠা|উঠবো|উঠব|ডেকে|ঘুম ভাঙা/i.test(cleanText);
                const finalCategory = isMedicine ? 'medicine' : (isWakeup ? 'wakeup' : (aiResponse.data.category || 'General'));
                const finalRepeat = isDaily ? 'Daily' : (aiResponse.data.repeat || 'Once');

                let finalTitle = cleanTitle;
                if (isSehri && (!finalTitle || /^(সেহরি|সাহরি|রমজান|romjan|sahari|sehri)$/i.test(finalTitle.trim()) || finalTitle.length < 5)) {
                  finalTitle = 'সেহরির জন্য ঘুম থেকে ওঠা 🌙';
                }

                // Default Sehri time to 04:00 AM if no time was explicitly mentioned
                if (isSehri && reminderTime === '10:00' && !cleanText.match(/\b(?:10|১০)\b/)) {
                  reminderTime = '04:00';
                  formattedTime = '04:00 AM';
                }

                await Reminder.create({
                  userId: user._id,
                  title: finalTitle,
                  description: customMsg,
                  date: reminderDate,
                  time: reminderTime,
                  priority: 'Medium',
                  category: finalCategory,
                  repeat: finalRepeat,
                  status: 'Pending',
                  isAlarm: isWakeup
                });

                let reply = aiResponse.replyText;
                if (isSehri) {
                  const repeatStr = finalRepeat === 'Daily' ? 'প্রতিদিন ' : '';
                  reply = `🌙🔔 আপনার সেহরি ওয়েক-আপ অ্যালার্ম "${finalTitle}" ${repeatStr}ভোর ${formattedTime}-এ সফলভাবে সেট করা হয়েছে! নির্ধারিত সময়ে আপনাকে ঘুম থেকে তোলার জন্য উচ্চশব্দে রিং অ্যালার্ম বাজবে।`;
                } else if (!reply || reply.includes('সেট করা হয়েছে')) {
                  const icon = isMedicine ? '💊' : (isWakeup ? '⏰🔔' : '⏰');
                  const repeatStr = finalRepeat === 'Daily' ? 'প্রতিদিন ' : '';
                  reply = `${icon} আপনার ${isMedicine ? 'ওষুধের ' : (isWakeup ? 'ওয়েক-আপ অ্যালার্ম ' : '')}রিমাইন্ডার "${finalTitle}" ${repeatStr}সময় ${formattedTime}-এ সফলভাবে সেট করা হয়েছে! নির্ধারিত সময়ে ঘুম ভাঙানোর জন্য অ্যালার্ম বাজবে।`;
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
