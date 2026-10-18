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

    // Adjust font size for web view
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        document.documentElement.style.fontSize = '115%';
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

  // Unified Subscription Handler (bKash & Robi via bdapps Charging SDK)
  const handleStartSubscription = async () => {
    const cleanMobile = mobileNumber.trim();
    if (!cleanMobile || !/^01[3-9]\d{8}$/.test(cleanMobile)) {
      toast.error('অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    setIsProcessing(true);
    toast.loading('পেমেন্ট গেটওয়েতে পাঠানো হচ্ছে...', { id: 'gatewayRedirect' });

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
        if (data.requestId) {
          localStorage.setItem('pendingBkashRequestId', data.requestId);
        }
        if (mobileNumber.trim()) {
          localStorage.setItem('pendingMsisdn', mobileNumber.trim());
          localStorage.setItem('userMobile', mobileNumber.trim());
        }

        toast.success('গেটওয়ে পেজে নিয়ে যাওয়া হচ্ছে...', { id: 'gatewayRedirect' });
        window.location.href = data.authorizationUrl;
      } else {
        setIsProcessing(false);
        const errMsg = data.message || 'সাবস্ক্রিপশন শুরু করা যাচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।';
        toast.error(errMsg, { id: 'gatewayRedirect', duration: 5000 });
      }
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Subscription init error:', err);
      toast.error('সার্ভারের সাথে সংযোগ করা সম্ভব হয়নি। আবার চেষ্টা করুন।', { id: 'gatewayRedirect' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden pb-10">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-[42vh] bg-gradient-to-b from-[#0A7756] via-[#086146] to-[#043d2c] rounded-b-[3.5rem] z-0 overflow-hidden shadow-xl">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "url('/theme-bg.png')", backgroundSize: 'cover' }}></div>
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl"></div>
        <div className="absolute top-24 -left-16 w-56 h-56 bg-amber-400/20 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pt-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl mx-auto flex items-center justify-center mb-3 p-2.5 border border-white/60">
            <img src="/robot-icon.png" alt="SmritiLife AI" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">Smriti Life Premium</h1>
          <p className="text-emerald-100 text-xs sm:text-sm font-medium mt-1">আপনার সব সুন্দর স্মৃতি ও প্রয়োজনীয় হিসাব সুরক্ষিত রাখুন</p>
        </div>

        {/* Pricing Card */}
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 relative mb-6">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-md flex items-center tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> সীমিত সময়ের অফার
          </div>

          <div className="text-center mb-5 mt-2">
            <h2 className="text-slate-800 font-black text-lg">আনলিমিটেড প্রিমিয়াম অ্যাক্সেস</h2>
            <p className="text-slate-500 text-xs mt-1">সব ফিচার সম্পূর্ণ আনলক করতে সাবস্ক্রাইব করুন</p>
          </div>

          {/* Features List */}
          <div className="space-y-2.5 mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-100/70">
            {[
              'আনলিমিটেড নোট ও ভয়েস রিমাইন্ডার',
              'AI ডিজিটাল শুভেচ্ছা কার্ড তৈরি',
              'অটোমেটিক SMS ও WhatsApp বার্তা',
              'WhatsApp AI পার্সোনাল অ্যাসিস্ট্যান্ট',
              'দৈনিক খরচ ও ধার-বাকির খাতা'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                <span className="text-slate-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* Plan Details Card */}
          <div className="mb-5 p-4 rounded-2xl border-2 border-[#0A7756] bg-emerald-50/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-extrabold text-slate-800 text-sm">
                  মাসিক প্রিমিয়াম প্ল্যান
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  ১ মাসের জন্য সম্পূর্ণ অ্যাক্সেস
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-lg text-[#0A7756]">
                  ৳ ১৯০
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  / মাস
                </div>
              </div>
            </div>

            {/* Payment Method Badges */}
            <div className="pt-2 border-t border-emerald-100/80 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                পেমেন্ট মাধ্যম:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-[#e2136e]/10 text-[#e2136e] px-2 py-0.5 rounded-md text-[11px] font-bold border border-[#e2136e]/20">
                  🌸 বিকাশ
                </span>
                <span className="inline-flex items-center gap-1 bg-[#e31b23]/10 text-[#e31b23] px-2 py-0.5 rounded-md text-[11px] font-bold border border-[#e31b23]/20">
                  🔴 রবি / এয়ারটেল
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Number Input Field */}
          <div className="mb-4 text-left">
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              আপনার মোবাইল নম্বর (বিকাশ বা রবি) <span className="text-red-500">*</span>
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
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-1 focus:ring-[#0A7756]"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              💡 যে নম্বরটি দিয়ে পেমেন্ট বা সাবস্ক্রাইব করবেন সেই নম্বরটি দিন।
            </p>
          </div>

          {/* Single Unified Subscription Button */}
          <button
            onClick={handleStartSubscription}
            disabled={isProcessing}
            className="w-full relative overflow-hidden rounded-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center bg-gradient-to-r from-[#0A7756] via-[#086146] to-[#043d2c] hover:opacity-95 active:scale-[0.98] hover:shadow-emerald-700/30 hover:-translate-y-0.5 h-14 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2 text-sm font-bold">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>পেমেন্ট গেটওয়েতে পাঠানো হচ্ছে...</span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-5">
                <span className="flex items-center tracking-wide text-sm font-black">
                  সাবস্ক্রাইব করুন (বিকাশ / রবি)
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 backdrop-blur-sm">
                  <span>৳ ১৯০</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </button>

          <div className="mt-4 flex items-center justify-center text-[10px] text-slate-400 font-medium gap-1">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>bdapps (bKash & Robi) অফিসিয়াল গেটওয়ে দ্বারা সুরক্ষিত</span>
          </div>
        </div>

        <Link to="/" className="text-slate-400 text-xs font-bold hover:text-slate-600 transition flex items-center">
          আপাতত স্কিপ করুন <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>
    </div>
  );
}
