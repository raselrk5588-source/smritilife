import express from 'express';
import { getProfile, updateProfile } from '../controllers/userController';
import { loginWithOtp } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', loginWithOtp);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

export default router;
