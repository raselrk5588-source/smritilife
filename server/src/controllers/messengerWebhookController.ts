import { Request, Response } from 'express';
import FacebookPage from '../models/FacebookPage';
import FacebookOrder from '../models/FacebookOrder';
import User from '../models/User';
import { processMessengerCustomerMessage } from '../services/messengerAiService';
import { sendMetaWhatsAppMessage } from './whatsappController';

/**
 * Send text message reply to a customer via Facebook Graph API
 */
export const sendMessengerTextMessage = async (
  pageAccessToken: string,
  recipientPsid: string,
  text: string
): Promise<boolean> => {
  try {
    const url = `https://graph.facebook.com/v25.0/me/messages?access_token=${encodeURIComponent(pageAccessToken.trim())}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        messaging_type: 'RESPONSE',
        message: { text }
      }),
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Messenger API Error] Failed to send message to PSID:', recipientPsid, data);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Messenger API Exception]', err?.message || err);
    return false;
  }
};

/**
 * Meta Webhook Verification (GET /api/messenger/webhook)
 */
export const verifyMessengerWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token) {
      const globalVerifyToken = process.env.MESSENGER_VERIFY_TOKEN || 'smriti_messenger_webhook_2026';
      
      // Match global verify token or page-specific verify token
      let isVerified = token === globalVerifyToken;
      if (!isVerified) {
        const pageExists = await FacebookPage.exists({ webhookVerifyToken: token });
        if (pageExists) isVerified = true;
      }

      if (isVerified) {
        console.log('[Messenger Webhook] Verified successfully for token:', token);
        res.status(200).send(challenge);
        return;
      }
    }

    console.warn('[Messenger Webhook] Verification failed for token:', token);
    res.sendStatus(403);
  } catch (error) {
    console.error('[Messenger Webhook Verify Error]', error);
    res.sendStatus(500);
  }
};

/**
 * Meta Webhook Event Handler (POST /api/messenger/webhook)
 */
export const handleMessengerWebhook = async (req: Request, res: Response): Promise<void> => {
  // Acknowledge immediately to prevent Meta webhook timeout/retries
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'page' || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      const pageId = entry.id;
      if (!pageId || !Array.isArray(entry.messaging)) continue;

      // Find registered and active Facebook page
      const page = await FacebookPage.findOne({ pageId, isActive: true });
      if (!page) {
        console.warn(`[Messenger Webhook] Received event for unconfigured/inactive Page ID: ${pageId}`);
        continue;
      }

      for (const event of entry.messaging) {
        const senderPsid = event.sender?.id;
        if (!senderPsid || event.message?.is_echo) {
          // Skip echoes or empty senders
          continue;
        }

        const messageText = event.message?.text || event.message?.quick_reply?.payload;
        if (!messageText) {
          // If customer sent an image or sticker without text
          await sendMessengerTextMessage(
            page.pageAccessToken,
            senderPsid,
            'আসসালামু আলাইকুম! আপনার মেসেজটি পেয়েছি। আপনি কোন পণ্যটি সম্পর্কে জানতে বা অর্ডার করতে চান দয়া করে লিখে জানান।'
          );
          continue;
        }

        // Process message through AI Sales Representative
        const aiResult = await processMessengerCustomerMessage(page, senderPsid, messageText);

        // Send reply back to customer
        if (aiResult.replyText) {
          await sendMessengerTextMessage(page.pageAccessToken, senderPsid, aiResult.replyText);
        }

        // If an order was confirmed by customer
        if (aiResult.orderAction && aiResult.orderAction.isConfirmed) {
          const action = aiResult.orderAction;

          // Prevent duplicate order creation if duplicate webhook arrives within 1 minute
          const recentOrder = await FacebookOrder.findOne({
            pageId: page.pageId,
            customerPsid: senderPsid,
            createdAt: { $gte: new Date(Date.now() - 60000) }
          });

          if (!recentOrder) {
            const orderNumber = `ORD-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
            const subtotal = action.price * (action.quantity || 1);
            const totalAmount = action.totalAmount || (subtotal + action.deliveryCharge);

            const newOrder = await FacebookOrder.create({
              pageId: page.pageId,
              merchantUserId: page.userId,
              customerPsid: senderPsid,
              customerName: action.customerName || 'সম্মানিত কাস্টমার',
              customerPhone: action.customerPhone,
              deliveryAddress: action.deliveryAddress,
              items: [{
                productName: action.productName,
                quantity: action.quantity || 1,
                price: action.price,
                color: action.color || '',
                size: action.size || ''
              }],
              subtotal,
              deliveryCharge: action.deliveryCharge,
              totalAmount,
              paymentMethod: 'COD',
              orderStatus: 'Confirmed',
              orderNumber,
              notes: 'ফেসবুক মেসেঞ্জার এআই সেলস অ্যাসিস্ট্যান্ট দ্বারা স্বয়ংক্রিয়ভাবে কনফার্ম করা হয়েছে।'
            });

            console.log(`[Messenger Order Created] ${orderNumber} for Page: ${page.pageName}`);

            // Send instant WhatsApp notification to Merchant
            let alertPhone = page.settings.notificationPhone;
            if (!alertPhone) {
              const merchantUser = await User.findById(page.userId).select('whatsapp mobile');
              alertPhone = merchantUser?.whatsapp || merchantUser?.mobile || '';
            }

            if (alertPhone) {
              const alertMsg = 
`🎉 *নতুন অর্ডার অ্যালার্ট!* (${page.settings.businessName || page.pageName})

📦 *অর্ডার নং:* #${orderNumber}
🛍️ *পণ্য:* ${action.productName} (x${action.quantity || 1})
${action.color ? `🎨 *কালার:* ${action.color}\n` : ''}${action.size ? `📏 *সাইজ:* ${action.size}\n` : ''}💰 *মোট বিল:* ৳${totalAmount} (ডেলিভারি: ৳${action.deliveryCharge})

👤 *গ্রাহক:* ${action.customerName}
📞 *মোবাইল:* ${action.customerPhone}
📍 *ঠিকানা:* ${action.deliveryAddress}

স্মৃতি ড্যাশবোর্ড থেকে অর্ডারটি প্রসেস করুন।`;

              sendMetaWhatsAppMessage(alertPhone, alertMsg).catch(err => {
                console.error('[Merchant Order Alert Failed]', err?.message || err);
              });
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[Messenger Webhook Processing Error]', error?.message || error);
  }
};
