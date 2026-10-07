import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  date: Date;
  time?: string;
  timezone: string;
  priority: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    time: { type: String },
    timezone: { type: String, default: 'Asia/Dhaka' },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    category: { type: String, default: 'General' },
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' }
  },
  { timestamps: true }
);

export default mongoose.model<IActivity>('Activity', ActivitySchema);
