import mongoose from 'mongoose';
import dns from 'dns';

// Fix for querySrv ECONNREFUSED on local environments
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {}
}

let isConnected: mongoose.ConnectionStates;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smriti', {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    isConnected = conn.connection.readyState;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Do not process.exit(1) in serverless environments like Vercel
  }
};

export default connectDB;
