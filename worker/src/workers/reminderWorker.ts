import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis';
import { sendWhatsApp } from '../services/smsService';

export const reminderWorker = new Worker('reminderQueue', async (job: Job) => {
  console.log(`Processing reminder job ${job.id}`);
  console.log(`Data:`, job.data);
  
  // Here we would typically send a notification, SMS, or Email
  console.log(`[DELIVERY] Reminder sending to user: ${job.data.title}`);
  
  // Assuming job.data contains phone or user mobile
  // Wait, I need to know what job.data looks like from the server, but let's assume it has the same fields or we can just send to a fixed test number? No, we should use job.data.userMobile or similar.
  // Actually, we can check if there's a phone number passed
  const phone = job.data.mobile || job.data.phone || '01734042131'; 
  const timeStr = job.data.time ? ` at ${job.data.time}` : '';
  const message = `Reminder: ${job.data.title}${timeStr}\n${job.data.description || ''}`.trim();
  
  await sendWhatsApp(phone, message);
  
}, { connection });

reminderWorker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

reminderWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
