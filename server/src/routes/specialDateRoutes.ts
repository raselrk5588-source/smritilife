import express from 'express';
import { getSpecialDates, createSpecialDate, updateSpecialDate, deleteSpecialDate } from '../controllers/specialDateController';

const router = express.Router();

router.get('/', getSpecialDates);
router.post('/', createSpecialDate);
router.put('/:id', updateSpecialDate);
router.delete('/:id', deleteSpecialDate);

export default router;
