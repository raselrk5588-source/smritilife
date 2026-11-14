import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpToken extends Document {
  mobile: string;
  otp: string;
  authSessionId?: string;
  verified?: boolean;
  verifiedToken?: string;
  verifiedUser?: {
    id: any;
    name: string;
    mobile: string;
    isSubscribed: boolean;
    trialStartDate?: Date;
    trialEndDate?: Date;
    isTrialActive?: boolean;
    hasAccess?: boolean;
    status?: string;
  };
  expiresAt: Date;
  createdAt: Date;
}

const OtpTokenSchema: Schema = new Schema(
  {
    mobile: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    authSessionId: { type: String, index: true },
    verified: { type: Boolean, default: false },
    verifiedToken: { type: String },
    verifiedUser: { type: Object },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

export default mongoose.model<IOtpToken>('OtpToken', OtpTokenSchema);
