import express from 'express';
import {
  getDocuments,
  uploadDocument,
  getDocumentById,
  downloadDocument,
  viewDocument,
  deleteDocument
} from '../controllers/documentController';

const router = express.Router();

router.get('/', getDocuments);
router.post('/', uploadDocument);
router.get('/:id', getDocumentById);
router.get('/:id/download', downloadDocument);
router.get('/:id/view', viewDocument);
router.get('/:id/file', viewDocument);
router.delete('/:id', deleteDocument);

export default router;
