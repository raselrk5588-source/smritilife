import { useState, useEffect } from 'react';
import { Users, FileText, Bell, Gift, Activity, ShieldCheck, CheckCircle, XCircle, Clock, AlertTriangle, Search, LayoutDashboard, LogOut, Filter, TrendingUp, DollarSign, Calendar, MessageSquare, Plus, Trash2, Edit3, Settings, Star, AlertCircle, Brain, Wrench, Power, ExternalLink, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

interface SystemLog {
  _id: string;
  type: string;
  status: string;
  message: string;
  createdAt: string;
}

interface AnalyticsData {
  totalUsers: number;
  activeSubscribers: number;
  inactiveSubscribers: number;
  totalNotes: number;
  totalActivities: number;
  totalReminders: number;
  totalWishes: number;
  recentLogs: SystemLog[];
}

interface UserData {
  _id: string;
  name: string;
  mobile: string;
  email: string;
  isSubscribed: boolean;
  createdAt: string;
}

interface WishTemplate {
  _id: string;
  name: string;
  category: string;
  content: string;
  type: string;
}

interface SystemSettings {
  openaiApiKey: string;
  geminiApiKey: string;
  whatsappApiToken: string;
  twilioAccountSid: string;
  twilioPhoneNumber: string;
  smsGatewayKey: string;
  freeUserReminderLimit: number;
  proUserReminderLimit: number;
  bdappsApiKey?: string;
  bdappsApiSecret?: string;
  bdappsRedirectUrl?: string;
  subscriptionFee?: number;
  isMaintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  maintenanceEstimatedTime?: string;
}

interface AdminReminder {
  _id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  userId: { _id: string; name: string; mobile: string; email: string };
  category: string;
  status: string;
}

interface AdminWish {
  _id: string;
  recipient: string;
  senderName: string;
  method: string;
  contact: string;
  scheduleDate: string;
  scheduleTime: string;
  status: string;
  userId: { _id: string; name: string; mobile: string; email: string };
  createdAt: string;
}

interface ErrorLogData {
  _id: string;
  source: string;
  message: string;
  stack: string;
  path: string;
  createdAt: string;
  userId?: { name: string; mobile: string };
}

interface AITrainingRuleData {
  _id: string;
  rule: string;
  exampleInput?: string;
  exampleOutput?: string;
  category?: string;
  addedBy?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [templates, setTemplates] = useState<WishTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [reminders, setReminders] = useState<AdminReminder[]>([]);
  const [wishes, setWishes] = useState<AdminWish[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    openaiApiKey: '', geminiApiKey: '', whatsappApiToken: '', twilioAccountSid: '', twilioPhoneNumber: '', smsGatewayKey: '', freeUserReminderLimit: 5, proUserReminderLimit: 100,
    bdappsApiKey: '', bdappsApiSecret: '', bdappsRedirectUrl: '', subscriptionFee: 190,
    isMaintenanceMode: false,
    maintenanceTitle: 'SmritiLive • সিস্টেম আপডেট চলছে',
    maintenanceMessage: 'SmritiLive-কে আরও দ্রুত ও উন্নত করতে বর্তমানে সিস্টেম আপগ্রেডের কাজ চলছে। খুব শীঘ্রই আমরা আবার পুরোদমে ফিরে আসছি। আপনার সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত।',
    maintenanceEstimatedTime: '১৫-২০ মিনিট'
  });
  const [errorLogs, setErrorLogs] = useState<ErrorLogData[]>([]);
  const [trainingRules, setTrainingRules] = useState<AITrainingRuleData[]>([]);
  const [newRuleInput, setNewRuleInput] = useState('');
  const [newRuleExample, setNewRuleExample] = useState('');
  
  // Tabs: 'dashboard', 'users', 'logs', 'revenue', 'templates', 'reminders', 'wishes', 'settings', 'errors', 'training'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'logs' | 'revenue' | 'templates' | 'reminders' | 'wishes' | 'settings' | 'errors' | 'training'>('dashboard');

  // Search & Filter states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilterStatus, setUserFilterStatus] = useState<'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED'>('ALL');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  const [reminderSearchTerm, setReminderSearchTerm] = useState('');
  const [reminderDateFilter, setReminderDateFilter] = useState('');

  const [wishSearchTerm, setWishSearchTerm] = useState('');
  const [wishDateFilter, setWishDateFilter] = useState('');

  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WishTemplate | null>(null);
  const [tempFormData, setTempFormData] = useState({ name: '', category: '', content: '', type: 'Text' });

  // Demo User Modal State
  const [showDemoUserModal, setShowDemoUserModal] = useState(false);
  const [demoForm, setDemoForm] = useState({ mobile: '', name: 'Demo Tester' });
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);

  const handleCreateDemoUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.mobile.trim()) {
      toast.error('মোবাইল নম্বর লিখুন');
      return;
    }
    try {
      setIsSubmittingDemo(true);
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/create-demo`, {
        method: 'POST',
        headers,
        body: JSON.stringify(demoForm)
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        toast.success(resData.message || 'ডেমো ইউজার সক্রিয় হয়েছে!');
        setShowDemoUserModal(false);
        setDemoForm({ mobile: '', name: 'Demo Tester' });
        // Refresh users list
        const usersRes = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, { headers });
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(uData.users);
        }
      } else {
        toast.error(resData.message || 'ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      toast.error(err.message || 'সার্ভার এরর');
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin is logged in
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin/login');
      return;
    }

    const fetchData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' };
        const [analyticsRes, usersRes, templatesRes, settingsRes, remindersRes, wishesRes, errorsRes, trainingRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/admin/analytics`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/users`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/templates`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/settings`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/reminders`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/wishes`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/errors`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/admin/training-rules`, { headers })
        ]);
        
        const analyticsJson = await analyticsRes.json();
        const usersJson = await usersRes.json();
        const templatesJson = await templatesRes.json();
        const settingsJson = await settingsRes.json();
        const remindersJson = await remindersRes.json();
        const wishesJson = await wishesRes.json();
        const errorsJson = await errorsRes.json();
        const trainingJson = await trainingRes.json();
        
        if (analyticsJson.success) setData(analyticsJson.data);
        if (usersJson.success) setUsers(usersJson.users);
        if (templatesJson.success) setTemplates(templatesJson.templates);
        if (settingsJson.success) setSettings(settingsJson.settings);
        if (remindersJson.success) setReminders(remindersJson.reminders);
        if (wishesJson.success) setWishes(wishesJson.wishes);
        if (errorsJson.success) setErrorLogs(errorsJson.errors);
        if (trainingJson.success) setTrainingRules(trainingJson.rules);
      } catch (error) {
        console.error('Failed to fetch admin data', error);
        toast.error(`Error loading analytics: ${error}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddTrainingRule = async () => {
    if (!newRuleInput.trim()) {
      toast.error('নিয়মটি লিখুন');
      return;
    }
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/training-rules`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rule: newRuleInput.trim(),
          exampleInput: newRuleExample.trim()
        })
      });
      const json = await res.json();
      if (json.success) {
        setTrainingRules([json.rule, ...trainingRules]);
        setNewRuleInput('');
        setNewRuleExample('');
        toast.success('🧠 AI সফলভাবে নতুন নিয়ম শিখে নিয়েছে!');
      } else {
        toast.error(json.message || 'ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      toast.error('Error adding rule');
    }
  };

  const handleDeleteTrainingRule = async (id: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/training-rules/${id}`, {
        method: 'DELETE',
        headers
      });
      const json = await res.json();
      if (json.success) {
        setTrainingRules(trainingRules.filter(r => r._id !== id));
        toast.success('নিয়ম মুছে ফেলা হয়েছে');
      }
    } catch (err) {
      toast.error('Error deleting rule');
    }
  };

  const handleToggleTrainingRule = async (ruleItem: AITrainingRuleData) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/training-rules/${ruleItem._id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isActive: !ruleItem.isActive })
      });
      const json = await res.json();
      if (json.success) {
        setTrainingRules(trainingRules.map(r => r._id === ruleItem._id ? json.rule : r));
        toast.success(json.rule.isActive ? 'নিয়ম চালু করা হয়েছে' : 'নিয়ম বন্ধ করা হয়েছে');
      }
    } catch (err) {
      toast.error('Error updating rule');
    }
  };

  const handleToggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${userId}/subscribe`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      
      if (result.success) {
        setUsers(users.map(u => u._id === userId ? { ...u, isSubscribed: result.isSubscribed } : u));
        setData(prev => prev ? {
          ...prev,
          activeSubscribers: prev.activeSubscribers + (result.isSubscribed ? 1 : -1),
          inactiveSubscribers: prev.inactiveSubscribers + (result.isSubscribed ? -1 : 1)
        } : prev);
        toast.success(`ইউজারের সাবস্ক্রিপশন ${result.isSubscribed ? 'চালু' : 'বন্ধ'} করা হয়েছে`);
      }
    } catch (e) {
      toast.error('Failed to update subscription');
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const url = editingTemplate 
        ? `${import.meta.env.VITE_API_URL}/admin/templates/${editingTemplate._id}` 
        : `${import.meta.env.VITE_API_URL}/admin/templates`;
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(tempFormData)
      });
      
      const result = await res.json();
      if (result.success) {
        if (editingTemplate) {
          setTemplates(templates.map(t => t._id === editingTemplate._id ? result.template : t));
          toast.success('টেমপ্লেট আপডেট করা হয়েছে');
        } else {
          setTemplates([result.template, ...templates]);
          toast.success('নতুন টেমপ্লেট যোগ করা হয়েছে');
        }
        setShowTemplateModal(false);
      }
    } catch (e) {
      toast.error('Failed to save template');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(settings)
      });
      const result = await res.json();
      if (result.success) {
        toast.success('সিস্টেম সেটিংস সফলভাবে আপডেট হয়েছে');
      }
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleToggleMaintenance = async (turnOn: boolean) => {
    try {
      const updated = {
        ...settings,
        isMaintenanceMode: turnOn
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(updated)
      });
      const result = await res.json();
      if (result.success) {
        setSettings(updated);
        if (turnOn) {
          toast.success('⚠️ মেইনটেন্যান্স মোড চালু করা হয়েছে। সাধারণ ইউজাররা এখন Under Maintenance স্ক্রিন দেখতে পাবে।', { duration: 5000 });
        } else {
          toast.success('✅ মেইনটেন্যান্স মোড বন্ধ করা হয়েছে। সিস্টেম এখন সাধারণ ব্যবহারকারীদের জন্য পুরোদমে লাইভ!', { duration: 5000 });
        }
      }
    } catch (e) {
      toast.error('মেইনটেন্যান্স স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই রিমাইন্ডারটি মুছতে চান?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/reminders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const result = await res.json();
      if (result.success) {
        setReminders(reminders.filter(r => r._id !== id));
        toast.success('রিমাইন্ডার মুছে ফেলা হয়েছে');
      }
    } catch (e) {
      toast.error('Failed to delete reminder');
    }
  };

  const handleDeleteWish = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই উইশটি মুছতে চান?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/wishes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const result = await res.json();
      if (result.success) {
        setWishes(wishes.filter(w => w._id !== id));
        toast.success('উইশ মুছে ফেলা হয়েছে');
      }
    } catch (e) {
      toast.error('Failed to delete wish');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    toast.success('অ্যাডমিন প্যানেল থেকে লগআউট করা হয়েছে');
    navigate('/admin/login');
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই টেমপ্লেটটি মুছতে চান?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (result.success) {
        setTemplates(templates.filter(t => t._id !== id));
        toast.success('টেমপ্লেট মুছে ফেলা হয়েছে');
      }
    } catch (e) {
      toast.error('Failed to delete template');
    }
  };


  // Filtered Data
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.mobile?.includes(userSearchTerm);
    const matchesFilter = 
      userFilterStatus === 'ALL' ? true : 
      userFilterStatus === 'SUBSCRIBED' ? u.isSubscribed === true : 
      u.isSubscribed === false;
    return matchesSearch && matchesFilter;
  });

  const filteredLogs = data?.recentLogs?.filter(log => 
    log.message?.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
    log.type?.toLowerCase().includes(logSearchTerm.toLowerCase())
  ) || [];

  const filteredReminders = reminders.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(reminderSearchTerm.toLowerCase()) || 
                          r.userId?.name?.toLowerCase().includes(reminderSearchTerm.toLowerCase()) || 
                          r.userId?.mobile?.includes(reminderSearchTerm);
    const rDate = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
    const matchesDate = reminderDateFilter ? rDate === reminderDateFilter : true;
    return matchesSearch && matchesDate;
  });

  const filteredWishes = wishes.filter(w => {
    const matchesSearch = w.recipient?.toLowerCase().includes(wishSearchTerm.toLowerCase()) || 
                          w.userId?.name?.toLowerCase().includes(wishSearchTerm.toLowerCase()) || 
                          w.userId?.mobile?.includes(wishSearchTerm);
    const wDate = w.scheduleDate ? new Date(w.scheduleDate).toISOString().split('T')[0] : '';
    const matchesDate = wishDateFilter ? wDate === wishDateFilter : true;
    return matchesSearch && matchesDate;
  });

  // Calculate Revenue and Growth Metrics
  const now = new Date();
  
  const dailyUsers = users.filter(u => {
    const d = new Date(u.createdAt);
    return d.toDateString() === now.toDateString();
  }).length;
  
  const monthlyUsers = users.filter(u => {
    const d = new Date(u.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  
  const yearlyUsers = users.filter(u => {
    const d = new Date(u.createdAt);
    return d.getFullYear() === now.getFullYear();
  }).length;

  const subscriptionFee = 500; // Assuming 500 BDT per year
  const totalRevenue = (data?.activeSubscribers || 0) * subscriptionFee;
  const expectedMonthlyRevenue = Math.round(totalRevenue / 12);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A7756]"></div>
    </div>
  );
  
  if (!data) return <div className="text-red-500 text-center p-10">Failed to load analytics data.</div>;

  return (
    <div className="bg-[#f6f8f9] min-h-screen font-sans flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-2xl relative z-40 md:min-h-screen">
        <div className="absolute inset-0 z-0 bg-cover opacity-10" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center" }}></div>
        <div className="relative z-10 p-6 pt-10 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-[#0A7756]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">অ্যাডমিন</h1>
              <p className="text-xs text-white/70 font-medium">কন্ট্রোল প্যানেল</p>
            </div>
          </div>
        </div>
        
        <nav className="relative z-10 flex-1 px-4 py-6 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>ড্যাশবোর্ড</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${activeTab === 'users' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5" />
              <span>ইউজার লিস্ট</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'users' ? 'bg-white/20' : 'bg-white/10'}`}>{data.totalUsers}</span>
          </button>

          <button 
            onClick={() => setActiveTab('revenue')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'revenue' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>গ্রোথ ও রেভিনিউ</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('templates')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'templates' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>উইশ টেমপ্লেট</span>
          </button>

          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5" />
              <span>সিস্টেম লগস</span>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('reminders')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'reminders' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <Bell className="w-5 h-5" />
            <span>রিমাইন্ডার ম্যানেজমেন্ট</span>
          </button>

          <button 
            onClick={() => setActiveTab('wishes')}
            className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === 'wishes' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <Star className="w-5 h-5" />
            <span>উইশ ম্যানেজমেন্ট</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-[#0A7756] shadow-lg text-white font-bold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
          >
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5" />
              <span>সিস্টেম সেটিংস</span>
            </div>
            {settings.isMaintenanceMode && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">ON</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('training')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${activeTab === 'training' ? 'bg-purple-600 shadow-lg text-white font-bold' : 'hover:bg-purple-500/10 text-slate-300 hover:text-purple-300 font-medium'}`}
          >
            <div className="flex items-center space-x-3">
              <Brain className="w-5 h-5 text-purple-400" />
              <span>AI ট্রেইনিং (Rules)</span>
            </div>
            {trainingRules.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'training' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-300'}`}>{trainingRules.length}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('errors')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${activeTab === 'errors' ? 'bg-red-600 shadow-lg text-white font-bold' : 'hover:bg-red-500/10 text-slate-300 hover:text-red-400 font-medium'}`}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5" />
              <span>এরর লগস (Errors)</span>
            </div>
            {errorLogs.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'errors' ? 'bg-white/20' : 'bg-red-500/20 text-red-400'}`}>{errorLogs.length}</span>
            )}
          </button>
        </nav>
        
        <div className="relative z-10 p-4 border-t border-white/10 space-y-2">
          <Link to="/app" className="flex items-center space-x-3 px-4 py-3 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-colors w-full text-left font-medium">
            <LayoutDashboard className="w-5 h-5" />
            <span>মূল অ্যাপে ফিরুন</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center space-x-3 px-4 py-3 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl transition-colors w-full text-left font-bold">
            <LogOut className="w-5 h-5" />
            <span>লগআউট করুন</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10 h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
          
          {/* Global Maintenance Alert Banner */}
          {settings.isMaintenanceMode && (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 border-2 border-amber-500/40 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                  <Wrench className="w-6 h-6 animate-spin" style={{ animationDuration: '10s' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-amber-950 text-base sm:text-lg">সিস্টেম মেইনটেন্যান্স মোডে সক্রিয়!</span>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white tracking-wider">ACTIVE</span>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-0.5 font-medium">সাধারণ ইউজাররা এখন Under Maintenance স্ক্রিন দেখতে পাচ্ছেন (কোনো 502 এরর নেই)। আপনি এডমিন প্যানেল থেকে সমস্ত কাজ করতে পারছেন।</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => handleToggleMaintenance(false)}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  মেইনটেন্যান্স বন্ধ করুন (Go Live)
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm px-4 py-3 rounded-xl transition"
                >
                  কনফিগার
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-[#0A7756]" /> 
                ওভারভিউ
              </h2>
              
              {/* Subscriber Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('users'); setUserFilterStatus('ALL'); }}>
                  <div>
                    <p className="text-sm font-bold text-slate-500">মোট ইউজার</p>
                    <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{data.totalUsers}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                    <Users className="w-7 h-7" />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('users'); setUserFilterStatus('SUBSCRIBED'); }}>
                  <div>
                    <p className="text-sm font-bold text-slate-500">অ্যাক্টিভ সাবস্ক্রাইবার</p>
                    <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{data.activeSubscribers || 0}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 border border-green-100 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('users'); setUserFilterStatus('UNSUBSCRIBED'); }}>
                  <div>
                    <p className="text-sm font-bold text-slate-500">ইনঅ্যাক্টিভ</p>
                    <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{data.inactiveSubscribers || 0}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center">
                    <XCircle className="w-7 h-7" />
                  </div>
                </div>
              </div>

              {/* Content KPIs */}
              <h3 className="text-lg font-bold text-slate-800 mb-4">কন্টেন্ট স্ট্যাটিসটিক্স</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'মোট নোটস', count: data.totalNotes, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                  { label: 'রিমাইন্ডার', count: data.totalReminders, icon: Bell, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
                  { label: 'উইশ কার্ড', count: data.totalWishes, icon: Gift, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
                  { label: 'অ্যাক্টিভিটি', count: data.totalActivities, icon: Activity, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${item.bg} ${item.color} ${item.border} border`}>
                      <item.icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-800 mb-1">{item.count}</h3>
                    <p className="text-sm font-bold text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-[#0A7756]" /> 
                    গ্রোথ ও রেভিনিউ
                  </h2>
                  <p className="text-slate-500 font-medium mt-1 ml-11">সিস্টেমের বর্তমান আর্থিক এবং ব্যবহারকারী বৃদ্ধির পরিসংখ্যান</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Revenue Overview (Takes 5 columns on large screens) */}
                <div className="lg:col-span-5 flex flex-col space-y-6">
                  <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0A7756] rounded-[36px] p-8 shadow-2xl relative overflow-hidden text-white flex-1 flex flex-col justify-between group">
                    <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-500 rounded-full blur-[80px] opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>
                    <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                          <DollarSign className="w-6 h-6 text-emerald-400" />
                        </div>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold tracking-wider backdrop-blur-md border border-white/5 uppercase">
                          বার্ষিক প্রজেকশন
                        </span>
                      </div>
                      
                      <div>
                        <p className="text-white/60 font-bold mb-2 uppercase tracking-wide text-sm">মোট প্রত্যাশিত রেভিনিউ</p>
                        <h3 className="text-5xl font-black tracking-tight mb-2 drop-shadow-md">
                          ৳ {totalRevenue.toLocaleString('bn-BD')}
                        </h3>
                        <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-400/10 inline-flex px-3 py-1.5 rounded-lg border border-emerald-400/20">
                          <TrendingUp className="w-4 h-4" />
                          <span>প্রতি ইউজার ৳ ৫০০</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 mt-10 pt-6 border-t border-white/10 flex justify-between items-end">
                      <div>
                        <p className="text-white/50 text-xs font-bold mb-1 uppercase">মাসিক গড় রেভিনিউ</p>
                        <p className="text-2xl font-bold text-white/90">৳ {expectedMonthlyRevenue.toLocaleString('bn-BD')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-xs font-bold mb-1 uppercase">অ্যাক্টিভ ইউজার</p>
                        <p className="text-xl font-bold text-emerald-400">{data.activeSubscribers}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Growth Overview (Takes 7 columns on large screens) */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  <div className="bg-white rounded-[36px] p-8 shadow-xl border border-slate-100 flex-1 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-slate-50 rounded-full blur-[100px] opacity-80 pointer-events-none"></div>
                    
                    <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                        <Calendar className="w-5 h-5" />
                      </div>
                      ইউজার গ্রোথ স্ট্যাটিসটিক্স
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                      <div className="group bg-slate-50/50 hover:bg-blue-50/30 border border-slate-100 hover:border-blue-100 p-6 rounded-[28px] transition-all duration-300">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-300">
                            <Users className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">আজ</span>
                        </div>
                        <h4 className="text-4xl font-black text-slate-800 mb-2">{dailyUsers}</h4>
                        <p className="text-slate-500 font-semibold text-sm">নতুন ইউজার যুক্ত হয়েছে</p>
                      </div>

                      <div className="group bg-slate-50/50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 p-6 rounded-[28px] transition-all duration-300">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">এই মাস</span>
                        </div>
                        <h4 className="text-4xl font-black text-slate-800 mb-2">{monthlyUsers}</h4>
                        <p className="text-slate-500 font-semibold text-sm">নতুন ইউজার যুক্ত হয়েছে</p>
                      </div>

                      <div className="sm:col-span-2 group bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 p-6 rounded-[28px] flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
                        <div className="flex items-center gap-5 w-full">
                          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-purple-600 shrink-0">
                            <Activity className="w-7 h-7" />
                          </div>
                          <div className="flex-1">
                            <p className="text-slate-600 font-bold mb-1">এই বছরের মোট নতুন ইউজার</p>
                            <h4 className="text-4xl font-black text-slate-900">{yearlyUsers}</h4>
                          </div>
                          <div className="hidden sm:block">
                             {/* Fake sparkline purely decorative */}
                            <div className="flex items-end gap-1.5 h-12">
                              {[30, 45, 25, 60, 40, 75, 50, 85].map((h, i) => (
                                <div key={i} className="w-2 bg-purple-300 rounded-t-sm opacity-60" style={{ height: `${h}%` }}></div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-7 h-7 text-[#0A7756]" /> 
                    ইউজার ম্যানেজমেন্ট
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setShowDemoUserModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0A7756] to-emerald-600 hover:from-[#086146] hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-700/20 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>+ নতুন ডেমো ইউজার</span>
                    </button>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Filter className="h-4 w-4 text-slate-400" />
                      </div>
                      <select
                        value={userFilterStatus}
                        onChange={(e) => setUserFilterStatus(e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-1 focus:ring-[#0A7756] appearance-none"
                      >
                        <option value="ALL">সব ইউজার</option>
                        <option value="SUBSCRIBED">অ্যাক্টিভ সাবস্ক্রাইবার</option>
                        <option value="UNSUBSCRIBED">ইনঅ্যাক্টিভ ইউজার</option>
                      </select>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="নাম বা মোবাইল নম্বর খুঁজুন..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-1 focus:ring-[#0A7756] transition-all w-full sm:w-64"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-4 px-4">নাম ও ফোন</th>
                        <th className="pb-4 px-4">যোগদানের তারিখ</th>
                        <th className="pb-4 px-4">ভ্যালিডিটি</th>
                        <th className="pb-4 px-4 text-center">স্ট্যাটাস</th>
                        <th className="pb-4 px-4 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const joinDate = new Date(user.createdAt);
                        const validUntil = new Date(joinDate);
                        validUntil.setDate(validUntil.getDate() + 365);
                        
                        return (
                          <tr key={user._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                            <td className="py-5 px-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                                  {user.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{user.name}</p>
                                  <p className="text-sm font-medium text-slate-500">{user.mobile}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-4 text-sm font-medium text-slate-500">
                              {joinDate.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </td>
                            <td className="py-5 px-4 text-sm font-medium text-slate-500">
                              {user.isSubscribed ? validUntil.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                            </td>
                            <td className="py-5 px-4 text-center">
                              {user.isSubscribed ? (
                                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1.5 rounded-full text-xs font-bold border border-green-100 uppercase tracking-wide">
                                  <CheckCircle className="w-4 h-4" /> অ্যাক্টিভ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold border border-red-100 uppercase tracking-wide">
                                  <XCircle className="w-4 h-4" /> ইনঅ্যাক্টিভ
                                </span>
                              )}
                            </td>
                            <td className="py-5 px-4 text-right">
                              <button
                                onClick={() => handleToggleSubscription(user._id, user.isSubscribed)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${
                                  user.isSubscribed 
                                    ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' 
                                    : 'bg-[#0A7756] text-white hover:bg-[#086146]'
                                }`}
                              >
                                {user.isSubscribed ? 'বন্ধ করুন' : 'চালু করুন'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-16 text-slate-400 font-medium">কোনো ইউজার পাওয়া যায়নি</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 flex flex-col min-h-[75vh]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-7 h-7 text-[#0A7756]" /> 
                      উইশ টেমপ্লেট ম্যানেজমেন্ট
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 ml-9">সিস্টেমের ডিফল্ট এসএমএস এবং উইশ কার্ড টেমপ্লেট</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingTemplate(null);
                      setTempFormData({ name: '', category: 'Birthday', content: '', type: 'Text' });
                      setShowTemplateModal(true);
                    }}
                    className="bg-[#0A7756] hover:bg-[#086146] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-[#0A7756]/20"
                  >
                    <Plus className="w-5 h-5" />
                    নতুন টেমপ্লেট
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map(template => (
                    <div key={template._id} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">{template.category}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTemplate(template); setTempFormData(template); setShowTemplateModal(true); }} className="p-1.5 bg-white text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteTemplate(template._id)} className="p-1.5 bg-white text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 border border-slate-200">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{template.name}</h3>
                      <p className="text-sm text-slate-600 line-clamp-3 bg-white p-3 rounded-xl border border-slate-100">{template.content}</p>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-400">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                      <p className="text-lg font-medium">কোনো টেমপ্লেট পাওয়া যায়নি</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 flex flex-col h-[75vh]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-7 h-7 text-indigo-600" /> 
                    সিস্টেম ও ডেলিভারি লগস
                  </h2>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="লগ মেসেজ খুঁজুন..."
                      value={logSearchTerm}
                      onChange={(e) => setLogSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all w-full sm:w-80"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <div key={log._id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex gap-5 items-start">
                        <div className="pt-1">
                          {log.status === 'SUCCESS' ? (
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                              <CheckCircle className="w-6 h-6" />
                            </div>
                          ) : log.status === 'FAILED' ? (
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                              <Clock className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded-md">{log.type}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400">
                              {new Date(log.createdAt).toLocaleString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-base font-medium text-slate-700">{log.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full text-slate-400">
                      <Clock className="w-16 h-16 mb-4 text-slate-200" />
                      <p className="font-medium text-lg">কোনো ডেলিভারি লগ পাওয়া যায়নি</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 flex flex-col h-[75vh]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Bell className="w-7 h-7 text-[#0A7756]" /> 
                      রিমাইন্ডার ম্যানেজমেন্ট
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 ml-9">সিস্টেমের সমস্ত ইউজারের রিমাইন্ডারসমূহ</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="নাম, মোবাইল বা টাইটেল খুঁজুন..." 
                        value={reminderSearchTerm}
                        onChange={(e) => setReminderSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A7756] w-full sm:w-64"
                      />
                    </div>
                    <input 
                      type="date"
                      value={reminderDateFilter}
                      onChange={(e) => setReminderDateFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A7756]"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                  {filteredReminders.length > 0 ? (
                    filteredReminders.map((r) => (
                      <div key={r._id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider">{r.category}</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${r.status === 'Cancelled' ? 'bg-red-100 text-red-600' : r.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>{r.status}</span>
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-md">{new Date(r.date).toLocaleDateString()} {r.time}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">{r.title}</h3>
                          <p className="text-sm font-medium text-slate-600 line-clamp-1">{r.description || 'N/A'}</p>
                          <p className="text-xs font-bold text-slate-500 mt-2">ইউজার: {r.userId?.name || 'Unknown'} ({r.userId?.mobile || 'N/A'})</p>
                        </div>
                        <button onClick={() => handleDeleteReminder(r._id)} className="p-3 bg-white text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 border border-slate-200 shrink-0 shadow-sm transition">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full text-slate-400">
                      <Bell className="w-16 h-16 mb-4 text-slate-200" />
                      <p className="font-medium text-lg">কোনো রিমাইন্ডার পাওয়া যায়নি</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wishes' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 flex flex-col h-[75vh]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <Star className="w-7 h-7 text-[#0A7756]" /> 
                      উইশ ম্যানেজমেন্ট
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 ml-9">সিস্টেমের সমস্ত ইউজারের উইশসমূহ</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="নাম, মোবাইল বা প্রাপক খুঁজুন..." 
                        value={wishSearchTerm}
                        onChange={(e) => setWishSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A7756] w-full sm:w-64"
                      />
                    </div>
                    <input 
                      type="date"
                      value={wishDateFilter}
                      onChange={(e) => setWishDateFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A7756]"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                  {filteredWishes.length > 0 ? (
                    filteredWishes.map((w) => (
                      <div key={w._id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-wider">{w.method}</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${w.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {w.status}
                            </span>
                            {w.scheduleDate && (
                              <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-md">
                                {new Date(w.scheduleDate).toLocaleDateString()} {w.scheduleTime}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">প্রাপক: {w.recipient}</h3>
                          <p className="text-sm font-medium text-slate-600 mt-1">প্রেরক: {w.senderName}</p>
                          <p className="text-xs font-bold text-slate-500 mt-2">ইউজার: {w.userId?.name || 'Unknown'} ({w.userId?.mobile || 'N/A'})</p>
                        </div>
                        <button onClick={() => handleDeleteWish(w._id)} className="p-3 bg-white text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 border border-slate-200 shrink-0 shadow-sm transition">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full text-slate-400">
                      <Star className="w-16 h-16 mb-4 text-slate-200" />
                      <p className="font-medium text-lg">কোনো উইশ পাওয়া যায়নি</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-red-100 flex flex-col h-[85vh]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-7 h-7" /> 
                      সিস্টেম এরর লগস
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 ml-9">সিস্টেমের ফ্রন্টএন্ড এবং ব্যাকএন্ডের সকল এরর</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                  {errorLogs.length > 0 ? (
                    errorLogs.map((err) => (
                      <div key={err._id} className="p-5 rounded-2xl border border-red-100 bg-red-50/50 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${err.source === 'Frontend' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                              {err.source}
                            </span>
                            <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                              {new Date(err.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 font-mono text-red-600 break-words">{err.message}</h3>
                        {err.path && <p className="text-sm font-medium text-slate-600"><strong>Path:</strong> {err.path}</p>}
                        {err.userId && <p className="text-sm font-medium text-slate-600"><strong>User:</strong> {err.userId.name} ({err.userId.mobile})</p>}
                        {err.stack && (
                          <div className="mt-2 p-4 bg-slate-900 rounded-xl overflow-x-auto">
                            <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap">{err.stack}</pre>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full text-slate-400">
                      <CheckCircle className="w-16 h-16 mb-4 text-green-200" />
                      <p className="font-medium text-lg text-green-600">কোনো এরর পাওয়া যায়নি! সিস্টেম ঠিক আছে।</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 max-w-4xl mx-auto">
                <div className="mb-8 border-b border-slate-100 pb-6">
                  <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-[#0A7756]" /> 
                    সিস্টেম সেটিংস ও API
                  </h2>
                  <p className="text-slate-500 font-medium mt-2">এখানে আপনি থার্ড-পার্টি API Keys এবং সিস্টেমের লিমিটেশন সেট করতে পারবেন।</p>
                </div>

                <div className="space-y-8">
                  {/* Maintenance Mode Control Card */}
                  <div className={`p-6 sm:p-7 rounded-3xl border-2 transition-all ${settings.isMaintenanceMode ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 border-amber-400 shadow-xl shadow-amber-500/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200/80">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.isMaintenanceMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-200 text-slate-700'}`}>
                          <Wrench className={`w-6 h-6 ${settings.isMaintenanceMode ? 'animate-spin' : ''}`} style={{ animationDuration: '10s' }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-lg font-black text-slate-800">সিস্টেম মেইনটেন্যান্স কন্ট্রোল (Maintenance Mode)</h3>
                            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${settings.isMaintenanceMode ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                              {settings.isMaintenanceMode ? 'MAINTENANCE ON' : 'LIVE (NORMAL)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {settings.isMaintenanceMode 
                              ? '⚠️ মেইনটেন্যান্স চালু আছে। সাধারণ ইউজাররা Under Working স্ক্রিন দেখতে পাচ্ছে।'
                              : 'অ্যাপ্লিকেশন আপডেট বা ডেপ্লয়মেন্টের সময় এটি অন রাখলে ইউজাররা 502 এরর না পেয়ে সুন্দর মেইনটেন্যান্স নোটিশ দেখতে পাবে।'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMaintenance(!settings.isMaintenanceMode)}
                          className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition active:scale-95 ${
                            settings.isMaintenanceMode
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {settings.isMaintenanceMode ? 'মেইনটেন্যান্স বন্ধ করুন (Go Live)' : 'মেইনটেন্যান্স মোড চালু করুন'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1.5 block">মেইনটেন্যান্স শিরোনাম (Title)</label>
                        <input
                          type="text"
                          value={settings.maintenanceTitle || ''}
                          onChange={(e) => setSettings({ ...settings, maintenanceTitle: e.target.value })}
                          placeholder="যেমন: সিস্টেম আপগ্রেড ও রক্ষণাবেক্ষণ চলছে"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0A7756]"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700 mb-1.5 block">ব্যবহারকারীদের জন্য বার্তা (Notice Message)</label>
                        <textarea
                          rows={2}
                          value={settings.maintenanceMessage || ''}
                          onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                          placeholder="ইউজাররা যে বার্তাটি স্ক্রিনে দেখতে পাবে..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0A7756]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="text-sm font-bold text-slate-700 mb-1.5 block">আনুমানিক সময় (Estimated Duration)</label>
                          <input
                            type="text"
                            value={settings.maintenanceEstimatedTime || ''}
                            onChange={(e) => setSettings({ ...settings, maintenanceEstimatedTime: e.target.value })}
                            placeholder="যেমন: ১৫ - ২০ মিনিট"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0A7756]"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-400 mr-1">দ্রুত সেট:</span>
                          {['১০ মিনিট', '২০ মিনিট', '৩০ মিনিট', '১ ঘণ্টা', '২ ঘণ্টা'].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSettings({ ...settings, maintenanceEstimatedTime: t })}
                              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#0A7756] text-slate-600 hover:text-[#0A7756] transition"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-center text-xs">
                        <a
                          href="/maintenance.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0A7756] hover:underline font-bold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          মেইনটেন্যান্স স্ক্রিনের প্রিভিউ দেখুন (Preview)
                        </a>
                        <span className="text-slate-400">💡 এডমিন অ্যাকাউন্টে কোনো বাধা ছাড়া যে কোনো সময় ড্যাশবোর্ডে ঢোকা যাবে।</span>
                      </div>
                    </div>
                  </div>

                  {/* Limits Section */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> ইউজার রিমাইন্ডার লিমিট</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">ফ্রি ইউজার লিমিট</label>
                        <input type="number" value={settings.freeUserReminderLimit} onChange={(e) => setSettings({...settings, freeUserReminderLimit: Number(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">প্রো/সাবস্ক্রাইবড ইউজার লিমিট</label>
                        <input type="number" value={settings.proUserReminderLimit} onChange={(e) => setSettings({...settings, proUserReminderLimit: Number(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                      </div>
                    </div>
                  </div>

                  {/* API Keys Section */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-green-500"/> থার্ড-পার্টি API Keys</h3>
                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">OpenAI API Key (ChatGPT)</label>
                        <input type="password" value={settings.openaiApiKey} onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})} placeholder="sk-..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                        <p className="text-xs text-slate-400 mt-1 font-medium">AI উইশ মেসেজ তৈরির জন্য ব্যবহৃত হবে।</p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">Gemini API Key (Google AI)</label>
                        <input type="password" value={settings.geminiApiKey} onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})} placeholder="AIzaSy..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                        <p className="text-xs text-slate-400 mt-1 font-medium">WhatsApp AI বট-এর জন্য ব্যবহৃত হবে।</p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">Twilio Account SID</label>
                        <input type="password" value={settings.twilioAccountSid} onChange={(e) => setSettings({...settings, twilioAccountSid: e.target.value})} placeholder="AC..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                        <p className="text-xs text-slate-400 mt-1 font-medium">Twilio ড্যাশবোর্ড থেকে পাবেন।</p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">Twilio Auth Token (WhatsApp API Token)</label>
                        <input type="password" value={settings.whatsappApiToken} onChange={(e) => setSettings({...settings, whatsappApiToken: e.target.value})} placeholder="Twilio Auth Token..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">Twilio WhatsApp Number</label>
                        <input type="text" value={settings.twilioPhoneNumber} onChange={(e) => setSettings({...settings, twilioPhoneNumber: e.target.value})} placeholder="whatsapp:+14155238886" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                        <p className="text-xs text-slate-400 mt-1 font-medium">আপনার Sandbox বা লাইভ নম্বর। (whatsapp: লিখতেই হবে)</p>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">SMS Gateway API Key</label>
                        <input type="password" value={settings.smsGatewayKey} onChange={(e) => setSettings({...settings, smsGatewayKey: e.target.value})} placeholder="SMS API Key..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]" />
                      </div>
                    </div>
                  </div>

                  {/* bdapps bKash Charging SDK Section */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-[#e2136e] text-white text-xs font-black flex items-center justify-center">b</span>
                      bdapps bKash Charging SDK সেটিংস
                    </h3>
                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="p-3 bg-pink-50 border border-pink-100 rounded-xl text-xs text-pink-900 leading-relaxed">
                        💡 <b>bdapps গাইড:</b> bdapps পোর্টালের <i>General → Advanced</i> থেকে <b>Enable Charging SDK</b> অন করার পর পাওয়া <b>API Key</b> ও <b>API Secret</b> এখানে সেট করুন।
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">bdapps API Key</label>
                        <input
                          type="text"
                          value={settings.bdappsApiKey || ''}
                          onChange={(e) => setSettings({...settings, bdappsApiKey: e.target.value})}
                          placeholder="YOUR_APPLICATION_API_KEY"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e2136e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1.5 block">bdapps API Secret</label>
                        <input
                          type="password"
                          value={settings.bdappsApiSecret || ''}
                          onChange={(e) => setSettings({...settings, bdappsApiSecret: e.target.value})}
                          placeholder="YOUR_APPLICATION_API_SECRET"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e2136e]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-bold text-slate-600 mb-1.5 block">Redirect URL</label>
                          <input
                            type="text"
                            value={settings.bdappsRedirectUrl || ''}
                            onChange={(e) => setSettings({...settings, bdappsRedirectUrl: e.target.value})}
                            placeholder="https://smritilife.com/subscription-return"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e2136e]"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-600 mb-1.5 block">মাসিক সাবস্ক্রিপশন ফি (টাকা)</label>
                          <input
                            type="number"
                            value={settings.subscriptionFee || 190}
                            onChange={(e) => setSettings({...settings, subscriptionFee: Number(e.target.value)})}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#e2136e]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveSettings} className="bg-[#0A7756] hover:bg-[#086146] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-[#0A7756]/20 active:scale-95">
                      <CheckCircle className="w-5 h-5" />
                      সেটিংস সেভ করুন
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Training & Custom Rules Tab */}
          {activeTab === 'training' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-purple-900 to-indigo-900 p-6 rounded-3xl text-white shadow-xl">
                <div>
                  <div className="flex items-center gap-3">
                    <Brain className="w-8 h-8 text-purple-300" />
                    <h2 className="text-2xl font-bold">AI বিহেভিয়ার ও ট্রেইনিং সেন্টার</h2>
                  </div>
                  <p className="text-sm text-purple-200 mt-1">
                    কোড পরিবর্তন না করেই এখান থেকে অথবা WhatsApp-এ <code className="bg-purple-800/80 px-2 py-0.5 rounded font-mono text-purple-200">/teach [নিয়ম]</code> লিখে স্মৃতিকে সরাসরি নতুন নিয়ম শেখান!
                  </p>
                </div>
              </div>

              {/* Add New Rule Form */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-purple-600" />
                  নতুন নিয়ম বা আচরণ শেখান
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">নিয়ম বা নির্দেশিকা (Instruction / Rule)</label>
                    <textarea
                      value={newRuleInput}
                      onChange={(e) => setNewRuleInput(e.target.value)}
                      placeholder="যেমন: ইউজার যদি জন্মদিনের শুভেচ্ছা পাঠাতে চায় কিন্তু নাম না বলে, তবে আগে নাম জিজ্ঞেস করবে।"
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">উদাহরণ বা প্রেক্ষাপট (ঐচ্ছিক / Optional Example)</label>
                    <input
                      type="text"
                      value={newRuleExample}
                      onChange={(e) => setNewRuleExample(e.target.value)}
                      placeholder="যেমন: 01307... নম্বরে উইশ পাঠাও -> কার জন্য পাঠাতে চান?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-slate-500">
                    💡 <b>টিপ:</b> WhatsApp চ্যাটেও আপনি <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">/teach [নিয়ম]</span> বা <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">/rules</span> লিখে সরাসরি ট্রেন করতে পারেন।
                  </div>
                  <button
                    onClick={handleAddTrainingRule}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 active:scale-95"
                  >
                    <Brain className="w-4 h-4" />
                    AI-কে শেখান
                  </button>
                </div>
              </div>

              {/* Active Rules List */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800">
                    বর্তমান সক্রিয় নিয়মসমূহ ({trainingRules.length}টি)
                  </h3>
                </div>

                {trainingRules.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Brain className="w-12 h-12 mx-auto text-slate-300 mb-2 opacity-50" />
                    <p className="font-medium">এখনো কোনো কাস্টম নিয়ম যুক্ত করা হয়নি।</p>
                    <p className="text-xs text-slate-400 mt-1">উপরের ফর্ম থেকে অথবা WhatsApp-এ /teach লিখে স্মৃতিকে ট্রেন করুন।</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {trainingRules.map((rule, idx) => (
                      <div key={rule._id} className="py-4 flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-mono">
                              #{idx + 1}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs text-slate-400">
                              উৎস: {rule.addedBy || 'Admin'}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium text-sm pt-1">
                            {rule.rule}
                          </p>
                          {rule.exampleInput && (
                            <p className="text-xs text-slate-500 italic">
                              উদাহরণ: {rule.exampleInput}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleTrainingRule(rule)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${rule.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                          >
                            {rule.isActive ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteTrainingRule(rule._id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 mb-6">{editingTemplate ? 'টেমপ্লেট সম্পাদনা করুন' : 'নতুন টেমপ্লেট যোগ করুন'}</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">টেমপ্লেটের নাম</label>
                <input 
                  type="text" 
                  value={tempFormData.name} 
                  onChange={e => setTempFormData({...tempFormData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]"
                  placeholder="যেমন: শুভ জন্মদিন ১"
                />
              </div>
              
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">ক্যাটাগরি</label>
                <select 
                  value={tempFormData.category} 
                  onChange={e => setTempFormData({...tempFormData, category: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]"
                >
                  <option value="Birthday">Birthday</option>
                  <option value="Anniversary">Anniversary</option>
                  <option value="Eid">Eid</option>
                  <option value="New Year">New Year</option>
                  <option value="Valentine">Valentine</option>
                  <option value="Mothers Day">Mothers Day</option>
                  <option value="Fathers Day">Fathers Day</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">মেসেজ কনটেন্ট</label>
                <textarea 
                  value={tempFormData.content} 
                  onChange={e => setTempFormData({...tempFormData, content: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756] min-h-[100px]"
                  placeholder="আপনার উইশ মেসেজ লিখুন..."
                ></textarea>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                বাতিল
              </button>
              <button 
                onClick={handleSaveTemplate}
                className="flex-1 py-3 bg-[#0A7756] hover:bg-[#086146] text-white font-bold rounded-xl transition shadow-lg shadow-[#0A7756]/20"
              >
                {editingTemplate ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Demo User Modal */}
      {showDemoUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0A7756]" />
                নতুন ডেমো / টেস্ট ইউজার
              </h2>
              <button 
                onClick={() => setShowDemoUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-emerald-800 bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 mb-5 leading-relaxed">
              💡 এই নম্বরে ১ বছরের ফুল সাবস্ক্রিপশন পাস সক্রিয় হবে। বিকাশ পেমেন্ট ছাড়াই সরাসরি ওয়েবসাইট ও হোয়াটসঅ্যাপে বট টেস্ট করতে পারবে। (লগইন টেস্ট OTP কোড: <b>1234</b> বা <b>0000</b>)
            </div>
            
            <form onSubmit={handleCreateDemoUser} className="space-y-4 mb-2">
              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  মোবাইল নম্বর <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="tel" 
                  value={demoForm.mobile} 
                  onChange={e => setDemoForm({...demoForm, mobile: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono font-medium focus:outline-none focus:border-[#0A7756]"
                  placeholder="যেমন: 017XXXXXXXX"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-600 mb-1.5 block">
                  নাম (ঐচ্ছিক)
                </label>
                <input 
                  type="text" 
                  value={demoForm.name} 
                  onChange={e => setDemoForm({...demoForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0A7756]"
                  placeholder="যেমন: Demo Tester"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setShowDemoUserModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingDemo}
                  className="flex-1 py-3 bg-[#0A7756] hover:bg-[#086146] text-white font-bold rounded-xl transition shadow-lg shadow-[#0A7756]/20 disabled:opacity-50"
                >
                  {isSubmittingDemo ? 'অ্যাক্টিভ হচ্ছে...' : 'অ্যাক্টিভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
