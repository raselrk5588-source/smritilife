import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, ShieldCheck } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';

export default function Auth() {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [showOtp, setShowOtp] = useState(false);

  // Form states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || (showOtp && !otp)) {
      toast.error('মোবাইল নম্বর এবং OTP সঠিকভাবে দিন');
      return;
    }

    if (!showOtp) {
      toast.loading('চেক করা হচ্ছে...', { id: 'authCheck' });
      setTimeout(() => {
        toast.success('আপনার নম্বরে OTP পাঠানো হয়েছে!', { id: 'authCheck' });
        setShowOtp(true);
      }, 1000);
    } else {
      // Step 2: Verify OTP via API
      toast.loading('লগইন হচ্ছে...', { id: 'authCheck' });
      try {
        const url = `${import.meta.env.VITE_API_URL}/users/login`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile, otp })
        });
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          toast.error(`Invalid JSON from server. URL: ${url}, Status: ${res.status}, Body: ${text.substring(0, 50)}`, { id: 'authCheck', duration: 8000 });
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
            navigate('/app');
          } else {
            toast.error('আপনার সাবস্ক্রিপশন নেই! আগে সাবস্ক্রাইব করুন।', { duration: 4000, id: 'authCheck' });
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('isSubscribed', 'false');
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userMobile', data.user.mobile);
            setTimeout(() => navigate('/paywall'), 1500);
          }
        } else {
          toast.error(data.message || 'OTP ভুল হয়েছে!', { id: 'authCheck' });
        }
      } catch (err: any) {
        console.error("Auth fetch error:", err);
        toast.error(`Fetch error: ${err.message}`, { id: 'authCheck', duration: 8000 });
      }
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative overflow-hidden">
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

        <div className="bg-white rounded-[32px] p-8 shadow-xl flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Smriti <span className="text-xl md:text-2xl font-bold text-slate-700">(স্মৃতি)</span><span className="text-[#0A7756] text-4xl">.</span></h2>
            <p className="text-slate-500 text-sm font-medium">
              Smriti (স্মৃতি) অ্যাপে আপনাকে স্বাগতম!
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">মোবাইল নম্বর</label>
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
                  className={`w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all ${showOtp ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {showOtp && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1 text-center">OTP কোড (আপনার মোবাইলে পাঠানো হয়েছে)</label>
                <div className="relative max-w-[200px] mx-auto">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-[#0A7756]" />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full bg-slate-50 border-2 border-[#0A7756]/30 rounded-2xl pl-12 pr-4 py-3.5 text-center text-xl font-bold text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all tracking-[0.5em]"
                  />
                </div>
                <p className="text-center text-xs text-slate-400 font-medium mt-3">
                  (ডেমো টেস্টের জন্য "1234" অথবা "0000" ব্যবহার করুন)
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#0A7756] hover:bg-[#086146] text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 mt-4"
            >
              {showOtp ? 'ভেরিফাই করুন' : 'OTP পাঠান'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
