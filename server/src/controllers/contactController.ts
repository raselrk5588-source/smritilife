import { Request, Response } from 'express';
import Contact from '../models/Contact';
import mongoose from 'mongoose';



export const getContacts = async (req: Request, res: Response) => {
  try {
    const contacts = await Contact.find({ userId: req.user?.id }).sort({ name: 1 });
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createContact = async (req: Request, res: Response) => {
  try {
    const { name, nickname, phone, email, relationship, photo, notes } = req.body;
    const contact = new Contact({
      userId: req.user?.id,
      name,
      nickname,
      phone,
      email,
      relationship,
      photo,
      notes
    });
    const savedContact = await contact.save();
    res.status(201).json(savedContact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const importContacts = async (req: Request, res: Response) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: 'No contacts provided' });
    }

    const createdList = [];
    for (const c of contacts) {
      if (!c.name || !c.phone) continue;
      const cleanPhone = c.phone.replace(/[\s\-\(\)]/g, '');
      const existing = await Contact.findOne({
        userId: req.user?.id,
        $or: [
          { phone: cleanPhone },
          { name: { $regex: new RegExp(`^${c.name.trim()}$`, 'i') } }
        ]
      });

      if (!existing) {
        const newContact = await Contact.create({
          userId: req.user?.id,
          name: c.name.trim(),
          phone: cleanPhone,
          email: c.email || undefined,
          relationship: c.relationship || 'Friend'
        });
        createdList.push(newContact);
      }
    }

    res.status(201).json({ message: `${createdList.length} contacts imported`, contacts: createdList });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateContact = async (req: Request, res: Response) => {
  try {
    const updatedContact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedContact) return res.status(404).json({ message: 'Contact not found' });
    res.json(updatedContact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteContact = async (req: Request, res: Response) => {
  try {
    const deletedContact = await Contact.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedContact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ message: 'Contact deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
