import mongoose, { Schema, Document } from 'mongoose';

export interface ISosContactNotification {
  name: string;
  phone: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface ISosAlert extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userPhone: string;
  source: 'whatsapp' | 'web';
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    mapUrl?: string;
  };
  note?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  emergencyContactsNotified: ISosContactNotification[];
  status: 'active' | 'resolved';
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SosAlertSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    source: { type: String, enum: ['whatsapp', 'web'], default: 'web' },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
      mapUrl: { type: String }
    },
    note: { type: String },
    bloodGroup: { type: String },
    medicalNotes: { type: String },
    emergencyContactsNotified: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
        error: { type: String }
      }
    ],
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model<ISosAlert>('SosAlert', SosAlertSchema);
