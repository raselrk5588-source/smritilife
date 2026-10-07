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
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String },
    mobile: { type: String },
    whatsapp: { type: String },
    profilePic: { type: String },
    timezone: { type: String, default: 'Asia/Dhaka' },
    preferences: {
      notifications: { type: Boolean, default: true },
      voice: { type: Boolean, default: true }
    },
    isSubscribed: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
