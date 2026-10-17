import { Request, Response } from 'express';
import FacebookPage, { IProduct } from '../models/FacebookPage';
import FacebookOrder from '../models/FacebookOrder';
import { processMessengerCustomerMessage } from '../services/messengerAiService';

/**
 * Get connected page configuration and overall statistics for merchant
 */
export const getMerchantPageInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const page = await FacebookPage.findOne({ userId });

    if (!page) {
      res.json({
        hasPage: false,
        page: null,
        stats: {
          totalOrders: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          deliveredOrders: 0,
          totalRevenue: 0
        }
      });
      return;
    }

    // Calculate merchant order statistics
    const [stats] = await FacebookOrder.aggregate([
      { $match: { merchantUserId: page.userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Pending'] }, 1, 0] } },
          confirmedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Confirmed'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          totalRevenue: {
            $sum: {
              $cond: [
                { $in: ['$orderStatus', ['Confirmed', 'Processing', 'Shipped', 'Delivered']] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      }
    ]) || [{
      totalOrders: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      totalRevenue: 0
    }];

    res.json({
      hasPage: true,
      page,
      stats: stats || {
        totalOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        deliveredOrders: 0,
        totalRevenue: 0
      }
    });
  } catch (error: any) {
    console.error('[getMerchantPageInfo Error]', error);
    res.status(500).json({ message: 'পেজের তথ্য লোড করতে সমস্যা হয়েছে', error: error.message });
  }
};

/**
 * Connect or update Facebook Page settings
 */
export const saveMerchantPageConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const {
      pageId,
      pageName,
      pageAccessToken,
      webhookVerifyToken,
      isActive,
      settings
    } = req.body;

    if (!pageId || !pageName || !pageAccessToken) {
      res.status(400).json({ message: 'Page ID, Page Name এবং Page Access Token আবশ্যক।' });
      return;
    }

    // Check if pageId is already registered by another user
    const existingOther = await FacebookPage.findOne({ pageId: pageId.trim(), userId: { $ne: userId } });
    if (existingOther) {
      res.status(400).json({ message: 'এই ফেসবুক পেজটি ইতিমধ্যে অন্য একটি একাউন্টে যুক্ত রয়েছে।' });
      return;
    }

    let page = await FacebookPage.findOne({ userId });

    if (page) {
      page.pageId = pageId.trim();
      page.pageName = pageName.trim();
      page.pageAccessToken = pageAccessToken.trim();
      if (webhookVerifyToken) page.webhookVerifyToken = webhookVerifyToken.trim();
      if (typeof isActive === 'boolean') page.isActive = isActive;
      if (settings) {
        page.settings = {
          ...page.settings,
          ...settings
        };
      }
      await page.save();
    } else {
      page = await FacebookPage.create({
        userId,
        pageId: pageId.trim(),
        pageName: pageName.trim(),
        pageAccessToken: pageAccessToken.trim(),
        webhookVerifyToken: webhookVerifyToken?.trim() || 'smriti_messenger_webhook_2026',
        isActive: isActive !== false,
        settings: {
          businessName: settings?.businessName || pageName.trim(),
          welcomeMessage: settings?.welcomeMessage || 'আসসালামু আলাইকুম! আমাদের পেজে আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে চান বলুন।',
          deliveryChargeInsideDhaka: Number(settings?.deliveryChargeInsideDhaka ?? 70),
          deliveryChargeOutsideDhaka: Number(settings?.deliveryChargeOutsideDhaka ?? 130),
          codAvailable: settings?.codAvailable !== false,
          bkashNumber: settings?.bkashNumber || '',
          contactPhone: settings?.contactPhone || '',
          notificationPhone: settings?.notificationPhone || '',
          customPromptInstructions: settings?.customPromptInstructions || ''
        },
        products: []
      });
    }

    res.json({
      success: true,
      message: 'ফেসবুক পেজ সেটিংস সফলভাবে সংরক্ষিত হয়েছে!',
      page
    });
  } catch (error: any) {
    console.error('[saveMerchantPageConfig Error]', error);
    res.status(500).json({ message: 'পেজ সেটিংস সংরক্ষণ ব্যর্থ হয়েছে', error: error.message });
  }
};

/**
 * Disconnect Facebook Page
 */
export const disconnectMerchantPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    await FacebookPage.findOneAndDelete({ userId });
    res.json({ success: true, message: 'ফেসবুক পেজ সফলভাবে ডিসকানেক্ট করা হয়েছে।' });
  } catch (error: any) {
    res.status(500).json({ message: 'ডিসকানেক্ট করতে সমস্যা হয়েছে', error: error.message });
  }
};

/**
 * Add a new product to catalog
 */
export const addProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { name, price, description, category, colors, sizes, inStock, imageUrl } = req.body;

    if (!name || price === undefined || price === null) {
      res.status(400).json({ message: 'পণ্যের নাম এবং মূল্য আবশ্যক।' });
      return;
    }

    const page = await FacebookPage.findOne({ userId });
    if (!page) {
      res.status(404).json({ message: 'প্রথমে আপনার ফেসবুক পেজ যুক্ত করুন।' });
      return;
    }

    const newProduct: any = {
      name: name.trim(),
      price: Number(price),
      description: description?.trim() || '',
      category: category?.trim() || 'General',
      colors: Array.isArray(colors) ? colors.filter(Boolean) : (colors ? colors.split(',').map((c: string) => c.trim()).filter(Boolean) : []),
      sizes: Array.isArray(sizes) ? sizes.filter(Boolean) : (sizes ? sizes.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
      inStock: inStock !== false,
      imageUrl: imageUrl?.trim() || ''
    };

    page.products.push(newProduct);
    await page.save();

    res.status(201).json({
      success: true,
      message: 'নতুন পণ্য সফলভাবে ক্যাটালগে যুক্ত হয়েছে!',
      products: page.products
    });
  } catch (error: any) {
    res.status(500).json({ message: 'পণ্য যোগ করতে সমস্যা হয়েছে', error: error.message });
  }
};

/**
 * Update an existing product
 */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { productId } = req.params;
    const updates = req.body;

    const page = await FacebookPage.findOne({ userId });
    if (!page) {
      res.status(404).json({ message: 'পেজ পাওয়া যায়নি।' });
      return;
    }

    const product = (page.products as any).id(productId);
    if (!product) {
      res.status(404).json({ message: 'পণ্যটি পাওয়া যায়নি।' });
      return;
    }

    if (updates.name !== undefined) product.name = updates.name.trim();
    if (updates.price !== undefined) product.price = Number(updates.price);
    if (updates.description !== undefined) product.description = updates.description.trim();
    if (updates.category !== undefined) product.category = updates.category.trim();
    if (updates.inStock !== undefined) product.inStock = Boolean(updates.inStock);
    if (updates.imageUrl !== undefined) product.imageUrl = updates.imageUrl.trim();
    if (updates.colors !== undefined) {
      product.colors = Array.isArray(updates.colors) ? updates.colors : updates.colors.split(',').map((c: string) => c.trim()).filter(Boolean);
    }
    if (updates.sizes !== undefined) {
      product.sizes = Array.isArray(updates.sizes) ? updates.sizes : updates.sizes.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    await page.save();

    res.json({
      success: true,
      message: 'পণ্য আপডেট সম্পন্ন হয়েছে!',
      products: page.products
    });
  } catch (error: any) {
    res.status(500).json({ message: 'পণ্য আপডেট ব্যর্থ হয়েছে', error: error.message });
  }
};

/**
 * Delete a product from catalog
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { productId } = req.params;

    const page = await FacebookPage.findOne({ userId });
    if (!page) {
      res.status(404).json({ message: 'পেজ পাওয়া যায়নি।' });
      return;
    }

    page.products = (page.products as any).filter((p: any) => p._id.toString() !== productId);
    await page.save();

    res.json({
      success: true,
      message: 'পণ্যটি ক্যাটালগ থেকে মুছে ফেলা হয়েছে!',
      products: page.products
    });
  } catch (error: any) {
    res.status(500).json({ message: 'পণ্য ডিলিট করতে সমস্যা হয়েছে', error: error.message });
  }
};

/**
 * Get merchant orders with filter and search
 */
export const getMerchantOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { status, search } = req.query;

    const query: any = { merchantUserId: userId };

    if (status && status !== 'all') {
      query.orderStatus = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { orderNumber: searchRegex },
        { 'items.productName': searchRegex }
      ];
    }

    const orders = await FacebookOrder.find(query).sort({ createdAt: -1 }).limit(100);

    res.json({
      success: true,
      orders
    });
  } catch (error: any) {
    res.status(500).json({ message: 'অর্ডার তালিকা লোড ব্যর্থ হয়েছে', error: error.message });
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { orderId } = req.params;
    const { orderStatus, notes } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      res.status(400).json({ message: 'অবৈধ অর্ডার স্ট্যাটাস।' });
      return;
    }

    const order = await FacebookOrder.findOne({ _id: orderId, merchantUserId: userId });
    if (!order) {
      res.status(404).json({ message: 'অর্ডার পাওয়া যায়নি।' });
      return;
    }

    order.orderStatus = orderStatus;
    if (notes !== undefined) order.notes = notes;
    await order.save();

    res.json({
      success: true,
      message: `অর্ডার স্ট্যাটাস পরিবর্তন হয়েছে: ${orderStatus}`,
      order
    });
  } catch (error: any) {
    res.status(500).json({ message: 'স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে', error: error.message });
  }
};

/**
 * Sandbox AI Simulator for testing bot responses
 */
export const testAiSimulator = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ message: 'মেসেজ আবশ্যক।' });
      return;
    }

    let page = await FacebookPage.findOne({ userId });
    if (!page) {
      // Mock page configuration for instant sandbox testing if user hasn't connected FB yet
      page = new FacebookPage({
        userId,
        pageId: 'sandbox_test_page',
        pageName: 'স্মৃতি ডেমো শপ',
        pageAccessToken: 'mock_token',
        settings: {
          businessName: 'স্মৃতি ডেমো শপ',
          welcomeMessage: 'আসসালামু আলাইকুম! আমাদের শপে স্বাগতম।',
          deliveryChargeInsideDhaka: 70,
          deliveryChargeOutsideDhaka: 130,
          codAvailable: true
        },
        products: [
          {
            name: 'প্রিমিয়াম কটন শার্ট',
            price: 1200,
            category: 'পোশাক',
            colors: ['কালো', 'সাদা', 'নেভি ব্লু'],
            sizes: ['M', 'L', 'XL'],
            inStock: true,
            description: '১০০% পিওর কটন ফেব্রিক, দীর্ঘস্থায়ী এবং আরামদায়ক।'
          },
          {
            name: 'স্মার্ট ব্লুটুথ ওয়াচ T800',
            price: 1850,
            category: 'গ্যাজেট',
            colors: ['ব্ল্যাক', 'সিলভার'],
            inStock: true,
            description: 'হার্টরেট ট্র্যাকিং, ব্লুটুথ কলিং এবং ৭ দিনের ব্যাটারি লাইফ।'
          }
        ]
      });
    }

    const result = await processMessengerCustomerMessage(page, `sim_${userId}`, message.trim());

    res.json({
      success: true,
      replyText: result.replyText,
      orderAction: result.orderAction || null
    });
  } catch (error: any) {
    console.error('[testAiSimulator Error]', error);
    res.status(500).json({ message: 'এআই সিমুলেটর রেসপন্স ব্যর্থ হয়েছে', error: error.message });
  }
};
