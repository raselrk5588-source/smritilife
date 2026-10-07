import { Request, Response } from 'express';
import Note from '../models/Note';
import mongoose from 'mongoose';



export const getNotes = async (req: Request, res: Response) => {
  try {
    const notes = await Note.find({ userId: req.user?.id }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createNote = async (req: Request, res: Response) => {
  try {
    const { title, content, type, category, tags } = req.body;
    const note = new Note({
      userId: req.user?.id,
      title,
      content,
      type,
      category,
      tags
    });
    const savedNote = await note.save();
    res.status(201).json(savedNote);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const updatedNote = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!updatedNote) return res.status(404).json({ message: 'Note not found' });
    res.json(updatedNote);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const deletedNote = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deletedNote) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
