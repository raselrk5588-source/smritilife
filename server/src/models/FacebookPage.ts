import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct {
  _id?: mongoose.Types.ObjectId;
  name: string;
  price: number;
  description?: string;
  category?: string;
  colors?: string[];
  sizes?: string[];
  inStock: boolean;
  imageUrl?: string;
}

export interface IFacebookPageSettings {
  businessName: string;
  welcomeMessage?: string;
  deliveryChargeInsideDhaka: number;
  deliveryChargeOutsideDhaka: number;
  codAvailable: boolean;
  bkashNumber?: string;
  contactPhone?: string;
  notificationPhone?: string; // Merchant WhatsApp number to receive instant order alerts
  customPromptInstructions?: string;
}

export interface IFacebookPage extends Document {
  userId: mongoose.Types.ObjectId;
  pageId: string; // Facebook Page ID (string)
  pageName: string;
  pageAccessToken: string;
  webhookVerifyToken: string;
  isActive: boolean;
  settings: IFacebookPageSettings;
  products: IProduct[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  colors: [{ type: String }],
  sizes: [{ type: String }],
  inStock: { type: Boolean, default: true },
  imageUrl: { type: String, default: '' }
}, { timestamps: true });

const FacebookPageSchema = new Schema<IFacebookPage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pageId: { type: String, required: true, unique: true, index: true },
  pageName: { type: String, required: true, trim: true },
  pageAccessToken: { type: String, required: true },
  webhookVerifyToken: { type: String, default: 'smriti_messenger_webhook_2026' },
  isActive: { type: Boolean, default: true },
  settings: {
    businessName: { type: String, default: 'আমার শপ' },
    welcomeMessage: { type: String, default: 'আসসালামু আলাইকুম! আমাদের পেজে আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে চান বলুন।' },
    deliveryChargeInsideDhaka: { type: Number, default: 70 },
    deliveryChargeOutsideDhaka: { type: Number, default: 130 },
    codAvailable: { type: Boolean, default: true },
    bkashNumber: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    notificationPhone: { type: String, default: '' },
    customPromptInstructions: { type: String, default: '' }
  },
  products: [ProductSchema]
}, { timestamps: true });

export default mongoose.model<IFacebookPage>('FacebookPage', FacebookPageSchema);
