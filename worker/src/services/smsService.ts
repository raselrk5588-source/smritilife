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
    // For Meta WhatsApp Cloud API (Testing configuration)
    const metaToken = "EAAfJRzwYyIsBSjO1yS0q0CJBVI9scXM3ssgL1czWkXmuvsXNzLzjkxRRMtO4pwIGpmiCdgs674JMjqx17IiJRJXOgp1FkBhuMkQmHl0xYZCa5Kw2BhBRiIittegUucKJWuineTJGX2yklXcnuHE2A1J2jANFR6kBYT3NvGsERdyBLejgaoqUKWXMfxAZDZD";
    const phoneNumberId = "1351522341377579"; 

    // Meta expects country code without '+' or 'whatsapp:' prefix
    let formattedTo = to;
    if (formattedTo.startsWith('+')) {
      formattedTo = formattedTo.substring(1);
    } else if (formattedTo.startsWith('01')) {
      formattedTo = `88${formattedTo}`;
    }

    console.log(`\n======================================`);
    console.log(`💬 [Real WhatsApp Service] Sending via Meta API to: ${formattedTo}`);
    
    // We send a text message by default
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedTo,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    };

    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${metaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to send WhatsApp via Meta API:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log(`✅ WhatsApp Sent! Message ID: ${data.messages?.[0]?.id}`);
    console.log(`======================================\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to send WhatsApp via Meta API:', error);
    return false;
  }
};
