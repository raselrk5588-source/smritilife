import { Request, Response } from 'express';
import Reminder from '../models/Reminder';
import User from '../models/User';
import SystemSettings from '../models/SystemSettings';



export const getReminders = async (req: Request, res: Response) => {
  try {
    const reminders = await Reminder.find({ userId: req.user?.id }).sort({ date: 1, time: 1 });
    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createReminder = async (req: Request, res: Response) => {
  try {
    const { title, description, date, time, priority, category, repeat } = req.body;

    const user = await User.findById(req.user?.id);
    let settings = await SystemSettings.findOne();
    if (!settings) settings = await SystemSettings.create({});

    const limit = user?.isSubscribed ? settings.proUserReminderLimit : settings.freeUserReminderLimit;
    const currentCount = await Reminder.countDocuments({ userId: req.user?.id });

    if (currentCount >= limit) {
      return res.status(403).json({ message: `আপনার রিমাইন্ডার লিমিট শেষ (${limit} টি)। দয়া করে সাবস্ক্রিপশন আপগ্রেড করুন বা পুরনো রিমাইন্ডার মুছুন।` });
    }

    const reminder = new Reminder({
      userId: req.user?.id,
      title,
      description,
      date,
      time,
      priority,
      category,
      repeat
    });
    const savedReminder = await reminder.save();
    res.status(201).json(savedReminder);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateReminder = async (req: Request, res: Response) => {
  try {
    const updatedReminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedReminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json(updatedReminder);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteReminder = async (req: Request, res: Response) => {
  try {
    const deletedReminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedReminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
