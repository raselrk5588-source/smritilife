import { Request, Response } from 'express';
import User from '../models/User';
import Note from '../models/Note';
import Activity from '../models/Activity';
import Reminder from '../models/Reminder';
import Wish from '../models/Wish';
import Subscription from '../models/Subscription';

import SystemLog from '../models/SystemLog';
import WishTemplate from '../models/WishTemplate';
import Admin from '../models/Admin';
import SystemSettings from '../models/SystemSettings';
import ErrorLog from '../models/ErrorLog';
import AITrainingRule from '../models/AITrainingRule';
import { updateMaintenanceCache } from '../services/maintenanceService';
import { sendLoginWelcomeMessage } from './authController';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';

export const setupAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    await Admin.deleteMany({ email });
    await Admin.create({ email, password });
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin || admin.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    console.log("Admin Analytics requested");
    const totalUsers = await User.countDocuments();
    const activeSubscribers = await User.countDocuments({ isSubscribed: true });
    const inactiveSubscribers = await User.countDocuments({ isSubscribed: false });
    
    const totalNotes = await Note.countDocuments();
    const totalActivities = await Activity.countDocuments();
    const totalReminders = await Reminder.countDocuments();
    const totalWishes = await Wish.countDocuments();
    
    // Aggregate wishes by status
    const wishesByStatus = await Wish.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Fetch recent delivery logs
    const recentLogs = await SystemLog.find().sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeSubscribers,
        inactiveSubscribers,
        totalNotes,
        totalActivities,
        totalReminders,
        totalWishes,
        wishesByStatus,
        recentLogs
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch all users with basic stats
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select('-__v').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle user subscription status
export const toggleSubscription = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isSubscribed = !user.isSubscribed;
    await user.save();
    
    res.json({ success: true, isSubscribed: user.isSubscribed, message: 'Subscription updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or activate a demo user with full subscription pass
export const createDemoUser = async (req: Request, res: Response) => {
  try {
    const { mobile, name } = req.body;
    if (!mobile || !String(mobile).trim()) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর দেওয়া আবশ্যক' });
    }

    let cleanMobile = String(mobile).trim().replace(/[^\d]/g, '');
    if (cleanMobile.startsWith('880')) {
      cleanMobile = cleanMobile.substring(2);
    }
    if (cleanMobile.length < 10) {
      return res.status(400).json({ success: false, message: 'সঠিক মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)' });
    }

    const userName = name?.trim() || 'Demo Tester';

    let user = await User.findOne({
      $or: [
        { mobile: cleanMobile },
        { whatsapp: cleanMobile },
        { mobile: '88' + cleanMobile },
        { whatsapp: '88' + cleanMobile }
      ]
    });

    if (!user) {
      user = await User.create({
        name: userName,
        email: `${cleanMobile}@smritilife.com`,
        mobile: cleanMobile,
        whatsapp: cleanMobile,
        isSubscribed: true,
        deviceIds: [],
        district: 'Dhaka',
        honorific: 'ভাই'
      });
    } else {
      user.name = userName;
      user.isSubscribed = true;
      user.mobile = cleanMobile;
      user.whatsapp = cleanMobile;
      await user.save();
    }

    // Ensure Subscription record exists with SUBSCRIBED status
    let sub = await Subscription.findOne({
      $or: [{ userId: user._id }, { msisdn: cleanMobile }]
    });

    if (!sub) {
      await Subscription.create({
        userId: user._id,
        msisdn: cleanMobile,
        requestId: `DEMO_${Date.now()}`,
        requestTime: new Date().toISOString(),
        amount: 190,
        status: 'SUBSCRIBED',
        paymentOption: 'Admin Demo Pass'
      });
    } else {
      sub.status = 'SUBSCRIBED';
      await sub.save();
    }

    // Send welcome WhatsApp message to the demo user immediately
    sendLoginWelcomeMessage(cleanMobile, userName);

    res.json({
      success: true,
      message: `ডেমো ইউজার (${cleanMobile}) সফলভাবে অ্যাক্টিভ করা হয়েছে!`,
      user
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Template Management
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await WishTemplate.find().sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { name, category, content, type } = req.body;
    const template = new WishTemplate({ name, category, content, type, isSystem: true });
    await template.save();
    res.status(201).json({ success: true, template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const template = await WishTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    await WishTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Reminders Management ---
export const getAllReminders = async (req: Request, res: Response) => {
  try {
    const reminders = await Reminder.find().populate('userId', 'name mobile email').sort({ createdAt: -1 });
    res.json({ success: true, reminders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnyReminder = async (req: Request, res: Response) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Wishes Management ---
export const getAllWishes = async (req: Request, res: Response) => {
  try {
    const wishes = await Wish.find().populate('userId', 'name mobile email').sort({ createdAt: -1 });
    res.json({ success: true, wishes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnyWish = async (req: Request, res: Response) => {
  try {
    await Wish.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Wish deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- System Settings ---
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }
    
    // Immediately update in-memory maintenance cache
    updateMaintenanceCache({
      isMaintenanceMode: Boolean(settings.isMaintenanceMode),
      maintenanceTitle: settings.maintenanceTitle,
      maintenanceMessage: settings.maintenanceMessage,
      maintenanceEstimatedTime: settings.maintenanceEstimatedTime,
      maintenanceAllowedIps: settings.maintenanceAllowedIps
    });

    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getErrorLogs = async (req: Request, res: Response) => {
  try {
    const errors = await ErrorLog.find().populate('userId', 'name mobile email').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, errors });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logClientError = async (req: Request, res: Response) => {
  try {
    const { message, stack, path, userId } = req.body;
    await ErrorLog.create({
      source: 'Frontend',
      message,
      stack,
      path,
      userId: userId || undefined
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Dynamic AI Training Rules CRUD ---
export const getTrainingRules = async (req: Request, res: Response) => {
  try {
    const rules = await AITrainingRule.find().sort({ createdAt: -1 });
    res.json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTrainingRule = async (req: Request, res: Response) => {
  try {
    const { rule, exampleInput, exampleOutput, category } = req.body;
    if (!rule || rule.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Rule content is required' });
    }
    const newRule = await AITrainingRule.create({
      rule: rule.trim(),
      exampleInput: exampleInput?.trim(),
      exampleOutput: exampleOutput?.trim(),
      category: category || 'general',
      addedBy: 'Admin Panel',
      isActive: true
    });
    res.status(201).json({ success: true, rule: newRule });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTrainingRule = async (req: Request, res: Response) => {
  try {
    const updated = await AITrainingRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, rule: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTrainingRule = async (req: Request, res: Response) => {
  try {
    await AITrainingRule.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

