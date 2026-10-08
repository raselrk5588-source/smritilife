import dotenv from 'dotenv';
dotenv.config();

import './workers/reminderWorker';
import './workers/wishWorker';
import connectDB from './config/db';
import { startCron } from './cron';

// Connect to MongoDB to read SystemSettings dynamically
connectDB();

console.log('Smriti Background Worker is running...');
console.log('Waiting for jobs in queues...');

// Start polling for reminders
startCron();
