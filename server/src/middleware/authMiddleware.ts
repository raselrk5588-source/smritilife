import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check device authorization (max 2 devices)
      const deviceId = req.headers['x-device-id'] as string;
      if (deviceId && user.deviceIds && user.deviceIds.length > 0 && !user.deviceIds.includes(deviceId)) {
        return res.status(401).json({ message: 'আপনার অ্যাকাউন্টটি অন্য ডিভাইস থেকে লগইন করায় এই ডিভাইসটি লগআউট হয়েছে।' });
      }

      req.user = { id: user.id };

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};
