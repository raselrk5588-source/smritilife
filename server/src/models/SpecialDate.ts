import mongoose, { Schema, Document } from 'mongoose';

export interface ISpecialDate extends Document {
  userId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  title: string;
  type: string;
  date: Date;
  recurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SpecialDateSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    title: { type: String, required: true },
    type: { type: String, enum: ['Birthday', 'Anniversary', 'Custom', 'Other'], default: 'Birthday' },
    date: { type: Date, required: true },
    recurring: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model<ISpecialDate>('SpecialDate', SpecialDateSchema);
