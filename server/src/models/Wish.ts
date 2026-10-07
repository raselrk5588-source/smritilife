import mongoose, { Schema, Document } from 'mongoose';

export interface IWish extends Document {
  userId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  recipientName?: string;
  recipientContact?: string;
  templateId?: mongoose.Types.ObjectId;
  occasion: string;
  message: string;
  isSmartCard: boolean;
  smartCardId?: string; // UUID for the unique shareable link
  cardData?: {
    image?: string;
    title?: string;
    shape?: string;
    music?: string;
    animation?: string;
    senderName?: string;
    primaryColor?: string;
  };
  scheduledAt: Date;
  deliveryMethod: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const WishSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    recipientName: { type: String },
    recipientContact: { type: String },
    templateId: { type: Schema.Types.ObjectId, ref: 'WishTemplate' },
    occasion: { type: String, required: true },
    message: { type: String, required: true },
    isSmartCard: { type: Boolean, default: false },
    smartCardId: { type: String, sparse: true, unique: true },
    cardData: {
      image: String,
      title: String,
      shape: String,
      music: String,
      animation: String,
      senderName: String,
      primaryColor: String
    },
    scheduledAt: { type: Date, required: true },
    deliveryMethod: [{ type: String, enum: ['SMS', 'WhatsApp', 'Email'] }],
    status: { type: String, enum: ['Scheduled', 'Processing', 'Sent', 'Failed', 'Cancelled'], default: 'Scheduled' }
  },
  { timestamps: true }
);

export default mongoose.model<IWish>('Wish', WishSchema);
