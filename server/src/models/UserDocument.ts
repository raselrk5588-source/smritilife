import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
  userId: mongoose.Types.ObjectId;
  mobile?: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  fileData?: string; // base64 encoded payload for persistent retrieval
  category: 'Prescription' | 'Medical Report' | 'NID/Card' | 'Certificate' | 'Invoice/Bill' | 'Other';
  tags: string[];
  metaMediaId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserDocumentSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mobile: { type: String, index: true },
    title: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    fileUrl: { type: String, required: true },
    fileData: { type: String }, // Optional base64
    category: {
      type: String,
      enum: ['Prescription', 'Medical Report', 'NID/Card', 'Certificate', 'Invoice/Bill', 'Other'],
      default: 'Other',
      index: true
    },
    tags: [{ type: String, index: true }],
    metaMediaId: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

// Text index for search
UserDocumentSchema.index({ title: 'text', tags: 'text', notes: 'text', fileName: 'text' });

export default mongoose.model<IUserDocument>('UserDocument', UserDocumentSchema);
