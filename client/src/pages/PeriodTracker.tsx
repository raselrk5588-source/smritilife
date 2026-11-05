import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Heart,
  Plus,
  Bell,
  Trash2,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Settings,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface PeriodHistoryItem {
  _id?: string;
  startDate: string;
  startDateBn: string;
  cycleDays?: number;
  notes?: string;
}

interface PeriodStatus {
  hasRecord: boolean;
  cycleLength: number;
  periodDuration: number;
  reminderEnabled: boolean;
  lastPeriodStart?: string;
  nextExpectedDate?: string;
  lastPeriodBn?: string;
  nextExpectedBn?: string;
  currentCycleDay?: number;
  daysRemaining?: number;
  isLate?: boolean;
  lateDays?: number;
  phaseKey?: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'late';
  phaseLabelBn?: string;
  phaseAdviceBn?: string;
  history: PeriodHistoryItem[];
}

const toBnDigits = (val: number | string | undefined): string => {
  if (val === undefined || val === null) return '০';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, d => bn[parseInt(d, 10)] || d);
};

export default function PeriodTracker() {
  const [status, setStatus] = useState<PeriodStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form states
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/period`);
      if (res.ok) {
        const data = await res.json();
        if (data?.status) {
          setStatus(data.status);
          setCycleLength(data.status.cycleLength || 28);
          setPeriodDuration(data.status.periodDuration || 5);
          setReminderEnabled(data.status.reminderEnabled !== false);
        }
      }
    } catch (err) {
      console.error('Error loading period status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleQuickLogToday = async () => {
    try {
      setSubmitting(true);
      const todayIso = new Date().toISOString().split('T')[0];
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/period/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: todayIso,
          cycleLength,
          periodDuration
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        toast.success('আজকের তারিখ সফলভাবে সেভ করা হয়েছে!');
      } else {
        toast.error('সেভ করতে সমস্যা হয়েছে');
      }
    } catch (e) {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/period/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedDate,
          cycleLength,
          periodDuration,
          notes: notes.trim() || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setShowLogModal(false);
        setNotes('');
        toast.success('পিরিয়ড শুরুর তারিখ সেভ হয়েছে!');
      } else {
        toast.error('সেভ করতে সমস্যা হয়েছে');
      }
    } catch (e) {
      toast.error('নেটওয়ার্ক ত্রুটি');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/period/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleLength,
          periodDuration,
          reminderEnabled
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setShowSettingsModal(false);
        toast.success('সাইকেল সেটিংস আপডেট হয়েছে!');
      }
    } catch (e) {
      toast.error('আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/period/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        toast.success('তারিখটি মুছে ফেলা হয়েছে');
      }
    } catch (e) {
      toast.error('ডিলিট করতে সমস্যা হয়েছে');
    }
  };

  const progressPercent = status?.hasRecord
    ? Math.min(100, Math.round(((status.currentCycleDay || 1) / (status.cycleLength || 28)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#f6f8f9] pb-24">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-5">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-700 via-pink-600 to-fuchsia-700 text-white p-5 sm:p-7 shadow-lg">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-bold mb-2.5">
                <Heart className="w-3.5 h-3.5 fill-rose-200 text-rose-200" />
                <span>নারীদের ব্যক্তিগত স্বাস্থ্য ও সাইকেল সহকারী</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                🌸 পিরিয়ড ও সাইকেল ডে কাউন্টার
              </h1>
              <p className="text-xs sm:text-sm text-rose-100 mt-1 max-w-xl">
                মাসিক সাইকেলের দিন গণনা, পরবর্তী সম্ভাব্য তারিখ এবং ২ দিন আগে গোপনীয় হোয়াটসঅ্যাপ রিমাইন্ডার।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleQuickLogToday}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>আজ শুরু হয়েছে</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 text-white border border-white/25 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>তারিখ যুক্ত করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="সাইকেল সেটিংস"
                className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Day Count & Next Date Cards */}
        {loading ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm font-medium shadow-xs border border-slate-100">
            লোড হচ্ছে...
          </div>
        ) : !status?.hasRecord ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 text-center shadow-xs border border-rose-100 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                আপনার সর্বশেষ পিরিয়ড শুরুর তারিখটি যুক্ত করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                সর্বশেষ কবে শুরু হয়েছিল তা সেভ করলেই স্মৃতি লাইফ স্বয়ংক্রিয়ভাবে আজ কততম দিন চলছে এবং পরবর্তী তারিখ কবে তা হিসাব করে রাখবে।
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleQuickLogToday}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                আজ থেকে শুরু হয়েছে
              </button>
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm border border-rose-200 transition cursor-pointer"
              >
                আগের তারিখ সিলেক্ট করুন
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Live Cycle Day Counter */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-rose-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">বর্তমান সাইকেল ডে কাউন্ট</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                  গড় সাইকেল: {toBnDigits(status.cycleLength)} দিন
                </span>
              </div>

              <div className="my-4 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-rose-600">
                  দিন {toBnDigits(status.currentCycleDay)}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  / {toBnDigits(status.cycleLength)} দিন
                </span>
              </div>

              <div>
                <div className="w-full h-2.5 bg-rose-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  📅 সর্বশেষ শুরু: <span className="text-slate-900 font-bold">{status.lastPeriodBn}</span>
                </p>
              </div>
            </div>

            {/* Card 2: Next Expected Date & Countdown */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-pink-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">পরবর্তী সম্ভাব্য তারিখ</span>
                <Clock className="w-4 h-4 text-pink-500" />
              </div>

              <div className="my-4">
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {status.nextExpectedBn}
                </div>
                {status.isLate && (status.lateDays || 0) > 0 ? (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{toBnDigits(status.lateDays)} দিন ওভারডিউ (দেরি চলছে)</span>
                  </div>
                ) : status.daysRemaining === 0 ? (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                    <Bell className="w-3.5 h-3.5" />
                    <span>আজ সম্ভাব্য তারিখ!</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <span>আর {toBnDigits(status.daysRemaining)} দিন বাকি</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>🔔 ২ দিন আগে হোয়াটসঅ্যাপ অ্যালার্ট</span>
                <span className={`font-bold ${status.reminderEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {status.reminderEnabled ? 'চালু আছে' : 'বন্ধ'}
                </span>
              </div>
            </div>

            {/* Card 3: Current Phase & Wellness Tip */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-purple-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">বর্তমান অবস্থা ও পরামর্শ</span>
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>

              <div className="my-3">
                <div className="text-sm sm:text-base font-extrabold text-purple-700">
                  {status.phaseLabelBn}
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {status.phaseAdviceBn}
                </p>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                🔒 আপনার তথ্য সম্পূর্ণ ব্যক্তিগত ও সুরক্ষিত
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Instant Usage Banner */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                হোয়াটসঅ্যাপে সরাসরি মেসেজ দিয়েও হিসাব রাখুন!
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                লিখুন: <span className="font-bold text-rose-600">"আজ থেকে পিরিয়ড শুরু"</span>, <span className="font-bold text-rose-600">"৫ তারিখ পিরিয়ড শুরু হয়েছে"</span> অথবা <span className="font-bold text-rose-600">"পিরিয়ডের কত দিন চলছে?"</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 self-start sm:self-center shrink-0">
            অটোমেটিক সিঙ্ক হবে
          </span>
        </div>

        {/* History List */}
        {status?.history && status.history.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" />
              <span>পূর্ববর্তী পিরিয়ড শুরুর তারিখসমূহ ({toBnDigits(status.history.length)}টি)</span>
            </h3>
            <div className="divide-y divide-slate-100">
              {status.history.map((item, idx) => (
                <div key={item._id || idx} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">
                        🌸 {item.startDateBn}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                          সর্বশেষ
                        </span>
                      )}
                      {item.cycleDays && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          সাইকেল: {toBnDigits(item.cycleDays)} দিন
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  {item._id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(item._id!)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Log Period Date */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">🌸 পিরিয়ড শুরুর তারিখ যুক্ত করুন</h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCustomLogSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শুরুর তারিখ (Start Date)
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নোট বা লক্ষণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="যেমন: হালকা পেট ব্যথা বা স্বাভাবিক..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Cycle Settings */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">⚙️ সাইকেল ও রিমাইন্ডার সেটিংস</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  গড় সাইকেল দৈর্ঘ্য (সাধারণত ২৮–৩০ দিন)
                </label>
                <input
                  type="number"
                  min={20}
                  max={42}
                  value={cycleLength}
                  onChange={e => setCycleLength(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পিরিয়ড স্থায়িত্বকাল (সাধারণত ৪–৬ দিন)
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={periodDuration}
                  onChange={e => setPeriodDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-700">
                  পরবর্তী সম্ভাব্য তারিখের ২ দিন আগে হোয়াটসঅ্যাপে গোপনীয় রিমাইন্ডার পাঠান
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
