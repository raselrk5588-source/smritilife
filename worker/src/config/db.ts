import mongoose from 'mongoose';
import dns from 'dns';

// Ensure Google & Cloudflare DNS is used to reliably resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smriti_ai';
    const conn = await mongoose.connect(mongoUri);
    console.log(`Worker MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
