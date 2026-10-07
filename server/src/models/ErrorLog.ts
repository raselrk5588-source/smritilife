import mongoose, { Document, Schema } from 'mongoose';

export interface IErrorLog extends Document {
  source: 'Frontend' | 'Backend' | 'Worker';
  message: string;
  stack?: string;
  path?: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const errorLogSchema = new Schema<IErrorLog>({
  source: { type: String, enum: ['Frontend', 'Backend', 'Worker'], required: true },
  message: { type: String, required: true },
  stack: { type: String },
  path: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Auto delete errors older than 30 days
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model<IErrorLog>('ErrorLog', errorLogSchema);
