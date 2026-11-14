import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Note from '../models/Note';
import Reminder from '../models/Reminder';
import SpecialDate from '../models/SpecialDate';
import SystemSettings from '../models/SystemSettings';
import { sendLoginWelcomeMessage } from './authController';
import { sendMetaWhatsAppMessage } from './whatsappController';
import { checkUserAccess, normalizeMobile } from '../utils/subscriptionHelper';

const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notesCount = await Note.countDocuments({ userId: req.user?.id });
    const remindersCount = await Reminder.countDocuments({ userId: req.user?.id });
    const specialDatesCount = await SpecialDate.countDocuments({ userId: req.user?.id });
    
    const access = checkUserAccess(user);

    res.json({
      ...user.toObject(),
      access,
      stats: {
        notes: notesCount,
        reminders: remindersCount,
        specialDates: specialDatesCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };
    if (updateData.name) {
      updateData.name = String(updateData.name).trim();
    }
    if (updateData.whatsapp) {
      const wClean = normalizeMobile(String(updateData.whatsapp));
      updateData.whatsapp = wClean;

      const existingUser = await User.findById(req.user?.id);
      if (existingUser && !existingUser.mobile) {
        updateData.mobile = wClean;
      }
    }

    // If user has not subscribed and has never used trial, automatically activate 3-day trial on profile completion!
    const existing = await User.findById(req.user?.id);
    if (existing && !existing.isSubscribed && !existing.isTrialUsed && !existing.trialEndDate) {
      updateData.trialStartDate = new Date();
      updateData.trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      updateData.isTrialUsed = true;
      updateData.isProfileCompleted = true;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user?.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const access = checkUserAccess(updatedUser);

    // If whatsapp is set, send a greeting message so the conversation thread starts
    if (updatedUser.whatsapp) {
      sendLoginWelcomeMessage(updatedUser.whatsapp, updatedUser.name).catch(e => console.error(e));
    }
    
    res.json({
      ...updatedUser.toObject(),
      access
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Public Endpoint: Get Current Free Trial Settings
 * Allows landing page and client to know if trial is enabled and how many days it offers
 */
export const getTrialSettings = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettings.findOne();
    const isTrialEnabled = settings?.isTrialEnabled !== false;
    const trialDays = Number(settings?.trialDays) > 0 ? Number(settings?.trialDays) : 3;
    return res.json({
      success: true,
      isTrialEnabled,
      trialDays
    });
  } catch (err: any) {
    return res.json({
      success: true,
      isTrialEnabled: true,
      trialDays: 3
    });
  }
};

/**
 * Public Endpoint: Complete Profile and Start Free Trial
 * When clicking "শুরু করুন" button, user completes profile and gets trial (default 3 days or admin defined)
 */
export const startTrial = async (req: Request, res: Response) => {
  try {
    const { name, mobile, whatsapp, district, email, deviceId } = req.body;

    // Check system trial configuration
    const systemSettings = await SystemSettings.findOne();
    const isTrialEnabled = systemSettings?.isTrialEnabled !== false;
    const trialDays = Number(systemSettings?.trialDays) > 0 ? Number(systemSettings?.trialDays) : 3;

    if (!isTrialEnabled) {
      return res.status(403).json({
        success: false,
        message: 'বর্তমানে ফ্রি ট্রায়াল সুবিধা বন্ধ রয়েছে। সরাসরি সাবস্ক্রিপশন সম্পন্ন করুন।'
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'অনুগ্রহ করে আপনার নাম লিখুন।' });
    }

    if (!mobile || !String(mobile).trim()) {
      return res.status(400).json({ success: false, message: 'অনুগ্রহ করে আপনার মোবাইল নম্বর লিখুন।' });
    }

    const cleanMobile = normalizeMobile(String(mobile));
    if (!/^01[3-9]\d{8}$/.test(cleanMobile)) {
      return res.status(400).json({ success: false, message: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)' });
    }

    const cleanWhatsApp = whatsapp ? normalizeMobile(String(whatsapp)) : cleanMobile;
    const cleanName = String(name).trim();
    const cleanDistrict = district ? String(district).trim() : 'Dhaka';

    let user = await User.findOne({
      $or: [
        { mobile: cleanMobile },
        { whatsapp: cleanMobile },
        { mobile: cleanWhatsApp },
        { whatsapp: cleanWhatsApp }
      ]
    });

    let isNewTrialStarted = false;

    if (user) {
      // User exists - check their subscription and trial status
      const access = checkUserAccess(user);

      if (access.isPaid) {
        // Already a paid subscriber
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
          status: 'PRO',
          message: 'আপনি ইতিমধ্যে একজন প্রিমিয়াম প্রো সাবস্ক্রাইবার!'
        });
      }

      if (access.isTrial) {
        // Trial is already active and valid
        user.name = cleanName;
        if (cleanWhatsApp) user.whatsapp = cleanWhatsApp;
        if (cleanDistrict) user.district = cleanDistrict;
        if (deviceId && user.deviceIds && !user.deviceIds.includes(deviceId)) {
          user.deviceIds.push(deviceId);
          if (user.deviceIds.length > 2) user.deviceIds = user.deviceIds.slice(-2);
        }
        await user.save();

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({
          success: true,
          token,
          user: {
            id: user._id,
            name: user.name,
            mobile: user.mobile,
            whatsapp: user.whatsapp,
            isSubscribed: false,
            trialStartDate: user.trialStartDate,
            trialEndDate: user.trialEndDate,
            isTrialActive: true
          },
          status: 'TRIAL_ACTIVE',
          trialEndDate: user.trialEndDate,
          trialRemainingDays: access.trialRemainingDays,
          message: `আপনার ফ্রি ট্রায়াল চলছে (বাকি ${access.trialRemainingDays} দিন)।`
        });
      }

      if (access.isExpired) {
        // Trial has already been used and expired -> Need bKash payment
        return res.status(403).json({
          success: false,
          status: 'TRIAL_EXPIRED',
          message: `আপনার ফ্রি ট্রায়ালের মেয়াদ শেষ হয়ে গেছে। স্মৃতি লাইফ চালিয়ে যেতে বিকাশ দিয়ে সাবস্ক্রাইব করুন।`
        });
      }

      // User exists but has never activated trial (e.g. created via OTP without profile)
      user.name = cleanName;
      user.mobile = cleanMobile;
      user.whatsapp = cleanWhatsApp;
      user.district = cleanDistrict;
      user.isProfileCompleted = true;
      user.isTrialUsed = true;
      user.trialStartDate = new Date();
      user.trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000); // Admin defined days
      if (deviceId) {
        if (!user.deviceIds) user.deviceIds = [];
        if (!user.deviceIds.includes(deviceId)) {
          user.deviceIds.push(deviceId);
          if (user.deviceIds.length > 2) user.deviceIds = user.deviceIds.slice(-2);
        }
      }
      await user.save();
      isNewTrialStarted = true;

    } else {
      // Brand new user registration with trial
      const cleanEmail = email && String(email).trim() 
        ? String(email).trim() 
        : `${cleanMobile}@smritilife.com`;

      user = new User({
        name: cleanName,
        mobile: cleanMobile,
        whatsapp: cleanWhatsApp,
        email: cleanEmail,
        district: cleanDistrict,
        isSubscribed: false,
        isProfileCompleted: true,
        isTrialUsed: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000), // Admin defined days
        deviceIds: deviceId ? [deviceId] : []
      });

      await user.save();
      isNewTrialStarted = true;
    }

    // Send WhatsApp Welcome Message about the trial
    if (isNewTrialStarted) {
      try {
        const welcomeText = `🎉 *স্মৃতি লাইফে স্বাগতম, ${user.name}!* 🤖\n\nআপনার *${trialDays} দিনের ফ্রি ট্রায়াল* সফলভাবে শুরু হয়েছে! আগামী ${trialDays} দিন আপনি স্মৃতি লাইফের সকল এআই ফিচার (রিমাইন্ডার, হিসাব খাতা, শুভেচ্ছা ও নোট) সম্পূর্ণ বিনামূল্যে ব্যবহার করতে পারবেন।\n\n💬 এখনই এই চ্যাটে আপনার যেকোনো রিমাইন্ডার বা খরচ লিখে পাঠান! 😊\n\n🌐 ওয়েবসাইট ড্যাশবোর্ড: https://smritilife.com/app`;
        await sendMetaWhatsAppMessage(user.whatsapp || user.mobile || '', welcomeText);
      } catch (waErr) {
        console.error('[startTrial] WhatsApp welcome message error:', waErr);
      }
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        whatsapp: user.whatsapp,
        district: user.district,
        isSubscribed: false,
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
        isTrialActive: true
      },
      status: 'TRIAL_ACTIVE',
      trialEndDate: user.trialEndDate,
      trialRemainingDays: trialDays,
      message: `🎉 অভিনন্দন! আপনার ${trialDays} দিনের ফ্রি ট্রায়াল সফলভাবে চালু হয়েছে।`
    });

  } catch (error: any) {
    console.error('startTrial error:', error);
    return res.status(500).json({ success: false, message: error.message || 'সার্ভার সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
  }
};
