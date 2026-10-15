import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpToken extends Document {
  mobile: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpTokenSchema: Schema = new Schema(
  {
    mobile: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

export default mongoose.model<IOtpToken>('OtpToken', OtpTokenSchema);
