import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  userId?: mongoose.Types.ObjectId;
  msisdn?: string;
  requestId: string;
  requestTime: string;
  amount: number;
  status: 'PENDING' | 'SUBSCRIBED' | 'FAILED' | 'CANCELLED';
  statusCode?: string;
  statusDetail?: string;
  paymentOption: string;
  subscriberId?: string;
  frequency?: string;
  signature?: string;
  redirectUrl?: string;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    msisdn: { type: String },
    requestId: { type: String, required: true, unique: true, index: true },
    requestTime: { type: String, required: true },
    amount: { type: Number, default: 190 },
    status: {
      type: String,
      enum: ['PENDING', 'SUBSCRIBED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    statusCode: { type: String },
    statusDetail: { type: String },
    paymentOption: { type: String, default: 'bKash' },
    subscriberId: { type: String },
    frequency: { type: String },
    signature: { type: String },
    redirectUrl: { type: String },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
