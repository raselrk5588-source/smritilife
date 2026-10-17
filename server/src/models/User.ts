import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  username?: string;
  mobile?: string;
  whatsapp?: string;
  profilePic?: string;
  timezone: string;
  preferences: {
    notifications: boolean;
    voice: boolean;
  };
  isSubscribed: boolean;
  isAdmin?: boolean;
  deviceIds: string[];
  lastFollowUpDate?: string;
  lastActiveAt?: Date;
  honorific?: string;
  district?: string;
  ramadanAlerts?: {
    enabled?: boolean;
    sehriAlert?: boolean;
    sehriMinutesBefore?: number;
    iftarAlert?: boolean;
    lastSehriAlertDate?: string;
    lastIftarNoticeDate?: string;
    lastIftarAlertDate?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String },
    mobile: { type: String, index: true },
    whatsapp: { type: String, index: true },
    profilePic: { type: String },
    timezone: { type: String, default: 'Asia/Dhaka' },
    preferences: {
      notifications: { type: Boolean, default: true },
      voice: { type: Boolean, default: true }
    },
    isSubscribed: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    deviceIds: { type: [String], default: [] },
    lastFollowUpDate: { type: String },
    lastActiveAt: { type: Date },
    honorific: { type: String },
    district: { type: String, default: 'Dhaka' },
    ramadanAlerts: {
      enabled: { type: Boolean, default: true },
      sehriAlert: { type: Boolean, default: true },
      sehriMinutesBefore: { type: Number, default: 40 },
      iftarAlert: { type: Boolean, default: true },
      lastSehriAlertDate: { type: String },
      lastIftarNoticeDate: { type: String },
      lastIftarAlertDate: { type: String }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
