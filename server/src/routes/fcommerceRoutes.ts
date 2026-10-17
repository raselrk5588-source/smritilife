import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getMerchantPageInfo,
  saveMerchantPageConfig,
  disconnectMerchantPage,
  addProduct,
  updateProduct,
  deleteProduct,
  getMerchantOrders,
  updateOrderStatus,
  testAiSimulator,
  getFacebookOAuthUrl,
  handleFacebookOAuthCallback,
  getPendingOAuthPages,
  selectOAuthPage
} from '../controllers/fcommerceController';

const router = Router();

// 1-Click Facebook OAuth Routes
router.get('/oauth/url', protect, getFacebookOAuthUrl);
router.get('/oauth/callback', handleFacebookOAuthCallback); // Public redirect callback from Meta
router.get('/oauth/pending-pages', protect, getPendingOAuthPages);
router.post('/oauth/select-page', protect, selectOAuthPage);

// Page info & Settings (Protected)
router.get('/page', protect, getMerchantPageInfo);
router.post('/page', protect, saveMerchantPageConfig);
router.delete('/page', protect, disconnectMerchantPage);

// Products catalog (Protected)
router.post('/products', protect, addProduct);
router.put('/products/:productId', protect, updateProduct);
router.delete('/products/:productId', protect, deleteProduct);

// Orders management (Protected)
router.get('/orders', protect, getMerchantOrders);
router.patch('/orders/:orderId/status', protect, updateOrderStatus);

// AI Sandbox Simulator (Protected)
router.post('/test-chat', protect, testAiSimulator);

export default router;
