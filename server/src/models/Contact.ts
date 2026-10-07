import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  relationship: string;
  photo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    nickname: { type: String },
    phone: { type: String },
    email: { type: String },
    relationship: { type: String, default: 'Other' },
    photo: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IContact>('Contact', ContactSchema);
