import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/db';
import noteRoutes from './routes/noteRoutes';
import activityRoutes from './routes/activityRoutes';
import reminderRoutes from './routes/reminderRoutes';
import specialDateRoutes from './routes/specialDateRoutes';
import contactRoutes from './routes/contactRoutes';
import wishTemplateRoutes from './routes/wishTemplateRoutes';
import wishRoutes from './routes/wishRoutes';
import aiRoutes from './routes/aiRoutes';
import adminRoutes from './routes/adminRoutes';
import userRoutes from './routes/userRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import ramadanRoutes from './routes/ramadanRoutes';
import path from 'path';
import fs from 'fs';
import expenseRoutes from './routes/expenseRoutes';
import debtRoutes from './routes/debtRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import documentRoutes from './routes/documentRoutes';
import ErrorLog from './models/ErrorLog';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Serve static uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

// Connect Database
connectDB();

import { startReminderScheduler } from './services/reminderScheduler';
startReminderScheduler();

import { getPublicWish } from './controllers/wishController';
import { protect } from './middleware/authMiddleware';
import { maintenanceMiddleware } from './middleware/maintenanceMiddleware';
import maintenanceRoutes from './routes/maintenanceRoutes';

// Global Maintenance Mode check
app.use(maintenanceMiddleware);

// Routes
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/users', userRoutes);
app.get('/api/wishes/public/:id', getPublicWish);
app.use('/api/notes', protect, noteRoutes);
app.use('/api/activities', protect, activityRoutes);
app.use('/api/reminders', protect, reminderRoutes);
app.use('/api/special-dates', protect, specialDateRoutes);
app.use('/api/contacts', protect, contactRoutes);
app.use('/api/wish-templates', protect, wishTemplateRoutes);
app.use('/api/wishes', protect, wishRoutes);
app.use('/api/ai', protect, aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ramadan', ramadanRoutes);
app.use('/api/expenses', protect, expenseRoutes);
app.use('/api/debts', protect, debtRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/documents', protect, documentRoutes);

app.get('/', (req, res) => {
  res.send('Smriti API is running...');
});

app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: isConnected ? 'healthy' : 'database_disconnected',
    database: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use(async (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    await ErrorLog.create({
      source: 'Backend',
      message: err.message || 'Internal Server Error',
      stack: err.stack,
      path: req.originalUrl,
      userId: (req as any).user?.id || undefined
    });
  } catch (e) {
    console.error('Failed to log error to DB', e);
  }
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

// Start server in all environments except Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
