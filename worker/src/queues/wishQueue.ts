import { Queue } from 'bullmq';
import { connection } from '../config/redis';

export const wishQueue = new Queue('wishQueue', { connection });

export const addWishJob = async (jobName: string, data: any, delay: number) => {
  await wishQueue.add(jobName, data, { delay });
};
