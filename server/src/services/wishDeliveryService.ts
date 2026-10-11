import Wish, { IWish } from '../models/Wish';
import User from '../models/User';

export const formatBangladeshPhone = (phone: string): string => {
  let cleaned = (phone || '').replace(/[\s\-\(\)]/g, '').trim();
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('01')) {
    cleaned = `88${cleaned}`;
  }
  return cleaned;
};

export const getOccasionImageUrl = (occasion: string): string => {
  const occ = (occasion || '').toLowerCase().trim();
  if (occ.includes('birth') || occ.includes('জন্মদিন')) {
    return 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?fm=jpg&w=800&fit=max';
  }
  if (occ.includes('anniversary') || occ.includes('বিবাহ') || occ.includes('বার্ষিকী')) {
    return 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?fm=jpg&w=800&fit=max';
  }
  if (occ.includes('eid') || occ.includes('ঈদ')) {
    return 'https://images.unsplash.com/photo-1585036156171-384164a8c675?fm=jpg&w=800&fit=max';
  }
  if (occ.includes('new') || occ.includes('বছর') || occ.includes('নববর্ষ') || occ.includes('year')) {
    return 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?fm=jpg&w=800&fit=max';
  }
  if (occ.includes('congrat') || occ.includes('অভিনন্দন') || occ.includes('সাফল্য')) {
    return 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?fm=jpg&w=800&fit=max';
  }
  if (occ.includes('love') || occ.includes('valentine') || occ.includes('ভালোবাসা')) {
    return 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?fm=jpg&w=800&fit=max';
  }
  return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?fm=jpg&w=800&fit=max';
};

export const getOccasionTitle = (occasion: string): string => {
  const occ = (occasion || '').toLowerCase().trim();
  if (occ.includes('birth') || occ.includes('জন্মদিন')) return 'শুভ জন্মদিন';
  if (occ.includes('anniversary') || occ.includes('বিবাহ') || occ.includes('বার্ষিকী')) return 'শুভ বিবাহ বার্ষিকী';
  if (occ.includes('eid') || occ.includes('ঈদ')) return 'ঈদ মোবারক';
  if (occ.includes('new') || occ.includes('বছর') || occ.includes('নববর্ষ')) return 'শুভ নববর্ষ';
  if (occ.includes('congrat') || occ.includes('অভিনন্দন')) return 'আন্তরিক অভিনন্দন';
  if (occ.includes('love') || occ.includes('ভালোবাসা')) return 'ভালোবাসা ও শুভেচ্ছা';
  return 'আন্তরিক শুভেচ্ছা ও শুভকামনা';
};

export const sendMetaWhatsAppImage = async (to: string, imageUrl: string, caption: string): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('[WishDelivery] Meta WhatsApp credentials missing');
    return false;
  }

  const formattedTo = formatBangladeshPhone(to);

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
          type: 'image',
          image: {
            link: imageUrl,
            caption: caption
          }
        }),
        signal: AbortSignal.timeout(15000)
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[WishDelivery] Attempt ${attempt} error sending Meta image:`, data);
        if (attempt === 2) return false;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`✅ [WishDelivery] Meta Wish Image sent successfully to ${formattedTo}!`);
        return true;
      }
    } catch (error) {
      console.error(`[WishDelivery] Attempt ${attempt} network exception:`, error);
      if (attempt === 2) return false;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return false;
};

export const sendMetaWhatsAppText = async (to: string, text: string): Promise<boolean> => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('[WishDelivery] Meta WhatsApp credentials missing');
    return false;
  }

  const formattedTo = formatBangladeshPhone(to);

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
      console.error('[WishDelivery] Error sending Meta text message:', data);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[WishDelivery] Error sending Meta text message:', error);
    return false;
  }
};

export const deliverWishCard = async (wish: IWish, senderName: string, senderWhatsApp?: string): Promise<boolean> => {
  if (!wish.recipientContact) {
    console.warn(`[WishDelivery] Wish ${wish._id} has no recipientContact`);
    return false;
  }

  const imageUrl = (wish.cardData?.image && wish.cardData.image.startsWith('http'))
    ? wish.cardData.image
    : getOccasionImageUrl(wish.occasion);

  const smartCardId = wish.smartCardId || wish._id.toString();
  const smartCardUrl = `https://smritilife.com/w/${smartCardId}`;
  const occasionTitle = getOccasionTitle(wish.occasion);

  let recipientSalutation = (wish.recipientName && wish.recipientName !== 'Unknown') ? `প্রিয় ${wish.recipientName},\n\n` : '';
  
  let linkSection = '';
  if (!wish.message.includes('http://') && !wish.message.includes('https://')) {
    linkSection = `\n\n💌 আপনার জন্য একটি বিশেষ অ্যানিমেটেড উইশ কার্ড পাঠানো হয়েছে:\n👉 ${smartCardUrl}`;
  }

  const promoSection = `\n\n✨ আপনিও কি প্রিয়জনকে এভাবে স্বয়ংক্রিয় উইশ কার্ড ও প্রয়োজনীয় রিমাইন্ডার পাঠাতে চান?\nএখনই সাবস্ক্রাইব করুন: https://smritilife.com/paywall`;

  const fullCaption = `🎉 ${occasionTitle}!\n\n${recipientSalutation}${wish.message}${linkSection}\n\n- ভালোবাসা সহ, ${senderName}${promoSection}`;

  // 1. Guaranteed Text Wish Delivery (Contains the full wish & interactive card link)
  const textDelivered = await sendMetaWhatsAppText(wish.recipientContact, fullCaption);
  console.log(`[WishDelivery] Text wish sent to ${wish.recipientContact}: status=${textDelivered}`);

  // 2. Also send the visual Image Card
  if (imageUrl) {
    sendMetaWhatsAppImage(wish.recipientContact, imageUrl, `🎉 ${occasionTitle}!`).catch(err => {
      console.warn(`[WishDelivery] Image dispatch failed for ${wish.recipientContact}:`, err);
    });
  }

  // 3. Confirm to sender
  if (textDelivered && senderWhatsApp) {
    await sendMetaWhatsAppText(
      senderWhatsApp,
      `✅ আসসালামু আলাইকুম! ${wish.recipientContact} নম্বরে আপনার নির্ধারিত ${occasionTitle} কার্ডটি সফলভাবে পৌঁছে দেওয়া হয়েছে।`
    );
  }

  return textDelivered;
};
