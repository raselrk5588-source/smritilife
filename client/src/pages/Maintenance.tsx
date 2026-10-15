import React, { useState, useEffect } from 'react';
import { Wrench, Clock, RefreshCw, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MaintenanceProps {
  title?: string;
  message?: string;
  estimatedTime?: string;
  onRefresh?: () => void;
}

export default function Maintenance({
  title = 'স্মৃতি • সিস্টেম আপডেট চলছে',
  message = 'স্মৃতিকে আরও দ্রুত ও উন্নত করার কাজ চলছে। কিছুক্ষণের মধ্যেই সিস্টেমটি পুরোপুরি সচল হবে।',
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
    <div className="min-h-screen bg-[#060b11] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-emerald-600/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-cyan-600/15 rounded-full blur-[90px] pointer-events-none" />

      {/* Main compact card */}
      <div className="relative z-10 max-w-[390px] w-full bg-[#0d1722]/90 backdrop-blur-2xl border border-emerald-500/25 rounded-3xl p-6 text-center shadow-2xl shadow-black/70 animate-in fade-in duration-300">
        {/* Compact Icon */}
        <div className="w-13 h-13 mx-auto mb-3 bg-gradient-to-br from-emerald-500/20 to-teal-900/40 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-center shadow-md">
          <Wrench className="w-6 h-6 text-emerald-400 animate-spin" style={{ animationDuration: '10s' }} />
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-400 mb-2.5 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
          <span>আপগ্রেড চলছে</span>
        </div>

        {/* Heading */}
        <h1 className="text-lg font-bold text-white mb-2 tracking-tight leading-snug">
          {title}
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed mb-4 px-1">
          {message}
        </p>

        {/* Estimated time pill */}
        <div className="bg-slate-950/70 border border-white/5 rounded-xl px-3.5 py-2 flex items-center justify-between mb-4 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            আনুমানিক সময়
          </span>
          <span className="text-emerald-400 font-bold font-mono">
            {estimatedTime}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 active:scale-98 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'চেক করা হচ্ছে...' : 'পুনরায় চেক করুন'}
          </button>

          <a
            href="https://wa.me/8801700000000"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-semibold py-2 px-3 rounded-xl border border-white/10 text-xs flex items-center justify-center gap-1.5 transition"
          >
            <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
            WhatsApp সাপোর্ট
          </a>
        </div>

        {/* Auto refresh counter */}
        <div className="mt-3.5 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
          <span>{countdown} সেকেন্ড পর স্বয়ংক্রিয়ভাবে চেক হবে</span>
        </div>
      </div>

      {/* Footer / Admin bypass link */}
      <div className="mt-5 max-w-[390px] w-full flex items-center justify-between text-[11px] text-slate-500 px-2">
        <span>© 2026 স্মৃতি (Smriti)</span>
        <Link
          to="/admin/login"
          className="text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 font-medium"
        >
          <span>এডমিন লগইন</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
