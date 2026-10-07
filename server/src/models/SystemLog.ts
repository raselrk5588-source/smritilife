import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLog extends Document {
  type: 'REMINDER' | 'WISH_CARD' | 'SMS' | 'SYSTEM';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  targetId?: mongoose.Types.ObjectId; // E.g. Reminder ID or Wish ID
  createdAt: Date;
  updatedAt: Date;
}

const SystemLogSchema: Schema = new Schema(
  {
    type: { type: String, enum: ['REMINDER', 'WISH_CARD', 'SMS', 'SYSTEM'], required: true },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], required: true },
    message: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId }
  },
  { timestamps: true }
);

export default mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
