import { Queue } from 'bullmq';
import { connection } from '../config/redis';

export const reminderQueue = new Queue('reminderQueue', { connection });

export const addReminderJob = async (jobName: string, data: any, delay: number) => {
  await reminderQueue.add(jobName, data, { delay });
};
