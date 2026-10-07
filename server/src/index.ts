import express from 'express';
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
import ErrorLog from './models/ErrorLog';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(helmet());

// Connect Database
connectDB();

import { getPublicWish } from './controllers/wishController';
import { protect } from './middleware/authMiddleware';

// Routes
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

app.get('/', (req, res) => {
  res.send('Smriti API is running...');
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
