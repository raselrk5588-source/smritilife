import express from 'express';
import { trackVisit, getVisitorAnalytics } from '../controllers/visitorController';

const router = express.Router();

// Public visit tracking endpoint
router.post('/track', trackVisit);

// Visitor analytics (can be accessed via /api/visitors/analytics or /api/admin/visitor-analytics)
router.get('/analytics', getVisitorAnalytics);

export default router;
