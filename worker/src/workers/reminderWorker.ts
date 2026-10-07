import { Worker, Job } from 'bullmq';
import { connection } from '../config/redis';

export const reminderWorker = new Worker('reminderQueue', async (job: Job) => {
  console.log(`Processing reminder job ${job.id}`);
  console.log(`Data:`, job.data);
  
  // Here we would typically send a notification, SMS, or Email
  // For now, just logging to simulate delivery
  console.log(`[DELIVERY] Reminder sent to user: ${job.data.title}`);
  
}, { connection });

reminderWorker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

reminderWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
