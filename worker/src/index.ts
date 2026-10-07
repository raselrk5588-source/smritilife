import dotenv from 'dotenv';
import './workers/reminderWorker';
import './workers/wishWorker';
import connectDB from './config/db';

dotenv.config();

// Connect to MongoDB to read SystemSettings dynamically
connectDB();

console.log('Smriti Background Worker is running...');
console.log('Waiting for jobs in queues...');
