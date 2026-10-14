import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  category: string;
  categoryBn: string;
  paymentMethod: string;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      default: 'other',
      enum: ['food', 'transport', 'shopping', 'bills', 'health', 'education', 'entertainment', 'other']
    },
    categoryBn: { type: String, default: 'অন্যান্য' },
    paymentMethod: {
      type: String,
      default: 'cash',
      enum: ['cash', 'bkash', 'nagad', 'card', 'bank', 'other']
    },
    date: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { timestamps: true }
);

ExpenseSchema.index({ userId: 1, date: -1 });

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
