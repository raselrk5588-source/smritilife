import twilio from 'twilio';
import mongoose from 'mongoose';

// Define a simple schema to fetch settings directly from MongoDB
const SystemSettingsSchema = new mongoose.Schema({
  whatsappApiToken: { type: String, default: '' },
  twilioAccountSid: { type: String, default: '' },
  twilioPhoneNumber: { type: String, default: 'whatsapp:+14155238886' },
  smsGatewayKey: { type: String, default: '' },
});

// Avoid OverwriteModelError
const SystemSettings = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);

export const sendSMS = async (to: string, message: string) => {
  try {
    const settings = await SystemSettings.findOne();
    
    console.log(`\n======================================`);
    console.log(`📱 [Real SMS Service] Preparing SMS to: ${to}`);
    console.log(`✉️  Message: ${message}`);
    console.log(`======================================\n`);

    // In a real scenario you would use the smsGatewayKey here.
    // For twilio SMS:
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, settings?.smsGatewayKey || process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
    
    console.log('✅ SMS Sent (Simulated real API call - Configure Twilio/Gateway details to enable)');
    return true;
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
    return false;
  }
};

export const sendWhatsApp = async (to: string, message: string, imageUrl?: string) => {
  try {
    const settings = await SystemSettings.findOne();
    
    // Check if we have Twilio credentials in environment or settings
    const accountSid = settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = settings?.whatsappApiToken || process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = settings?.twilioPhoneNumber || process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; 
    
    if (!accountSid || !authToken) {
      console.log('⚠️  Twilio credentials not fully configured. Using mock WhatsApp send.');
      console.log(`💬 To: ${to} | Message: ${message}`);
      return true;
    }

    const client = twilio(accountSid, authToken);

    // Format the number to E.164 format and prefix with 'whatsapp:'
    // Example: if 'to' is '01700000000', we format to 'whatsapp:+8801700000000'
    let formattedTo = to.startsWith('+') ? to : `+88${to}`; // Assuming Bangladesh format, adjust as needed
    formattedTo = `whatsapp:${formattedTo}`;

    console.log(`\n======================================`);
    console.log(`💬 [Real WhatsApp Service] Sending via Twilio to: ${formattedTo}`);
    
    const messageOptions: any = {
      body: message,
      from: twilioWhatsAppNumber,
      to: formattedTo
    };

    if (imageUrl) {
      messageOptions.mediaUrl = [imageUrl];
    }

    const response = await client.messages.create(messageOptions);
    console.log(`✅ WhatsApp Sent! Message SID: ${response.sid}`);
    console.log(`======================================\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to send WhatsApp via Twilio:', error);
    return false;
  }
};
