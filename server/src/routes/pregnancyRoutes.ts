import express from 'express';
import {
  getPregnancy,
  setupPregnancy,
  logKick,
  addOrUpdateVisit,
  deleteVisit,
  updatePregnancySettings,
  resetPregnancy
} from '../controllers/pregnancyController';

const router = express.Router();

router.get('/', getPregnancy);
router.post('/', setupPregnancy);
router.post('/kick', logKick);
router.post('/visit', addOrUpdateVisit);
router.delete('/visit/:visitId', deleteVisit);
router.put('/settings', updatePregnancySettings);
router.delete('/', resetPregnancy);

export default router;
