import express from 'express';
import { getActivities, createActivity, updateActivity, deleteActivity } from '../controllers/activityController';

const router = express.Router();

router.get('/', getActivities);
router.post('/', createActivity);
router.patch('/:id', updateActivity);
router.delete('/:id', deleteActivity);

export default router;
