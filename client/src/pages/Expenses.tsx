import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Filter, 
  TrendingUp, 
  Calendar, 
  Wallet, 
  ArrowUpRight, 
  ShoppingBag, 
  CreditCard, 
  Check, 
  X, 
  MessageSquare, 
  PieChart,
  Search,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface ExpenseItem {
  _id: string;
  title: string;
  amount: number;
  category: string;
  categoryBn: string;
  paymentMethod: string;
  date: string;
  notes?: string;
  createdAt: string;
}

interface CategorySummary {
  id: string;
  nameBn: string;
  icon: string;
  amount: number;
  count: number;
  percentage: number;
}

interface ExpenseSummary {
  todayExpenses: ExpenseItem[];
  todayTotal: number;
  todayCount: number;
  monthTotal: number;
  monthCount: number;
  categoryBreakdown: CategorySummary[];
  dateStr: string;
}

const CATEGORY_ICONS: Record<string, { icon: string; nameBn: string; color: string }> = {
  food: { icon: '🛒', nameBn: 'খাবার ও বাজার', color: 'from-emerald-500 to-teal-600' },
  transport: { icon: '🚗', nameBn: 'যাতায়াত', color: 'from-blue-500 to-indigo-600' },
  health: { icon: '💊', nameBn: 'ওষুধ ও চিকিৎসা', color: 'from-rose-500 to-red-600' },
  bills: { icon: '💡', nameBn: 'ইউটিলিটি ও বিল', color: 'from-amber-500 to-orange-600' },
  shopping: { icon: '🛍️', nameBn: 'কেনাকাটা', color: 'from-purple-500 to-pink-600' },
  education: { icon: '📚', nameBn: 'শিক্ষা', color: 'from-sky-500 to-cyan-600' },
  entertainment: { icon: '🎬', nameBn: 'বিনোদন', color: 'from-fuchsia-500 to-violet-600' },
  other: { icon: '📌', nameBn: 'অন্যান্য', color: 'from-slate-500 to-gray-600' }
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'নগদ (Cash)',
  bkash: 'বিকাশ (bKash)',
  nagad: 'নগদ (Nagad)',
  card: 'কার্ড (Card)',
  bank: 'ব্যাংক (Bank)',
  other: 'অন্যান্য'
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'yesterday' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('food');
  const [newPaymentMethod, setNewPaymentMethod] = useState('cash');
  const [newNotes, setNewNotes] = useState('');
  const [newDate, setNewDate] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const [listRes, summaryRes] = await Promise.all([
        fetchWithAuth(`${import.meta.env.VITE_API_URL}/expenses`),
        fetchWithAuth(`${import.meta.env.VITE_API_URL}/expenses/summary`)
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setExpenses(listData.expenses || []);
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData.summary || null);
      }
    } catch (err) {
      toast.error('খরচের হিসাব লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount || parseFloat(newAmount) <= 0) {
      toast.error('অনুগ্রহ করে সঠিক খাতের নাম ও টাকার পরিমাণ দিন');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          amount: parseFloat(newAmount),
          category: newCategory,
          paymentMethod: newPaymentMethod,
          notes: newNotes.trim(),
          date: newDate ? new Date(`${newDate}T12:00:00.000+06:00`) : undefined
        })
      });

      if (res.ok) {
        toast.success('খরচ সফলভাবে যুক্ত হয়েছে! 💰');
        setNewTitle('');
        setNewAmount('');
        setNewNotes('');
        setNewDate('');
        setIsAddModalOpen(false);
        fetchExpenses();
      } else {
        toast.error('খরচ যুক্ত করতে ব্যর্থ হয়েছে');
      }
    } catch (err) {
      toast.error('সমস্যা হয়েছে, পরে চেষ্টা করুন');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${title}" খরচটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/expenses/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('খরচ মুছে ফেলা হয়েছে');
        setExpenses(prev => prev.filter(e => e._id !== id));
        // Refresh summary
        const sumRes = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/expenses/summary`);
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setSummary(sumData.summary || null);
        }
      } else {
        toast.error('মুছে ফেলতে সমস্যা হয়েছে');
      }
    } catch (err) {
      toast.error('সমস্যা হয়েছে');
    }
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    if (activeFilter === 'today') {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      const itemDateStr = new Date(item.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      return todayStr === itemDateStr;
    }

    if (activeFilter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      const itemDateStr = new Date(item.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      return yesterdayStr === itemDateStr;
    }

    if (activeFilter === 'month') {
      const now = new Date();
      const itemDate = new Date(item.date);
      return now.getFullYear() === itemDate.getFullYear() && now.getMonth() === itemDate.getMonth();
    }

    if (activeFilter === 'custom' && customDate) {
      const itemDateStr = new Date(item.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
      return customDate === itemDateStr;
    }

    return true;
  });

  const topCategory = summary?.categoryBreakdown?.[0];

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans text-slate-800">
      
      {/* Top Header Banner */}
      <div className="bg-gradient-to-br from-[#063828] via-[#0A543A] to-[#04281c] text-white p-5 pt-7 md:pt-10 pb-12 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/30 text-amber-300 text-xs font-bold mb-1.5 shadow-xs">
                <Wallet className="w-3.5 h-3.5" />
                <span>দৈনিক খরচের হিসাব খাতা</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                স্মার্ট হিসাব খাতা
              </h1>
              <p className="text-emerald-100/80 text-xs font-medium">
                হোয়াটসঅ্যাপ বা অ্যাপে প্রতিদিনের খরচের হিসাব রাখুন নির্ভুলভাবে
              </p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/30 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>নতুন খরচ</span>
            </button>
          </div>

          {/* WhatsApp Logging Tip Pill */}
          <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between text-xs backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] shrink-0 font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="text-emerald-100 font-semibold text-[11px] md:text-xs">
                  💡 <strong className="text-amber-300">হোয়াটসঅ্যাপ টিপস:</strong> শুধু লিখুন <span className="underline decoration-amber-400 font-mono font-bold">বাজার ৫০০</span> বা <span className="underline decoration-amber-400 font-mono font-bold">রিকশা ৬০</span>, সাথে সাথে হিসাব সেভ হয়ে যাবে!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-20 space-y-4">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Today's Expense */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">আজকের মোট খরচ</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#0A7756] flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 font-mono tracking-tight">
                ৳{summary ? Math.round(summary.todayTotal).toLocaleString('en-IN') : '০'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                আজকের মোট এন্ট্রি: <strong className="text-slate-700">{summary?.todayCount || 0}টি</strong>
              </p>
            </div>
          </div>

          {/* This Month's Expense */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">চলতি মাসের মোট</span>
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 font-mono tracking-tight text-emerald-800">
                ৳{summary ? Math.round(summary.monthTotal).toLocaleString('en-IN') : '০'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                এই মাসের মোট এন্ট্রি: <strong className="text-slate-700">{summary?.monthCount || 0}টি</strong>
              </p>
            </div>
          </div>

          {/* Top Expense Category */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">সর্বোচ্চ খরচের খাত</span>
              <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 truncate">
                {topCategory ? `${topCategory.icon} ${topCategory.nameBn}` : 'কোনো তথ্য নেই'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {topCategory ? `মোট খরচের ${topCategory.percentage}% (৳${Math.round(topCategory.amount).toLocaleString('en-IN')})` : 'খরচ যোগ করুন'}
              </p>
            </div>
          </div>
        </div>

        {/* Category Breakdown Progress Bar Section */}
        {summary && summary.categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#0A7756]" />
              <span>চলতি মাসের খাতভিত্তিক খরচ</span>
            </h3>

            {/* Visual Multi-Segment Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {summary.categoryBreakdown.map((cat, idx) => {
                const colors = [
                  'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500',
                  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-slate-400'
                ];
                return (
                  <div
                    key={cat.id}
                    title={`${cat.nameBn}: ${cat.percentage}%`}
                    style={{ width: `${cat.percentage}%` }}
                    className={`${colors[idx % colors.length]} h-full transition-all duration-300`}
                  />
                );
              })}
            </div>

            {/* Category Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {summary.categoryBreakdown.map(cat => (
                <div key={cat.id} className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{cat.nameBn}</span>
                  </div>
                  <div className="text-right pl-1">
                    <span className="text-xs font-bold text-slate-900 font-mono">৳{Math.round(cat.amount).toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-slate-400 block font-medium">{cat.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses List & Filter Card */}
        <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-4">
          
          {/* Controls: Tabs & Category Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
              <button
                onClick={() => { setActiveFilter('all'); setCustomDate(''); }}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${activeFilter === 'all' ? 'bg-white text-[#0A7756] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                সব খরচ
              </button>
              <button
                onClick={() => { setActiveFilter('today'); setCustomDate(''); }}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${activeFilter === 'today' ? 'bg-white text-[#0A7756] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                আজকে ({summary?.todayCount || 0})
              </button>
              <button
                onClick={() => { setActiveFilter('yesterday'); setCustomDate(''); }}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${activeFilter === 'yesterday' ? 'bg-white text-[#0A7756] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                গতকালকে
              </button>
              <button
                onClick={() => { setActiveFilter('month'); setCustomDate(''); }}
                className={`px-3 py-1.5 rounded-full transition cursor-pointer ${activeFilter === 'month' ? 'bg-white text-[#0A7756] shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                এই মাস ({summary?.monthCount || 0})
              </button>
              <div className="flex items-center gap-1 pl-1">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    if (e.target.value) setActiveFilter('custom');
                  }}
                  title="নির্দিষ্ট তারিখ বাছাই করুন (যেমন: ১০ অক্টোবর)"
                  className="bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-xl outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Category Dropdown & Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-2xl px-3 py-2 outline-none cursor-pointer flex-1 sm:flex-initial"
              >
                <option value="all">সব খাত (All Categories)</option>
                {Object.entries(CATEGORY_ICONS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.icon} {val.nameBn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items List */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              লোড হচ্ছে...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                <Wallet className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">কোনো খরচ পাওয়া যায়নি</h4>
              <p className="text-xs text-slate-400 mt-1">
                উপরের "+ নতুন খরচ" বাটনে চাপ দিয়ে অথবা হোয়াটসঅ্যাপে মেসেজ পাঠিয়ে খরচ লিখুন।
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredExpenses.map((item) => {
                const cat = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.other;
                const formattedDate = new Date(item.date).toLocaleDateString('bn-BD', {
                  day: 'numeric',
                  month: 'short'
                });

                return (
                  <div key={item._id} className="py-3 flex items-center justify-between group hover:bg-slate-50/60 -mx-2 px-2 rounded-2xl transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                        {cat.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                          <span>{cat.nameBn}</span>
                          <span>•</span>
                          <span>{PAYMENT_METHODS[item.paymentMethod] || 'নগদ'}</span>
                          <span>•</span>
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm md:text-base font-black text-slate-900 font-mono">
                        ৳{Math.round(item.amount).toLocaleString('en-IN')}
                      </span>
                      <button
                        onClick={() => handleDeleteExpense(item._id, item.title)}
                        className="text-slate-300 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#0A7756]" />
                <span>নতুন খরচ যোগ করুন</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  খরচের বিবরণ বা খাতের নাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: কাঁচাবাজার, রিকশা ভাড়া, লাঞ্চ..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30 focus:border-[#0A7756]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="যেমন: ৫০০"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30 focus:border-[#0A7756]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ক্যাটাগরি
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30 cursor-pointer"
                  >
                    {Object.entries(CATEGORY_ICONS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.icon} {val.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30 cursor-pointer"
                  >
                    {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নোট বা অতিরিক্ত তথ্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: রিকশা দিয়ে ধানমন্ডি গিয়েছিলাম..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ (ঐচ্ছিক - পেছনের দিনের খরচ হলে তারিখ দিন, না দিলে আজকের তারিখ হবে)
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A7756]/30"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 rounded-2xl bg-[#0A7756] hover:bg-[#086146] active:scale-95 text-white font-bold text-xs shadow-md shadow-[#0A7756]/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{submitting ? 'সেভ হচ্ছে...' : 'হিসাব সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
