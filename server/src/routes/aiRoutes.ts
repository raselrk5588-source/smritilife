import express from 'express';
import { parseCommand, generateWish, transcribeVoice, parseVoiceWish } from '../controllers/aiController';

const router = express.Router();

router.post('/parse-command', parseCommand);
router.post('/generate-wish', generateWish);
router.post('/transcribe-voice', transcribeVoice);
router.post('/parse-voice-wish', parseVoiceWish);

export default router;
