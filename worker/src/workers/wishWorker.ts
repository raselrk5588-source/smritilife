import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis';
import { sendEmail } from '../services/emailService';
import { sendSMS, sendWhatsApp } from '../services/smsService';

export const wishWorker = new Worker('wishQueue', async (job: Job) => {
  console.log(`[WishWorker] Processing wish job ${job.id} for ${job.data.person}`);
  
  const { person, occasion, message, email, phone, methods } = job.data;
  
  // Process based on requested delivery methods
  if (methods.includes('Email') && email) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #f8fafc;">
        <h1 style="color: #6366f1;">Happy ${occasion}, ${person}! 🎉</h1>
        <div style="background-color: white; padding: 30px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <p style="font-size: 18px; color: #334155; line-height: 1.6;">${message}</p>
        </div>
        <p style="margin-top: 30px; color: #94a3b8; font-size: 12px;">Sent via Smriti AI</p>
      </div>
    `;
    await sendEmail(email, `Happy ${occasion}, ${person}!`, htmlContent);
  }
  
  if (methods.includes('SMS') && phone) {
    await sendSMS(phone, message);
  }
  
  if (methods.includes('WhatsApp') && phone) {
    await sendWhatsApp(phone, message);
  }

}, { connection });

wishWorker.on('completed', job => {
  console.log(`[WishWorker] Job ${job.id} has successfully delivered all wishes!`);
});

wishWorker.on('failed', (job, err) => {
  console.error(`[WishWorker] Job ${job?.id} failed: ${err.message}`);
});
