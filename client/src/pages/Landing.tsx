import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  MessageCircle, 
  Cake, 
  FileText, 
  CreditCard, 
  Monitor, 
  Check, 
  ArrowRight, 
  Menu, 
  X,
  Crown,
  PhoneCall,
  ChevronDown,
  Sparkles,
  HelpCircle,
  LogIn
} from 'lucide-react';

const heroFeatures = [
  {
    badge: 'জরুরি কাজের রিমাইন্ডার',
    title: 'জরুরি কাজ ভুলে গেছেন?',
    highlight: 'SmritiLife সাথে থাকলে কাজ আর কখনো ভুলবেন না!',
    subtitle: 'অফিসের কাজ, মিটিং বা দৈনন্দিন জরুরি দায়িত্ব—নির্ধারিত সময়ের ঠিক আগেই আপনার WhatsApp-এ পৌঁছে যাবে স্বয়ংক্রিয় রিমাইন্ডার।'
  },
  {
    badge: 'বিশেষ দিনের শুভেচ্ছা',
    title: 'ওয়াইফ বা প্রিয়জনের জন্মদিন ভুলে গেছেন?',
    highlight: 'সঠিক সময়ে আন্তরিক শুভেচ্ছা পাঠিয়ে সম্পর্ক রাখুন সতেজ!',
    subtitle: 'স্ত্রী, বন্ধুবান্ধব বা পরিবারের প্রিয় মানুষের বিশেষ দিনটিতে আপনার পক্ষ থেকে সঠিক সময়ে শুভেচ্ছা বার্তা পৌঁছে দেবে SmritiLife।'
  },
  {
    badge: 'স্বাস্থ্য ও ওষুধ রিমাইন্ডার',
    title: 'নিয়মিত ওষুধ খেতে বা ডাক্তারের ভিজিট ভুলে যাচ্ছেন?',
    highlight: 'স্বাস্থ্য সচেতনতায় সঠিক সময়ে ওষুধের অ্যালার্ট!',
    subtitle: 'সকাল, দুপুর কিংবা রাতে ওষুধের সঠিক সময় মিস হওয়ার সুযোগ নেই—WhatsApp মেসেজ দিয়ে আপনাকে সতর্ক রাখবে SmritiLife।'
  },
  {
    badge: 'নোট ও কাজের তালিকা',
    title: 'বাজারের তালিকা বা দরকারি নোট মনে নেই?',
    highlight: 'এক নিমেষে গুছিয়ে রাখুন সবকিছু আপনার হাতের মুঠোয়!',
    subtitle: 'কেনাকাটার ফর্দ, আইডিয়া কিংবা জরুরি নোট—ওয়েবসাইট বা চ্যাটের মাধ্যমে সহজে সেভ করে রাখুন এবং প্রয়োজনমতো পান।'
  },
  {
    badge: 'বিল ও ডেডলাইন রিমাইন্ডার',
    title: 'বিদ্যুৎ বিল বা জরুরি ডেডলাইনের কথা মনে পড়ছে না?',
    highlight: 'বিল বা ডেডলাইন পার হওয়ার আগেই সতর্ক থাকুন!',
    subtitle: 'অফিসের গুরুত্বপূর্ণ ডেডলাইন, বাসা ভাড়া কিংবা ইউটিলিটি বিলের সঠিক রিমাইন্ডার নিশ্চিত করে টেনশনমুক্ত থাকুন প্রতিদিন।'
  }
];

const faqs = [
  {
    question: 'SmritiLife কীভাবে কাজ করে?',
    answer: 'SmritiLife হলো আপনার ব্যক্তিগত WhatsApp Agent। ওয়েবসাইট বা সরাসরি WhatsApp-এ বার্তা দিয়ে আপনি যেকোনো রিমাইন্ডার, নোট বা শুভেচ্ছা সেট করতে পারেন। নির্ধারিত সময়ে এটি স্বয়ংক্রিয়ভাবে আপনাকে WhatsApp মেসেজে জানিয়ে দেবে।'
  },
  {
    question: 'আমাকে কি আলাদা কোনো মোবাইল অ্যাপ ইনস্টল করতে হবে?',
    answer: 'একদমই না! আপনাকে কোনো বাড়তি অ্যাপ ডাউনলোড করতে হবে না। আপনার ফোনে আগে থেকেই থাকা সাধারণ WhatsApp-এর মাধ্যমেই সব সেবা পেয়ে যাবেন।'
  },
  {
    question: 'কী কাজে লাগে SmritiLife?',
    answer: 'দৈনন্দিন গুরুত্বপূর্ণ কাজের রিমাইন্ডার, সঠিক সময়ে ওষুধ খাওয়া, প্রিয়জনের জন্মদিন বা বিবাহবার্ষিকীর শুভেচ্ছা, বিদ্যুৎ বিলের অ্যালার্ট এবং বাজার বা জরুরি নোট সংরক্ষণে এটি প্রতিদিন কাজে লাগে।'
  },
  {
    question: 'আমি কি নিজের পাশাপাশি অন্যদের নম্বরেও মেসেজ পাঠাতে পারব?',
    answer: 'হ্যাঁ, অবশ্যই! আপনি নিজের জন্য রিমাইন্ডার নেওয়ার পাশাপাশি মা, বাবা, স্ত্রী বা প্রিয় বন্ধুর নম্বরেও নির্দিষ্ট সময়ে স্বয়ংক্রিয় শুভেচ্ছা বা রিমাইন্ডার পাঠাতে পারবেন।'
  },
  {
    question: 'সাবস্ক্রিপশন ফি কত এবং কীভাবে পেমেন্ট করব?',
    answer: 'SmritiLife-এর সব আনলিমিটেড প্রিমিয়াম সুবিধা উপভোগ করতে মাসিক চার্জ মাত্র ১৯০ টাকা। bKash-এর মাধ্যমে খুব সহজে ও নিরাপদে পেমেন্ট করে তাৎক্ষণিক সার্ভিস চালু করতে পারবেন।'
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Auto rotate hero titles every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentFeatureIndex((prev) => (prev + 1) % heroFeatures.length);
        setFade(true);
      }, 250);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Force normal font size on landing page
  useEffect(() => {
    const originalFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.setProperty('font-size', '16px', 'important');
    return () => {
      document.documentElement.style.fontSize = originalFontSize;
    };
  }, []);

  const handleSubscribe = () => {
    setMobileMenuOpen(false);
    navigate('/paywall');
  };

  const handleOpenWhatsApp = () => {
    setMobileMenuOpen(false);
    const whatsappUrl = 'https://wa.me/8801862636137?text=' + encodeURIComponent('হ্যালো স্মৃতি লাইফ, আমি জানতে চাই...');
    window.open(whatsappUrl, '_blank');
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const currentHero = heroFeatures[currentFeatureIndex];

  return (
    <div className="min-h-screen bg-[#FAFCFB] text-slate-800 font-sans selection:bg-[#0A7756]/20 selection:text-[#0A7756] flex flex-col antialiased">
      
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          
          {/* Logo with Heart Leaf icon */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0A7756] to-[#12A57A] flex items-center justify-center shadow-sm shadow-[#0A7756]/20 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                <path d="M12 5v14" />
              </svg>
            </div>
            <span className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900">
              Smriti<span className="text-[#0A7756]">Life</span>
            </span>
          </div>

          {/* Right Controls (Desktop & Mobile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#0A7756] font-bold px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-full transition cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#0A7756]" />
              লগইন
            </button>
            <button
              onClick={handleSubscribe}
              className="bg-[#0A7756] hover:bg-[#086347] active:scale-95 text-white font-bold text-xs sm:text-sm md:text-base px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md shadow-[#0A7756]/25 hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              এখনই শুরু করুন
            </button>
            {/* 3-line / 3-dot hamburger menu button for all devices */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition cursor-pointer border border-slate-200/80 bg-white shadow-sm"
              aria-label="Toggle menu"
              title="মেনু"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>

        </div>

        {/* Dropdown Menu Modal (Shown when clicking 3-line menu button) */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-[#FAFCFB]/98 backdrop-blur-xl border-b border-slate-200/80 shadow-2xl py-6 px-4 animate-in slide-in-from-top-2 z-50">
            <div className="max-w-md mx-auto space-y-4">
              
              {/* Menu items card styled just like Remique */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-3 shadow-md space-y-1">
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="w-full text-left font-bold text-slate-700 hover:text-[#0A7756] hover:bg-emerald-50/50 px-4 py-3.5 rounded-2xl transition cursor-pointer"
                >
                  কীভাবে কাজ করে
                </button>

                <button
                  onClick={() => scrollToSection('features')}
                  className="w-full text-left font-bold text-slate-700 hover:text-[#0A7756] hover:bg-emerald-50/50 px-4 py-3.5 rounded-2xl transition cursor-pointer"
                >
                  কী কাজে লাগে
                </button>

                <button
                  onClick={() => scrollToSection('pricing')}
                  className="w-full text-left font-bold text-slate-700 hover:text-[#0A7756] hover:bg-emerald-50/50 px-4 py-3.5 rounded-2xl transition cursor-pointer"
                >
                  প্রাইসিং
                </button>

                <button
                  onClick={() => scrollToSection('faq')}
                  className="w-full text-left font-bold text-slate-700 hover:text-[#0A7756] hover:bg-emerald-50/50 px-4 py-3.5 rounded-2xl transition cursor-pointer"
                >
                  সাধারণ প্রশ্ন
                </button>
              </div>

              {/* Action buttons inside menu */}
              <div className="space-y-2">
                <button
                  onClick={handleSubscribe}
                  className="w-full bg-[#0A7756] hover:bg-[#086347] active:scale-95 text-white font-bold py-3.5 rounded-2xl text-center shadow-md shadow-[#0A7756]/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>এখনই শুরু করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleOpenWhatsApp}
                  className="w-full bg-[#EBF7F2] hover:bg-[#d8f1e7] text-[#0A7756] font-bold py-3 rounded-2xl text-center flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  <span>WhatsApp-এ কথা বলুন</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-10 sm:pt-14 pb-14 sm:pb-20">
        {/* Soft decorative background leaf illustration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-[#0A7756]/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Hero Content (7 Cols) */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Dynamic Badge & Scenario Rotator Dots */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 bg-[#0A7756]/10 text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full border border-[#0A7756]/20">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A7756]" />
                  <span>{currentHero.badge}</span>
                </div>

                {/* Progress Indicators / Clickable Pills */}
                <div className="flex items-center gap-1.5">
                  {heroFeatures.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setFade(false);
                        setTimeout(() => {
                          setCurrentFeatureIndex(idx);
                          setFade(true);
                        }, 150);
                      }}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        currentFeatureIndex === idx
                          ? 'w-6 bg-[#0A7756]'
                          : 'w-2 bg-slate-200 hover:bg-slate-300'
                      }`}
                      aria-label={`Go to scenario ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Dynamic Rotating Headline with Smooth Fade */}
              <div className={`transition-all duration-300 min-h-[145px] sm:min-h-[160px] flex flex-col justify-center ${
                fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-[1.2] tracking-tight">
                  {currentHero.title}
                </h1>
                <p className="text-xl sm:text-2xl font-bold text-[#0A7756] mt-2">
                  {currentHero.highlight}
                </p>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal mt-3 max-w-xl">
                  {currentHero.subtitle}
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleSubscribe}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#0A7756] hover:bg-[#086347] active:scale-95 text-white font-bold text-base sm:text-lg px-8 py-3.5 rounded-full shadow-lg shadow-[#0A7756]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <Crown className="w-5 h-5 text-amber-300" />
                  <span>এখনই শুরু করুন ৳ ১৯০ / মাস</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleOpenWhatsApp}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-95 text-[#0A7756] font-bold text-base px-6 py-3.5 rounded-full border border-slate-200 shadow-sm transition cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  <span>WhatsApp-এ কথা বলুন</span>
                </button>
              </div>

            </div>

            {/* Right Hero Graphic: Phone Mockup (5 Cols) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[340px] sm:max-w-[370px]">
                
                {/* Decorative floating green leaves in background */}
                <div className="absolute -right-6 top-10 w-24 h-24 bg-[#0A7756]/15 rounded-full blur-xl -z-10" />
                <div className="absolute -left-6 bottom-10 w-20 h-20 bg-[#12A57A]/15 rounded-full blur-xl -z-10" />

                {/* Smartphone Device Frame */}
                <div className="bg-slate-900 rounded-[3rem] p-3.5 shadow-[0_25px_60px_-15px_rgba(10,119,86,0.3)] border-[5px] border-slate-800">
                  
                  {/* Phone Screen */}
                  <div className="bg-[#F4F7F5] rounded-[2.3rem] overflow-hidden border border-slate-200/50 flex flex-col text-slate-800">
                    
                    {/* Status Bar */}
                    <div className="h-7 bg-white px-6 flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span>8:51</span>
                      <div className="w-16 h-3 bg-slate-900 rounded-full mx-auto" />
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                        <span className="text-[10px]">94%</span>
                      </div>
                    </div>

                    {/* Chat / App Bar */}
                    <div className="bg-white px-4 py-2.5 border-b border-slate-100 flex items-center justify-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#0A7756] flex items-center justify-center text-white">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black text-slate-900">SmritiLife</div>
                        <div className="text-[9px] text-[#0A7756] font-semibold flex items-center justify-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0A7756] inline-block animate-pulse" />
                          Online
                        </div>
                      </div>
                    </div>

                    {/* Message Cards Inside Phone */}
                    <div className="p-4 space-y-3">
                      
                      {/* Card 1: Today's Reminder */}
                      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100/80 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Bell className="w-4 h-4 fill-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900">আজকের রিমাইন্ডার</h4>
                            <span className="text-[9px] text-slate-400">9:00 AM</span>
                          </div>
                          <ul className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                            <li className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              ওষুধ খাওয়া
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              মিটিং 10:00 AM
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Card 2: Happy Birthday Wish */}
                      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100/80 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                          <Cake className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              শুভ জন্মদিন! 🎉
                            </h4>
                            <span className="text-[9px] text-slate-400">8:00 AM</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            আপনার বিশেষ দিনটি শুভ হোক!
                          </p>
                        </div>
                      </div>

                      {/* Card 3: Notes */}
                      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100/80 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900">নোট</h4>
                            <span className="text-[9px] text-slate-400">10:00 AM</span>
                          </div>
                          <ul className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                            <li className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              বাজার করা
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                              বিদ্যুৎ বিল
                            </li>
                          </ul>
                        </div>
                      </div>

                    </div>

                    {/* Bottom bar inside phone */}
                    <div className="h-6 bg-white/50 mt-auto flex items-center justify-center">
                      <div className="w-24 h-1 bg-slate-300 rounded-full" />
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. 4-FEATURE PILL CARDS (কী কাজে লাগে) */}
      <section id="features" className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            
            {/* Feature 1: Reminder */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0A7756] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">রিমাইন্ডার</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-snug">
                কাজ, ওষুধ, মিটিং<br />যা কিছু গুরুত্বপূর্ণ
              </p>
            </div>

            {/* Feature 2: WhatsApp Message */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#25D366] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">WhatsApp মেসেজ</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-snug">
                নির্ধারিত সময়ে<br />স্বয়ংক্রিয়ভাবে
              </p>
            </div>

            {/* Feature 3: Special Day Wish */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Cake className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">বিশেষ দিনের শুভেচ্ছা</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-snug">
                জন্মদিন, বিবাহবার্ষিকী<br />ও অন্যান্য দিন
              </p>
            </div>

            {/* Feature 4: Note & Checklist */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">নোট ও তালিকা</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-snug">
                ব্যক্তিগত নোট ও<br />কাজের তালিকা
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. HOW TO USE? (3 STEPS) (কীভাবে কাজ করে) */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-[#F7FAF8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          {/* Section Heading */}
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              কিভাবে ব্যবহার করবেন?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1.5">
              শুধু ৩টি ধাপে শুরু করুন
            </p>
          </div>

          {/* Steps Horizontal Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center relative group">
              {/* Step Badge */}
              <div className="w-7 h-7 rounded-full bg-[#0A7756] text-white text-xs font-bold flex items-center justify-center mb-4 shadow-sm">
                1
              </div>
              {/* Step Icon Box */}
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-[#0A7756] mb-4 group-hover:scale-105 transition-transform">
                <CreditCard className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1.5">
                ৳ ১৯০ দিয়ে শুরু করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed max-w-xs">
                bKash দিয়ে সহজে পেমেন্ট করে সাবস্ক্রিপশন চালু করুন।
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center relative group">
              {/* Step Badge */}
              <div className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mb-4 shadow-sm">
                2
              </div>
              {/* Step Icon Box */}
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-amber-600 mb-4 group-hover:scale-105 transition-transform">
                <Monitor className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1.5">
                ওয়েবসাইট থেকে রিমাইন্ডার তৈরি করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed max-w-xs">
                লগইন করে রিমাইন্ডার, শুভেচ্ছা বা নোট তৈরি করুন।
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center relative group">
              {/* Step Badge */}
              <div className="w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center mb-4 shadow-sm">
                3
              </div>
              {/* Step Icon Box */}
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-[#25D366] mb-4 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1.5">
                অথবা WhatsApp Agent দিয়েও তৈরি করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed max-w-xs">
                আমাদের WhatsApp নম্বরে মেসেজ দিয়ে রিমাইন্ডার, শুভেচ্ছা বা নোট যোগ করুন।
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 5. PRICING SECTION: ONE SIMPLE PLAN (প্রাইসিং) */}
      <section id="pricing" className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left Title Area (5 Cols) */}
            <div className="md:col-span-5 text-left space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                একটি সহজ প্ল্যান
              </h2>
              <p className="text-lg text-slate-600 font-medium">
                সব গুরুত্বপূর্ণ সুবিধা একসাথে
              </p>
            </div>

            {/* Right Plan Card (7 Cols) */}
            <div className="md:col-span-7">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_15px_40px_rgba(0,0,0,0.06)] overflow-hidden">
                
                {/* Green Top Header */}
                <div className="bg-[#0A7756] py-3 text-center text-white font-bold text-sm tracking-wide">
                  মাসিক প্ল্যান
                </div>

                {/* Card Body */}
                <div className="p-6 sm:p-8 space-y-6">
                  
                  {/* Price Header */}
                  <div className="text-center pb-2 border-b border-slate-100">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900">৳ ১৯০</span>
                      <span className="text-base text-slate-500 font-medium">/ মাস</span>
                    </div>
                  </div>

                  {/* Bullet Checklist */}
                  <ul className="space-y-3 text-sm sm:text-base font-medium text-slate-700">
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#0A7756] shrink-0" strokeWidth={2.5} />
                      <span>অসীম রিমাইন্ডার</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#0A7756] shrink-0" strokeWidth={2.5} />
                      <span>WhatsApp মেসেজ (নিজের ও অন্যদের)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#0A7756] shrink-0" strokeWidth={2.5} />
                      <span>বিশেষ দিনের শুভেচ্ছা</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#0A7756] shrink-0" strokeWidth={2.5} />
                      <span>নোট ও তালিকা</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#0A7756] shrink-0" strokeWidth={2.5} />
                      <span>সব প্রিমিয়াম সুবিধা</span>
                    </li>
                  </ul>

                  {/* Subscribe Action Button */}
                  <button
                    onClick={handleSubscribe}
                    className="w-full bg-[#0A7756] hover:bg-[#086347] active:scale-98 text-white font-bold text-base py-3.5 rounded-full shadow-md shadow-[#0A7756]/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>এখনই শুরু করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5.5. FAQ SECTION: সাধারণ প্রশ্ন */}
      <section id="faq" className="py-16 sm:py-20 bg-[#F7FAF8] border-t border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 bg-[#0A7756]/10 text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full mb-3">
              <HelpCircle className="w-4 h-4" />
              <span>সাধারণ প্রশ্ন ও উত্তর</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              সচরাচর জিজ্ঞাসিত প্রশ্ন
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-2">
              SmritiLife সম্পর্কে আপনার যা কিছু জানা দরকার
            </p>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-slate-900 hover:text-[#0A7756] transition cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0A7756]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. BOTTOM CONTACT FOOTER BAR */}
      <footer className="mt-auto bg-[#F4F7F5] border-t border-slate-200/60 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Left info with WhatsApp Icon */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-sm">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">আরো জানতে চান?</h4>
              <p className="text-xs sm:text-sm text-slate-500">আমাদের WhatsApp Agent-এ কথা বলুন</p>
            </div>
          </div>

          {/* Right WhatsApp Action Button */}
          <button
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:scale-95 text-[#0A7756] font-bold text-sm sm:text-base px-6 py-2.5 rounded-full border border-slate-200 shadow-sm transition"
          >
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            <span>WhatsApp-এ কথা বলুন</span>
          </button>

        </div>
      </footer>

    </div>
  );
}
