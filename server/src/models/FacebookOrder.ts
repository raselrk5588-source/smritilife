import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId?: string;
  productName: string;
  quantity: number;
  price: number;
  color?: string;
  size?: string;
}

export interface IFacebookOrder extends Document {
  pageId: string; // Associated Facebook Page ID
  merchantUserId: mongoose.Types.ObjectId; // User who owns the shop
  customerPsid: string; // Facebook Page-Scoped ID of customer
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  paymentMethod: 'COD' | 'bKash' | 'Online';
  orderStatus: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  orderNumber: string; // Human readable order reference e.g. #ORD-1001
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, default: '' },
  productName: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  price: { type: Number, required: true },
  color: { type: String, default: '' },
  size: { type: String, default: '' }
}, { _id: false });

const FacebookOrderSchema = new Schema<IFacebookOrder>({
  pageId: { type: String, required: true, index: true },
  merchantUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerPsid: { type: String, required: true, index: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true, trim: true },
  deliveryAddress: { type: String, required: true, trim: true },
  items: [OrderItemSchema],
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['COD', 'bKash', 'Online'], default: 'COD' },
  orderStatus: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], 
    default: 'Pending',
    index: true
  },
  orderNumber: { type: String, required: true, unique: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model<IFacebookOrder>('FacebookOrder', FacebookOrderSchema);
