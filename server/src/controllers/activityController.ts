import { Request, Response } from 'express';
import Activity from '../models/Activity';
import mongoose from 'mongoose';



export const getActivities = async (req: Request, res: Response) => {
  try {
    const activities = await Activity.find({ userId: req.user?.id }).sort({ date: 1, time: 1 });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { title, description, date, time, priority, category } = req.body;
    const activity = new Activity({
      userId: req.user?.id,
      title,
      description,
      date,
      time,
      priority,
      category
    });
    const savedActivity = await activity.save();
    res.status(201).json(savedActivity);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const updatedActivity = await Activity.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedActivity) return res.status(404).json({ message: 'Activity not found' });
    res.json(updatedActivity);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const deletedActivity = await Activity.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedActivity) return res.status(404).json({ message: 'Activity not found' });
    res.json({ message: 'Activity deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
