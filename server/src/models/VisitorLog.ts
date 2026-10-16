import mongoose, { Document, Schema } from 'mongoose';

export interface IVisitorLog extends Document {
  visitorId: string;
  sessionId: string;
  path: string;
  pageTitle?: string;
  referrer?: string;
  ip?: string;
  userAgent?: string;
  device: 'mobile' | 'desktop' | 'tablet' | 'other';
  browser?: string;
  os?: string;
  dateStr: string;     // YYYY-MM-DD (Asia/Dhaka)
  yearMonth: string;   // YYYY-MM (Asia/Dhaka)
  hour: number;        // 0-23 (Asia/Dhaka)
  isUniqueDailyVisit: boolean;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const VisitorLogSchema = new Schema<IVisitorLog>(
  {
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    path: { type: String, required: true, index: true },
    pageTitle: { type: String, default: '' },
    referrer: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    device: { 
      type: String, 
      enum: ['mobile', 'desktop', 'tablet', 'other'], 
      default: 'mobile',
      index: true 
    },
    browser: { type: String, default: 'Other' },
    os: { type: String, default: 'Other' },
    dateStr: { type: String, required: true, index: true },
    yearMonth: { type: String, required: true, index: true },
    hour: { type: Number, default: 0 },
    isUniqueDailyVisit: { type: Boolean, default: false, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { 
    timestamps: true 
  }
);

// Compound indexes for optimal aggregation performance
VisitorLogSchema.index({ dateStr: 1, visitorId: 1 });
VisitorLogSchema.index({ createdAt: -1 });

export const getBangladeshDateStr = (date: Date = new Date()): string => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (3600000 * 6));
  const year = bdTime.getFullYear();
  const month = String(bdTime.getMonth() + 1).padStart(2, '0');
  const day = String(bdTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getBangladeshHour = (date: Date = new Date()): number => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (3600000 * 6));
  return bdTime.getHours();
};

export default mongoose.model<IVisitorLog>('VisitorLog', VisitorLogSchema);
