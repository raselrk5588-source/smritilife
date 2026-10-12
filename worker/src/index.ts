import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
dns.setDefaultResultOrder('ipv4first');

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

// Reminder cron is handled centrally by server's reminderScheduler
// startCron();
