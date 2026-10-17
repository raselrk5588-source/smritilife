import { Router } from 'express';
import {
  getMerchantPageInfo,
  saveMerchantPageConfig,
  disconnectMerchantPage,
  addProduct,
  updateProduct,
  deleteProduct,
  getMerchantOrders,
  updateOrderStatus,
  testAiSimulator
} from '../controllers/fcommerceController';

const router = Router();

// Page info & Settings
router.get('/page', getMerchantPageInfo);
router.post('/page', saveMerchantPageConfig);
router.delete('/page', disconnectMerchantPage);

// Products catalog
router.post('/products', addProduct);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);

// Orders management
router.get('/orders', getMerchantOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);

// AI Sandbox Simulator
router.post('/test-chat', testAiSimulator);

export default router;
