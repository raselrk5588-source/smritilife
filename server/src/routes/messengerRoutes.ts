import { Router } from 'express';
import { verifyMessengerWebhook, handleMessengerWebhook } from '../controllers/messengerWebhookController';

const router = Router();

// Meta Messenger Webhook verification (GET) and incoming event receiver (POST)
router.get('/webhook', verifyMessengerWebhook);
router.post('/webhook', handleMessengerWebhook);

export default router;
