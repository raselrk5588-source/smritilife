import mongoose, { Schema, Document } from 'mongoose';

export interface IDebtTransaction {
  date: Date;
  amount: number;
  note?: string;
  type: 'payment' | 'additional';
}

export interface IDebt extends Document {
  userId: mongoose.Types.ObjectId;
  personName: string;
  personPhone?: string;
  type: 'lent' | 'borrowed'; // lent = আমি পাবো (পাওনা), borrowed = আমি দেবো (দেনা)
  amount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'settled';
  dueDate?: Date;
  notes?: string;
  history: IDebtTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const debtTransactionSchema = new Schema<IDebtTransaction>({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  note: { type: String },
  type: { type: String, enum: ['payment', 'additional'], default: 'payment' }
}, { _id: false });

const debtSchema = new Schema<IDebt>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  personName: { type: String, required: true, trim: true, index: true },
  personPhone: { type: String, trim: true },
  type: { type: String, enum: ['lent', 'borrowed'], required: true, index: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'settled'], default: 'pending', index: true },
  dueDate: { type: Date },
  notes: { type: String },
  history: [debtTransactionSchema]
}, { timestamps: true });

export default mongoose.model<IDebt>('Debt', debtSchema);
