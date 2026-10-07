import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  date: Date;
  time: string;
  priority: string;
  category: string;
  repeat: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    category: { type: String, default: 'General' },
    repeat: { type: String, enum: ['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Weekdays', 'Custom'], default: 'Once' },
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled', 'Snoozed'], default: 'Pending' }
  },
  { timestamps: true }
);

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
