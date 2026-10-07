import { Request, Response } from 'express';
import Wish from '../models/Wish';
import mongoose from 'mongoose';



export const getWishes = async (req: Request, res: Response) => {
  try {
    const wishes = await Wish.find({ userId: req.user?.id }).populate('contactId templateId').sort({ scheduledAt: 1 });
    res.json(wishes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

import crypto from 'crypto';

export const getPublicWish = async (req: Request, res: Response) => {
  try {
    // Check if the ID is a smartCardId (UUID or similar length) or a Mongo ID
    let wish;
    const id = req.params.id as string;
    if (mongoose.Types.ObjectId.isValid(id)) {
      wish = await Wish.findById(id);
    } else {
      wish = await Wish.findOne({ smartCardId: id });
    }
    
    if (!wish) return res.status(404).json({ message: 'Wish not found' });
    res.json(wish);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createWish = async (req: Request, res: Response) => {
  try {
    const { contactId, recipientName, recipientContact, templateId, occasion, message, cardData, scheduledAt, deliveryMethod, status, isSmartCard } = req.body;
    
    let smartCardId;
    if (isSmartCard) {
      smartCardId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    const wish = new Wish({
      userId: req.user?.id,
      contactId,
      recipientName,
      recipientContact,
      templateId,
      occasion,
      message,
      cardData,
      scheduledAt,
      deliveryMethod,
      status,
      isSmartCard,
      smartCardId
    });
    const savedWish = await wish.save();
    res.status(201).json(savedWish);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateWish = async (req: Request, res: Response) => {
  try {
    const updatedWish = await Wish.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedWish) return res.status(404).json({ message: 'Wish not found' });
    res.json(updatedWish);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteWish = async (req: Request, res: Response) => {
  try {
    const deletedWish = await Wish.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedWish) return res.status(404).json({ message: 'Wish not found' });
    res.json({ message: 'Wish deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
