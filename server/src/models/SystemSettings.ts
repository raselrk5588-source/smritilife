import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  openaiApiKey: string;
  geminiApiKey: string;
  whatsappApiToken: string;
  twilioAccountSid: string;
  twilioPhoneNumber: string;
  smsGatewayKey: string;
  freeUserReminderLimit: number;
  proUserReminderLimit: number;
}

const SystemSettingsSchema: Schema = new Schema(
  {
    openaiApiKey: { type: String, default: '' },
    geminiApiKey: { type: String, default: '' },
    whatsappApiToken: { type: String, default: '' },
    twilioAccountSid: { type: String, default: '' },
    twilioPhoneNumber: { type: String, default: 'whatsapp:+14155238886' },
    smsGatewayKey: { type: String, default: '' },
    freeUserReminderLimit: { type: Number, default: 5 },
    proUserReminderLimit: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export default mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
