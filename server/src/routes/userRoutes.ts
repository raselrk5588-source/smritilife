import express from 'express';
import { getProfile, updateProfile, startTrial, getTrialSettings } from '../controllers/userController';
import { loginWithOtp, checkMobile, checkAuthSessionStatus } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/trial-settings', getTrialSettings);
router.post('/start-trial', startTrial);
router.post('/check-mobile', checkMobile);
router.post('/login', loginWithOtp);
router.get('/auth-session/:sessionId', checkAuthSessionStatus);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

export default router;
