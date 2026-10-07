import express from 'express';
import { receiveWebhook } from '../controllers/whatsappController';

const router = express.Router();

// Twilio webhook endpoint needs to handle POST requests
router.post('/webhook', receiveWebhook);

export default router;
