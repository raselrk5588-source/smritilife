import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  MessageSquare, 
  LayoutDashboard, 
  Sparkles 
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';

export default function Auth() {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [showOtp, setShowOtp] = useState(false);
  const [showSuccessChoice, setShowSuccessChoice] = useState(false);

  // Form states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [authSessionId, setAuthSessionId] = useState('');

  // Polling for 1-Click WhatsApp Instant Verification
  useEffect(() => {
    if (!showOtp || !authSessionId) return;

    let isCancelled = false;
    const interval = setInterval(async () => {
      try {
        const devId = localStorage.getItem('deviceId') || '';
        const res = await fetch(`${import.meta.env.VITE_API_URL}/users/auth-session/${authSessionId}?deviceId=${encodeURIComponent(devId)}`);
        const data = await res.json();

        if (!isCancelled && data.verified && data.token) {
          clearInterval(interval);
          localStorage.setItem('token', data.token);

          if (data.user?.isSubscribed) {
            toast.success('WhatsApp ভেরিফিকেশন সফল! সরাসরি লগইন হয়েছে 🎉', { id: 'authCheck' });
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isSubscribed', 'true');
            if (data.user?.name) localStorage.setItem('userName', data.user.name);
            if (data.user?.mobile) localStorage.setItem('userMobile', data.user.mobile);
            setShowSuccessChoice(true);
          } else {
            toast.error('আপনার সাবস্ক্রিপশন নেই! আগে সাবস্ক্রাইব করুন।', { duration: 4000, id: 'authCheck' });
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isSubscribed', 'false');
            if (data.user?.name) localStorage.setItem('userName', data.user.name);
            if (data.user?.mobile) localStorage.setItem('userMobile', data.user.mobile);
            setTimeout(() => navigate('/paywall'), 1500);
          }
        }
      } catch (err) {
        // silent polling catch
      }
    }, 1500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [showOtp, authSessionId, navigate]);

  const getDeviceId = () => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', id);
    }
    return id;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || (showOtp && !otp)) {
      toast.error('মোবাইল নম্বর এবং OTP সঠিকভাবে দিন');
      return;
    }

    const deviceId = getDeviceId();

    if (!showOtp) {
      toast.loading('চেক করা হচ্ছে...', { id: 'authCheck' });
      try {
        const url = `${import.meta.env.VITE_API_URL}/users/check-mobile`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile, deviceId })
        });
        const data = await res.json();
        
        if (data.requireOtp === false && data.token) {
          // Bypass OTP (Device already recognized)
          localStorage.setItem('token', data.token);
          toast.success('সরাসরি লগইন সফল হয়েছে!', { id: 'authCheck' });
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('isSubscribed', 'true');
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userMobile', data.user.mobile);
          setShowSuccessChoice(true);
        } else {
          if (data.authSessionId) {
            setAuthSessionId(data.authSessionId);
          }
          toast.success(data.message || 'আপনার WhatsApp নম্বরে কোড পাঠানো হয়েছে!', { id: 'authCheck', duration: 4000 });
          setShowOtp(true);
        }
      } catch (err: any) {
        console.error("Auth check error:", err);
        toast.error('সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।', { id: 'authCheck' });
      }
    } else {
      // Step 2: Verify OTP via API
      toast.loading('যাচাই করা হচ্ছে...', { id: 'authCheck' });
      try {
        const url = `${import.meta.env.VITE_API_URL}/users/login`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile, otp, deviceId })
        });
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          toast.error(`Invalid response: ${text.substring(0, 50)}`, { id: 'authCheck', duration: 6000 });
          return;
        }
        
        if (res.ok) {
          localStorage.setItem('token', data.token);
          
          if (data.user.isSubscribed) {
            toast.success('লগইন সফল হয়েছে!', { id: 'authCheck' });
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isSubscribed', 'true');
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userMobile', data.user.mobile);
            setShowSuccessChoice(true);
          } else {
            toast.error('আপনার সাবস্ক্রিপশন নেই! আগে সাবস্ক্রাইব করুন।', { duration: 4000, id: 'authCheck' });
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isSubscribed', 'false');
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userMobile', data.user.mobile);
            setTimeout(() => navigate('/paywall'), 1500);
          }
        } else {
          toast.error(data.message || 'OTP ভুল হয়েছে বা মেয়াদ শেষ হয়েছে!', { id: 'authCheck' });
        }
      } catch (err: any) {
        console.error("Auth fetch error:", err);
        toast.error(`Fetch error: ${err.message}`, { id: 'authCheck', duration: 6000 });
      }
    }
  };

  const storedUserName = localStorage.getItem('userName');

  return (
    <div className="bg-slate-50 min-h-screen min-h-[100dvh] flex flex-col relative overflow-x-hidden font-sans pb-6">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-64 sm:h-72 bg-gradient-to-b from-[#0A7756] to-[#12A57A] rounded-b-[36px] sm:rounded-b-[44px] z-0 shadow-lg">
        <div className="absolute inset-0 bg-cover opacity-20" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center" }}></div>
      </div>

      <div className="relative z-10 flex flex-col flex-1 p-4 sm:p-6 pt-5 sm:pt-8 max-w-md mx-auto w-full justify-center">
        {showSuccessChoice ? (
          <div className="flex items-center justify-between mb-4 text-white">
            <Link
              to="/"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-xs font-semibold backdrop-blur-md"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>হোমে যান</span>
            </Link>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span>অ্যাকাউন্ট সক্রিয়</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center mb-6 sm:mb-8 text-white">
            <Link to="/" className="p-2 hover:bg-white/20 rounded-full transition-colors mr-3 active:scale-95">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-wide">
              {showOtp ? 'ওটিপি কোড দিন' : 'লগইন করুন'}
            </h1>
          </div>
        )}

        {showSuccessChoice ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 shadow-2xl border border-white/60 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-400">
            {/* Header / Celebration Icon */}
            <div className="text-center mb-5 sm:mb-6">
              <div className="relative inline-flex items-center justify-center mb-3">
                <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping opacity-75"></div>
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0A7756] via-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-700/25 ring-4 ring-emerald-50">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                </div>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-1.5">
                <span>লগইন সফল হয়েছে!</span>
                <span className="text-2xl">🎉</span>
              </h2>
              {storedUserName && (
                <p className="text-sm font-bold text-[#0A7756] mt-0.5">
                  স্বাগতম, {storedUserName}
                </p>
              )}
              <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">
                স্মৃতি লাইফ শুরু করতে আপনার পছন্দের মাধ্যম বেছে নিন:
              </p>
            </div>

            <div className="space-y-3.5 mb-5">
              {/* Option 1: WhatsApp AI */}
              <a
                href={`https://wa.me/8801862636137?text=${encodeURIComponent('/start smritilife')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white hover:from-emerald-100/70 hover:to-teal-100/50 hover:border-emerald-600 transition-all shadow-sm hover:shadow-md group flex items-start gap-3.5 relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-6 h-6 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-slate-800 text-sm sm:text-base">
                      হোয়াটসঅ্যাপ এআই (WhatsApp AI)
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#25D366] text-white rounded-full tracking-wider shrink-0 shadow-2xs">
                      সুপার ফাস্ট
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    হোয়াটসঅ্যাপে চ্যাট করে সরাসরি আয়-ব্যয়, নোট ও রিমাইন্ডার সেভ করুন।
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-900 font-mono text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span>/start smritilife</span>
                    </div>
                    <div className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all">
                      <span>ওপেন করুন</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </a>

              {/* Option 2: Web Dashboard */}
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all shadow-xs hover:shadow-md group flex items-start gap-3.5 cursor-pointer relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-800 text-sm sm:text-base">
                      ওয়েবসাইট ড্যাশবোর্ড (Web App)
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                      ব্রাউজার ভিউ
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    কম্পিউটার বা ফোনের ব্রাউজারে বিস্তারিত হিসাব, নোট, ক্যালেন্ডার ও গ্রাফ দেখুন।
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">সম্পূর্ণ ফিচারযুক্ত অ্যাপ</span>
                    <div className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-700 group-hover:text-[#0A7756] group-hover:translate-x-0.5 transition-all">
                      <span>প্রবেশ করুন</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Sync Tip Info */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 text-slate-700">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-snug font-medium">
                <strong className="text-slate-800">রিয়েল-টাইম সিঙ্ক:</strong> হোয়াটসঅ্যাপ ও ওয়েবসাইট উভয় মাধ্যমেই আপনার অ্যাকাউন্ট সবসময় স্বয়ংক্রিয়ভাবে সিঙ্ক থাকবে।
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 shadow-xl flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-6 sm:mb-8 flex flex-col items-center">
              {/* Brand Logo */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-3 rounded-full flex items-center justify-center p-1 bg-gradient-to-tr from-emerald-100 to-teal-50 border border-emerald-200/80 shadow-md">
                <img 
                  src="/robot-icon.png" 
                  alt="SmritiLife Logo" 
                  className="w-full h-full rounded-full object-cover shadow-2xs ring-2 ring-emerald-500/25" 
                />
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
              </div>

              <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Smriti <span className="text-[#0A7756]">Life</span><span className="text-[#0A7756] text-4xl">.</span></h2>
              <p className="text-slate-500 text-sm font-medium">
                Smriti Life অ্যাপে আপনাকে স্বাগতম!
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="text-xs font-bold text-slate-500">মোবাইল নম্বর</label>
                  {showOtp && (
                    <button
                      type="button"
                      onClick={() => { setShowOtp(false); setOtp(''); }}
                      className="text-xs text-[#0A7756] hover:underline font-bold"
                    >
                      নম্বর পরিবর্তন করুন
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={showOtp}
                    placeholder="017XXXXXXX"
                    className={`w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all ${showOtp ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
              </div>

              {showOtp && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Option 1: 1-Click WhatsApp Instant Verification */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-2 border-emerald-500/40 text-center shadow-xs mb-4">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-ping"></span>
                      <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                        WhatsApp-এ অনুমোদন বাটন পাঠানো হয়েছে
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold mb-3 leading-snug">
                      আপনার WhatsApp-এ অনুমোদনের বাটন গেছে। সেখানে <span className="text-emerald-700 font-black">"✅ হ্যাঁ, লগইন করুন"</span> বাটনে চাপ দিলেই ব্রাউজারে স্বয়ংক্রিয়ভাবে সরাসরি লগইন হয়ে যাবে!
                    </p>
                    <a
                      href={`https://wa.me/8801862636137?text=${encodeURIComponent(`LOGIN ${authSessionId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 group"
                    >
                      <MessageSquare className="w-5 h-5 fill-current shrink-0 group-hover:scale-110 transition-transform" />
                      <span>WhatsApp খুলুন এবং 'হ্যাঁ' চাপুন 📲</span>
                    </a>
                  </div>

                  {/* Divider for Different Device */}
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                    <span className="relative bg-white px-3 text-[11px] text-slate-400 font-bold uppercase tracking-wider">অথবা অন্য ডিভাইসে WhatsApp থাকলে</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-3 text-center">
                    <p className="text-xs font-semibold text-slate-700">
                      📲 আপনার WhatsApp-এ পাঠানো ৪ ডিজিটের OTP দিন
                    </p>
                  </div>

                  <div className="relative max-w-[200px] mx-auto">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-[#0A7756]" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="••••"
                      maxLength={4}
                      autoFocus
                      className="w-full bg-slate-50 border-2 border-[#0A7756]/40 rounded-2xl pl-12 pr-4 py-3 text-center text-xl font-black text-slate-800 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all tracking-[0.5em]"
                    />
                  </div>

                  <div className="text-center mt-2.5">
                    <button
                      type="button"
                      onClick={(e) => { setShowOtp(false); handleAuthSubmit(e); }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-medium underline"
                    >
                      কোড পাননি? আবার পাঠান
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#0A7756] hover:bg-[#086146] text-white font-bold py-3.5 sm:py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mt-3 cursor-pointer"
              >
                {showOtp ? 'ওটিপি দিয়ে ভেরিফাই করুন' : 'WhatsApp-এ এগিয়ে যান'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
