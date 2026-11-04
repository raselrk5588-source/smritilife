import express from 'express';
import {
  initBkashSubscription,
  directSubscribeRedirect,
  verifySubscriptionReturn,
  bdappsNotificationWebhook,
  getAllSubscriptions,
  sendRobiSubscriptionOtp,
  verifyRobiSubscriptionOtp,
  cancelUserSubscription
} from '../controllers/subscriptionController';

const router = express.Router();

// Initialize bKash authorization from frontend
router.post('/bkash/init', initBkashSubscription);

// Direct cancellation endpoint
router.post('/cancel', cancelUserSubscription);

// Direct 302 redirect for server-side authorization flow
router.get('/bkash/authorize', directSubscribeRedirect);
router.get('/bkash/subscribe', directSubscribeRedirect);

// Robi / Airtel SIM carrier billing subscription (190 Tk)
router.post('/robi/send-otp', sendRobiSubscriptionOtp);
router.post('/robi/verify-otp', verifyRobiSubscriptionOtp);

// Callback / User return verification
router.post('/verify', verifySubscriptionReturn);

// bdapps asynchronous notification webhook (handles both GET and POST)
router.all('/webhook', bdappsNotificationWebhook);
router.all('/notify', bdappsNotificationWebhook);
router.all('/callback', bdappsNotificationWebhook);
router.all('/subscription/notify', bdappsNotificationWebhook);
router.all('/subscription/webhook', bdappsNotificationWebhook);

// Subscriptions list for Admin
router.get('/list', getAllSubscriptions);

export default router;
