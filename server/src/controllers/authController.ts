import { Request, Response } from 'express';
import User from '../models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'smriti_secret_key_2026';

export const loginWithOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;
    console.log("Login request received:", req.body);

    if (!mobile || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required' });
    }

    // In a real app, verify OTP against a service/DB. Here we accept 1234 or 0000
    if (otp !== '1234' && otp !== '0000') {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    let user = await User.findOne({ mobile });

    if (!user) {
      if (mobile === '01734042131') {
        user = new User({
          name: 'Roni Sikder',
          email: 'ronisikder49@gmail.com',
          mobile: '01734042131',
          whatsapp: '01734042131',
          isSubscribed: true,
        });
      } else {
        user = new User({
          name: 'নতুন ব্যবহারকারী',
          email: `${mobile}@example.com`,
          mobile,
          isSubscribed: false,
        });
      }
      await user.save();
    } else {
      if (mobile === '01734042131' && !user.isSubscribed) {
        user.isSubscribed = true;
        await user.save();
      } else if (mobile !== '01734042131' && user.isSubscribed) {
        // Force others to false for this requirement, or leave them as is if they already paid
        user.isSubscribed = false;
        await user.save();
      }
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        isSubscribed: user.isSubscribed
      }
    });

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
