import express from 'express';
import { parseCommand, generateWish } from '../controllers/aiController';

const router = express.Router();

router.post('/parse-command', parseCommand);
router.post('/generate-wish', generateWish);

export default router;
