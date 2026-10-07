import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Brain, BellRing, Wand2, Sparkles, CheckCircle2, Shield, Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Landing() {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  // Reset global scaling on the landing page
  useEffect(() => {
    const originalFontSize = document.documentElement.style.fontSize;
    // Force html font size to 16px to prevent scaling on this page
    document.documentElement.style.setProperty('font-size', '16px', 'important');
    return () => {
      document.documentElement.style.fontSize = originalFontSize;
    };
  }, []);

  const handleBkashPayment = () => {
    navigate('/paywall');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-[#0A7756]/20 selection:text-[#0A7756] flex flex-col relative overflow-clip">
      
      {/* Full Page Aesthetic Background (Generated Image) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img 
          src="/landing-bg.png" 
          alt="Cozy Diary Background"
          className="w-full h-full object-cover opacity-[0.35]"
        />
        {/* Light gradient to ensure perfect text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50/50 via-transparent to-slate-50/50"></div>
      </div>

      {/* Main Content Area (Split into Left and Right) */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full justify-between gap-12 lg:gap-24 xl:gap-32 p-6 lg:px-8 lg:py-12 xl:px-10 xl:py-16">
        
        {/* LEFT SIDE: Content */}
        <div className="w-full lg:w-[55%] xl:w-[60%] flex flex-col relative items-center lg:items-start pt-12 lg:pt-0">
          
          <div className="relative z-10 flex flex-col w-full max-w-[750px] py-4">
            
            {/* Header & Tagline */}
            <div className="mb-10 animate-in slide-in-from-left-5 duration-700">
              <div className="inline-block bg-white/60 backdrop-blur-lg px-6 py-4 rounded-3xl border border-white/60 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <Leaf className="w-10 h-10 text-[#0A7756] absolute transform -rotate-12" />
                    <Leaf className="w-10 h-10 text-[#12A57A] absolute transform rotate-45 opacity-80" />
                  </div>
                  <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-2">
                    Smriti <span className="text-2xl md:text-3xl font-bold text-slate-700">(স্মৃতি)</span>
                  </h1>
                </div>
                
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                  ভুলে যাওয়া নয়, সব কিছু থাকবে <span className="text-[#E67E22] border-b-2 border-[#E67E22] pb-0.5">স্মৃতিতে</span>
                </p>
              </div>
              
              {/* Intro Text (Image removed) */}
              <div className="bg-white/80 p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm backdrop-blur-sm">
                <p className="text-slate-700 text-lg md:text-xl font-medium leading-relaxed">
                  Smriti (স্মৃতি) অ্যাপের মাধ্যমে আপনার দৈনন্দিন জীবনের সবকিছু নিরাপদভাবে ডিজিটাল ডায়েরিতে সেভ করে রাখুন। একটি মাত্র অ্যাপে পাচ্ছেন চমৎকার সব সুবিধা।
                </p>
              </div>
            </div>

            {/* Features (Expanded Details) */}
            <div className="space-y-6 flex-1 flex flex-col animate-in slide-in-from-left-8 duration-700 delay-150">
              
              {/* Feature 1 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-start lg:-ml-4">
                <img src="https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=400&auto=format&fit=crop" alt="Notes" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Brain className="w-6 h-6 md:w-7 md:h-7 text-[#0A7756]" /> স্মার্ট নোটপ্যাড
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    ভয়েস কমান্ড ব্যবহার করে বা লিখে মুহূর্তের মধ্যেই যেকোনো তথ্য স্মার্ট নোটপ্যাডে লিখে রাখুন। আপনার প্রয়োজনীয় প্রতিটি কথা, আইডিয়া বা বাজারের ফর্দ— সবকিছুই নিরাপদ থাকবে ক্লাউডে।
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-end">
                <img src="https://images.unsplash.com/photo-1631549916768-4119b2e5f926?q=80&w=400&auto=format&fit=crop" alt="Medicine" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Shield className="w-6 h-6 md:w-7 md:h-7 text-blue-500" /> ওষুধ খাওয়ার রিমাইন্ডার
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    আপনার বা আপনার পরিবারের প্রতিদিনের প্রয়োজনীয় ওষুধ খাওয়ার সময় হলে সঠিক সময়ে নোটিফিকেশন দিয়ে মনে করিয়ে দেবে। স্বাস্থ্য সুরক্ষায় আর কোনো অবহেলা নয়!
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-start lg:-ml-4">
                <img src="https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?q=80&w=400&auto=format&fit=crop" alt="Reminders" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <BellRing className="w-6 h-6 md:w-7 md:h-7 text-[#E67E22]" /> স্পেশাল ডেট রিমাইন্ডার
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    প্রিয়জনের জন্মদিন, বিবাহ বার্ষিকী, গুরুত্বপূর্ণ মিটিং বা যেকোনো স্পেশাল ইভেন্ট— এখন আর ভুলে যাওয়ার ভয় নেই। সঠিক সময়ে অটোমেটিক নোটিফিকেশন পাঠাবে Smriti (স্মৃতি) অ্যাপ।
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-end">
                <img src="https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=400&auto=format&fit=crop" alt="Cards" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Wand2 className="w-6 h-6 md:w-7 md:h-7 text-pink-500" /> AI ম্যাজিক কার্ড
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    AI এর সাহায্যে অটোমেটিকভাবে দারুণ সব শুভেচ্ছা বার্তা লিখুন। সাথে সুন্দর ছবি যুক্ত করে ইউনিক ডিজিটাল গ্রিটিং কার্ড বা ওয়েবলিংক তৈরি করে প্রিয়জনকে চমকে দিন।
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-start lg:-ml-4">
                <img src="https://images.unsplash.com/photo-1501139083538-0139583c060f?q=80&w=400&auto=format&fit=crop" alt="Message Schedule" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Send className="w-6 h-6 md:w-7 md:h-7 text-indigo-500" /> অটোমেটিক শুভেচ্ছা শিডিউলিং
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    আপনার ব্যস্ত রুটিনেও প্রিয়জনকে সময় দিন! আগে থেকেই মেসেজ শিডিউল করে রাখুন। নির্দিষ্ট সময়ে WhatsApp, SMS বা ইমেইলের মাধ্যমে অটোমেটিকভাবে শুভেচ্ছা পৌঁছে যাবে।
                  </p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="flex gap-6 p-6 md:p-8 bg-white/90 backdrop-blur-md border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all hover:scale-[1.02] w-full lg:w-[85%] lg:self-end">
                <img src="/whatsapp_bot.png" alt="WhatsApp Bot" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0 border border-slate-100" />
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-[#25D366]" /> WhatsApp AI বট
                  </h3>
                  <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium">
                    অ্যাপে না ঢুকেই সরাসরি WhatsApp-এর মাধ্যমে আপনার রিমাইন্ডার সেট, ডিলিট বা ক্যান্সেল করুন! শুধু আমাদের বটকে মেসেজ দিন, বাকি কাজ AI করে নেবে।
                  </p>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Paywall */}
        <div className="w-full lg:w-[45%] xl:w-[40%] relative flex flex-col items-center lg:items-end pt-8 lg:pt-0 lg:sticky lg:top-12 lg:self-start z-20">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#0A7756]/5 rounded-full blur-[80px] pointer-events-none"></div>
          
          {/* Paywall Container */}
          <div className="w-full max-w-[420px] relative animate-in zoom-in-95 duration-700 delay-300">
            
            {/* Embedded Login Button */}
            <div className="mb-4 flex justify-end">
              <button 
                onClick={() => navigate('/auth')}
                className="bg-white/90 backdrop-blur-md text-[#0A7756] border border-[#0A7756]/20 font-bold px-6 py-2 rounded-full shadow-md hover:bg-white hover:shadow-lg transition-all flex items-center"
              >
                লগইন করুন
              </button>
            </div>

            <div className="bg-white/30 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-8 md:p-10 border border-white/40 relative">
              
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0A7756] to-[#12A57A] text-white text-[13px] md:text-sm font-bold px-6 py-2 rounded-full shadow-lg flex items-center tracking-wide">
                <Sparkles className="w-4 h-4 mr-2" /> Smriti (স্মৃতি) Premium
              </div>

              <div className="text-center mb-8 mt-4">
                <h2 className="text-slate-800 font-extrabold text-2xl md:text-3xl drop-shadow-sm">আনলিমিটেড অ্যাক্সেস</h2>
                <p className="text-slate-700 text-[15px] mt-2 font-medium">অ্যাপের সম্পূর্ণ ফিচার উপভোগ করতে সাবস্ক্রাইব করুন</p>
              </div>

            <div className="space-y-4 mb-8 bg-white/40 p-5 rounded-2xl border border-white/50 shadow-sm">
              {[
                'আনলিমিটেড নোট ও রিমাইন্ডার',
                'WhatsApp AI বট সার্ভিস',
                'AI ডিজিটাল গ্রিটিং কার্ড তৈরি',
                'অটোমেটিক SMS মেসেজ',
                'ক্লাউড ব্যাকআপ ও সিকিউরিটি'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center text-[15px]">
                  <CheckCircle2 className="w-5 h-5 text-[#0A7756] mr-3 shrink-0" />
                  <span className="text-slate-700 font-bold">{feature}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 mb-10">
              <label 
                className="flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all border-[#0A7756] bg-[#0A7756]/5"
                onClick={() => setSelectedPlan('monthly')}
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 border-[#0A7756]">
                    <div className="w-3 h-3 bg-[#0A7756] rounded-full" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-base">মাসিক প্ল্যান</div>
                    <div className="text-xs text-slate-500 font-medium mt-1">১ মাসের জন্য</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-[#0A7756] text-2xl">৳ ৫০</div>
                </div>
              </label>
            </div>

            <button 
              onClick={handleBkashPayment}
              className="w-full relative overflow-hidden rounded-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center bg-[#0A7756] hover:bg-[#0A7756]/90 active:scale-95 hover:shadow-lg hover:-translate-y-1 h-16"
            >
              <div className="flex items-center justify-between w-full px-6">
                <span className="flex items-center tracking-wide text-lg">
                  বিকাশ পেমেন্ট
                </span>
                <span className="bg-white/20 px-3 py-1.5 rounded-lg text-base">
                  ৳ ৫০ / মাস
                </span>
              </div>
            </button>

              <div className="mt-5 flex items-center justify-center text-xs text-slate-400 font-bold">
                <Shield className="w-4 h-4 mr-1.5" /> 100% নিরাপদ পেমেন্ট
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* FULL WIDTH FOOTER (Visible at the very bottom of the entire page) */}
      <footer className="w-full bg-white/40 backdrop-blur-md border-t border-slate-200/50 py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-600 text-sm font-bold">
            © {new Date().getFullYear()} Smriti (স্মৃতি). All rights reserved.
          </p>
        </div>
      </footer>
      
    </div>
  );
}
