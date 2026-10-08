import { Request, Response } from 'express';
import User from '../models/User';
import Note from '../models/Note';
import Reminder from '../models/Reminder';
import SpecialDate from '../models/SpecialDate';
import mongoose from 'mongoose';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notesCount = await Note.countDocuments({ userId: req.user?.id });
    const remindersCount = await Reminder.countDocuments({ userId: req.user?.id });
    const specialDatesCount = await SpecialDate.countDocuments({ userId: req.user?.id });
    
    res.json({
      ...user.toObject(),
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
    const updatedUser = await User.findByIdAndUpdate(
      req.user?.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
