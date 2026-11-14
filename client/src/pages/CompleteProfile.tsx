import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ChevronRight, CheckCircle2, ShieldCheck, MessageSquare, LayoutDashboard, Sparkles, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bkashNumber, setBkashNumber] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [isPaidUser, setIsPaidUser] = useState(false);

  useEffect(() => {
    const isSub = localStorage.getItem('isSubscribed') === 'true';
    setIsPaidUser(isSub);

    // Get the mobile number saved during payment or login
    const savedNumber = localStorage.getItem('userMobile') || localStorage.getItem('pendingMsisdn') || '';
    if (savedNumber) {
      if (isSub) setBkashNumber(savedNumber);
      setWhatsapp(savedNumber);
    }

    const savedName = localStorage.getItem('userName') || '';
    if (savedName && savedName !== 'নতুন ব্যবহারকারী' && savedName !== 'রবি ব্যবহারকারী') {
      setName(savedName);
    }

    // Adjust size for mobile view by decreasing 10%
    const handleResize = () => {
      if (window.innerWidth < 768) {
        document.documentElement.style.fontSize = '90%';
      } else {
        document.documentElement.style.fontSize = ''; // Default for web view
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.fontSize = '';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    if (!name.trim()) {
      toast.error('অনুগ্রহ করে আপনার নাম লিখুন');
      return;
    }

    const cleanWhatsapp = whatsapp.trim();
    if (!cleanWhatsapp || !/^01[3-9]\d{8}$/.test(cleanWhatsapp)) {
      toast.error('সঠিক ১১ ডিজিটের WhatsApp/মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (token) {
        // Authenticated user -> Update Profile
        const payload: any = { name: name.trim(), whatsapp: cleanWhatsapp };
        if (email.trim() !== '') {
          payload.email = email.trim();
        }
        
        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/users/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          const result = await res.json();
          localStorage.setItem('userName', name.trim());
          if (result.email) localStorage.setItem('userEmail', result.email);
          localStorage.setItem('whatsappNumber', cleanWhatsapp);
          localStorage.setItem('userMobile', cleanWhatsapp);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('isProfileCompleted', 'true');

          if (result.access?.trialEndDate) {
            localStorage.setItem('trialEndDate', result.access.trialEndDate);
            localStorage.setItem('isTrialActive', 'true');
          }

          toast.success('প্রোফাইল সফলভাবে আপডেট হয়েছে!');
          setIsSavedSuccess(true);
        } else {
          toast.error('প্রোফাইল সেভ করতে সমস্যা হয়েছে!');
        }
      } else {
        // Unauthenticated user -> Start 3-Day Free Trial
        const payload: any = {
          name: name.trim(),
          mobile: cleanWhatsapp,
          whatsapp: cleanWhatsapp,
          deviceId: localStorage.getItem('deviceId') || ''
        };
        if (email.trim() !== '') {
          payload.email = email.trim();
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/users/start-trial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userMobile', data.user.mobile);
          localStorage.setItem('whatsappNumber', data.user.whatsapp);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('isSubscribed', data.user.isSubscribed ? 'true' : 'false');
          localStorage.setItem('isTrialActive', 'true');
          if (data.trialEndDate) {
            localStorage.setItem('trialEndDate', data.trialEndDate);
          }
          localStorage.setItem('isProfileCompleted', 'true');

          toast.success('🎉 প্রোফাইল সফল হয়েছে! WhatsApp ওপেন হচ্ছে...', { duration: 3000 });
          setIsSavedSuccess(true);
          setTimeout(() => {
            window.location.href = `https://wa.me/8801862636137?text=${encodeURIComponent('/start smritilife')}`;
          }, 800);
        } else if (data.status === 'TRIAL_EXPIRED') {
          toast.error(data.message || 'আপনার ৩ দিনের ফ্রি ট্রায়াল শেষ হয়ে গেছে। বিকাশ দিয়ে সাবস্ক্রাইব করুন।');
          navigate('/paywall');
        } else {
          toast.error(data.message || 'প্রোফাইল সেভ করতে সমস্যা হয়েছে!');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('সার্ভারের সাথে কানেক্ট করা যাচ্ছে না!');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative overflow-hidden">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#0A7756] to-[#12A57A] rounded-b-[3rem] z-0 shadow-lg"></div>

      <div className="relative z-10 flex flex-col flex-1 p-5 pt-12 sm:pt-16 max-w-lg mx-auto w-full">
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-2xl flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-500">
          
          {isSavedSuccess ? (
            /* Choice Screen: WhatsApp AI vs Web App */
            <div className="py-4 space-y-6 animate-in fade-in zoom-in-95 duration-300 my-auto text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-md">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#0A7756]/10 text-[#0A7756] mb-2">
                  <Sparkles className="w-4 h-4" /> ৩ দিনের ফ্রি ট্রায়াল সক্রিয়
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  স্বাগতম, {name || 'স্মৃতি ইউজার'}!
                </h2>
                <p className="text-slate-500 text-sm mt-1 px-4">
                  স্মৃতি লাইফ শুরু করতে আপনার পছন্দের মাধ্যম বেছে নিন:
                </p>
              </div>

              <div className="pt-2 space-y-3.5">
                {/* Option 1: WhatsApp Bot */}
                <a
                  href={`https://wa.me/8801862636137?text=${encodeURIComponent('/start smritilife')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#1ebd59] text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 fill-current text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-base leading-tight">WhatsApp এ যান</div>
                      <div className="text-xs text-white/90 font-medium">হোয়াটসঅ্যাপেই সব রিমাইন্ডার ও চ্যাট</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>

                {/* Option 2: Web App Dashboard */}
                <button
                  onClick={() => navigate('/app')}
                  className="w-full bg-gradient-to-r from-[#0A7756] to-[#12A57A] hover:opacity-95 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                      <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-base leading-tight">Web App এ যান</div>
                      <div className="text-xs text-white/90 font-medium">ওয়েবসাইট ড্যাশবোর্ড ও ম্যানেজমেন্ট</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-[#0A7756]/10 rounded-2xl flex items-center justify-center shadow-xs">
                  {isPaidUser ? (
                    <CheckCircle2 className="w-9 h-9 text-[#0A7756]" />
                  ) : (
                    <Gift className="w-9 h-9 text-[#0A7756] animate-bounce" />
                  )}
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-black px-3 py-1 rounded-full border border-emerald-200/80 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isPaidUser ? 'সাবস্ক্রিপশন সম্পন্ন' : '৩ দিন সম্পূর্ণ ফ্রি ট্রায়াল'}</span>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-1.5 tracking-tight">
                  {isPaidUser ? 'প্রোফাইল তথ্য দিন' : 'প্রোফাইল পূরণ করে শুরু করুন'}
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm font-medium px-2 leading-relaxed">
                  {isPaidUser 
                    ? 'আপনার নাম এবং WhatsApp নম্বর দিন যেন আমরা আপনাকে সময়মতো রিমাইন্ডার ও অ্যাসিস্ট্যান্ট সেবা দিতে পারি।'
                    : 'তথ্য পূরণ করলেই ৩ দিন সম্পূর্ণ ফ্রিতে স্মৃতি লাইফের সব ফিচার উপভোগ করতে পারবেন। কোনো অগ্রিম ফি লাগবে না!'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Disabled Mobile Number field for paid users */}
                {bkashNumber && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">সাবস্ক্রিপশন মোবাইল নম্বর</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      </div>
                      <input
                        type="text"
                        value={bkashNumber}
                        disabled
                        className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-emerald-800 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block ml-1">
                    আপনার পূর্ণ নাম {isSubmitted && !name && <span className="text-red-500 text-sm">*</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="আপনার পুরো নাম লিখুন (যেমন: রিয়াদ হাসান)"
                      className={`w-full bg-slate-50 border ${isSubmitted && !name ? 'border-red-400 focus:ring-red-400/20' : 'border-slate-200 focus:border-[#0A7756] focus:ring-[#0A7756]/20'} rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 transition-all`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block ml-1">
                    WhatsApp / মোবাইল নম্বর {isSubmitted && !whatsapp && <span className="text-red-500 text-sm">*</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className={`w-full bg-slate-50 border ${isSubmitted && !whatsapp ? 'border-red-400 focus:ring-red-400/20' : 'border-slate-200 focus:border-[#0A7756] focus:ring-[#0A7756]/20'} rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 transition-all`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 ml-1">
                    💡 এই নম্বরেই আপনার WhatsApp AI সহকারী রিমাইন্ডার ও তথ্য পাঠাবে।
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block ml-1">ইমেইল অ্যাড্রেস (ঐচ্ছিক)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0A7756] to-[#12A57A] hover:opacity-95 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center group mt-6 cursor-pointer"
                >
                  <span>{isPaidUser ? 'প্রোফাইল সেভ করুন' : '৩ দিন ফ্রি ট্রায়াল শুরু করুন 🚀'}</span>
                  <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
