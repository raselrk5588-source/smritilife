import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, ShieldCheck, CheckCircle2, MessageSquare, LayoutDashboard } from 'lucide-react';
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
          toast.success(data.message || 'আপনার WhatsApp নম্বরে OTP পাঠানো হয়েছে!', { id: 'authCheck', duration: 4000 });
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

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative overflow-hidden font-sans">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[#0A7756] to-[#12A57A] rounded-b-[40px] z-0 shadow-lg">
        <div className="absolute inset-0 bg-cover opacity-20" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center" }}></div>
      </div>

      <div className="relative z-10 flex flex-col flex-1 p-5 pt-12 max-w-lg mx-auto w-full">
        <div className="flex items-center mb-8 text-white">
          <Link to="/" className="p-2 hover:bg-white/20 rounded-full transition-colors mr-3">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold tracking-wide">
            লগইন করুন
          </h1>
        </div>

        {showSuccessChoice ? (
          <div className="bg-white rounded-[32px] p-8 shadow-xl flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-400">
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-[#0A7756] shadow-sm">
                <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">লগইন সফল হয়েছে! 🎉</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">
                স্মৃতি লাইফ শুরু করতে আপনার পছন্দের মাধ্যম বেছে নিন:
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Option 1: WhatsApp AI */}
              <a
                href={`https://wa.me/8801862636137?text=${encodeURIComponent('/start smritilife')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left p-4.5 rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white hover:from-emerald-100/90 hover:to-teal-100/70 transition-all shadow-md shadow-emerald-700/10 hover:shadow-lg group flex items-start gap-3.5 block"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-6 h-6 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-slate-800 text-sm sm:text-base">হোয়াটসঅ্যাপ এআই (WhatsApp AI)</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#25D366] text-white rounded-full tracking-wider shrink-0 shadow-xs">সুপার ফাস্ট</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    সরাসরি হোয়াটসঅ্যাপ ওপেন হবে। <span className="bg-emerald-100/80 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">/start smritilife</span> সেন্ড করে ২৪ ঘণ্টার চ্যাট সক্রিয় করুন।
                  </p>
                </div>
              </a>

              {/* Option 2: Web Dashboard */}
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="w-full text-left p-4.5 rounded-2xl border border-slate-200 bg-slate-50/90 hover:bg-slate-100 transition-all shadow-sm hover:shadow-md group flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-800 text-sm sm:text-base">ওয়েবসাইট ড্যাশবোর্ড (Web App)</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full shrink-0">ব্রাউজার ভিউ</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    কম্পিউটার বা ফোনের ব্রাউজারে বিস্তারিত হিসাব, নোট, ক্যালেন্ডার ও গ্রাফ দেখুন।
                  </p>
                </div>
              </button>
            </div>

            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-400 font-medium">
                💡 আপনি যেকোনো সময় ওয়েবসাইট এবং হোয়াটসঅ্যাপ উভয় মাধ্যম থেকেই আপনার স্মৃতি লাইফ অ্যাকাউন্ট চালাতে পারবেন।
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] p-8 shadow-xl flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Smriti <span className="text-[#0A7756]">Life</span><span className="text-[#0A7756] text-4xl">.</span></h2>
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
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-center">
                    <p className="text-xs font-bold text-emerald-800">
                      📲 আপনার WhatsApp-এ ৪ ডিজিটের OTP পাঠানো হয়েছে
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      কোডটি ৩ মিনিটের মধ্যে প্রবেশ করান।
                    </p>
                  </div>

                  <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1 text-center">
                    OTP কোড দিন
                  </label>
                  <div className="relative max-w-[200px] mx-auto">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-[#0A7756]" />
                    </div>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="••••"
                      maxLength={4}
                      autoFocus
                      className="w-full bg-slate-50 border-2 border-[#0A7756]/40 rounded-2xl pl-12 pr-4 py-3.5 text-center text-xl font-black text-slate-800 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all tracking-[0.5em]"
                    />
                  </div>
                  <div className="text-center mt-3">
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
                className="w-full bg-[#0A7756] hover:bg-[#086146] text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mt-4"
              >
                {showOtp ? 'ভেরিফাই ও লগইন করুন' : 'WhatsApp-এ OTP পাঠান'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
