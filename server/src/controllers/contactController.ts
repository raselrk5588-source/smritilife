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
