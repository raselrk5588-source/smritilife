import express from 'express';
import { getWishTemplates, createWishTemplate, updateWishTemplate, deleteWishTemplate } from '../controllers/wishTemplateController';

const router = express.Router();

router.get('/', getWishTemplates);
router.post('/', createWishTemplate);
router.patch('/:id', updateWishTemplate);
router.delete('/:id', deleteWishTemplate);

export default router;
