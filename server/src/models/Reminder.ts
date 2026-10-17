import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicineItem {
  name: string;
  mealTiming?: string;
  durationDays?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface IReminder extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  recipientPhone?: string;
  date: Date;
  time: string;
  priority: string;
  category: string;
  repeat: string;
  status: string;
  isAlarm?: boolean;
  startDate?: Date;
  endDate?: Date;
  durationDays?: number;
  mealTiming?: string;
  medicineRoutine?: string;
  medicines?: IMedicineItem[];
  lastDispatchedDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineItemSchema = new Schema({
  name: { type: String, required: true },
  mealTiming: { type: String, default: 'after' },
  durationDays: { type: Number, default: 7 },
  startDate: { type: Date },
  endDate: { type: Date }
}, { _id: true });

const ReminderSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    recipientPhone: { type: String },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    category: { type: String, default: 'General' },
    repeat: { type: String, enum: ['Once', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Weekdays', 'Custom'], default: 'Once' },
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled', 'Snoozed'], default: 'Pending' },
    isAlarm: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    durationDays: { type: Number },
    mealTiming: { type: String },
    medicineRoutine: { type: String },
    medicines: [MedicineItemSchema],
    lastDispatchedDate: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
