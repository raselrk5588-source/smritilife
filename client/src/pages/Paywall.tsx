import { useState, useEffect } from 'react';
import { CheckCircle2, Shield, Sparkles, ChevronRight, Phone, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Paywall() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'robi'>('bkash');

  // bKash States
  const [mobileNumber, setMobileNumber] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  // Robi States
  const [robiMobile, setRobiMobile] = useState('');
  const [robiStep, setRobiStep] = useState<1 | 2>(1);
  const [robiOtp, setRobiOtp] = useState('');
  const [referenceNo, setReferenceNo] = useState('');

  useEffect(() => {
    // Check if user's mobile number is already stored
    const savedMobile = localStorage.getItem('userMobile') || '';
    if (savedMobile) {
      setMobileNumber(savedMobile);
      if (savedMobile.startsWith('018') || savedMobile.startsWith('016')) {
        setRobiMobile(savedMobile);
        setPaymentMethod('robi'); // Auto-recommend Robi if user entered Robi/Airtel number
      }
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

  // 1. bKash Subscription Handler
  const handleStartBkashSubscription = async () => {
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
        if (data.requestId) {
          localStorage.setItem('pendingBkashRequestId', data.requestId);
        }
        if (mobileNumber.trim()) {
          localStorage.setItem('pendingMsisdn', mobileNumber.trim());
          localStorage.setItem('userMobile', mobileNumber.trim());
        }

        toast.success('বিকাশ পেজে পাঠানো হচ্ছে...', { id: 'bkashRedirect' });
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

  // 2. Robi Send OTP Handler
  const handleRobiSendOtp = async () => {
    const cleanNum = robiMobile.trim();
    if (!cleanNum || !/^01[68]\d{8}$/.test(cleanNum)) {
      toast.error('অনুগ্রহ করে সঠিক রবি (018) বা এয়ারটেল (016) নম্বর দিন।');
      return;
    }

    setIsProcessing(true);
    toast.loading('রবি ওটিপি পাঠানো হচ্ছে...', { id: 'robiOtp' });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subscription/robi/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanNum })
      });

      const data = await res.json();

      if (res.ok && data.success && data.referenceNo) {
        setReferenceNo(data.referenceNo);
        setRobiStep(2);
        toast.success('আপনার রবি সিমে ওটিপি পাঠানো হয়েছে!', { id: 'robiOtp' });
      } else {
        toast.error(data.message || 'ওটিপি পাঠানো যায়নি। আবার চেষ্টা করুন।', { id: 'robiOtp', duration: 5000 });
      }
    } catch (err: any) {
      console.error('Robi send OTP error:', err);
      toast.error('সার্ভারে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।', { id: 'robiOtp' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Robi Verify OTP & Activate Subscription
  const handleRobiVerifyOtp = async () => {
    const cleanOtp = robiOtp.trim();
    if (!cleanOtp) {
      toast.error('অনুগ্রহ করে ওটিপি কোডটি লিখুন।');
      return;
    }

    setIsProcessing(true);
    toast.loading('সাবস্ক্রিপশন ভেরিফাই করা হচ্ছে...', { id: 'robiVerify' });

    try {
      const deviceId = localStorage.getItem('deviceId') || '';
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subscription/robi/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: robiMobile.trim(),
          otp: cleanOtp,
          referenceNo,
          deviceId
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('isSubscribed', 'true');
        localStorage.setItem('userMobile', robiMobile.trim());
        if (data.user?.name) localStorage.setItem('userName', data.user.name);

        toast.success('রবি সাবস্ক্রিপশন সফল হয়েছে! স্বাগতম স্মৃতি লাইফে 🎉', { id: 'robiVerify', duration: 4000 });
        setTimeout(() => navigate('/app'), 1000);
      } else {
        toast.error(data.message || 'ভুল বা মেয়াদোত্তীর্ণ ওটিপি!', { id: 'robiVerify', duration: 5000 });
      }
    } catch (err: any) {
      console.error('Robi verify OTP error:', err);
      toast.error('ভেরিফিকেশন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।', { id: 'robiVerify' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden pb-10">
      {/* Background Decor */}
      <div className={`absolute top-0 left-0 right-0 h-[40vh] transition-colors duration-500 rounded-b-[3rem] z-0 overflow-hidden shadow-lg ${
        paymentMethod === 'bkash' 
          ? 'bg-gradient-to-b from-[#e2136e] to-[#8a2f68]' 
          : 'bg-gradient-to-b from-[#e31b23] to-[#8c1015]'
      }`}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "url('/theme-bg.png')", backgroundSize: 'cover' }}></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pt-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl mx-auto flex items-center justify-center mb-3 p-2.5 border border-white/60">
            <img src="/robot-icon.png" alt="SmritiLife AI" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Smriti Life Premium</h1>
          <p className="text-white/90 text-xs sm:text-sm font-medium mt-1">আপনার সব সুন্দর স্মৃতিগুলো সুরক্ষিত রাখুন</p>
        </div>

        {/* Pricing Card */}
        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 relative mb-6">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-md flex items-center tracking-wide uppercase">
            <Sparkles className="w-3 h-3 mr-1" /> সীমিত অফার
          </div>

          <div className="text-center mb-5 mt-2">
            <h2 className="text-slate-800 font-extrabold text-lg">আনলিমিটেড প্রিমিয়াম অ্যাক্সেস</h2>
            <p className="text-slate-500 text-xs mt-1">অ্যাপের সম্পূর্ণ ফিচার উপভোগ করতে সাবস্ক্রাইব করুন</p>
          </div>

          {/* Features List */}
          <div className="space-y-2.5 mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
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

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => { setPaymentMethod('bkash'); setRobiStep(1); }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentMethod === 'bkash'
                  ? 'bg-[#e2136e] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🌸 বিকাশ (bKash)</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('robi')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                paymentMethod === 'robi'
                  ? 'bg-[#e31b23] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🔴 রবি / এয়ারটেল</span>
            </button>
          </div>

          {/* Plan Details Card (Same 190 Tk for both) */}
          <div className="space-y-3 mb-5">
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-colors ${
              paymentMethod === 'bkash' 
                ? 'border-[#e2136e] bg-[#e2136e]/5' 
                : 'border-[#e31b23] bg-[#e31b23]/5'
            }`}>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2.5 ${
                  paymentMethod === 'bkash' ? 'border-[#e2136e]' : 'border-[#e31b23]'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    paymentMethod === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#e31b23]'
                  }`} />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs sm:text-sm">
                    {paymentMethod === 'bkash' ? 'বিকাশ মাসিক প্ল্যান' : 'রবি/এয়ারটেল সিম প্ল্যান'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">১ মাসের জন্য অ্যাক্সেস</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-extrabold text-base ${
                  paymentMethod === 'bkash' ? 'text-[#e2136e]' : 'text-[#e31b23]'
                }`}>
                  ৳ ১৯০
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: BKASH FLOW */}
          {paymentMethod === 'bkash' && (
            <div className="animate-in fade-in duration-200">
              {showPhoneInput ? (
                <div className="mb-4">
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

              <button
                onClick={handleStartBkashSubscription}
                disabled={isProcessing}
                className="w-full relative overflow-hidden rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center bg-[#e2136e] hover:bg-[#c91061] active:scale-95 hover:shadow-[#e2136e]/30 hover:-translate-y-0.5 h-13 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>বিকাশ পেজে লোড হচ্ছে...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-4">
                    <span className="flex items-center tracking-wide text-sm font-bold">
                      বিকাশ দিয়ে সাবস্ক্রাইব করুন
                    </span>
                    <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1">
                      <span>৳ ১৯০</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: ROBI / AIRTEL SIM OTP FLOW */}
          {paymentMethod === 'robi' && (
            <div className="animate-in fade-in duration-200">
              {robiStep === 1 ? (
                <div>
                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                      রবি / এয়ারটেল মোবাইল নম্বর
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="tel"
                        placeholder="018XXXXXXXX"
                        value={robiMobile}
                        onChange={(e) => setRobiMobile(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#e31b23] focus:ring-1 focus:ring-[#e31b23]"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      নম্বরে একটি সাধারণ SMS ওটিপি কোড পাঠানো হবে।
                    </p>
                  </div>

                  <button
                    onClick={handleRobiSendOtp}
                    disabled={isProcessing}
                    className="w-full relative overflow-hidden rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center bg-[#e31b23] hover:bg-[#c4141b] active:scale-95 hover:shadow-[#e31b23]/30 hover:-translate-y-0.5 h-13 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>ওটিপি পাঠানো হচ্ছে...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full px-4">
                        <span className="flex items-center tracking-wide text-sm font-bold">
                          SMS ওটিপি পাঠান
                        </span>
                        <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1">
                          <span>৳ ১৯০</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-3 text-center p-3 bg-red-50/60 border border-red-100 rounded-xl">
                    <p className="text-xs font-semibold text-slate-700">
                      📲 <strong>{robiMobile}</strong> নম্বরে পাঠানো ওটিপি কোডটি লিখুন:
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="relative max-w-[200px] mx-auto">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-4 w-4 text-[#e31b23]" />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="••••"
                        maxLength={6}
                        autoFocus
                        value={robiOtp}
                        onChange={(e) => setRobiOtp(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-2 border-[#e31b23]/40 rounded-xl text-center text-lg font-black text-slate-800 tracking-[0.3em] focus:outline-none focus:border-[#e31b23]"
                      />
                    </div>
                    <div className="text-center mt-2">
                      <button
                        type="button"
                        onClick={() => { setRobiStep(1); setRobiOtp(''); }}
                        className="text-[11px] text-[#e31b23] hover:underline font-bold"
                      >
                        নম্বর পরিবর্তন / কোড আবার পাঠান
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleRobiVerifyOtp}
                    disabled={isProcessing}
                    className="w-full rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center bg-[#e31b23] hover:bg-[#c4141b] active:scale-95 hover:shadow-[#e31b23]/30 h-13 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>ভেরিফাই করা হচ্ছে...</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold tracking-wide">
                        সাবস্ক্রিপশন নিশ্চিত করুন (৳ ১৯০)
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center text-[10px] text-slate-400 font-medium gap-1">
            <Shield className="w-3 h-3 text-slate-500" />
            <span>bdapps & bKash অফিসিয়াল গেটওয়ে দ্বারা সুরক্ষিত</span>
          </div>
        </div>

        <Link to="/" className="text-slate-400 text-xs font-bold hover:text-slate-600 transition flex items-center">
          আপাতত স্কিপ করুন <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>
    </div>
  );
}

