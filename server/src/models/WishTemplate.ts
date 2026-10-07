import mongoose, { Schema, Document } from 'mongoose';

export interface IWishTemplate extends Document {
  name: string;
  category: string;
  content: string;
  type: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WishTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['Text', 'Image', 'TextAndImage'], default: 'Text' },
    isSystem: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IWishTemplate>('WishTemplate', WishTemplateSchema);
