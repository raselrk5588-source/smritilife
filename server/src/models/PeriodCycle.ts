import mongoose, { Document, Schema } from 'mongoose';

export interface IPeriodHistoryItem {
  _id?: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  cycleDays?: number;
  notes?: string;
  loggedAt: Date;
}

export interface IPeriodCycle extends Document {
  userId: mongoose.Types.ObjectId;
  cycleLength: number;
  periodDuration: number;
  lastPeriodStart: Date;
  nextExpectedDate: Date;
  reminderEnabled: boolean;
  history: IPeriodHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const PeriodHistorySchema = new Schema<IPeriodHistoryItem>({
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  cycleDays: { type: Number },
  notes: { type: String },
  loggedAt: { type: Date, default: Date.now }
});

const PeriodCycleSchema = new Schema<IPeriodCycle>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    cycleLength: {
      type: Number,
      default: 28,
      min: 18,
      max: 45
    },
    periodDuration: {
      type: Number,
      default: 5,
      min: 2,
      max: 12
    },
    lastPeriodStart: {
      type: Date,
      required: true
    },
    nextExpectedDate: {
      type: Date,
      required: true
    },
    reminderEnabled: {
      type: Boolean,
      default: true
    },
    history: {
      type: [PeriodHistorySchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model<IPeriodCycle>('PeriodCycle', PeriodCycleSchema);
