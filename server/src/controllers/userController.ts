import { Request, Response } from 'express';
import User from '../models/User';
import Note from '../models/Note';
import Reminder from '../models/Reminder';
import SpecialDate from '../models/SpecialDate';
import { sendLoginWelcomeMessage } from './authController';
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
    const updateData = { ...req.body };
    if (updateData.name) {
      updateData.name = String(updateData.name).trim();
    }
    if (updateData.whatsapp) {
      let wClean = String(updateData.whatsapp).replace(/[^\d]/g, '');
      if (wClean.startsWith('880')) wClean = wClean.substring(2);
      else if (wClean.startsWith('88')) wClean = wClean.substring(2);
      if (!wClean.startsWith('0') && wClean.length === 10) wClean = '0' + wClean;
      updateData.whatsapp = wClean;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user?.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If whatsapp is set, send a greeting message so the conversation thread starts
    if (updatedUser.whatsapp) {
      sendLoginWelcomeMessage(updatedUser.whatsapp, updatedUser.name).catch(e => console.error(e));
    }
    
    res.json(updatedUser);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
