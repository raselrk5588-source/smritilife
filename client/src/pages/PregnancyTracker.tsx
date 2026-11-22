import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Baby,
  Calendar,
  Heart,
  Sparkles,
  Activity,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Stethoscope,
  Bell,
  Scale,
  Smile,
  AlertCircle,
  HelpCircle,
  Share2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PREGNANCY_WEEKS, type IPregnancyWeekInfo } from '../data/pregnancyMilestones';

interface IKickLog {
  _id?: string;
  date: string;
  count: number;
  durationMinutes?: number;
  notes?: string;
}

interface IDoctorVisit {
  _id?: string;
  date: string;
  title: string;
  doctorName?: string;
  notes?: string;
  isCompleted: boolean;
}

interface IPregnancyData {
  _id: string;
  userId: string;
  status: 'active' | 'delivered' | 'completed' | 'paused';
  method: 'lmp' | 'dueDate' | 'conception';
  lmpDate?: string;
  dueDate: string;
  babyNickname: string;
  weeklyReminderEnabled: boolean;
  kickLogs: IKickLog[];
  doctorVisits: IDoctorVisit[];
}

interface IStats {
  totalDays: number;
  currentWeek: number;
  currentDayInWeek: number;
  daysRemaining: number;
  trimester: 1 | 2 | 3;
  progressPercent: number;
}

export default function PregnancyTracker() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pregnancy, setPregnancy] = useState<IPregnancyData | null>(null);
  const [stats, setStats] = useState<IStats | null>(null);

  // Setup Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupMethod, setSetupMethod] = useState<'lmp' | 'dueDate'>('lmp');
  const [lmpDateInput, setLmpDateInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('সোনামণি');
  const [savingSetup, setSavingSetup] = useState(false);

  // Active view week (allows exploring weeks 1-40)
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'kicks' | 'visits'>('overview');

  // Kick Counter State
  const [currentSessionKicks, setCurrentSessionKicks] = useState(0);
  const [kickTimerSeconds, setKickTimerSeconds] = useState(0);
  const [isKickTimerRunning, setIsKickTimerRunning] = useState(false);
  const [savingKick, setSavingKick] = useState(false);

  // Doctor Visit Modal State
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitTitle, setVisitTitle] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitDoctor, setVisitDoctor] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);

  // Digits helper
  const enToBnDigits = (n: number | string): string => {
    const bnNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return n.toString().replace(/\d/g, (d) => bnNums[d] || d);
  };

  // Fetch pregnancy profile
  const fetchPregnancy = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pregnancy) {
          setPregnancy(data.pregnancy);
          setStats(data.stats);
          setSelectedWeek(data.stats.currentWeek || 1);
        } else {
          setPregnancy(null);
          setShowSetupModal(true);
        }
      }
    } catch (err) {
      console.error('Error fetching pregnancy:', err);
      toast.error('তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPregnancy();
  }, []);

  // Kick Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isKickTimerRunning) {
      interval = setInterval(() => {
        setKickTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isKickTimerRunning]);

  // Handle Setup Submit
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupMethod === 'lmp' && !lmpDateInput) {
      toast.error('দয়া করে শেষ পিরিয়ডের তারিখ (LMP) দিন');
      return;
    }
    if (setupMethod === 'dueDate' && !dueDateInput) {
      toast.error('দয়া করে প্রসবের সম্ভাব্য তারিখ (EDD) দিন');
      return;
    }

    try {
      setSavingSetup(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          method: setupMethod,
          lmpDate: setupMethod === 'lmp' ? lmpDateInput : undefined,
          dueDate: setupMethod === 'dueDate' ? dueDateInput : undefined,
          babyNickname: nicknameInput || 'সোনামণি'
        })
      });

      if (res.ok) {
        toast.success('মাতৃত্ব ট্র্যাকার সফলভাবে কনফিগার হয়েছে! 🌸');
        setShowSetupModal(false);
        fetchPregnancy();
      } else {
        const err = await res.json();
        toast.error(err.message || 'সেটআপ ব্যর্থ হয়েছে');
      }
    } catch (e) {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setSavingSetup(false);
    }
  };

  // Kick Counter: Tap Kick
  const handleKickTap = () => {
    if (!isKickTimerRunning) {
      setIsKickTimerRunning(true);
    }
    const newCount = currentSessionKicks + 1;
    setCurrentSessionKicks(newCount);
    if (newCount === 10) {
      toast.success('🎉 চমৎকার! বাবু ১০টি কিক সম্পন্ন করেছে!', { icon: '👶' });
    }
  };

  // Save Kick Log
  const handleSaveKickSession = async () => {
    if (currentSessionKicks === 0) {
      toast.error('অন্তত ১টি কিক রেকর্ড করুন');
      return;
    }
    try {
      setSavingKick(true);
      const token = localStorage.getItem('token');
      const durationMins = Math.max(1, Math.round(kickTimerSeconds / 60));
      const res = await fetch('/api/pregnancy/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          count: currentSessionKicks,
          durationMinutes: durationMins
        })
      });

      if (res.ok) {
        toast.success('কিক রেকর্ড সংরক্ষিত হয়েছে! 👶');
        setCurrentSessionKicks(0);
        setKickTimerSeconds(0);
        setIsKickTimerRunning(false);
        fetchPregnancy();
      } else {
        toast.error('কিক রেকর্ড সংরক্ষণ করা যায়নি');
      }
    } catch (e) {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setSavingKick(false);
    }
  };

  // Handle Add Doctor Visit
  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitTitle || !visitDate) {
      toast.error('বিষয় ও তারিখ দিন');
      return;
    }

    try {
      setSavingVisit(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy/visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: visitTitle,
          date: visitDate,
          doctorName: visitDoctor,
          notes: visitNotes
        })
      });

      if (res.ok) {
        toast.success('ডাক্তারের ভিজিট সফলভাবে সেভ হয়েছে! 🩺');
        setShowVisitModal(false);
        setVisitTitle('');
        setVisitDate('');
        setVisitDoctor('');
        setVisitNotes('');
        fetchPregnancy();
      } else {
        toast.error('ভিজিট সেভ করা যায়নি');
      }
    } catch (e) {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setSavingVisit(false);
    }
  };

  // Toggle Doctor Visit Completed
  const handleToggleVisit = async (visit: IDoctorVisit) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy/visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          visitId: visit._id,
          title: visit.title,
          date: visit.date,
          doctorName: visit.doctorName,
          notes: visit.notes,
          isCompleted: !visit.isCompleted
        })
      });
      if (res.ok) {
        toast.success(visit.isCompleted ? 'ভিজিট আনমার্ক করা হয়েছে' : 'ভিজিট সম্পন্ন হয়েছে! ✅');
        fetchPregnancy();
      }
    } catch (e) {
      toast.error('আপডেট করতে সমস্যা হয়েছে');
    }
  };

  // Delete Doctor Visit
  const handleDeleteVisit = async (visitId: string) => {
    if (!window.confirm('আপনি কি এই ভিজিটটি মুছে ফেলতে চান?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pregnancy/visit/${visitId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('ভিজিট মুছে ফেলা হয়েছে');
        fetchPregnancy();
      }
    } catch (e) {
      toast.error('মুছে ফেলা যায়নি');
    }
  };

  // Toggle WhatsApp Weekly Alert
  const handleToggleWeeklyAlert = async () => {
    if (!pregnancy) return;
    const nextVal = !pregnancy.weeklyReminderEnabled;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ weeklyReminderEnabled: nextVal })
      });
      if (res.ok) {
        setPregnancy({ ...pregnancy, weeklyReminderEnabled: nextVal });
        toast.success(nextVal ? 'হোয়াটসঅ্যাপ সাপ্তাহিক বার্তা সক্রিয় হয়েছে! 📱' : 'বার্তা বন্ধ করা হয়েছে');
      }
    } catch (e) {
      toast.error('আপডেট করা যায়নি');
    }
  };

  // Reset Pregnancy
  const handleResetPregnancy = async () => {
    if (!window.confirm('আপনি কি মাতৃত্ব ট্র্যাকার রিসেট করতে চান? সব তথ্য মুছে যাবে।')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pregnancy', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('মাতৃত্ব ট্র্যাকার রিসেট করা হয়েছে');
        navigate('/app/period');
      }
    } catch (e) {
      toast.error('রিসেট করা যায়নি');
    }
  };

  // Get selected week info
  const weekInfo: IPregnancyWeekInfo = PREGNANCY_WEEKS[selectedWeek] || PREGNANCY_WEEKS[1];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-12 h-12 rounded-full border-4 border-rose-200 border-t-rose-500 animate-spin mb-3"></div>
        <p className="text-sm font-semibold">মাতৃত্বের তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-24 md:pb-12 bg-gradient-to-b from-rose-50/60 via-pink-50/30 to-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100 shadow-xs px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="p-1.5 rounded-full hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition cursor-pointer"
              title="হোমে ফিরে যান"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1">
                  <span>মাতৃত্ব কেয়ার</span>
                  <span className="text-rose-500">🌸</span>
                </span>
                {stats && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100/80 text-rose-700">
                    সপ্তাহ {enToBnDigits(stats.currentWeek || 1)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">স্মৃতি লাইফ প্রেগন্যান্সি ট্র্যাকার</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetupModal(true)}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition active:scale-95 cursor-pointer"
            >
              {pregnancy ? 'ইডিট' : 'সেটআপ'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* HERO CARD: Gestational Age & Baby Size */}
        {pregnancy && stats && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white p-5 sm:p-6 shadow-xl shadow-rose-500/15">
            {/* Background glowing circles */}
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-pink-300/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col gap-4">
              {/* Nickname & Days Remaining */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold">
                  <span>👶 {pregnancy.babyNickname || 'সোনামণি'}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-rose-100">প্রসবের বাকি: </span>
                  <span className="text-sm font-black text-white">{enToBnDigits(stats.daysRemaining)} দিন</span>
                </div>
              </div>

              {/* Central Week Display */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                    {enToBnDigits(stats.currentWeek)} <span className="text-lg font-bold">সপ্তাহ</span> {enToBnDigits(stats.currentDayInWeek)} <span className="text-lg font-bold">দিন</span>
                  </h2>
                  <p className="text-xs text-rose-100 font-medium mt-0.5">
                    {stats.trimester === 1 ? '১ম ট্রাইমেস্টার (১-১৩ সপ্তাহ)' : stats.trimester === 2 ? '২য় ট্রাইমেস্টার (১৪-২৭ সপ্তাহ)' : '৩য় ট্রাইমেস্টার (২৮-৪০ সপ্তাহ)'}
                  </p>
                </div>

                {/* Fruit / Veggie Badge */}
                <div className="bg-white/95 text-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center shadow-lg shrink-0 min-w-[95px] text-center">
                  <span className="text-3xl mb-0.5 animate-bounce">{PREGNANCY_WEEKS[stats.currentWeek]?.fruitEmoji || '👶'}</span>
                  <span className="text-[10px] font-black text-rose-600 line-clamp-1 leading-tight">
                    {PREGNANCY_WEEKS[stats.currentWeek]?.sizeComparison.split(' ')[1] || 'বাবু'}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">এর সমান</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-100 mb-1.5">
                  <span>অগ্রগতি</span>
                  <span>{enToBnDigits(stats.progressPercent)}% সম্পন্ন</span>
                </div>
                <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(5, stats.progressPercent))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-medium text-rose-100/80 mt-1">
                  <span>১ম সপ্তাহ</span>
                  <span>২০ সপ্তাহ (অর্ধেক)</span>
                  <span>৪০ সপ্তাহ (প্রসব)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Banner when not yet configured */}
        {!pregnancy && (
          <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-rose-500/15 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-xs shrink-0">
                  👶
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    মাতৃত্ব কেয়ারে আপনাকে স্বাগতম! 🌸
                  </h3>
                  <p className="text-xs text-rose-100 mt-0.5 max-w-md">
                    আপনার শেষ পিরিয়ডের তারিখ (LMP) বা ডেলিভারির তারিখ দিয়ে বাচ্চার বয়স ও সাপ্তাহিক বিকাশ ট্র্যাক করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(true)}
                className="px-5 py-2.5 rounded-xl bg-white text-rose-600 hover:bg-rose-50 text-xs sm:text-sm font-black shadow-md transition active:scale-95 shrink-0 cursor-pointer"
              >
                সেটআপ করুন ✨
              </button>
            </div>
          </div>
        )}

        {/* WEEK HORIZONTAL SCROLL SELECTOR */}
        <div className="bg-white rounded-2xl p-3 border border-rose-100 shadow-2xs">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>সপ্তাহ অনুযায়ী তথ্য দেখুন (১ - ৪০)</span>
            </span>
            {stats && selectedWeek !== stats.currentWeek && (
              <button
                onClick={() => setSelectedWeek(stats.currentWeek)}
                className="text-[11px] font-bold text-rose-600 hover:underline"
              >
                বর্তমান সপ্তাহে যান ({enToBnDigits(stats.currentWeek)})
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
            {Array.from({ length: 40 }, (_, i) => i + 1).map((wk) => {
              const isCurrent = stats?.currentWeek === wk;
              const isSelected = selectedWeek === wk;
              const emoji = PREGNANCY_WEEKS[wk]?.fruitEmoji || '🌱';
              return (
                <button
                  key={wk}
                  onClick={() => setSelectedWeek(wk)}
                  className={`snap-start shrink-0 px-3 py-2 rounded-xl text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-105'
                      : isCurrent
                      ? 'bg-rose-100 text-rose-700 border-2 border-rose-400 font-bold'
                      : 'bg-slate-50 text-slate-600 hover:bg-rose-50 border border-slate-100'
                  }`}
                >
                  <div className="text-base leading-none mb-1">{emoji}</div>
                  <div className="text-[10px] font-black">{enToBnDigits(wk)}</div>
                  <div className="text-[8px] font-medium opacity-80">সপ্তাহ</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-2xl border border-rose-100 shadow-2xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'overview'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>সাপ্তাহিক বিকাশ</span>
          </button>

          <button
            onClick={() => setActiveTab('kicks')}
            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'kicks'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>কিক কাউন্টার</span>
          </button>

          <button
            onClick={() => setActiveTab('visits')}
            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'visits'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>ডাক্তার ভিজিট</span>
          </button>
        </div>

        {/* TAB 1: WEEKLY OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Week Highlight Card */}
            <div className="bg-white rounded-3xl p-5 border border-rose-100/80 shadow-sm">
              <div className="flex items-center gap-3.5 mb-4 pb-3.5 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-100 to-pink-50 flex items-center justify-center text-3xl shadow-2xs shrink-0">
                  {weekInfo.fruitEmoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                      সপ্তাহ {enToBnDigits(weekInfo.week)}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {weekInfo.trimester === 1 ? '১ম ট্রাইমেস্টার' : weekInfo.trimester === 2 ? '২য় ট্রাইমেস্টার' : '৩য় ট্রাইমেস্টার'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
                    বাবু এখন {weekInfo.sizeComparison}-এর সমান!
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-semibold">
                    <span>📏 দৈর্ঘ্য: {weekInfo.lengthApprox}</span>
                    <span>⚖️ ওজন: {weekInfo.weightApprox}</span>
                  </div>
                </div>
              </div>

              {/* 3 Detail Boxes */}
              <div className="space-y-3">
                {/* 1. Baby Development */}
                <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-700 mb-1">
                    <Baby className="w-4 h-4 text-rose-500" />
                    <span>শিশুর শারীরিক বিকাশ:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {weekInfo.babyDevelopment}
                  </p>
                </div>

                {/* 2. Mom's Body Changes */}
                <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 mb-1">
                    <Heart className="w-4 h-4 text-amber-600" />
                    <span>মায়ের শরীরের পরিবর্তন ও লক্ষণ:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {weekInfo.momBodyChanges}
                  </p>
                </div>

                {/* 3. Nutrition & Health Tips */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 mb-1">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>এই সপ্তাহের পরামর্শ ও যত্ন:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {weekInfo.tips}
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Weekly Notification Control */}
            {pregnancy && (
              <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0A7756] flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">WhatsApp-এ সাপ্তাহিক বেবি আপডেট</h4>
                    <p className="text-[10px] text-slate-400">প্রতি সপ্তাহের শুরুতে বাবুর সাইজ ও পুষ্টি টিপস পাঠাবে</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleWeeklyAlert}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                    pregnancy.weeklyReminderEnabled ? 'bg-[#0A7756]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      pregnancy.weeklyReminderEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        )}

        

        {/* TAB 2: KICK COUNTER */}
        {activeTab === 'kicks' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Interactive Pulse Kick Button Card */}
            <div className="bg-white rounded-3xl p-6 border border-rose-100 text-center shadow-sm">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold mb-3">
                <Activity className="w-3.5 h-3.5" />
                <span>আজকের সেশন কিক কাউন্টার</span>
              </div>

              {/* Big Tap Button */}
              <div className="flex flex-col items-center justify-center my-3">
                <button
                  type="button"
                  onClick={handleKickTap}
                  className="relative group w-36 h-36 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-8 ring-rose-100"
                >
                  <span className="text-4xl mb-1 group-active:scale-125 transition-transform">🦶</span>
                  <span className="text-2xl font-black">{enToBnDigits(currentSessionKicks)}</span>
                  <span className="text-[10px] font-bold text-rose-100">ট্যাপ করুন</span>
                </button>
              </div>

              {/* Timer info */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-semibold mt-4">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  সময় অতিবাহিত: {enToBnDigits(Math.floor(kickTimerSeconds / 60))} মিনিট {enToBnDigits(kickTimerSeconds % 60)} সেকেন্ড
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                💡 চিকিৎসকদের মতে, ২ ঘণ্টার মধ্যে ১০টি কিক বা মুভমেন্ট গণনা করা শিশুর সুস্থতার ভালো লক্ষণ।
              </p>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveKickSession}
                  disabled={currentSessionKicks === 0 || savingKick}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingKick ? 'সংরক্ষণ হচ্ছে...' : 'সেশন সেভ করুন ✅'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentSessionKicks(0);
                    setKickTimerSeconds(0);
                    setIsKickTimerRunning(false);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition active:scale-95"
                >
                  রিসেট
                </button>
              </div>
            </div>

            {/* Past Kick Logs */}
            <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-2xs">
              <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center justify-between">
                <span>পূর্ববর্তী কিক রেকর্ডসমূহ</span>
                <span className="text-[10px] text-slate-400 font-normal">সর্বশেষ রেকর্ড</span>
              </h4>

              {pregnancy?.kickLogs && pregnancy.kickLogs.length > 0 ? (
                <div className="space-y-2">
                  {pregnancy.kickLogs.slice(0, 10).map((log, idx) => (
                    <div
                      key={log._id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 border border-rose-100/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">👶</span>
                        <div>
                          <span className="font-bold text-slate-800">{enToBnDigits(log.count)} টি কিক</span>
                          {log.durationMinutes && (
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({enToBnDigits(log.durationMinutes)} মিনিটে)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(log.date).toLocaleDateString('bn-BD', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  এখনো কোনো কিক রেকর্ড করা হয়নি। উপরের বাটনে চাপ দিয়ে শুরু করুন।
                </div>
              )}
            </div>
          </div>
        )}

        

        {/* TAB 3: DOCTOR VISITS */}
        {activeTab === 'visits' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-800">ডাক্তার ভিজিট ও টেস্ট শিডিউল</h4>
                <p className="text-[11px] text-slate-400">গুরুত্বপূর্ণ চেকআপ ও আল্ট্রাসাউন্ডের তালিকা</p>
              </div>

              <button
                type="button"
                onClick={() => setShowVisitModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন ভিজিট</span>
              </button>
            </div>

            {/* Visits List */}
            {pregnancy?.doctorVisits && pregnancy.doctorVisits.length > 0 ? (
              <div className="space-y-2.5">
                {pregnancy.doctorVisits.map((visit) => (
                  <div
                    key={visit._id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      visit.isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200/80 text-slate-600'
                        : 'bg-white border-rose-100 shadow-2xs text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleVisit(visit)}
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition ${
                            visit.isCompleted
                              ? 'bg-emerald-500 text-white'
                              : 'border-2 border-slate-300 hover:border-rose-400'
                          }`}
                        >
                          {visit.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h5 className={`text-xs sm:text-sm font-bold ${visit.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {visit.title}
                          </h5>
                          {visit.doctorName && (
                            <p className="text-[11px] text-slate-500 mt-0.5">🩺 {visit.doctorName}</p>
                          )}
                          {visit.notes && (
                            <p className="text-[11px] text-slate-500 mt-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              📝 {visit.notes}
                            </p>
                          )}
                          <p className="text-[10px] text-rose-600 font-semibold mt-1">
                            📅 {new Date(visit.date).toLocaleDateString('bn-BD', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => visit._id && handleDeleteVisit(visit._id)}
                        className="text-slate-300 hover:text-rose-500 p-1 transition"
                        title="মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-rose-100 text-center text-slate-400 text-xs">
                <Stethoscope className="w-8 h-8 text-rose-300 mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-slate-600 mb-1">কোনো ডাক্তারের ভিজিট নেই</p>
                <p className="text-[11px]">উপরে '+ নতুন ভিজিট' বাটনে চাপ দিয়ে আল্ট্রাসাউন্ড বা চেকআপের তারিখ যোগ করুন।</p>
              </div>
            )}
          </div>
        )}

        

        {/* BOTTOM QUICK SWITCH / RESET */}
        <div className="pt-4 pb-6 flex items-center justify-between text-xs border-t border-rose-100/80">
          <Link
            to="/app/period"
            className="text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition"
          >
            <span>🩸 পিরিয়ড কেয়ারে ফিরে যান</span>
          </Link>

          <button
            type="button"
            onClick={handleResetPregnancy}
            className="text-rose-400 hover:text-rose-600 text-[11px] font-medium transition"
          >
            মাতৃত্ব ট্র্যাকার রিসেট করুন
          </button>
        </div>
      </div>

      {/* SETUP / EDIT MODAL */}
      {showSetupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSetupModal(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌸</span>
                <div>
                  <h3 className="text-base font-black text-slate-800">মাতৃত্ব কেয়ার সেটআপ</h3>
                  <p className="text-[11px] text-slate-400">আপনার গর্ভাবস্থার সঠিক দিন হিসাব করতে দিন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              {/* Method Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSetupMethod('lmp')}
                  className={`py-2 rounded-lg transition ${
                    setupMethod === 'lmp' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  শেষ পিরিয়ডের তারিখ (LMP)
                </button>
                <button
                  type="button"
                  onClick={() => setSetupMethod('dueDate')}
                  className={`py-2 rounded-lg transition ${
                    setupMethod === 'dueDate' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  প্রসবের সম্ভাব্য তারিখ (EDD)
                </button>
              </div>

              {/* Date Input */}
              {setupMethod === 'lmp' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শেষ পিরিয়ড শুরুর তারিখ:
                  </label>
                  <input
                    type="date"
                    required
                    value={lmpDateInput}
                    onChange={(e) => setLmpDateInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500 font-sans"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    চিকিৎসা বিজ্ঞানের ন্যাগেলেস ফর্মুলা অনুযায়ী এটি থেকে স্বয়ংক্রিয়ভাবে প্রসবের তারিখ হিসাব করা হবে।
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ডাক্তার নির্ধারিত প্রসবের তারিখ (Due Date):
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDateInput}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500 font-sans"
                  />
                </div>
              )}

              {/* Baby Nickname */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বাবুর আদরের নাম বা ডাকনাম:
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সোনামণি, পুঁচকে, রাজপুত্র"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={savingSetup}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingSetup ? 'সেভ হচ্ছে...' : 'মাতৃত্ব যাত্রা শুরু করুন 💖'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  পরে করবো / বন্ধ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DOCTOR VISIT MODAL */}
      {showVisitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVisitModal(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-rose-500" />
                <span>নতুন চেকআপ বা টেস্ট যোগ করুন</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowVisitModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVisit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  চেকআপ বা টেস্টের নাম:
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: অ্যানোমালি স্ক্যান, রুটিন চেকআপ, রক্ত পরীক্ষা"
                  value={visitTitle}
                  onChange={(e) => setVisitTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ:
                </label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ডাক্তার বা হাসপাতালের নাম (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ডা. ফারহানা, পপুলার ডায়াগনস্টিক"
                  value={visitDoctor}
                  onChange={(e) => setVisitDoctor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নোটস বা ডাক্তারের পরামর্শ (ঐচ্ছিক):
                </label>
                <textarea
                  placeholder="যেমন: ওষুধ পরিবর্তন, আল্ট্রাসাউন্ড রিপোর্ট নিয়ে যেতে হবে"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {savingVisit ? 'সেভ হচ্ছে...' : 'ভিজিট সংরক্ষণ করুন 🩺'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
