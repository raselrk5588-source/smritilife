import express from 'express';
import { getWishes, createWish, updateWish, deleteWish } from '../controllers/wishController';

const router = express.Router();

router.get('/', getWishes);
router.post('/', createWish);
router.patch('/:id', updateWish);
router.delete('/:id', deleteWish);

export default router;
