import express from 'express';
import { triggerWebSos, getSosProfile, updateSosProfile, resolveSos } from '../controllers/sosController';

const router = express.Router();

router.post('/trigger', triggerWebSos);
router.get('/profile', getSosProfile);
router.put('/profile', updateSosProfile);
router.post('/resolve', resolveSos);

export default router;
