import express from 'express';
import { getContacts, createContact, updateContact, deleteContact, importContacts } from '../controllers/contactController';

const router = express.Router();

router.get('/', getContacts);
router.post('/', createContact);
router.post('/import', importContacts);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
