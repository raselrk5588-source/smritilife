import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Subscription from '../models/Subscription';
import SystemSettings from '../models/SystemSettings';
import { createAuthorizationRequest, getBdappsConfig } from '../services/bdappsBkashService';
import { sendMetaWhatsAppMessage } from './whatsappController';

const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';

// Map of bdapps error codes to human-readable descriptions
export const BDAPPS_ERROR_CODES: Record<string, { desc: string; bnDesc: string }> = {
  E1001: { desc: 'Error occurred. Please try again.', bnDesc: 'একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' },
  E1002: { desc: 'Invalid signature.', bnDesc: 'স্বাক্ষর (Signature) সঠিক হয়নি। API কী ও সিক্রেট যাচাই করুন।' },
  E1003: { desc: 'Invalid time format.', bnDesc: 'রিকুয়েস্টের সময় সঠিক নয়। বর্তমান UTC সময় দিন।' },
  E1004: { desc: 'Request timeout.', bnDesc: 'রিকুয়েস্টের সময় শেষ হয়ে গেছে। নতুন করে চেষ্টা করুন।' },
  E1005: { desc: 'Invalid request ID.', bnDesc: 'রিকুয়েস্ট আইডি সঠিক নয় (ঠিক ১৫ ডিজিট হতে হবে)।' },
  E1006: { desc: 'Invalid API key.', bnDesc: 'API কী সঠিক নয়।' },
  E1007: { desc: 'Unauthorized.', bnDesc: 'অননুমোদিত রিকুয়েস্ট। ক্রেডেনশিয়াল পরীক্ষা করুন।' },
  E1008: { desc: 'Service is not allowed for the application.', bnDesc: 'অ্যাপ্লিকেশনটির জন্য সার্ভিস অনুমোদিত নয়।' },
  E1009: { desc: 'Invalid request.', bnDesc: 'রিকুয়েস্টের প্যারামিটার সঠিক নয়।' },
  E1010: { desc: 'Service is not allowed for the SP.', bnDesc: 'সার্ভিস প্রোভাইডারের জন্য সার্ভিস অনুমোদিত নয়।' },
  E1011: { desc: 'SDK is not enabled for this application.', bnDesc: 'Charging SDK বা সাবস্ক্রিপশন সক্ষম করা নেই।' },
  E1012: { desc: 'Please start from the beginning.', bnDesc: 'শুরু থেকে আবার প্রক্রিয়াটি আরম্ভ করুন।' }
};

/**
 * Initialize bdapps bKash subscription flow (API call from frontend)
 */
export const initBkashSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.userId;
    const { msisdn, redirectUrl } = req.body;

    // Check fee from settings
    let amount = 190;
    try {
      const settings = await SystemSettings.findOne();
      if (settings?.subscriptionFee) {
        amount = settings.subscriptionFee;
      }
    } catch (e) {}

    const result = await createAuthorizationRequest({
      userId,
      msisdn,
      customRedirectUrl: redirectUrl,
      amount
    });

    res.json({
      success: true,
      authorizationUrl: result.authorizationUrl,
      requestId: result.requestId,
      requestTime: result.requestTime,
      amount
    });
  } catch (error: any) {
    console.error('initBkashSubscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize bKash authorization'
    });
  }
};

/**
 * Direct GET redirect endpoint as documented in bdapps server-side reference:
 * GET /api/subscription/bkash/authorize or /api/subscription/bkash/subscribe
 */
export const directSubscribeRedirect = async (req: Request, res: Response) => {
  try {
    const msisdn = (req.query.msisdn as string) || undefined;
    const redirectUrl = (req.query.redirectUrl as string) || undefined;

    const result = await createAuthorizationRequest({
      msisdn,
      customRedirectUrl: redirectUrl
    });

    res.redirect(302, result.authorizationUrl);
  } catch (error: any) {
    console.error('directSubscribeRedirect error:', error);
    res.status(500).send(`<h3>Error initiating bKash subscription</h3><p>${error.message}</p>`);
  }
};

/**
 * Verify user return after completing authorization on bdapps
 */
export const verifySubscriptionReturn = async (req: Request, res: Response) => {
  try {
    const {
      requestId,
      status,
      statusCode,
      subscriberId,
      msisdn,
      errorCode
    } = req.body;

    const currentUserId = (req as any).user?.id;

    // Check for error code
    const errKey = errorCode || (statusCode && statusCode.startsWith('E') ? statusCode : null);
    if (errKey && BDAPPS_ERROR_CODES[errKey]) {
      const errorInfo = BDAPPS_ERROR_CODES[errKey];

      if (requestId) {
        await Subscription.findOneAndUpdate(
          { requestId },
          {
            status: 'FAILED',
            statusCode: errKey,
            statusDetail: errorInfo.desc,
            meta: req.body
          }
        );
      }

      return res.status(400).json({
        success: false,
        errorCode: errKey,
        message: errorInfo.bnDesc,
        englishMessage: errorInfo.desc
      });
    }

    // Find the subscription by requestId if provided
    let subscription = requestId ? await Subscription.findOne({ requestId }) : null;

    if (subscription) {
      subscription.status = 'SUBSCRIBED';
      subscription.statusCode = statusCode || 'SUCCESS';
      if (subscriberId) subscription.subscriberId = subscriberId;
      if (msisdn && !subscription.msisdn) subscription.msisdn = msisdn;
      subscription.meta = { ...subscription.meta, ...req.body };
      await subscription.save();
    } else if (requestId) {
      subscription = await Subscription.create({
        requestId,
        requestTime: new Date().toISOString(),
        status: 'SUBSCRIBED',
        statusCode: statusCode || 'SUCCESS',
        subscriberId,
        msisdn,
        paymentOption: 'bKash',
        amount: 190,
        meta: req.body
      });
    }

    // Now update or find the user
    let user = null;
    if (currentUserId) {
      user = await User.findById(currentUserId);
    }

    if (!user && (msisdn || subscription?.msisdn)) {
      const phone = msisdn || subscription?.msisdn;
      user = await User.findOne({ mobile: phone });
    }

    if (user) {
      user.isSubscribed = true;
      await user.save();
      if (subscription && !subscription.userId) {
        subscription.userId = user._id as any;
        await subscription.save();
      }
    } else if (msisdn || subscription?.msisdn) {
      const phone = msisdn || subscription?.msisdn;
      user = await User.create({
        name: 'নতুন ব্যবহারকারী',
        email: `${phone}@example.com`,
        mobile: phone,
        isSubscribed: true
      });
      if (subscription) {
        subscription.userId = user._id as any;
        await subscription.save();
      }
    }

    let token = null;
    if (user) {
      token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    }

    res.json({
      success: true,
      message: 'বিকাশ সাবস্ক্রিপশন সফল হয়েছে!',
      isSubscribed: true,
      requestId,
      token,
      user: user
        ? {
            id: user._id,
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            isSubscribed: user.isSubscribed
          }
        : null
    });
  } catch (error: any) {
    console.error('verifySubscriptionReturn error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Verification failed'
    });
  }
};

/**
 * Webhook for bdapps server notification events (renewals, cancellations, etc.)
 */
export const bdappsNotificationWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    console.log('[bdapps Subscription Webhook]:', JSON.stringify(payload));

    const { requestId, subscriberId, status, statusCode } = payload;
    let msisdn = payload.msisdn;

    if (!msisdn && subscriberId) {
      const cleanDigits = String(subscriberId).replace(/[^\d]/g, '');
      if (cleanDigits.startsWith('880')) {
        msisdn = cleanDigits.substring(2);
      } else if (cleanDigits.startsWith('88')) {
        msisdn = cleanDigits.substring(2);
      } else if (cleanDigits.startsWith('01')) {
        msisdn = cleanDigits;
      }
    }

    const isSub =
      status === 'REGISTERED' ||
      status === '1' ||
      status === 'SUBSCRIBED' ||
      statusCode === 'S1000';

    if (requestId) {
      await Subscription.findOneAndUpdate(
        { requestId },
        {
          status: isSub ? 'SUBSCRIBED' : 'CANCELLED',
          statusCode,
          subscriberId,
          meta: payload
        },
        { upsert: true }
      );
    } else if (msisdn && isSub) {
      // Record subscription event (e.g. from Robi OTP portal or USSD)
      await Subscription.create({
        requestId: `ROBI_${Date.now()}`,
        subscriberId: subscriberId || `tel:88${msisdn}`,
        status: 'SUBSCRIBED',
        statusCode: statusCode || 'S1000',
        amount: 4,
        meta: payload
      }).catch(err => console.error('[bdapps Webhook] Subscription record error:', err));
    }

    if (msisdn) {
      let user = await User.findOne({ mobile: msisdn });
      if (user) {
        user.isSubscribed = isSub;
        await user.save();
        console.log(`[bdapps Webhook] User ${msisdn} subscription set to ${isSub}`);
      } else if (isSub) {
        user = new User({
          name: 'রবি ব্যবহারকারী',
          mobile: msisdn,
          whatsapp: msisdn,
          email: `${msisdn}@smritilife.com`,
          isSubscribed: true,
          deviceIds: []
        });
        await user.save();
        console.log(`[bdapps Webhook] Created new user ${msisdn} with isSubscribed: true`);
      }

      if (isSub) {
        // Send WhatsApp welcome and onboarding message
        const welcomeText = `🎉 *স্মৃতি লাইফ (Smriti Life)-এ আপনাকে স্বাগতম!*\n\nরবি/এয়ারটেল এর মাধ্যমে আপনার সাবস্ক্রিপশন সফলভাবে সম্পন্ন হয়েছে। এখন থেকে আপনি প্রতিদিন স্মৃতি লাইফের সব ফিচার নির্বিঘ্নে ব্যবহার করতে পারবেন।\n\n🌐 লগইন লিঙ্ক: https://smritilife.com/auth\n💬 যেকোনো প্রশ্ন বা সাহায্যের জন্য সরাসরি এখানে মেসেজ দিন!`;
        sendMetaWhatsAppMessage(msisdn, welcomeText).catch(e =>
          console.error('[bdapps Webhook] WhatsApp alert error:', e)
        );
      }
    }

    // Acknowledge receipt
    res.json({ statusCode: 'S1000', statusDetail: 'Success' });
  } catch (error: any) {
    console.error('bdappsNotificationWebhook error:', error);
    res.status(500).json({ statusCode: 'E1001', statusDetail: error.message });
  }
};

/**
 * Get all subscription transactions (for Admin Dashboard)
 */
export const getAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('userId', 'name mobile email')
      .sort({ createdAt: -1 })
      .limit(100);

    const totalRevenue = subscriptions
      .filter((s) => s.status === 'SUBSCRIBED')
      .reduce((sum, s) => sum + (s.amount || 190), 0);

    res.json({
      success: true,
      subscriptions,
      totalRevenue
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
