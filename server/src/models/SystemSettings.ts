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
  bdappsApiKey?: string;
  bdappsApiSecret?: string;
  bdappsRedirectUrl?: string;
  subscriptionFee?: number;
  isMaintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
  maintenanceAllowedIps?: string[];
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
    bdappsApiKey: { type: String, default: '' },
    bdappsApiSecret: { type: String, default: '' },
    bdappsRedirectUrl: { type: String, default: '' },
    subscriptionFee: { type: Number, default: 190 },
    isMaintenanceMode: { type: Boolean, default: false },
    maintenanceTitle: { type: String, default: 'সিস্টেম আপগ্রেড ও রক্ষণাবেক্ষণ চলছে' },
    maintenanceMessage: { type: String, default: 'স্মৃতিকে আরও দ্রুত ও উন্নত করতে বর্তমানে সিস্টেম আপগ্রেডের কাজ চলছে। খুব শীঘ্রই আমরা আবার পুরোদমে ফিরে আসছি। আপনার সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত।' },
    maintenanceEstimatedTime: { type: String, default: '১৫-২০ মিনিট' },
    maintenanceAllowedIps: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
