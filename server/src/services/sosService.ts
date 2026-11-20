import User, { IUser, IEmergencyContact } from '../models/User';
import SosAlert, { ISosAlert, ISosContactNotification } from '../models/SosAlert';
import { sendMetaWhatsAppMessage } from '../controllers/whatsappController';
import { normalizeMobile } from '../utils/subscriptionHelper';

export interface TriggerSosParams {
  userId: string;
  source: 'whatsapp' | 'web';
  latitude?: number;
  longitude?: number;
  address?: string;
  note?: string;
}

export interface TriggerSosResult {
  success: boolean;
  alertId?: string;
  contactsNotifiedCount: number;
  totalContacts: number;
  contacts: ISosContactNotification[];
  message: string;
}

/**
 * Triggers an SOS Emergency Alert for a user.
 * - Collects user info, blood group, medical notes, GPS coordinates
 * - Sends urgent WhatsApp alerts to all saved emergency contacts
 * - Logs the alert in database
 */
export async function triggerSosAlert(params: TriggerSosParams): Promise<TriggerSosResult> {
  const { userId, source, latitude, longitude, address, note } = params;

  const user = await User.findById(userId);
  if (!user) {
    return {
      success: false,
      contactsNotifiedCount: 0,
      totalContacts: 0,
      contacts: [],
      message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।'
    };
  }

  const userPhone = user.whatsapp || user.mobile || '';
  const userName = user.name || 'স্মৃতি ব্যবহারকারী';
  const bloodGroup = user.bloodGroup || '';
  const medicalNotes = user.medicalNotes || '';
  const contacts = user.emergencyContacts || [];

  // Generate Google Maps URL if coordinates provided
  let mapUrl = '';
  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  }

  const notifications: ISosContactNotification[] = [];
  let notifiedCount = 0;

  // Format emergency message for contacts
  const buildContactAlertMessage = (contactName: string) => {
    let msg = `🚨 *জরুরি বিপদকালীন অ্যালার্ট (SOS)!* 🚨\n\n`;
    msg += `আসসালামু আলাইকুম ${contactName},\n`;
    msg += `আপনার প্রিয়জন *${userName}* (${userPhone}) এইমাত্র স্মৃতি লাইফ থেকে একটি *জরুরি সাহায্য অ্যালার্ট* পাঠিয়েছেন!\n\n`;

    if (mapUrl) {
      msg += `📍 *বর্তমান লাইভ লোকেশন:*\n${mapUrl}\n\n`;
    }
    if (address) {
      msg += `🏠 *ঠিকানা / এলাকা:* ${address}\n`;
    }
    if (bloodGroup) {
      msg += `🩸 *রক্তের গ্রুপ:* ${bloodGroup}\n`;
    }
    if (medicalNotes) {
      msg += `🩺 *মেডিকেল তথ্য:* ${medicalNotes}\n`;
    }
    if (note) {
      msg += `⚠️ *বার্তা:* "${note}"\n`;
    }

    msg += `\n📞 *তাঁকে দ্রুত কল করুন:* ${userPhone}\n`;
    msg += `_অনুগ্রহ করে দ্রুত যোগাযোগ করুন অথবা জাতীয় জরুরি সেবা ৯৯৯-এ সহায়তা নিন!_`;

    return msg;
  };

  // Dispatch alert to each emergency contact
  for (const contact of contacts) {
    const cleanPhone = normalizeMobile(contact.phone);
    if (!cleanPhone) continue;

    const alertText = buildContactAlertMessage(contact.name);
    try {
      const sent = await sendMetaWhatsAppMessage(cleanPhone, alertText);
      if (sent) {
        notifications.push({
          name: contact.name,
          phone: cleanPhone,
          status: 'sent'
        });
        notifiedCount++;
      } else {
        notifications.push({
          name: contact.name,
          phone: cleanPhone,
          status: 'failed',
          error: 'WhatsApp dispatch failed'
        });
      }
    } catch (err: any) {
      notifications.push({
        name: contact.name,
        phone: cleanPhone,
        status: 'failed',
        error: err.message || 'Unknown error'
      });
    }
  }

  // Create SOS Alert Record
  const alert = await SosAlert.create({
    userId: user._id,
    userName,
    userPhone,
    source,
    location: {
      latitude,
      longitude,
      address,
      mapUrl
    },
    note,
    bloodGroup,
    medicalNotes,
    emergencyContactsNotified: notifications,
    status: 'active'
  });

  return {
    success: true,
    alertId: alert._id.toString(),
    contactsNotifiedCount: notifiedCount,
    totalContacts: contacts.length,
    contacts: notifications,
    message: contacts.length > 0
      ? `🚨 আপনার SOS সতর্কবার্তা ${notifiedCount} জন জরুরি কন্টাক্টকে পাঠানো হয়েছে!`
      : '🚨 আপনার কোনো জরুরি কন্টাক্ট সেভ করা নেই। অবিলম্বে জাতীয় জরুরি সেবা ৯৯৯ এ কল করুন!'
  };
}

/**
 * Update user's emergency profile (emergency contacts, blood group, medical notes)
 */
export async function updateEmergencyProfile(
  userId: string,
  data: {
    bloodGroup?: string;
    emergencyContacts?: IEmergencyContact[];
    medicalNotes?: string;
  }
): Promise<{ success: boolean; user?: IUser; message: string }> {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (data.bloodGroup !== undefined) {
    user.bloodGroup = String(data.bloodGroup).trim();
  }
  if (data.medicalNotes !== undefined) {
    user.medicalNotes = String(data.medicalNotes).trim();
  }
  if (Array.isArray(data.emergencyContacts)) {
    // Validate and clean contacts (limit to max 5)
    const cleaned = data.emergencyContacts
      .slice(0, 5)
      .map(c => ({
        name: String(c.name || '').trim(),
        phone: normalizeMobile(String(c.phone || '')),
        relation: String(c.relation || 'অভিভাবক').trim()
      }))
      .filter(c => c.name && /^01[3-9]\d{8}$/.test(c.phone));

    user.emergencyContacts = cleaned;
  }

  await user.save();
  return { success: true, user, message: 'জরুরি কন্টাক্ট ও মেডিকেল তথ্য সফলভাবে আপডেট হয়েছে।' };
}

/**
 * Resolves an active SOS alert ("I am safe now")
 */
export async function resolveSosAlert(userId: string, alertId?: string): Promise<boolean> {
  const query: any = { userId, status: 'active' };
  if (alertId) {
    query._id = alertId;
  }

  const activeAlerts = await SosAlert.find(query);
  if (activeAlerts.length === 0) return false;

  for (const alert of activeAlerts) {
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();

    // Notify contacts that the user is now safe
    const user = await User.findById(userId);
    const safeText = `✅ *আপডেট: আপনার প্রিয়জন ${alert.userName} এখন নিরাপদ!* 🤲\n\nস্মৃতি লাইফ থেকে প্রেরিত পূর্ববর্তী জরুরি অ্যালার্টটি সম্পন্ন হয়েছে। সাথে থাকার জন্য ধন্যবাদ।`;
    for (const c of alert.emergencyContactsNotified) {
      if (c.status === 'sent') {
        try {
          await sendMetaWhatsAppMessage(c.phone, safeText);
        } catch (_) {}
      }
    }
  }

  return true;
}
