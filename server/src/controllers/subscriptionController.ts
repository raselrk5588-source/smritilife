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

/**
 * Send BDApps Robi/Airtel SMS OTP for 190 Tk subscription
 */
export const sendRobiSubscriptionOtp = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর প্রদান করুন।' });
    }

    let cleanMobile = String(mobile).replace(/[^\d]/g, '');
    if (cleanMobile.startsWith('880')) cleanMobile = cleanMobile.substring(2);
    else if (cleanMobile.startsWith('88')) cleanMobile = cleanMobile.substring(2);
    if (!cleanMobile.startsWith('0') && cleanMobile.length === 10) cleanMobile = '0' + cleanMobile;

    // Verify if Robi or Airtel
    if (!cleanMobile.startsWith('018') && !cleanMobile.startsWith('016')) {
      return res.status(400).json({
        success: false,
        message: 'এই অপশনটি শুধুমাত্র রবি (018) এবং এয়ারটেল (016) সিমের জন্য প্রযোজ্য। অন্যান্য অপারেটরের ক্ষেত্রে বিকাশ অপশনটি ব্যবহার করুন।'
      });
    }

    const appId = process.env.BDAPPS_APP_ID || 'APP_140575';
    const appPassword = process.env.BDAPPS_PASSWORD || '47b9ea91d92d9783a390681b2e07cd95';
    const userMobile = 'tel:88' + cleanMobile;

    const requestData = {
      applicationId: appId,
      password: appPassword,
      subscriberId: userMobile,
      applicationHash: 'Smriti Life',
      applicationMetaData: {
        client: 'MOBILEAPP',
        device: 'Web Browser',
        os: 'web',
        appCode: 'https://smritilife.com'
      }
    };

    const proxyUrl = 'https://portal.rtsquad.com/api/bdapps/proxy';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-URL': 'https://developer.bdapps.com/subscription/otp/request'
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(15000)
    });

    const data: any = await response.json();
    console.log('[Robi Subscription OTP Request]:', JSON.stringify(data));

    if (data.referenceNo && (data.statusCode === 'S1000' || !data.statusCode || data.statusCode === '200')) {
      return res.json({
        success: true,
        referenceNo: data.referenceNo,
        message: 'আপনার রবি/এয়ারটেল নম্বরে ওটিপি কোড পাঠানো হয়েছে।'
      });
    }

    return res.status(400).json({
      success: false,
      message: data.statusDetail || data.message || 'ওটিপি পাঠানো সম্ভব হয়নি। অনুগ্রহ করে নম্বর পরীক্ষা করুন।'
    });
  } catch (error: any) {
    console.error('sendRobiSubscriptionOtp error:', error);
    res.status(500).json({ success: false, message: error.message || 'সার্ভার সমস্যা হয়েছে।' });
  }
};

/**
 * Verify BDApps Robi/Airtel SMS OTP and activate 190 Tk subscription & login
 */
export const verifyRobiSubscriptionOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, otp, referenceNo, deviceId, name, whatsapp } = req.body;
    if (!mobile || !otp || !referenceNo) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর, ওটিপি এবং রেফারেন্স কোড প্রয়োজন।' });
    }

    let cleanMobile = String(mobile).replace(/[^\d]/g, '');
    if (cleanMobile.startsWith('880')) cleanMobile = cleanMobile.substring(2);
    else if (cleanMobile.startsWith('88')) cleanMobile = cleanMobile.substring(2);
    if (!cleanMobile.startsWith('0') && cleanMobile.length === 10) cleanMobile = '0' + cleanMobile;

    let cleanWhatsApp = cleanMobile;
    if (whatsapp) {
      let wClean = String(whatsapp).replace(/[^\d]/g, '');
      if (wClean.startsWith('880')) wClean = wClean.substring(2);
      else if (wClean.startsWith('88')) wClean = wClean.substring(2);
      if (!wClean.startsWith('0') && wClean.length === 10) wClean = '0' + wClean;
      if (wClean.length === 11) cleanWhatsApp = wClean;
    }

    const appId = process.env.BDAPPS_APP_ID || 'APP_140575';
    const appPassword = process.env.BDAPPS_PASSWORD || '47b9ea91d92d9783a390681b2e07cd95';

    const requestData = {
      applicationId: appId,
      password: appPassword,
      referenceNo,
      otp: String(otp).trim()
    };

    const proxyUrl = 'https://portal.rtsquad.com/api/bdapps/proxy';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Target-URL': 'https://developer.bdapps.com/subscription/otp/verify'
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(15000)
    });

    const data: any = await response.json();
    console.log('[Robi Subscription OTP Verify]:', JSON.stringify(data));

    const isSuccess = data.statusCode === 'S1000' || String(data.subscriptionStatus).toUpperCase() === 'REGISTERED';

    if (!isSuccess) {
      return res.status(400).json({
        success: false,
        message: data.statusDetail || data.message || 'ভুল বা মেয়াদোত্তীর্ণ ওটিপি কোড।'
      });
    }

    // Subscription successful! Create or activate user with their custom Name & WhatsApp
    let user = await User.findOne({ mobile: cleanMobile });
    const userRealName = (name && String(name).trim()) || user?.name || 'স্মৃতি গ্রাহক';

    if (!user) {
      user = new User({
        name: userRealName,
        mobile: cleanMobile,
        whatsapp: cleanWhatsApp,
        email: `${cleanMobile}@smritilife.com`,
        isSubscribed: true,
        deviceIds: deviceId ? [deviceId] : []
      });
    } else {
      user.name = userRealName;
      user.whatsapp = cleanWhatsApp;
      user.isSubscribed = true;
      if (deviceId) {
        if (!user.deviceIds) user.deviceIds = [];
        if (!user.deviceIds.includes(deviceId)) {
          user.deviceIds.push(deviceId);
          if (user.deviceIds.length > 2) user.deviceIds = user.deviceIds.slice(-2);
        }
      }
    }
    await user.save();

    // Record subscription in DB
    await Subscription.create({
      userId: user._id,
      requestId: `ROBI_${Date.now()}`,
      subscriberId: `tel:88${cleanMobile}`,
      status: 'SUBSCRIBED',
      statusCode: 'S1000',
      amount: 190,
      meta: data
    }).catch(e => console.error('Subscription record error:', e));

    // Send BDApps confirmation SMS
    try {
      const smsPayload = {
        applicationId: appId,
        password: appPassword,
        message: 'স্মৃতি লাইফ (Smriti Life)-এ স্বাগতম! ১৯০ টাকায় আপনার সাবস্ক্রিপশন সফলভাবে সম্পন্ন হয়েছে। সেবাটি সক্রিয় থাকবে। লগইন করুন: https://smritilife.com',
        destinationAddresses: [`tel:88${cleanMobile}`]
      };
      fetch('https://portal.rtsquad.com/api/bdapps/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Target-URL': 'https://developer.bdapps.com/sms/send'
        },
        body: JSON.stringify(smsPayload)
      }).catch(e => console.error('SMS send error:', e));
    } catch (smsErr) {}

    // Send WhatsApp welcome message to user's designated WhatsApp number
    sendMetaWhatsAppMessage(
      cleanWhatsApp,
      `🎉 *স্মৃতি লাইফ (Smriti Life)-এ আপনাকে স্বাগতম, ${userRealName}!* 🤖\n\nরবি/এয়ারটেল এর মাধ্যমে আপনার ১৯০ টাকার মাসিক সাবস্ক্রিপশন সফলভাবে সম্পন্ন হয়েছে।\n\nদৈনিক রিমাইন্ডার, নোট বা খরচ রাখতে এই চ্যাটে সরাসরি *"হাই"* লিখে শুরু করুন! 😊\n\n🌐 লগইন লিঙ্ক: https://smritilife.com`
    ).catch(e => console.error('WhatsApp message error:', e));

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        whatsapp: user.whatsapp,
        isSubscribed: true
      },
      message: 'সাবস্ক্রিপশন সফলভাবে সম্পন্ন হয়েছে! স্বাগতম স্মৃতি লাইফে।'
    });
  } catch (error: any) {
    console.error('verifyRobiSubscriptionOtp error:', error);
    res.status(500).json({ success: false, message: error.message || 'সার্ভার সমস্যা হয়েছে।' });
  }
};
