import { Request, Response } from 'express';
import Wish from '../models/Wish';
import User from '../models/User';
import mongoose from 'mongoose';
import { deliverWishCard } from '../services/wishDeliveryService';



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
    // Check if the ID is a smartCardId or a Mongo ID
    let wish = null;
    const id = req.params.id as string;
    if (mongoose.Types.ObjectId.isValid(id)) {
      wish = await Wish.findById(id);
    }
    if (!wish) {
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
    const { contactId, recipientName, recipientContact, templateId, occasion, message, cardData, scheduledAt, deliveryMethod, status, isSmartCard, smartCardId: incomingSmartCardId } = req.body;
    
    let smartCardId = incomingSmartCardId;
    if (isSmartCard && !smartCardId) {
      smartCardId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    let parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
    if (isNaN(parsedScheduledAt.getTime())) {
      parsedScheduledAt = new Date();
    }

    const wish = new Wish({
      userId: req.user?.id,
      contactId: contactId && mongoose.Types.ObjectId.isValid(contactId) ? contactId : undefined,
      recipientName: recipientName || 'প্রিয়জন',
      recipientContact,
      templateId: templateId && mongoose.Types.ObjectId.isValid(templateId) ? templateId : undefined,
      occasion: occasion || 'other',
      message: message || 'শুভকামনা!',
      cardData,
      scheduledAt: parsedScheduledAt,
      deliveryMethod: deliveryMethod && deliveryMethod.length ? deliveryMethod : ['WhatsApp'],
      status: status || 'Scheduled',
      isSmartCard: !!isSmartCard,
      smartCardId
    });
    const savedWish = await wish.save();

    // If scheduled for now and has a recipient phone, dispatch the card image right away
    if (recipientContact && (status === 'Sent' || status === 'Processing' || !scheduledAt || new Date(scheduledAt) <= new Date())) {
      try {
        const user = await User.findById(req.user?.id);
        const senderName = cardData?.senderName || user?.name || 'আপনার শুভাকাঙ্ক্ষী';
        const senderWhatsApp = user?.whatsapp || user?.mobile;
        deliverWishCard(savedWish, senderName, senderWhatsApp).then(async (success) => {
          if (success) {
            await Wish.findByIdAndUpdate(savedWish._id, { status: 'Sent' });
          }
        }).catch(err => {
          console.error('[WishController] Instant wish delivery error:', err);
        });
      } catch (err) {
        console.error('[WishController] Failed to dispatch instant wish card:', err);
      }
    }

    res.status(201).json(savedWish);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateWish = async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };
    if (!updateData.contactId || !mongoose.Types.ObjectId.isValid(updateData.contactId)) {
      delete updateData.contactId;
    }
    if (!updateData.templateId || !mongoose.Types.ObjectId.isValid(updateData.templateId)) {
      delete updateData.templateId;
    }
    if (updateData.scheduledAt) {
      const parsed = new Date(updateData.scheduledAt);
      if (!isNaN(parsed.getTime())) {
        updateData.scheduledAt = parsed;
      } else {
        delete updateData.scheduledAt;
      }
    }

    const updatedWish = await Wish.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      updateData,
      { new: true }
    );
    if (!updatedWish) return res.status(404).json({ message: 'Wish not found' });

    // If updated to Processing or Sent and has a recipient phone, dispatch the card image right away
    if (updatedWish.recipientContact && (updatedWish.status === 'Sent' || updatedWish.status === 'Processing' || !updatedWish.scheduledAt || new Date(updatedWish.scheduledAt) <= new Date())) {
      try {
        const user = await User.findById(req.user?.id);
        const senderName = updatedWish.cardData?.senderName || user?.name || 'আপনার শুভাকাঙ্ক্ষী';
        const senderWhatsApp = user?.whatsapp || user?.mobile;
        deliverWishCard(updatedWish, senderName, senderWhatsApp).then(async (success) => {
          if (success) {
            await Wish.findByIdAndUpdate(updatedWish._id, { status: 'Sent' });
          }
        }).catch(err => {
          console.error('[WishController] Instant wish delivery error after update:', err);
        });
      } catch (err) {
        console.error('[WishController] Failed to dispatch instant wish card after update:', err);
      }
    }

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
