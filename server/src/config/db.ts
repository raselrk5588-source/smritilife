import mongoose from 'mongoose';
import dns from 'dns';

// Ensure Google & Cloudflare DNS is used to reliably resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (isConnecting) return;
  isConnecting = true;

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smriti';

  const connectWithRetry = async (attempt = 1): Promise<void> => {
    try {
      console.log(`[MongoDB] Connecting to database (attempt ${attempt})...`);
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      });
      isConnecting = false;
      console.log(`✅ [MongoDB] Connected successfully: ${conn.connection.host}`);
    } catch (error: any) {
      console.error(`❌ [MongoDB] Connection error (attempt ${attempt}): ${error.message}`);
      isConnecting = false;
      // Retry in background after 5 seconds
      setTimeout(() => connectWithRetry(attempt + 1), 5000);
    }
  };

  await connectWithRetry(1);
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ [MongoDB] Disconnected. Attempting reconnection...');
  setTimeout(() => connectDB(), 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ [MongoDB] Runtime connection error:', err);
});

export default connectDB;
