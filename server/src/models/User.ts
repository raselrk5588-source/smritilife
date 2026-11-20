import mongoose, { Schema, Document } from 'mongoose';

export interface IEmergencyContact {
  name: string;
  phone: string;
  relation?: string;
}

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
  trialStartDate?: Date;
  trialEndDate?: Date;
  isTrialUsed?: boolean;
  isProfileCompleted?: boolean;
  subscriptionExpiresAt?: Date;
  isAdmin?: boolean;
  deviceIds: string[];
  lastFollowUpDate?: string;
  lastActiveAt?: Date;
  honorific?: string;
  district?: string;
  bloodGroup?: string;
  emergencyContacts?: IEmergencyContact[];
  medicalNotes?: string;
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
    trialStartDate: { type: Date },
    trialEndDate: { type: Date },
    isTrialUsed: { type: Boolean, default: false },
    isProfileCompleted: { type: Boolean, default: false },
    subscriptionExpiresAt: { type: Date },
    isAdmin: { type: Boolean, default: false },
    deviceIds: { type: [String], default: [] },
    lastFollowUpDate: { type: String },
    lastActiveAt: { type: Date },
    honorific: { type: String },
    district: { type: String, default: 'Dhaka' },
    bloodGroup: { type: String, default: '' },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relation: { type: String, default: 'অভিভাবক' }
      }
    ],
    medicalNotes: { type: String, default: '' },
    ramadanAlerts: {
      enabled: { type: Boolean, default: false },
      sehriAlert: { type: Boolean, default: false },
      sehriMinutesBefore: { type: Number, default: 40 },
      iftarAlert: { type: Boolean, default: false },
      lastSehriAlertDate: { type: String },
      lastIftarNoticeDate: { type: String },
      lastIftarAlertDate: { type: String }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
