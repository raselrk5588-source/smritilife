import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Store, 
  Package, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle, 
  RefreshCw, 
  Plus, 
  Search, 
  Send, 
  Copy, 
  ExternalLink, 
  Sliders, 
  Phone, 
  MapPin, 
  Tag, 
  ChevronRight, 
  Check, 
  Trash2, 
  Edit, 
  DollarSign, 
  MessageCircle, 
  Info, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sparkles,
  Globe,
  CheckCircle,
  Shield
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface IProduct {
  _id?: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  colors?: string[];
  sizes?: string[];
  inStock: boolean;
  imageUrl?: string;
}

interface IFacebookPageSettings {
  businessName: string;
  welcomeMessage?: string;
  deliveryChargeInsideDhaka: number;
  deliveryChargeOutsideDhaka: number;
  codAvailable: boolean;
  bkashNumber?: string;
  contactPhone?: string;
  notificationPhone?: string;
  customPromptInstructions?: string;
}

interface IFacebookPage {
  _id: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  webhookVerifyToken: string;
  isActive: boolean;
  settings: IFacebookPageSettings;
  products: IProduct[];
}

interface IOrderItem {
  productId?: string;
  productName: string;
  quantity: number;
  price: number;
  color?: string;
  size?: string;
}

interface IFacebookOrder {
  _id: string;
  pageId: string;
  customerPsid: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  paymentMethod: string;
  orderStatus: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  orderNumber: string;
  notes?: string;
  createdAt: string;
}

export default function FCommerce() {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'simulator' | 'settings'>('orders');
  
  // Page Data
  const [hasPage, setHasPage] = useState<boolean>(false);
  const [page, setPage] = useState<IFacebookPage | null>(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    deliveredOrders: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Orders
  const [orders, setOrders] = useState<IFacebookOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);

  // Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    category: 'General',
    description: '',
    colors: '',
    sizes: '',
    inStock: true,
    imageUrl: ''
  });
  const [productSubmitting, setProductSubmitting] = useState<boolean>(false);

  // Page Settings Form
  const [settingsForm, setSettingsForm] = useState({
    pageId: '',
    pageName: '',
    pageAccessToken: '',
    businessName: '',
    welcomeMessage: '',
    deliveryChargeInsideDhaka: 70,
    deliveryChargeOutsideDhaka: 130,
    codAvailable: true,
    bkashNumber: '',
    contactPhone: '',
    notificationPhone: '',
    customPromptInstructions: '',
    isActive: true
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Simulator
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; orderAction?: any }>>([
    {
      sender: 'bot',
      text: 'আসসালামু আলাইকুম! আমাদের পেজে আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে বা অর্ডার করতে চান বলুন।'
    }
  ]);
  const [simInput, setSimInput] = useState<string>('');
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const location = useLocation();
  const navigate = useNavigate();

  // 1-Click Facebook OAuth States
  const [oauthLoading, setOauthLoading] = useState<boolean>(false);
  const [pendingPages, setPendingPages] = useState<Array<{ id: string; name: string; category?: string }>>([]);
  const [isSelectPageModalOpen, setIsSelectPageModalOpen] = useState<boolean>(false);
  const [selectingPageId, setSelectingPageId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  // Check URL query parameters for OAuth results
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('connected') === 'true') {
      const pName = params.get('pageName');
      toast.success(pName ? `"${pName}" পেজটি সফলভাবে কানেক্ট হয়েছে!` : 'ফেসবুক পেজ সফলভাবে কানেক্ট হয়েছে!');
      navigate('/app/fcommerce', { replace: true });
      fetchPageInfo();
    } else if (params.get('selectPage') === 'true') {
      fetchPendingPages();
      navigate('/app/fcommerce', { replace: true });
    } else if (params.get('error')) {
      toast.error(decodeURIComponent(params.get('error') || 'ফেসবুক সংযোগ ব্যর্থ হয়েছে'));
      navigate('/app/fcommerce', { replace: true });
    }
  }, [location.search]);

  const handleConnectFacebook = async () => {
    try {
      setOauthLoading(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/oauth/url`);
      const data = await res.json();
      if (res.ok && data.oauthUrl) {
        window.location.href = data.oauthUrl;
      } else {
        toast.error(data.message || 'ফেসবুক অ্যাপ কনফিগারেশন পাওয়া যায়নি');
        setShowManualForm(true);
      }
    } catch (err) {
      toast.error('সার্ভারের সাথে যোগাযোগ করা যায়নি');
    } finally {
      setOauthLoading(false);
    }
  };

  const fetchPendingPages = async () => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/oauth/pending-pages`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.pages) && data.pages.length > 0) {
        setPendingPages(data.pages);
        setIsSelectPageModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectPage = async (pageId: string) => {
    try {
      setSelectingPageId(pageId);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/oauth/select-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'পেজ সফলভাবে কানেক্ট হয়েছে!');
        setIsSelectPageModalOpen(false);
        fetchPageInfo();
      } else {
        toast.error(data.message || 'পেজ সংযোগ ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('পেজ সংযোগ করা যায়নি');
    } finally {
      setSelectingPageId(null);
    }
  };

  const handleDisconnectPage = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে ফেসবুক পেজটি ডিসকানেক্ট করতে চান? এর ফলে এআই মেসেঞ্জারে রিপ্লাই দেওয়া বন্ধ করবে।')) return;
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/page`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'পেজ ডিসকানেক্ট করা হয়েছে');
        fetchPageInfo();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('ডিসকানেক্ট করতে সমস্যা হয়েছে');
    }
  };

  // Fetch Page Info
  const fetchPageInfo = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/page`);
      if (res.ok) {
        const data = await res.json();
        setHasPage(data.hasPage);
        setPage(data.page);
        if (data.stats) setStats(data.stats);

        if (data.page) {
          setSettingsForm({
            pageId: data.page.pageId || '',
            pageName: data.page.pageName || '',
            pageAccessToken: data.page.pageAccessToken || '',
            businessName: data.page.settings?.businessName || '',
            welcomeMessage: data.page.settings?.welcomeMessage || '',
            deliveryChargeInsideDhaka: data.page.settings?.deliveryChargeInsideDhaka ?? 70,
            deliveryChargeOutsideDhaka: data.page.settings?.deliveryChargeOutsideDhaka ?? 130,
            codAvailable: data.page.settings?.codAvailable !== false,
            bkashNumber: data.page.settings?.bkashNumber || '',
            contactPhone: data.page.settings?.contactPhone || '',
            notificationPhone: data.page.settings?.notificationPhone || '',
            customPromptInstructions: data.page.settings?.customPromptInstructions || '',
            isActive: data.page.isActive !== false
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('পেজের তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const params = new URLSearchParams();
      if (orderStatusFilter !== 'all') params.append('status', orderStatusFilter);
      if (orderSearchQuery.trim()) params.append('search', orderSearchQuery.trim());

      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchPageInfo();
    fetchOrders();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [orderStatusFilter]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.pageId.trim() || !settingsForm.pageName.trim() || !settingsForm.pageAccessToken.trim()) {
      toast.error('Page ID, Page Name এবং Page Access Token আবশ্যক!');
      return;
    }

    try {
      setSavingSettings(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: settingsForm.pageId.trim(),
          pageName: settingsForm.pageName.trim(),
          pageAccessToken: settingsForm.pageAccessToken.trim(),
          isActive: settingsForm.isActive,
          settings: {
            businessName: settingsForm.businessName.trim() || settingsForm.pageName.trim(),
            welcomeMessage: settingsForm.welcomeMessage.trim(),
            deliveryChargeInsideDhaka: Number(settingsForm.deliveryChargeInsideDhaka),
            deliveryChargeOutsideDhaka: Number(settingsForm.deliveryChargeOutsideDhaka),
            codAvailable: settingsForm.codAvailable,
            bkashNumber: settingsForm.bkashNumber.trim(),
            contactPhone: settingsForm.contactPhone.trim(),
            notificationPhone: settingsForm.notificationPhone.trim(),
            customPromptInstructions: settingsForm.customPromptInstructions.trim()
          }
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
        fetchPageInfo();
      } else {
        toast.error(data.message || 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('সার্ভারে যোগাযোগ ব্যর্থ হয়েছে');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Add/Edit Product
  const openProductModal = (product?: IProduct) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        price: product.price.toString(),
        category: product.category || 'General',
        description: product.description || '',
        colors: product.colors?.join(', ') || '',
        sizes: product.sizes?.join(', ') || '',
        inStock: product.inStock,
        imageUrl: product.imageUrl || ''
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        price: '',
        category: 'General',
        description: '',
        colors: '',
        sizes: '',
        inStock: true,
        imageUrl: ''
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price) {
      toast.error('পণ্যের নাম এবং মূল্য আবশ্যক!');
      return;
    }

    try {
      setProductSubmitting(true);
      const url = editingProduct?._id
        ? `${import.meta.env.VITE_API_URL}/fcommerce/products/${editingProduct._id}`
        : `${import.meta.env.VITE_API_URL}/fcommerce/products`;
      const method = editingProduct?._id ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name.trim(),
          price: Number(productForm.price),
          category: productForm.category.trim(),
          description: productForm.description.trim(),
          colors: productForm.colors,
          sizes: productForm.sizes,
          inStock: productForm.inStock,
          imageUrl: productForm.imageUrl.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsProductModalOpen(false);
        fetchPageInfo();
      } else {
        toast.error(data.message || 'ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('পণ্য সংরক্ষণ করা যায়নি');
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে পণ্যটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/products/${productId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchPageInfo();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('পণ্য ডিলিট ব্যর্থ হয়েছে');
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`অর্ডার স্ট্যাটাস: ${newStatus}`);
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: newStatus as any } : o));
        fetchPageInfo(); // update stats
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
    }
  };

  // Send Simulator Message
  const handleSendSimulatorMessage = async (textToSend?: string) => {
    const text = (textToSend || simInput).trim();
    if (!text || simLoading) return;

    setSimMessages(prev => [...prev, { sender: 'user', text }]);
    setSimInput('');
    setSimLoading(true);

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/fcommerce/test-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (res.ok) {
        setSimMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: data.replyText,
            orderAction: data.orderAction
          }
        ]);
      } else {
        setSimMessages(prev => [
          ...prev,
          { sender: 'bot', text: 'দুঃখিত, কোনো একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।' }
        ]);
      }
    } catch (err) {
      setSimMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।' }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} কপি হয়েছে!`);
  };

  const webhookUrl = `${window.location.origin}/api/messenger/webhook`;
  const verifyToken = page?.webhookVerifyToken || 'smriti_messenger_webhook_2026';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">অপেক্ষমাণ (Pending)</span>;
      case 'Confirmed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">কনফার্মড</span>;
      case 'Processing':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">প্রসেসিং</span>;
      case 'Shipped':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">কুরিয়ারে পাঠানো</span>;
      case 'Delivered':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">ডেলিভার্ড</span>;
      case 'Cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">বাতিল</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 md:pb-12 text-slate-800 font-sans">
      {/* Top Banner / SaaS Header */}
      <div className="bg-gradient-to-r from-[#063828] via-[#0A543A] to-[#04281c] text-white pt-6 pb-12 px-4 sm:px-6 shadow-md border-b border-emerald-500/20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-300 p-0.5 shadow-lg shadow-emerald-950/40 shrink-0">
              <div className="w-full h-full bg-[#063828] rounded-[14px] flex items-center justify-center">
                <Store className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  মেসেঞ্জার এআই শপ (F-Commerce SaaS)
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  PRO
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                ফেসবুক পেজ কানেক্ট করে ২৪/৭ গ্রাহকের সাথে এআই চ্যাট ও অটোমেটিক অর্ডার কালেকশন
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => { fetchPageInfo(); fetchOrders(); toast.success('রিফ্রেশ করা হয়েছে!'); }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center space-x-1.5 transition border border-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
              <span>{hasPage ? 'পেজ সেটিংস' : 'পেজ কানেক্ট করুন'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-7">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">মোট অর্ডার</p>
              <h3 className="text-lg font-black text-slate-900">{stats.totalOrders} টি</h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">পেন্ডিং অর্ডার</p>
              <h3 className="text-lg font-black text-slate-900">{stats.pendingOrders} টি</h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">কনফার্মড</p>
              <h3 className="text-lg font-black text-slate-900">{stats.confirmedOrders} টি</h3>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">ডেলিভার্ড</p>
              <h3 className="text-lg font-black text-slate-900">{stats.deliveredOrders} টি</h3>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-gradient-to-tr from-emerald-600 to-teal-600 p-3.5 rounded-2xl shadow-sm text-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-emerald-100">মোট বিক্রয়</p>
              <h3 className="text-lg font-black text-white">৳{stats.totalRevenue.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content & Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>অর্ডারসমূহ ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>পণ্য ক্যাটালগ ({page?.products?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>এআই টেস্ট চ্যাট (Sandbox)</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>পেজ ও মেটা সংযোগ</span>
          </button>
        </div>

        {/* Tab 1: Orders */}
        {activeTab === 'orders' && (
          <div className="mt-5 space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="গ্রাহকের নাম, ফোন বা অর্ডার নং..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
                {['all', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition whitespace-nowrap ${
                      orderStatusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'all' ? 'সব অর্ডার' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            {ordersLoading ? (
              <div className="bg-white p-12 rounded-2xl text-center shadow-sm">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">অর্ডার লোড হচ্ছে...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl text-center shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-3">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">কোনো অর্ডার পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  ফেসবুক মেসেঞ্জারে কাস্টমার চ্যাট করে কনফার্ম করলে তাৎক্ষণিক এখানে অর্ডার চলে আসবে এবং হোয়াটসঅ্যাপে নোটিফিকেশন পাবেন।
                </p>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  এআই টেস্ট চ্যাটে একটি টেস্ট অর্ডার করুন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top bar: Order ID, Time, Badge */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-xs font-black text-slate-900 tracking-tight">
                            #{order.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(order.createdAt).toLocaleString('bn-BD', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                        {getStatusBadge(order.orderStatus)}
                      </div>

                      {/* Items */}
                      <div className="py-2.5 space-y-1.5 border-b border-slate-100">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800">{item.productName}</span>
                              <span className="text-slate-500">x{item.quantity}</span>
                              {(item.color || item.size) && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                  {[item.color, item.size].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900">৳{item.price * item.quantity}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                          <span>ডেলিভারি চার্জ:</span>
                          <span>৳{order.deliveryCharge}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black text-emerald-800 pt-1 border-t border-dashed border-slate-200">
                          <span>সর্বমোট বিল:</span>
                          <span className="text-sm">৳{order.totalAmount} (COD)</span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="py-2.5 space-y-1 text-xs">
                        <div className="flex items-center space-x-2 text-slate-700 font-semibold">
                          <span className="text-slate-400">👤</span>
                          <span>{order.customerName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="flex items-center space-x-1.5 text-emerald-700 font-bold hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{order.customerPhone}</span>
                          </a>
                          <a
                            href={`https://wa.me/88${order.customerPhone.replace(/^(\+88|0)/, '01')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-[#0f7b57] bg-[#25D366]/10 hover:bg-[#25D366]/20 px-2 py-0.5 rounded-full border border-[#25D366]/30 transition"
                          >
                            WhatsApp মেসেজ
                          </a>
                        </div>
                        <div className="flex items-start space-x-1.5 text-slate-600 text-[11px] pt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{order.deliveryAddress}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status Changer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">স্ট্যাটাস পরিবর্তন:</span>
                      <select
                        value={order.orderStatus}
                        onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                        className="text-xs font-bold py-1 px-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="Pending">Pending (অপেক্ষমাণ)</option>
                        <option value="Confirmed">Confirmed (কনফার্মড)</option>
                        <option value="Processing">Processing (প্রসেসিং)</option>
                        <option value="Shipped">Shipped (কুরিয়ারে)</option>
                        <option value="Delivered">Delivered (ডেলিভার্ড)</option>
                        <option value="Cancelled">Cancelled (বাতিল)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Products Catalog */}
        {activeTab === 'products' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">পণ্য ক্যাটালগ তালিকা</h3>
                <p className="text-xs text-slate-500">এখানে যুক্ত করা পণ্য ও দাম অনুযায়ী এআই গ্রাহককে তথ্য দেবে ও অর্ডার নেবে</p>
              </div>
              <button
                onClick={() => openProductModal()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>নতুন পণ্য যুক্ত করুন</span>
              </button>
            </div>

            {(!page?.products || page.products.length === 0) ? (
              <div className="bg-white p-12 rounded-2xl text-center shadow-sm border border-slate-100">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">কোনো পণ্য তালিকাভুক্ত নেই</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  আপনার দোকানের পণ্যগুলো যুক্ত করুন যাতে এআই মেসেঞ্জারে সঠিক মূল্য ও বিবরণসহ গ্রাহককে রিপ্লাই দিতে পারে।
                </p>
                <button
                  onClick={() => openProductModal()}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
                >
                  + প্রথম পণ্য যুক্ত করুন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {page.products.map((p) => (
                  <div
                    key={p._id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                            {p.category || 'General'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1.5">{p.name}</h4>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {p.inStock ? 'স্টকে আছে' : 'স্টক শেষ'}
                        </span>
                      </div>

                      <div className="mt-2 text-base font-black text-slate-900">
                        ৳{p.price.toLocaleString('bn-BD')}
                      </div>

                      {p.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {p.description}
                        </p>
                      )}

                      {(p.colors && p.colors.length > 0) && (
                        <div className="mt-2 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-500">কালার: </span>
                          <span>{p.colors.join(', ')}</span>
                        </div>
                      )}

                      {(p.sizes && p.sizes.length > 0) && (
                        <div className="mt-1 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-500">সাইজ: </span>
                          <span>{p.sizes.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openProductModal(p)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg flex items-center space-x-1 transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>এডিট</span>
                      </button>
                      <button
                        onClick={() => p._id && handleDeleteProduct(p._id)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center space-x-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: AI Sandbox Simulator */}
        {activeTab === 'simulator' && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Simulator Chat Window */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[520px]">
              {/* Simulator Header */}
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 rounded-t-2xl">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {page?.settings?.businessName || 'স্মৃতি এআই শপ'} - মেসেঞ্জার বট
                    </h4>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>লাইভ সিমুলেটর চালু আছে</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSimMessages([{ sender: 'bot', text: page?.settings?.welcomeMessage || 'আসসালামু আলাইকুম! আমাদের পেজে আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে চান বলুন।' }])}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>চ্যাট রিসেট</span>
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {simMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Order Action Card if AI detected order confirmation */}
                    {msg.orderAction && (
                      <div className="mt-2 max-w-[85%] bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs">
                        <div className="flex items-center space-x-1 text-emerald-800 font-bold mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>এআই দ্বারা সংগৃহীত অর্ডার ডিটেইলস:</span>
                        </div>
                        <div className="space-y-0.5 text-slate-700 text-[11px]">
                          <p><strong>পণ্য:</strong> {msg.orderAction.productName} (x{msg.orderAction.quantity})</p>
                          <p><strong>মোট মূল্য:</strong> ৳{msg.orderAction.totalAmount} (ডেলিভারি: ৳{msg.orderAction.deliveryCharge})</p>
                          <p><strong>গ্রাহক:</strong> {msg.orderAction.customerName}</p>
                          <p><strong>মোবাইল:</strong> {msg.orderAction.customerPhone}</p>
                          <p><strong>ঠিকানা:</strong> {msg.orderAction.deliveryAddress}</p>
                          <p className="text-emerald-700 font-bold pt-1">
                            {msg.orderAction.isConfirmed ? '✅ অর্ডার স্ট্যাটাস: গ্রাহক কনফার্ম করেছেন!' : '⏳ অর্ডার কনফার্মেশনের অপেক্ষায়'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {simLoading && (
                  <div className="flex items-center space-x-1.5 text-slate-400 text-xs py-2">
                    <Bot className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span>এআই রিপ্লাই লিখছে...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendSimulatorMessage(); }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="text"
                    placeholder="মেসেঞ্জারে একজন গ্রাহক হিসেবে কিছু লিখুন..."
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    disabled={simLoading}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={simLoading || !simInput.trim()}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Test Scenarios Guide */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3.5">
              <div className="flex items-center space-x-2 text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">টেস্ট প্রম্পট সাজেশনস</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                নিচের যে কোনো বাটনে ক্লিক করে দেখতে পারেন এআই কীভাবে পণ্যের তথ্য দেয় এবং ধাপে ধাপে নাম, ফোন ও ঠিকানা সংগ্রহ করে অর্ডার তৈরি করে:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('আপনাদের কাছে কি কি প্রডাক্ট আছে?')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200 transition"
                >
                  🛍️ "আপনাদের কাছে কি কি প্রডাক্ট আছে?"
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('ডেলিভারি চার্জ কত এবং ক্যাশ অন ডেলিভারি পাওয়া যাবে কি?')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200 transition"
                >
                  🚚 "ডেলিভারি চার্জ কত এবং COD পাওয়া যাবে?"
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('আমি প্রথম পণ্যটি ১ পিস অর্ডার করতে চাই')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200 transition"
                >
                  📦 "আমি পণ্যটি ১ পিস অর্ডার করতে চাই"
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('নাম: রিয়াদ হাসান, ফোন: 01711223344, ঠিকানা: বাসা ১২, রোড ৫, ধানমন্ডি, ঢাকা')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200 transition"
                >
                  👤 "নাম: রিয়াদ, ফোন: 01711223344, ঢাকা"
                </button>

                <button
                  type="button"
                  onClick={() => handleSendSimulatorMessage('হ্যাঁ সবকিছু ঠিক আছে, অর্ডার কনফার্ম করে দিন')}
                  className="w-full text-left p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition"
                >
                  ✅ "হ্যাঁ, অর্ডার কনফার্ম করে দিন"
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Settings & Meta Connection */}
        {activeTab === 'settings' && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Meta Webhook Guide Box */}
            <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <Store className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">মেটা ফেসবুক পেজ সংযোগ গাইড</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                আপনার ফেসবুক পেজে এই এআই বট সক্রিয় করতে মেটা ডেভেলপার পোর্টালে নিচের তথ্যগুলো দিন:
              </p>

              {/* Callback URL */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-emerald-300">Webhook Callback URL:</span>
                <div className="flex items-center bg-black/40 rounded-xl p-2 border border-white/10 text-xs">
                  <span className="truncate flex-1 font-mono text-[11px] text-slate-200">{webhookUrl}</span>
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Verify Token */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-emerald-300">Verify Token:</span>
                <div className="flex items-center bg-black/40 rounded-xl p-2 border border-white/10 text-xs">
                  <span className="truncate flex-1 font-mono text-[11px] text-slate-200">{verifyToken}</span>
                  <button
                    onClick={() => copyToClipboard(verifyToken, 'Verify Token')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 4 Steps */}
              <div className="pt-2 border-t border-white/10 space-y-2 text-[11px] text-slate-300">
                <p><strong>১.</strong> developers.facebook.com এ লগইন করে আপনার অ্যাপে 'Messenger' সেটআপ করুন।</p>
                <p><strong>২.</strong> Webhooks সেকশনে ওপরের Callback URL ও Verify Token দিয়ে ভেরিফাই করুন।</p>
                <p><strong>৩.</strong> 'messages' ফিল্ডটি সাবস্ক্রাইব করুন।</p>
                <p><strong>৪.</strong> পেজ অ্যাক্সেস টোকেন জেনারেট করে ডানপাশের ফর্মে পেস্ট করে সেভ করুন।</p>
              </div>
            </div>

            {/* Shop & AI Configuration Form */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              
              {/* 1-Click Facebook Connect Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/50 border border-blue-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          {hasPage ? 'ফেসবুক পেজ সংযুক্ত আছে' : '১-ক্লিকে ফেসবুক পেজ কানেক্ট করুন'}
                        </h4>
                        {hasPage && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>সক্রিয়</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {hasPage
                          ? `সংযুক্ত পেজ: "${page?.pageName}" (ID: ${page?.pageId})`
                          : 'ফেসবুক অ্যাকাউন্টে লগইন করে এক ক্লিকে আপনার পছন্দের পেজটি নির্বাচন করুন। কোনো ম্যানুয়াল টোকেন লাগবে না।'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {hasPage ? (
                      <>
                        <button
                          type="button"
                          onClick={handleConnectFacebook}
                          disabled={oauthLoading}
                          className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${oauthLoading ? 'animate-spin' : ''}`} />
                          <span>পেজ পরিবর্তন</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectPage}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer"
                        >
                          ডিসকানেক্ট
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectFacebook}
                        disabled={oauthLoading}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span>{oauthLoading ? 'রিডাইরেক্ট হচ্ছে...' : 'Connect with Facebook'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-blue-200/40 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">মেটা অফিশিয়াল OAuth ও গ্রাফ এপিআই দ্বারা সুরক্ষিত</span>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    {showManualForm ? 'ম্যানুয়াল ফর্ম লুকান ▲' : 'ম্যানুয়াল টোকেন সেটিংস (Advanced) ▼'}
                  </button>
                </div>
              </div>

              {/* Manual Page ID & Token (Only visible if toggled) */}
              {showManualForm && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">ম্যানুয়াল পেজ আইডি ও টোকেন কনফিগারেশন</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">এডভান্সড</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Facebook Page ID</label>
                      <input
                        type="text"
                        placeholder="যেমন: 104928472910"
                        value={settingsForm.pageId}
                        onChange={(e) => setSettingsForm({ ...settingsForm, pageId: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Facebook Page Name</label>
                      <input
                        type="text"
                        placeholder="যেমন: ফ্যাশন হাউজ বিডি"
                        value={settingsForm.pageName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, pageName: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Page Access Token</label>
                    <textarea
                      rows={2}
                      placeholder="মেটা ডেভেলপার ড্যাশবোর্ড থেকে পাওয়া দীর্ঘ Page Access Token"
                      value={settingsForm.pageAccessToken}
                      onChange={(e) => setSettingsForm({ ...settingsForm, pageAccessToken: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Shop & AI Configuration Form */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">দোকান ও এআই সেলস সহকারী সেটিংস</h3>
                <p className="text-xs text-slate-500 mb-3">আপনার ব্যবসার বিবরণ ও ডেলিভারি পলিসি নির্ধারণ করুন</p>

                <form onSubmit={handleSaveSettings} className="space-y-4">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ব্যবসার নাম (Brand Name)</label>
                    <input
                      type="text"
                      placeholder="যেমন: স্মৃতি ফ্যাশন মার্ট"
                      value={settingsForm.businessName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      অর্ডার নোটিফিকেশন WhatsApp নম্বর
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: 017XXXXXXXX"
                      value={settingsForm.notificationPhone}
                      onChange={(e) => setSettingsForm({ ...settingsForm, notificationPhone: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400">নতুন অর্ডার কনফার্ম হলে এই হোয়াটসঅ্যাপে মেসেজ যাবে</span>
                  </div>
                </div>

                {/* Delivery Charges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ঢাকার ভেতর ডেলিভারি চার্জ (৳)</label>
                    <input
                      type="number"
                      value={settingsForm.deliveryChargeInsideDhaka}
                      onChange={(e) => setSettingsForm({ ...settingsForm, deliveryChargeInsideDhaka: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ঢাকার বাইরে ডেলিভারি চার্জ (৳)</label>
                    <input
                      type="number"
                      value={settingsForm.deliveryChargeOutsideDhaka}
                      onChange={(e) => setSettingsForm({ ...settingsForm, deliveryChargeOutsideDhaka: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Welcome Message */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">গ্রাহকের জন্য স্বাগত বার্তা</label>
                  <input
                    type="text"
                    value={settingsForm.welcomeMessage}
                    onChange={(e) => setSettingsForm({ ...settingsForm, welcomeMessage: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Custom AI Instructions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    এআই-এর জন্য বিশেষ নির্দেশাবলী (Custom Sales Rules)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="যেমন: আমাদের পণ্য ১০০% আসল, ডেলিভারি ৩-৪ দিন সময় লাগে, কোনো বার্গেইনিং চলবে না।"
                    value={settingsForm.customPromptInstructions}
                    onChange={(e) => setSettingsForm({ ...settingsForm, customPromptInstructions: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActivePage"
                    checked={settingsForm.isActive}
                    onChange={(e) => setSettingsForm({ ...settingsForm, isActive: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isActivePage" className="text-xs font-bold text-slate-800">
                    মেসেঞ্জার এআই সেলস বট চালু রাখুন (Active)
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition"
                  >
                    {savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Add/Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যুক্ত করুন'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পণ্যের নাম *</label>
                <input
                  type="text"
                  placeholder="যেমন: প্রিমিয়াম পোলো টি-শার্ট"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মূল্য (টাকা) *</label>
                  <input
                    type="number"
                    placeholder="যেমন: 650"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
                  <input
                    type="text"
                    placeholder="পোশাক / গ্যাজেট"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">কালার ভ্যারিয়েন্ট (কমা দিয়ে লিখুন)</label>
                <input
                  type="text"
                  placeholder="যেমন: কালো, সাদা, নেভি ব্লু"
                  value={productForm.colors}
                  onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">সাইজ ভ্যারিয়েন্ট (কমা দিয়ে লিখুন)</label>
                <input
                  type="text"
                  placeholder="যেমন: M, L, XL, XXL"
                  value={productForm.sizes}
                  onChange={(e) => setProductForm({ ...productForm, sizes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বিবরণ / স্পেসিফিকেশন</label>
                <textarea
                  rows={2}
                  placeholder="ফেব্রিক কোয়ালিটি, গ্যারান্টি বা অন্যান্য তথ্য..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="stockStatus"
                  checked={productForm.inStock}
                  onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="stockStatus" className="text-xs font-bold text-slate-800">
                  পণ্যটি বর্তমানে স্টকে আছে (In Stock)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={productSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  {productSubmitting ? 'সেভ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multiple Facebook Pages Selection Modal */}
      {isSelectPageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">ফেসবুক পেজ নির্বাচন করুন</h3>
                <p className="text-[11px] text-slate-500">আপনার অ্যাকাউন্টে একাধিক পেজ পাওয়া গেছে</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">
              যে পেজটিতে স্মৃতি এআই সেলস সহকারী চালু করতে চান, নিচে সেটি বেছে নিন:
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {pendingPages.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 flex items-center justify-between transition"
                >
                  <div className="pr-2">
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</h4>
                    <span className="text-[10px] text-slate-400">
                      ID: {p.id} {p.category ? `• ${p.category}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPage(p.id)}
                    disabled={selectingPageId === p.id}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer"
                  >
                    {selectingPageId === p.id ? 'কানেক্ট হচ্ছে...' : 'কানেক্ট করুন'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectPageModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
