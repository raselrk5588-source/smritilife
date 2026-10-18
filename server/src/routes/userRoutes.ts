import express from 'express';
import { getProfile, updateProfile } from '../controllers/userController';
import { loginWithOtp, checkMobile, checkAuthSessionStatus } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/check-mobile', checkMobile);
router.post('/login', loginWithOtp);
router.get('/auth-session/:sessionId', checkAuthSessionStatus);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

export default router;
