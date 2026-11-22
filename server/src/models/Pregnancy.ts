import mongoose, { Document, Schema } from 'mongoose';

export interface IKickLog {
  _id?: mongoose.Types.ObjectId;
  date: Date;
  count: number;
  durationMinutes?: number;
  notes?: string;
}

export interface IDoctorVisit {
  _id?: mongoose.Types.ObjectId;
  date: Date;
  title: string;
  doctorName?: string;
  notes?: string;
  isCompleted: boolean;
}

export interface IWeightLog {
  _id?: mongoose.Types.ObjectId;
  date: Date;
  weightKg: number;
}

export interface IPregnancy extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'active' | 'delivered' | 'completed' | 'paused';
  method: 'lmp' | 'dueDate' | 'conception';
  lmpDate?: Date;
  dueDate: Date;
  conceptionDate?: Date;
  babyNickname?: string;
  weeklyReminderEnabled: boolean;
  lastWeeklyAlertWeek?: number;
  lastWeeklyAlertDate?: string;
  kickLogs: IKickLog[];
  doctorVisits: IDoctorVisit[];
  weightLogs: IWeightLog[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KickLogSchema = new Schema<IKickLog>({
  date: { type: Date, default: Date.now },
  count: { type: Number, required: true },
  durationMinutes: { type: Number },
  notes: { type: String }
});

const DoctorVisitSchema = new Schema<IDoctorVisit>({
  date: { type: Date, required: true },
  title: { type: String, required: true },
  doctorName: { type: String },
  notes: { type: String },
  isCompleted: { type: Boolean, default: false }
});

const WeightLogSchema = new Schema<IWeightLog>({
  date: { type: Date, default: Date.now },
  weightKg: { type: Number, required: true }
});

const PregnancySchema = new Schema<IPregnancy>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'delivered', 'completed', 'paused'],
      default: 'active'
    },
    method: {
      type: String,
      enum: ['lmp', 'dueDate', 'conception'],
      default: 'lmp'
    },
    lmpDate: { type: Date },
    dueDate: { type: Date, required: true },
    conceptionDate: { type: Date },
    babyNickname: { type: String, default: 'সোনামণি' },
    weeklyReminderEnabled: { type: Boolean, default: true },
    lastWeeklyAlertWeek: { type: Number, default: 0 },
    lastWeeklyAlertDate: { type: String },
    kickLogs: [KickLogSchema],
    doctorVisits: [DoctorVisitSchema],
    weightLogs: [WeightLogSchema],
    notes: { type: String }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IPregnancy>('Pregnancy', PregnancySchema);
