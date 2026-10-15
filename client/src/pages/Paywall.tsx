import { useState, useEffect } from 'react';
import { CheckCircle2, Shield, Sparkles, ChevronRight, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Paywall() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  useEffect(() => {
    // Check if user's mobile number is already stored
    const savedMobile = localStorage.getItem('userMobile') || '';
    if (savedMobile) {
      setMobileNumber(savedMobile);
    }

    // Increase size by 20% for Web View only
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        document.documentElement.style.fontSize = '120%';
      } else {
        document.documentElement.style.fontSize = '';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.fontSize = '';
    };
  }, []);

  const handleStartBkashSubscription = async () => {
    // If mobile number is not yet entered and not saved, show prompt or validate
    if (!mobileNumber && !showPhoneInput) {
      setShowPhoneInput(true);
      return;
    }

    if (mobileNumber && !/^01[3-9]\d{8}$/.test(mobileNumber.trim())) {
      toast.error('সঠিক ১১ ডিজিটের বিকাশ নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    setIsProcessing(true);
    toast.loading('বিকাশ গেটওয়েতে রিডাইরেক্ট করা হচ্ছে...', { id: 'bkashRedirect' });

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const redirectUrl = `${window.location.origin}/subscription-return`;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/subscription/bkash/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          msisdn: mobileNumber.trim() || undefined,
          redirectUrl
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.authorizationUrl) {
        // Save pending request ID and phone in localStorage for correlation
        if (data.requestId) {
          localStorage.setItem('pendingBkashRequestId', data.requestId);
        }
        if (mobileNumber.trim()) {
          localStorage.setItem('pendingMsisdn', mobileNumber.trim());
          localStorage.setItem('userMobile', mobileNumber.trim());
        }

        toast.success('বিকাশ পেজে পাঠানো হচ্ছে...', { id: 'bkashRedirect' });

        // Redirect user to bdapps subscription authorization page
        window.location.href = data.authorizationUrl;
      } else {
        setIsProcessing(false);
        const errMsg = data.message || 'বিকাশ সাবস্ক্রিপশন শুরু করা যাচ্ছে না।';
        toast.error(errMsg, { id: 'bkashRedirect', duration: 5000 });
      }
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Bkash init error:', err);
      toast.error('সার্ভারের সাথে সংযোগ করা সম্ভব হয়নি। আবার চেষ্টা করুন।', { id: 'bkashRedirect' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden pb-10">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-[#e2136e] to-[#8a2f68] rounded-b-[3rem] z-0 overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "url('/theme-bg.png')", backgroundSize: 'cover' }}></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pt-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl mx-auto flex items-center justify-center mb-4 p-2.5 border border-white/60">
            <img src="/robot-icon.png" alt="SmritiLife AI" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Smriti Life Premium</h1>
          <p className="text-white/90 text-sm font-medium mt-1">আপনার সব সুন্দর স্মৃতিগুলো সুরক্ষিত রাখুন</p>
        </div>

        {/* Pricing Card */}
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 relative mb-6">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-md flex items-center tracking-wide uppercase">
            <Sparkles className="w-3 h-3 mr-1" /> সীমিত অফার
          </div>

          <div className="text-center mb-6 mt-2">
            <h2 className="text-slate-800 font-extrabold text-lg">আনলিমিটেড অ্যাক্সেস</h2>
            <p className="text-slate-500 text-xs mt-1">অ্যাপের সম্পূর্ণ ফিচার উপভোগ করতে সাবস্ক্রাইব করুন</p>
          </div>

          {/* Features List */}
          <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
            {[
              'আনলিমিটেড নোট ও রিমাইন্ডার',
              'AI ডিজিটাল গ্রিটিং কার্ড তৈরি',
              'অটোমেটিক SMS ও WhatsApp মেসেজ',
              'WhatsApp AI পার্সোনাল অ্যাসিস্ট্যান্ট',
              'দৈনিক খরচ ও ধার-বাকির খাতা'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                <span className="text-slate-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* Plan Selection */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#e2136e] bg-[#e2136e]/5">
              <div className="flex items-center">
                <div className="w-5 h-5 rounded-full border-2 border-[#e2136e] flex items-center justify-center mr-3">
                  <div className="w-2.5 h-2.5 bg-[#e2136e] rounded-full" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">মাসিক প্রিমিয়াম প্ল্যান</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">১ মাসের জন্য অ্যাক্সেস</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-[#e2136e]">৳ ১৯০</div>
              </div>
            </div>
          </div>

          {/* Customer bKash Mobile Input (Optional or Confirm) */}
          {showPhoneInput ? (
            <div className="mb-5 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                আপনার বিকাশ নম্বর (ঐচ্ছিক / সুবিধার্থে)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#e2136e] focus:ring-1 focus:ring-[#e2136e]"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                নম্বর দিলে বিকাশ পেজে নম্বরটি স্বয়ংক্রিয়ভাবে বসে যাবে।
              </p>
            </div>
          ) : (
            <div className="mb-4 text-center">
              <button
                type="button"
                onClick={() => setShowPhoneInput(true)}
                className="text-xs text-slate-500 hover:text-[#e2136e] font-semibold transition underline decoration-dotted"
              >
                {mobileNumber ? `বিকাশ নম্বর: ${mobileNumber} (পরিবর্তন করুন)` : '+ বিকাশ নম্বর যোগ করুন (ঐচ্ছিক)'}
              </button>
            </div>
          )}

          {/* bKash Payment Button */}
          <button
            onClick={handleStartBkashSubscription}
            disabled={isProcessing}
            className="w-full relative overflow-hidden rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center bg-[#e2136e] hover:bg-[#c91061] active:scale-95 hover:shadow-[#e2136e]/30 hover:-translate-y-0.5 h-14 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>বিকাশ পেজে লোড হচ্ছে...</span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-5">
                <span className="flex items-center tracking-wide text-[15px]">
                  বিকাশ দিয়ে সাবস্ক্রাইব করুন
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                  <span>৳ ১৯০</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </button>

          <div className="mt-4 flex items-center justify-center text-[10px] text-slate-400 font-medium gap-1">
            <Shield className="w-3 h-3 text-[#e2136e]" />
            <span>bdapps bKash Charging SDK দ্বারা সুরক্ষিত</span>
          </div>
        </div>

        <Link to="/" className="text-slate-400 text-xs font-bold hover:text-slate-600 transition flex items-center">
          আপাতত স্কিপ করুন <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>
    </div>
  );
}
