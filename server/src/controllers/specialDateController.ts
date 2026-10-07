import { Request, Response } from 'express';
import SpecialDate from '../models/SpecialDate';
import mongoose from 'mongoose';



export const getSpecialDates = async (req: Request, res: Response) => {
  try {
    const dates = await SpecialDate.find({ userId: req.user?.id }).sort({ date: 1 });
    res.json(dates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createSpecialDate = async (req: Request, res: Response) => {
  try {
    const { title, type, date, recurring } = req.body;
    const specialDate = new SpecialDate({
      userId: req.user?.id,
      title,
      type,
      date,
      recurring
    });
    const savedDate = await specialDate.save();
    res.status(201).json(savedDate);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
export const updateSpecialDate = async (req: Request, res: Response) => {
  try {
    const updatedDate = await SpecialDate.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedDate) return res.status(404).json({ message: 'Special Date not found' });
    res.json(updatedDate);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSpecialDate = async (req: Request, res: Response) => {
  try {
    const deletedDate = await SpecialDate.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedDate) return res.status(404).json({ message: 'Special Date not found' });
    res.json({ message: 'Special Date deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
