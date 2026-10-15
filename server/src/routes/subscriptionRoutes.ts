import express from 'express';
import {
  initBkashSubscription,
  directSubscribeRedirect,
  verifySubscriptionReturn,
  bdappsNotificationWebhook,
  getAllSubscriptions
} from '../controllers/subscriptionController';

const router = express.Router();

// Initialize bKash authorization from frontend
router.post('/bkash/init', initBkashSubscription);

// Direct 302 redirect for server-side authorization flow
router.get('/bkash/authorize', directSubscribeRedirect);
router.get('/bkash/subscribe', directSubscribeRedirect);

// Callback / User return verification
router.post('/verify', verifySubscriptionReturn);

// bdapps asynchronous notification webhook
router.post('/webhook', bdappsNotificationWebhook);
router.post('/notify', bdappsNotificationWebhook);

// Subscriptions list for Admin
router.get('/list', getAllSubscriptions);

export default router;
