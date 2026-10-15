import React, { useState, useEffect } from 'react';
import { Wrench, Clock, RefreshCw, MessageCircle, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MaintenanceProps {
  title?: string;
  message?: string;
  estimatedTime?: string;
  onRefresh?: () => void;
}

export default function Maintenance({
  title = 'স্মৃতিতে রক্ষণাবেক্ষণ ও আপগ্রেডেশনের কাজ চলছে',
  message = 'স্মৃতিকে আরও দ্রুত, নিরাপদ ও উন্নত করতে বর্তমানে সিস্টেমে প্রয়োজনীয় আপগ্রেড করা হচ্ছে। সাময়িক অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত। খুব শীঘ্রই সিস্টেমটি আবার পুরোদমে সচল হবে।',
  estimatedTime = '১৫ - ২০ মিনিট',
  onRefresh
}: MaintenanceProps) {
  const [countdown, setCountdown] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    } else {
      window.location.reload();
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (onRefresh) onRefresh();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefresh]);

  return (
    <div className="min-h-screen bg-[#070d14] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none font-sans">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-600/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/20 rounded-full blur-[110px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 max-w-lg w-full bg-[#0d1826]/85 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6 sm:p-10 text-center shadow-2xl shadow-black/60 transition-all">
        {/* Animated icon */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 rounded-full blur-xl animate-pulse" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-900/60 border border-emerald-500/40 rounded-2xl flex items-center justify-center shadow-lg">
            <Wrench className="w-10 h-10 text-emerald-400 animate-spin" style={{ animationDuration: '14s' }} />
          </div>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-400 mb-5 tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
          <span>সিস্টেম আপগ্রেডেশন মোড সক্রিয়</span>
        </div>

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight leading-snug">
          {title}
        </h1>

        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed mb-6 font-normal">
          {message}
        </p>

        {/* Estimated time */}
        <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4 flex items-center justify-between mb-6 text-sm">
          <span className="text-slate-400 flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4 text-emerald-400" />
            আনুমানিক সময়
          </span>
          <span className="text-emerald-400 font-bold font-mono text-base">
            {estimatedTime}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'চেক করা হচ্ছে...' : 'পুনরায় চেক করুন (Check Status)'}
          </button>

          <a
            href="https://wa.me/8801700000000"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-3 px-6 rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            জরুরি প্রয়োজনে WhatsApp সাপোর্ট
          </a>
        </div>

        {/* Auto refresh counter */}
        <div className="mt-5 text-xs text-slate-500 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
          <span>প্রতি {countdown} সেকেন্ড পর পর স্বয়ংক্রিয়ভাবে চেক করা হচ্ছে</span>
        </div>
      </div>

      {/* Footer / Admin bypass link */}
      <div className="mt-8 max-w-lg w-full flex items-center justify-between text-xs text-slate-500 px-3">
        <span>© 2026 স্মৃতি (Smriti)</span>
        <Link
          to="/admin/login"
          className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 font-medium"
        >
          <span>এডমিন লগইন</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
