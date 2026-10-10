import express from 'express';
import { receiveWebhook, verifyWebhook } from '../controllers/whatsappController';

const router = express.Router();

// Meta Webhook Verification endpoint
router.get('/webhook', verifyWebhook);

// Webhook endpoint to receive messages
router.post('/webhook', receiveWebhook);

export default router;
