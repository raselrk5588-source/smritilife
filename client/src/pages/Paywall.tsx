import { useState, useEffect } from 'react';
import { CheckCircle2, Shield, Sparkles, ChevronRight, Zap, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Paywall() {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBkashModal, setShowBkashModal] = useState(false);
  const [bkashStep, setBkashStep] = useState(1);
  const [bkashNumber, setBkashNumber] = useState('');
  const [bkashOtp, setBkashOtp] = useState('');
  const [bkashPin, setBkashPin] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
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

  const handleBkashPayment = () => {
    setShowBkashModal(true);
  };

  const handleBkashSubmit = async () => {
    if (bkashStep === 1) {
      if (!bkashNumber || !/^01[3-9]\d{8}$/.test(bkashNumber)) {
        toast.error('সঠিক ১১ ডিজিটের বিকাশ নম্বর দিন (যেমন: 017XXXXXXX)');
        return;
      }
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setBkashStep(2);
      }, 1000);
    } else if (bkashStep === 2) {
      if (bkashOtp !== '123456') {
        toast.error('ভুল OTP! দয়া করে 123456 ব্যবহার করুন (Demo)');
        return;
      }
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setBkashStep(3);
      }, 1000);
    } else if (bkashStep === 3) {
      if (bkashPin !== '12345') {
        toast.error('ভুল পিন! দয়া করে 12345 ব্যবহার করুন (Demo)');
        return;
      }
      setIsProcessing(true);
      
      try {
        // Update subscription on the backend
        const token = localStorage.getItem('token');
        if (token) {
          await fetch(`${import.meta.env.VITE_API_URL}/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ isSubscribed: true })
          });
        }
      } catch (err) {
        console.error(err);
      }

      setTimeout(() => {
        setIsProcessing(false);
        setShowBkashModal(false);
        toast.success('পেমেন্ট সফল হয়েছে!');
        
        localStorage.setItem('isSubscribed', 'true');
        navigate('/complete-profile');
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden pb-10">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-primary/90 to-primary rounded-b-[3rem] z-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/theme-bg.png')", backgroundSize: 'cover' }}></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pt-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-xl mx-auto flex items-center justify-center mb-4 transform rotate-3">
            <span className="text-3xl">🌸</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Smriti (স্মৃতি) Premium</h1>
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
              'ক্লাউড ব্যাকআপ ও সিকিউরিটি'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                <span className="text-slate-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* Plan Selection */}
          <div className="space-y-3 mb-8">
            <label 
              className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all border-primary bg-primary/5`}
              onClick={() => setSelectedPlan('monthly')}
            >
              <div className="flex items-center">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 border-primary`}>
                  <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">মাসিক প্ল্যান</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">১ মাসের জন্য</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-primary">৳ ৫০</div>
              </div>
            </label>
          </div>

          {/* bKash Payment Button */}
          <button 
            onClick={handleBkashPayment}
            className={`w-full relative overflow-hidden rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center bg-[#e2136e] hover:bg-[#c91061] active:scale-95 hover:shadow-[#e2136e]/30 hover:-translate-y-0.5 h-14`}
          >
            <div className="flex items-center justify-between w-full px-5">
              <span className="flex items-center tracking-wide text-[15px]">
                বিকাশ পেমেন্ট
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">
                ৳ ৫০
              </span>
            </div>
          </button>

          <div className="mt-4 flex items-center justify-center text-[10px] text-slate-400 font-medium">
            <Shield className="w-3 h-3 mr-1" /> 100% নিরাপদ পেমেন্ট
          </div>
        </div>

        <Link to="/" className="text-slate-400 text-xs font-bold hover:text-slate-600 transition flex items-center">
          আপাতত স্কিপ করুন <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>

      {/* bKash Payment Modal Simulator */}
      {showBkashModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-lg overflow-hidden shadow-2xl relative">
            {/* bKash Header */}
            <div className="bg-[#e2136e] p-4 flex justify-between items-center relative">
              <img src="https://scripts.sandbox.bka.sh/resources/img/bkash_payment_logo.png" alt="bKash" className="h-8" onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }} />
              <div className="text-white font-bold text-lg hidden" id="bkash-text">bKash</div>
              <button onClick={() => setShowBkashModal(false)} className="text-white hover:bg-white/20 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* bKash Content */}
            <div className="bg-cover bg-center h-full relative" style={{ backgroundImage: "url('https://scripts.sandbox.bka.sh/resources/img/bkash_bg.png')", backgroundColor: "#f5f5f5" }}>
              <div className="p-6 text-center">
                <div className="bg-white/90 rounded-lg p-3 inline-block shadow-sm mb-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">🌸</div>
                    <div className="text-left">
                      <div className="text-xs text-gray-500">Merchant</div>
                      <div className="font-bold text-sm text-gray-800">Smriti (স্মৃতি)</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-gray-800 font-bold mb-4 border-b border-gray-300 pb-2">
                  Amount: ৳ 50.00
                </div>

                <div className="mt-6 mb-8 text-center text-gray-700 font-medium">
                  {bkashStep === 1 && 'Enter your bKash Account number'}
                  {bkashStep === 2 && 'Enter verification code sent to ' + bkashNumber}
                  {bkashStep === 3 && 'Enter PIN for your bKash Account'}
                </div>

                {bkashStep === 1 && (
                  <input 
                    type="tel" 
                    placeholder="e.g 01XXXXXXXXX" 
                    className="w-full text-center text-lg tracking-widest bg-white border border-gray-300 p-2 rounded focus:outline-none focus:border-[#e2136e]"
                    value={bkashNumber}
                    onChange={(e) => setBkashNumber(e.target.value)}
                  />
                )}

                {bkashStep === 2 && (
                  <input 
                    type="text" 
                    placeholder="bKash Verification Code" 
                    className="w-full text-center text-lg tracking-widest bg-white border border-gray-300 p-2 rounded focus:outline-none focus:border-[#e2136e]"
                    value={bkashOtp}
                    onChange={(e) => setBkashOtp(e.target.value)}
                  />
                )}

                {bkashStep === 3 && (
                  <input 
                    type="password" 
                    placeholder="bKash PIN" 
                    className="w-full text-center text-lg tracking-widest bg-white border border-gray-300 p-2 rounded focus:outline-none focus:border-[#e2136e]"
                    value={bkashPin}
                    onChange={(e) => setBkashPin(e.target.value)}
                  />
                )}

                <div className="flex justify-between gap-4 mt-8">
                  <button 
                    onClick={handleBkashSubmit}
                    disabled={isProcessing}
                    className="w-full bg-[#e2136e] hover:bg-[#c91061] text-white font-bold py-2 rounded transition-colors flex justify-center items-center h-10 uppercase text-sm"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      bkashStep === 3 ? 'Confirm' : 'Proceed'
                    )}
                  </button>
                  <button 
                    onClick={() => setShowBkashModal(false)}
                    className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 rounded transition-colors uppercase text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
