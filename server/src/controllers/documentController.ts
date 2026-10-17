import { Request, Response } from 'express';
import UserDocument from '../models/UserDocument';
import { detectDocumentCategory, saveFileToDisk } from '../services/documentService';
import path from 'path';
import fs from 'fs';

/**
 * Get all documents for the authenticated user
 */
export const getDocuments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { category, search } = req.query;

    const query: any = { userId };

    if (category && category !== 'All' && category !== 'সব') {
      query.category = category;
    }

    if (search && String(search).trim()) {
      const s = String(search).trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { fileName: { $regex: s, $options: 'i' } },
        { tags: { $regex: s, $options: 'i' } },
        { notes: { $regex: s, $options: 'i' } }
      ];
    }

    const documents = await UserDocument.find(query)
      .select('-fileData')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      documents
    });
  } catch (error: any) {
    console.error('getDocuments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload a document from Web client (Base64 payload)
 */
export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { title, category, fileName, mimeType, fileData, notes } = req.body;

    if (!title || !fileData) {
      return res.status(400).json({ success: false, message: 'Title and file data are required' });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const effectiveMime = mimeType || 'application/octet-stream';
    const effectiveFileName = fileName || `file_${Date.now()}`;

    // Auto-detect category if not explicitly specified
    const autoCat = detectDocumentCategory(title + ' ' + (fileName || ''));
    const finalCategory = category && category !== 'Other' ? category : autoCat.category;
    const tags = Array.from(new Set([...(autoCat.tags || []), finalCategory.toLowerCase()]));

    // Save to disk
    const diskResult = await saveFileToDisk(buffer, effectiveFileName, effectiveMime);

    const doc = await UserDocument.create({
      userId,
      title: title.trim(),
      fileName: diskResult.fileName,
      fileUrl: diskResult.fileUrl,
      fileSize: diskResult.fileSize,
      mimeType: effectiveMime,
      category: finalCategory,
      tags,
      notes: notes?.trim(),
      fileData: base64Data
    });

    res.status(201).json({
      success: true,
      message: 'ডকুমেন্ট সফলভাবে সংরক্ষণ করা হয়েছে',
      document: doc
    });
  } catch (error: any) {
    console.error('uploadDocument error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single document details
 */
export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const doc = await UserDocument.findOne({ _id: req.params.id, userId });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, document: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDiskPath = (fileUrl: string): string | null => {
  if (!fileUrl) return null;
  const base = path.basename(fileUrl);
  const candidates = [
    path.join(__dirname, '../../uploads/documents', base),
    path.join(__dirname, '../uploads/documents', base),
    path.join(process.cwd(), 'uploads/documents', base),
    path.join(process.cwd(), 'server/uploads/documents', base)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
};

/**
 * View / Stream document inline (for image preview or PDF view)
 */
export const viewDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const doc = await UserDocument.findOne({ _id: req.params.id, userId });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const diskPath = getDiskPath(doc.fileUrl);
    if (diskPath) {
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
      return fs.createReadStream(diskPath).pipe(res);
    }

    if (doc.fileData) {
      const buffer = Buffer.from(doc.fileData, 'base64');
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
      return res.send(buffer);
    }

    res.status(404).json({ success: false, message: 'File not found on storage' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Download document file
 */
export const downloadDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const doc = await UserDocument.findOne({ _id: req.params.id, userId });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const diskPath = getDiskPath(doc.fileUrl);
    if (diskPath) {
      return res.download(diskPath, doc.fileName);
    }

    // Fallback: decode base64 if disk file was moved/deleted
    if (doc.fileData) {
      const buffer = Buffer.from(doc.fileData, 'base64');
      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
      return res.send(buffer);
    }

    res.status(404).json({ success: false, message: 'File not found on storage' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const doc = await UserDocument.findOneAndDelete({ _id: req.params.id, userId });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Clean up disk file
    try {
      const diskPath = path.join(__dirname, '../../uploads/documents', path.basename(doc.fileUrl));
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
      }
    } catch (e) {
      console.warn('Failed to delete file from disk:', e);
    }

    res.json({ success: true, message: 'ফাইলটি মুছে ফেলা হয়েছে' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
