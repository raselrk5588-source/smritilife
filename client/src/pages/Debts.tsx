import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Filter, 
  Search, 
  Handshake, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Calendar, 
  MessageCircle, 
  Send, 
  X, 
  Sparkles, 
  DollarSign,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface IDebtTransaction {
  date: string;
  amount: number;
  note?: string;
  type: 'payment' | 'additional';
}

interface IDebt {
  _id: string;
  personName: string;
  personPhone?: string;
  type: 'lent' | 'borrowed'; // lent = আমি পাবো, borrowed = আমি দেবো
  amount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'settled';
  dueDate?: string;
  notes?: string;
  history?: IDebtTransaction[];
  createdAt: string;
  updatedAt: string;
}

interface DebtSummary {
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
  receivableCount: number;
  payableCount: number;
  activePeopleCount: number;
  topReceivables: Array<{ personName: string; amount: number; phone?: string }>;
  topPayables: Array<{ personName: string; amount: number }>;
}

export default function Debts() {
  const [debts, setDebts] = useState<IDebt[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'lent' | 'borrowed' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Debt Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [debtType, setDebtType] = useState<'lent' | 'borrowed'>('lent');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebtForPay, setSelectedDebtForPay] = useState<IDebt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchDebtsData = async () => {
    try {
      setLoading(true);
      const [listRes, summaryRes] = await Promise.all([
        fetchWithAuth(`${import.meta.env.VITE_API_URL}/debts`),
        fetchWithAuth(`${import.meta.env.VITE_API_URL}/debts/summary`)
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setDebts(listData.debts || []);
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.summary || null);
      }
    } catch (err) {
      console.error(err);
      toast.error('ধার-দেনার তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtsData();
  }, []);

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      toast.error('ব্যক্তির নাম লিখুন');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: personName.trim(),
          personPhone: personPhone.trim() || undefined,
          type: debtType,
          amount: numAmount,
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined
        })
      });

      if (res.ok) {
        toast.success(debtType === 'lent' ? 'পাওনা হিসাব যুক্ত হয়েছে' : 'দেনা হিসাব যুক্ত হয়েছে');
        setIsAddModalOpen(false);
        setPersonName('');
        setPersonPhone('');
        setAmount('');
        setDueDate('');
        setNotes('');
        fetchDebtsData();
      } else {
        const err = await res.json();
        toast.error(err.message || 'সংরক্ষণ করা যায়নি');
      }
    } catch (err) {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtForPay) return;

    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('সঠিক পরিশোধের পরিমাণ লিখুন');
      return;
    }

    try {
      setPaySubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/debts/${selectedDebtForPay._id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          note: payNote.trim() || undefined
        })
      });

      if (res.ok) {
        toast.success('পরিশোধ হিসাব সংরক্ষণ করা হয়েছে');
        setIsPayModalOpen(false);
        setSelectedDebtForPay(null);
        setPayAmount('');
        setPayNote('');
        fetchDebtsData();
      } else {
        const err = await res.json();
        toast.error(err.message || 'পরিশোধ সংরক্ষণ করা যায়নি');
      }
    } catch (err) {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleDeleteDebt = async (id: string, name: string) => {
    if (!window.confirm(`${name}-এর এই হিসাবটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/debts/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('হিসাব মুছে ফেলা হয়েছে');
        setDebts(prev => prev.filter(d => d._id !== id));
        fetchDebtsData();
      } else {
        toast.error('হিসাব মোছা যায়নি');
      }
    } catch (err) {
      toast.error('নেটওয়ার্ক সমস্যা');
    }
  };

  const openPaymentModal = (debt: IDebt) => {
    setSelectedDebtForPay(debt);
    const remaining = Math.max(0, debt.amount - debt.paidAmount);
    setPayAmount(remaining.toString());
    setPayNote('');
    setIsPayModalOpen(true);
  };

  // Build WhatsApp Reminder Link (তাগাদা বার্তা)
  const getWhatsAppReminderUrl = (debt: IDebt) => {
    const remaining = debt.amount - debt.paidAmount;
    const cleanPhone = (debt.personPhone || '').replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (cleanPhone.startsWith('01')) {
      formattedPhone = `88${cleanPhone}`;
    }

    const messageText = `আসসালামু আলাইকুম ${debt.personName} ভাই, আশা করি ভালো আছেন। আপনার কাছে আমার ৳${remaining.toLocaleString('en-IN')} ধার/বাকি রয়েছে। সম্ভব হলে দ্রুত পরিশোধ করলে বিশেষ উপকৃত হতাম। ধন্যবাদ!`;
    const encodedMsg = encodeURIComponent(messageText);

    if (formattedPhone) {
      return `https://wa.me/${formattedPhone}?text=${encodedMsg}`;
    }
    return `https://wa.me/?text=${encodedMsg}`;
  };

  // Filtered debts
  const filteredDebts = debts.filter(debt => {
    // Tab filter
    if (activeTab === 'lent' && (debt.type !== 'lent' || debt.status === 'settled')) return false;
    if (activeTab === 'borrowed' && (debt.type !== 'borrowed' || debt.status === 'settled')) return false;
    if (activeTab === 'settled' && debt.status !== 'settled') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = debt.personName.toLowerCase().includes(q);
      const matchPhone = debt.personPhone?.toLowerCase().includes(q);
      const matchNotes = debt.notes?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchNotes) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 md:pb-12 font-sans">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white pt-8 pb-14 px-4 sm:px-8 shadow-md">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md mb-2 border border-emerald-500/30">
                <Handshake className="w-3.5 h-3.5" />
                <span>ধাপ ৪: স্মার্ট লেনদেন ও বাকি খাতা</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                🤝 ধার-দেনা ও বাকি খাতা
              </h1>
              <p className="text-emerald-100/80 text-sm mt-1 max-w-xl">
                স্মার্ট হিসাব খাতা — কার কাছে কত পাবেন এবং কাকে কত দেবেন তার স্পষ্ট ডিজিটাল খতিয়ান ও হোয়াটসঅ্যাপে ১-ক্লিকে তাগাদা।
              </p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-sm shrink-0"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>নতুন ধার/বাকি যুক্ত করুন</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 -mt-8">
        
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          
          {/* Card 1: মোট পাওনা (আমি পাবো) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between transition hover:shadow-md">
            <div>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                আমি পাবো (মোট পাওনা)
              </span>
              <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">
                ৳{(summary?.totalReceivable || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {summary?.receivableCount || 0} টি সক্রিয় পাওনা হিসাব
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 2: মোট দেনা (আমি দেবো) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between transition hover:shadow-md">
            <div>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                আমি দেবো (মোট দেনা)
              </span>
              <div className="text-2xl md:text-3xl font-black text-rose-600 mt-1">
                ৳{(summary?.totalPayable || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {summary?.payableCount || 0} টি দেনা পরিশোধ বাকি
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
              <TrendingDown className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 3: নেট ব্যালেন্স */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between transition hover:shadow-md">
            <div>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                নেট ব্যালেন্স
              </span>
              <div className={`text-2xl md:text-3xl font-black mt-1 ${
                (summary?.netBalance || 0) > 0 
                  ? 'text-emerald-700' 
                  : (summary?.netBalance || 0) < 0 
                  ? 'text-rose-700' 
                  : 'text-slate-700'
              }`}>
                {(summary?.netBalance || 0) >= 0 ? '+' : ''}
                ৳{(summary?.netBalance || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                {(summary?.netBalance || 0) > 0 ? '🟢 উদ্বৃত্ত (পাওনা বেশি)' : (summary?.netBalance || 0) < 0 ? '🔴 ঘাটতি (দেনা বেশি)' : 'ব্যালেন্স শূন্য'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <Receipt className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

        </div>

        {/* WhatsApp Voice / Text Help Box */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/70 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  হোয়াটসঅ্যাপে সরাসরি ভয়েস বা মেসেজ পাঠিয়ে হিসাব রাখুন!
                </h3>
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ০ টোকেন খরচ
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                লিখুন: <span className="font-semibold text-emerald-800">"রনিকে ৫০০ টাকা ধার দিলাম"</span> বা <span className="font-semibold text-emerald-800">"দোকানে বাকি ৩০০ টাকা"</span> বা <span className="font-semibold text-emerald-800">"ধার দেনার হিসাব কত"</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-semibold bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>অটোমেটিক আপডেট হবে</span>
          </div>
        </div>

        {/* Filters & Search Controls */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'সব হিসাব' },
                { id: 'lent', label: '🟢 আমি পাবো' },
                { id: 'borrowed', label: '🔴 আমি দেবো' },
                { id: 'settled', label: '✨ পরিশোধিত' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="নাম বা বিবরণ খুঁজুন..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Debts List */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">ধার-দেনার হিসাব লোড হচ্ছে...</p>
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm max-w-md mx-auto my-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">কোনো হিসাব পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 mb-5">
              {searchQuery ? 'আপনার সার্চের সাথে কোনো ফলাফল মেলেনি।' : 'আপনার কোনো বাকি বা ধার-দেনার এন্ট্রি নেই।'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন এন্ট্রি যোগ করুন</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDebts.map(debt => {
              const isLent = debt.type === 'lent';
              const remaining = Math.max(0, debt.amount - debt.paidAmount);
              const percentPaid = Math.min(100, Math.round((debt.paidAmount / debt.amount) * 100));
              const isSettled = debt.status === 'settled' || remaining <= 0;

              return (
                <div
                  key={debt._id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border transition hover:shadow-md flex flex-col justify-between ${
                    isSettled 
                      ? 'border-slate-100 opacity-80' 
                      : isLent 
                      ? 'border-emerald-100 hover:border-emerald-300' 
                      : 'border-rose-100 hover:border-rose-300'
                  }`}
                >
                  <div>
                    {/* Top row: Avatar + Name + Badges */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-inner ${
                          isLent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {debt.personName.substring(0, 2)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                            {debt.personName}
                          </h4>
                          {debt.personPhone && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {debt.personPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isLent 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isLent ? 'আমি পাবো (পাওনা)' : 'আমি দেবো (দেনা)'}
                        </span>

                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSettled
                            ? 'bg-slate-100 text-slate-600'
                            : percentPaid > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                          {isSettled ? '✨ সম্পূর্ণ শোধ' : percentPaid > 0 ? `আংশিক (${percentPaid}%)` : 'বাকি আছে'}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Remaining Breakdown */}
                    <div className="bg-slate-50/80 rounded-xl p-3 mb-3 border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">মোট হিসাব:</span>
                        <span className="font-bold text-slate-800">৳{debt.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">পরিশোধ হয়েছে:</span>
                        <span className="font-semibold text-emerald-700">৳{debt.paidAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="border-t border-slate-200/60 my-1.5 pt-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">অবশিষ্ট বাকি:</span>
                        <span className={`text-base font-black ${
                          isSettled 
                            ? 'text-slate-400' 
                            : isLent 
                            ? 'text-emerald-600' 
                            : 'text-rose-600'
                        }`}>
                          ৳{remaining.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Repayment Progress Bar */}
                      {!isSettled && debt.paidAmount > 0 && (
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Notes & Due Date */}
                    {(debt.notes || debt.dueDate) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mb-3 px-1">
                        {debt.dueDate && (
                          <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-100 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            পরিশোধের তারিখ: {new Date(debt.dueDate).toLocaleDateString('bn-BD')}
                          </span>
                        )}
                        {debt.notes && (
                          <span className="bg-white px-2 py-0.5 rounded-md border border-slate-100 font-medium">
                            বিবরণ: {debt.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
                    
                    {/* Left: WhatsApp Reminder (Only for lent & not settled) */}
                    {isLent && !isSettled ? (
                      <a
                        href={getWhatsAppReminderUrl(debt)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>তাগাদা পাঠান</span>
                      </a>
                    ) : (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(debt.createdAt).toLocaleDateString('bn-BD')}
                      </div>
                    )}

                    {/* Right: Payment & Delete Buttons */}
                    <div className="flex items-center space-x-1.5">
                      {!isSettled && (
                        <button
                          onClick={() => openPaymentModal(debt)}
                          className="inline-flex items-center space-x-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>জমা / শোধ</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteDebt(debt._id, debt.personName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* --- ADD DEBT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <Handshake className="w-5 h-5 text-emerald-600" />
                নতুন ধার / বাকি খাতা এন্ট্রি
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-4">
              
              {/* Type Switcher */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">লেনদেনের ধরন:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtType('lent')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      debtType === 'lent'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>আমি পাবো (পাওনা)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDebtType('borrowed')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      debtType === 'borrowed'
                        ? 'bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>আমি দেবো (দেনা)</span>
                  </button>
                </div>
              </div>

              {/* Person Name */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  ব্যক্তি বা প্রতিষ্ঠানের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  placeholder="যেমন: রনি, করিম, বা দোকান"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Amount & Phone in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="৫০০"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    মোবাইল নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="tel"
                    value={personPhone}
                    onChange={e => setPersonPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  পরিশোধের সম্ভাব্য তারিখ (ঐচ্ছিক)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  বিবরণ বা নোট (ঐচ্ছিক)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="যেমন: মুদি বাজার বাকি বা জরুরি ধার"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'হিসাব সংরক্ষণ করুন'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- PAYMENT / SETTLEMENT MODAL --- */}
      {isPayModalOpen && selectedDebtForPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                টাকা পরিশোধ / জমা গ্রহণ
              </h3>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 mb-4 text-xs">
              <div className="font-bold text-slate-800 text-sm mb-1">{selectedDebtForPay.personName}</div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>মোট হিসাব:</span>
                <span>৳{selectedDebtForPay.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>পূর্বে পরিশোধ:</span>
                <span className="text-emerald-700">৳{selectedDebtForPay.paidAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between font-bold text-slate-800">
                <span>বর্তমানে বাকি:</span>
                <span className="text-rose-600">৳{(selectedDebtForPay.amount - selectedDebtForPay.paidAmount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  এখন জমার পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  max={selectedDebtForPay.amount - selectedDebtForPay.paidAmount}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-base font-black rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  নোট / মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="যেমন: বিকাশে পাঠিয়েছে বা ক্যাশ দিলো"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {paySubmitting ? 'প্রসেসিং...' : 'জমা সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
