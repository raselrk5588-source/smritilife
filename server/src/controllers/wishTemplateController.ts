import { Request, Response } from 'express';
import WishTemplate from '../models/WishTemplate';

export const getWishTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await WishTemplate.find().sort({ category: 1 });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createWishTemplate = async (req: Request, res: Response) => {
  try {
    const { name, category, content, type, isSystem } = req.body;
    const template = new WishTemplate({
      name,
      category,
      content,
      type,
      isSystem
    });
    const savedTemplate = await template.save();
    res.status(201).json(savedTemplate);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateWishTemplate = async (req: Request, res: Response) => {
  try {
    const updatedTemplate = await WishTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedTemplate) return res.status(404).json({ message: 'Template not found' });
    res.json(updatedTemplate);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteWishTemplate = async (req: Request, res: Response) => {
  try {
    const deletedTemplate = await WishTemplate.findByIdAndDelete(req.params.id);
    if (!deletedTemplate) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
