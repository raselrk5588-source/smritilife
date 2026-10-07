import express from 'express';
import { getReminders, createReminder, updateReminder, deleteReminder } from '../controllers/reminderController';

const router = express.Router();

router.get('/', getReminders);
router.post('/', createReminder);
router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
