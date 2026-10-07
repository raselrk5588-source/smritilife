import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ChevronRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bkashNumber, setBkashNumber] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // Get the bKash number saved during payment
    const savedNumber = localStorage.getItem('userMobile') || '';
    if (!savedNumber) {
      // If somehow reached here without payment
      navigate('/');
    }
    setBkashNumber(savedNumber);

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
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    
    if (!name || !whatsapp) {
      toast.error('নাম এবং হোয়াটসঅ্যাপ নম্বর অবশ্যই দিতে হবে');
      return;
    }

    try {
      // Construct payload dynamically to avoid overriding valid email with empty string
      const payload: any = { name, whatsapp };
      if (email.trim() !== '') {
        payload.email = email;
      }
      
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const result = await res.json();
        // Also save to localStorage for immediate UI updates
        localStorage.setItem('userName', name);
        if (result.email) localStorage.setItem('userEmail', result.email);
        localStorage.setItem('whatsappNumber', whatsapp);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('isProfileCompleted', 'true');

        toast.success('প্রোফাইল আপডেট সফল হয়েছে!');
        navigate('/app');
      } else {
        toast.error('প্রোফাইল সেভ করতে সমস্যা হয়েছে!');
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

      <div className="relative z-10 flex flex-col flex-1 p-5 pt-16 max-w-lg mx-auto w-full">
        <div className="bg-white rounded-[2rem] p-8 shadow-2xl flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-500">
          
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#0A7756]/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#0A7756]" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">পেমেন্ট সফল হয়েছে!</h2>
            <p className="text-slate-500 text-sm font-medium px-4">
              দয়া করে আপনার প্রোফাইল সম্পূর্ণ করুন যেন আমরা আপনাকে রিমাইন্ডার পাঠাতে পারি।
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Disabled bKash Number field (Unique ID) */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">আপনার Unique ID (bKash নম্বর)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <input
                  type="text"
                  value={bkashNumber}
                  disabled
                  className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-emerald-800 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">
                আপনার নাম {isSubmitted && !name && <span className="text-red-500 text-sm">*</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="আপনার পুরো নাম লিখুন"
                  className={`w-full bg-slate-50 border ${isSubmitted && !name ? 'border-red-400 focus:ring-red-400/20' : 'border-slate-200 focus:border-[#0A7756] focus:ring-[#0A7756]/20'} rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 transition-all`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">ইমেইল অ্যাড্রেস (ঐচ্ছিক)</label>
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

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">
                WhatsApp নম্বর (রিমাইন্ডারের জন্য) {isSubmitted && !whatsapp && <span className="text-red-500 text-sm">*</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="017XXXXXXX"
                  className={`w-full bg-slate-50 border ${isSubmitted && !whatsapp ? 'border-red-400 focus:ring-red-400/20' : 'border-slate-200 focus:border-[#0A7756] focus:ring-[#0A7756]/20'} rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 transition-all`}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0A7756] hover:bg-[#086146] text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center group mt-6"
            >
              প্রোফাইল সেভ করুন 
              <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
