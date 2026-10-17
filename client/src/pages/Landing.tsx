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
  ChevronDown,
  Sparkles,
  HelpCircle,
  LogIn,
  Bot,
  Zap,
  ShieldCheck,
  CheckCheck,
  AlarmClock,
  Wallet,
  HandCoins,
  Pill,
  Moon,
  FolderLock,
  ListTodo,
  Mic,
  Store
} from 'lucide-react';

const heroFeatures = [
  {
    badge: 'জরুরি কাজের রিমাইন্ডার',
    title: 'জরুরি কাজ ভুলে গেছেন?',
    highlight: 'SmritiLife সাথে থাকলে কাজ আর কখনো ভুলবেন না!',
    subtitle: 'অফিসের কাজ, মিটিং বা দৈনন্দিন জরুরি দায়িত্ব—সময়ের ঠিক আগেই আপনার WhatsApp-এ পৌঁছে যাবে স্বয়ংক্রিয় রিমাইন্ডার।'
  },
  {
    badge: 'বিশেষ দিনের শুভেচ্ছা',
    title: 'প্রিয়জনের জন্মদিন ভুলে গেছেন?',
    highlight: 'সঠিক সময়ে আন্তরিক শুভেচ্ছা পাঠিয়ে সম্পর্ক রাখুন সতেজ!',
    subtitle: 'পরিবার বা প্রিয় মানুষের বিশেষ দিনটিতে আপনার পক্ষ থেকে সঠিক সময়ে মিষ্টি শুভেচ্ছা বার্তা পৌঁছে দেবে SmritiLife।'
  },
  {
    badge: 'স্বাস্থ্য ও ওষুধ রিমাইন্ডার',
    title: 'নিয়মিত ওষুধ খেতে ভুলে যাচ্ছেন?',
    highlight: 'স্বাস্থ্য সচেতনতায় সঠিক সময়ে ওষুধের অ্যালার্ট!',
    subtitle: 'সকাল, দুপুর কিংবা রাতে ওষুধের সঠিক সময় মিস হওয়ার সুযোগ নেই—সঠিক মুহূর্তে WhatsApp মেসেজে সতর্ক থাকুন।'
  },
  {
    badge: 'নোট ও কাজের তালিকা',
    title: 'বাজারের তালিকা বা নোট মনে নেই?',
    highlight: 'এক নিমেষে গুছিয়ে রাখুন সবকিছু আপনার হাতের মুঠোয়!',
    subtitle: 'কেনাকাটার ফর্দ, জরুরি আইডিয়া বা নোট—সহজে সেভ করে রাখুন এবং যেকোনো সময় প্রয়োজনমতো হাতের কাছে পান।'
  },
  {
    badge: 'বিল ও ডেডলাইন রিমাইন্ডার',
    title: 'বিদ্যুৎ বিলের ডেডলাইন মনে নেই?',
    highlight: 'বিল বা ডেডলাইন পার হওয়ার আগেই সতর্ক থাকুন!',
    subtitle: 'অফিসের গুরুত্বপূর্ণ ডেডলাইন, বাসা ভাড়া কিংবা ইউটিলিটি বিলের সঠিক রিমাইন্ডার নিশ্চিত করে টেনশনমুক্ত থাকুন।'
  },
  {
    badge: 'দৈনিক খরচ ও ধার-দেনা',
    title: 'মাসের খরচের হিসাব রাখা কঠিন?',
    highlight: 'প্রতিটি টাকার নিখুঁত হিসাব রাখুন এক নিমেষে!',
    subtitle: 'বাজারে বা যাতায়াতে যা খরচ হলো তা মেসেজে লিখে রাখুন—ক্যাটাগরি ভিত্তিক মোট খরচের হিসাব পান স্বয়ংক্রিয়ভাবে।'
  },
  {
    badge: 'রমজান ও সেহরি ওয়েক-আপ',
    title: 'সেহরিতে ঘুম ভাঙা নিয়ে দুশ্চিন্তা?',
    highlight: 'সময়মতো ওয়েক-আপ অ্যালার্মে ঘুম ভাঙিয়ে দেবে SmritiLife!',
    subtitle: 'বাংলাদেশের ৬৪ জেলার সঠিক সেহরি ও ইফতারের সময়সূচী এবং ঘুম ভাঙানোর জন্য উচ্চশব্দে রিং অ্যালার্মের সুবিধা।'
  }
];

const faqs = [
  {
    question: 'SmritiLife কীভাবে কাজ করে?',
    answer: 'SmritiLife হলো আপনার ব্যক্তিগত AI WhatsApp Agent। ওয়েবসাইট বা সরাসরি WhatsApp-এ সাধারণ বাংলায় বার্তা পাঠিয়ে আপনি যেকোনো রিমাইন্ডার, নোট বা শুভেচ্ছা সেট করতে পারেন। নির্ধারিত সময়ে এটি স্বয়ংক্রিয়ভাবে আপনাকে WhatsApp মেসেজে জানিয়ে দেবে।'
  },
  {
    question: 'আমাকে কি আলাদা কোনো মোবাইল অ্যাপ ইনস্টল করতে হবে?',
    answer: 'একদমই না! আপনাকে কোনো অ্যাপ ডাউনলোড করতে হবে না। আপনার ফোনে আগে থেকেই থাকা সাধারণ WhatsApp-এর মাধ্যমেই সব সেবা চমৎকারভাবে পাবেন।'
  },
  {
    question: 'কী কাজে লাগে SmritiLife?',
    answer: 'দৈনন্দিন গুরুত্বপূর্ণ কাজের রিমাইন্ডার, ঘুম ভাঙার ওয়েক-আপ অ্যালার্ম, সময়মতো ওষুধ খাওয়ার রুটিন, দৈনিক খরচ ও ধার-দেনার হিসাব, প্রিয়জনকে বিশেষ দিনের শুভেচ্ছা বার্তা, সেহরি-ইফতারের সময়সূচী এবং জরুরি ফাইল ও নোট সংরক্ষণে এটি প্রতিটি পদক্ষেপে আপনার বিশ্বস্ত ডিজিটাল সহকারী হিসেবে কাজ করে।'
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
    <div className="relative min-h-screen bg-[#F4F9F6] text-slate-800 font-sans selection:bg-[#0A7756]/20 selection:text-[#0A7756] flex flex-col antialiased overflow-x-clip">
      
      {/* AMBIENT GLOWING MESH ORBS (MODERN AI GLASS AESTHETIC) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-emerald-200/40 via-teal-100/30 to-emerald-300/20 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-[650px] -right-32 w-[550px] h-[550px] bg-gradient-to-br from-emerald-100/40 via-teal-200/25 to-transparent rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[1400px] -left-32 w-[600px] h-[600px] bg-gradient-to-tr from-teal-100/30 via-emerald-100/30 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />
      
      {/* SUBTLE TECH DOT GRID OVERLAY */}
      <div className="absolute inset-0 bg-[radial-gradient(#0A7756_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.06] pointer-events-none -z-10" />

      {/* 1. TOP NAVBAR (GLASSMORPHISM) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-slate-200/60 shadow-[0_4px_30px_rgba(10,119,86,0.05)] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Logo with Robot AI Avatar & AI Badge */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none group shrink-0"
          >
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center group-hover:scale-105 transition-all duration-300">
              <img 
                src="/robot-icon.png" 
                alt="SmritiLife AI" 
                className="w-full h-full rounded-full object-cover shadow-md shadow-[#0A7756]/20 ring-2 ring-emerald-500/30" 
              />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-[26px] font-black tracking-tight text-slate-900">
                Smriti<span className="text-[#0A7756]">Life</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#0A7756] border border-emerald-500/20 shadow-xs">
                AI Agent
              </span>
            </div>
          </div>

          {/* Right Controls (Desktop & Mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#0A7756] font-bold px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full bg-white/70 hover:bg-white border border-slate-200/80 shadow-xs backdrop-blur-md transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0A7756]" />
              <span>লগইন</span>
            </button>
          </div>

        </div>
      </header>

      {/* Spacer to preserve natural flow underneath the fixed header */}
      <div className="h-16 sm:h-20 shrink-0" aria-hidden="true" />

      {/* 2. HERO SECTION (AI AGENT & LIVE CHAT SIMULATION) */}
      <section className="relative overflow-hidden pt-4 sm:pt-8 pb-6 sm:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 lg:gap-8 items-center">
            
            {/* Left Hero Content (7 Cols) */}
            <div className="lg:col-span-7 space-y-3 sm:space-y-5 text-left">
              
              {/* Dynamic AI Badge & Live Indicator */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2.5 bg-white/80 backdrop-blur-xl text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-emerald-500/20 shadow-xs">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span>{currentHero.badge}</span>
                </div>

                {/* Scenario Indicators (Clickable glass pills) */}
                <div className="flex items-center gap-1.5 p-1 bg-white/60 backdrop-blur-md rounded-full border border-slate-200/60 shadow-xs">
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
                          ? 'w-7 bg-gradient-to-r from-[#0A7756] to-[#12A57A] shadow-xs'
                          : 'w-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={`Go to scenario ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Dynamic Rotating Headline with Smooth Fade (Compact & Stable) */}
              <div className={`transition-opacity duration-300 min-h-[140px] sm:min-h-[160px] md:min-h-[180px] lg:min-h-[200px] flex flex-col justify-start ${
                fade ? 'opacity-100' : 'opacity-0'
              }`}>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-[50px] font-black text-slate-900 leading-[1.2] tracking-tight">
                  {currentHero.title}
                </h1>
                <p className="text-lg sm:text-2xl font-black bg-gradient-to-r from-[#0A7756] via-teal-600 to-[#12A57A] bg-clip-text text-transparent mt-1.5 sm:mt-2.5 leading-snug">
                  {currentHero.highlight}
                </p>
                <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal mt-2 sm:mt-3 max-w-xl">
                  {currentHero.subtitle}
                </p>
              </div>

            </div>

            {/* Right Hero Graphic: Phone Mockup Showing Live AI WhatsApp Experience */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[340px] sm:max-w-[375px]">
                
                {/* Ambient glowing radial orbs behind the phone */}
                <div className="absolute -right-8 top-12 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -z-10" />
                <div className="absolute -left-8 bottom-12 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl -z-10" />

                {/* Smartphone Device Frame */}
                <div className="bg-slate-900 rounded-[3rem] p-3.5 shadow-[0_25px_65px_-10px_rgba(10,119,86,0.35)] border-[5px] border-slate-800">
                  
                  {/* Phone Screen with Glass Texture */}
                  <div className="bg-[#EFEAE2] rounded-[2.3rem] overflow-hidden border border-slate-200/50 flex flex-col text-slate-800 min-h-[510px]">
                    
                    {/* Status Bar */}
                    <div className="h-7 bg-[#075E54] px-6 flex justify-between items-center text-[10px] font-bold text-white/80">
                      <span>9:41</span>
                      <div className="w-16 h-3 bg-black/40 rounded-full mx-auto" />
                      <div className="flex items-center gap-1 text-[10px]">
                        <span>4G</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        <span>98%</span>
                      </div>
                    </div>

                    {/* WhatsApp Top Header with Verified AI Badge */}
                    <div className="bg-[#075E54] px-4 py-2.5 text-white flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                          <img 
                            src="/robot-icon.png" 
                            alt="SmritiLife AI" 
                            className="w-full h-full rounded-full object-cover border border-emerald-300/40 shadow-xs" 
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1 leading-tight">
                            <span>SmritiLife AI</span>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-300 inline" />
                          </div>
                          <div className="text-[10px] text-emerald-200 font-medium">Online • Smart Assistant</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-600/60 px-2 py-0.5 rounded-full font-bold text-emerald-100">AI BOT</span>
                    </div>

                    {/* Realistic WhatsApp Chat Stream */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-end text-xs">
                      
                      {/* Date Bubble */}
                      <div className="text-center my-1">
                        <span className="bg-white/80 backdrop-blur-md text-slate-500 text-[10px] px-2.5 py-0.5 rounded-md shadow-xs">
                          আজ
                        </span>
                      </div>

                      {/* Message 1: User Request */}
                      <div className="self-end max-w-[85%] bg-[#D9FDD3] rounded-2xl rounded-tr-xs p-2.5 shadow-xs text-slate-800">
                        <p className="leading-snug text-[11px]">
                          কাল সকাল ৯টায় প্রেসক্রিপশনের ওষুধ খাওয়ার কথা মনে করিয়ে দিও তো 💊
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-1">
                          <span>8:49 AM</span>
                          <CheckCheck className="w-3 h-3 text-sky-500" />
                        </div>
                      </div>

                      {/* Message 2: AI Bot Confirmation */}
                      <div className="self-start max-w-[88%] bg-white rounded-2xl rounded-tl-xs p-2.5 shadow-xs text-slate-800 border border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-[#0A7756] mb-0.5">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          <span>রিমাইন্ডার সেট সম্পন্ন!</span>
                        </div>
                        <p className="leading-snug text-[11px] text-slate-700">
                          কাল সকাল ৯:০০ টায় ঠিক সময়ে আপনাকে WhatsApp-এ অ্যালার্ট দেওয়া হবে।
                        </p>
                        <div className="text-right text-[9px] text-slate-400 mt-1">
                          8:49 AM
                        </div>
                      </div>

                      {/* Message 3: User Request 2 */}
                      <div className="self-end max-w-[85%] bg-[#D9FDD3] rounded-2xl rounded-tr-xs p-2.5 shadow-xs text-slate-800">
                        <p className="leading-snug text-[11px]">
                          আর ১২ তারিখ ওয়াইফের জন্মদিনের উইশ রাত ১২টায় পাঠাতে হবে 🎂
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-1">
                          <span>8:50 AM</span>
                          <CheckCheck className="w-3 h-3 text-sky-500" />
                        </div>
                      </div>

                      {/* Message 4: AI Bot Schedule */}
                      <div className="self-start max-w-[88%] bg-white rounded-2xl rounded-tl-xs p-2.5 shadow-xs text-slate-800 border border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mb-0.5">
                          <Cake className="w-3 h-3" />
                          <span>জন্মদিনের শুভেচ্ছা শিডিউলড!</span>
                        </div>
                        <p className="leading-snug text-[11px] text-slate-700">
                          ১২ নভেম্বর রাত ১২:০০ টায় আপনার পক্ষ থেকে আন্তরিক শুভেচ্ছা বার্তা পৌঁছে যাবে।
                        </p>
                        <div className="text-right text-[9px] text-slate-400 mt-1">
                          8:50 AM
                        </div>
                      </div>

                      {/* AI Status Banner inside chat */}
                      <div className="mt-2 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-100/90 text-[#0A7756] text-[10px] font-bold py-1 px-3 rounded-full shadow-xs">
                          <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                          <span>২৪/৭ একটিভ AI অ্যাসিস্ট্যান্ট</span>
                        </div>
                      </div>

                    </div>

                    {/* Bottom Home Indicator */}
                    <div className="h-6 bg-[#EFEAE2] flex items-center justify-center">
                      <div className="w-24 h-1 bg-slate-400/60 rounded-full" />
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. 10-FEATURE BENTO CARDS (কী কী কাজে লাগে) - FROSTED GLASS CARDS */}
      <section id="features" className="pt-2 pb-10 sm:pb-14 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-7 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-xs mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#0A7756]" />
              <span>স্মার্ট AI সুবিধা সমূহ</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              দৈনন্দিন জীবনের কী কী কাজে লাগে?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-2 max-w-xl mx-auto">
              কাজের রিমাইন্ডার থেকে শুরু করে খরচের হিসাব—সবকিছু গুছিয়ে রাখার অল-ইন-ওয়ান AI সহকারী
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            
            {/* Feature 1: Reminders & Alarm */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(10,119,86,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#0A7756] to-[#12A57A] text-white flex items-center justify-center mb-4 shadow-md shadow-[#0A7756]/25 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <AlarmClock className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">রিমাইন্ডার ও ওয়েক-আপ অ্যালার্ম</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                জরুরি কাজ, মিটিং কিংবা ঘুম ভাঙানোর ওয়েক-আপ অ্যালার্ম—কোনো কিছুই আর মিস হবে না।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#0A7756] bg-emerald-50 px-3 py-1 rounded-full">
                ⏰ ৩ বার পর্যন্ত রিং অ্যালার্ট
              </span>
            </div>

            {/* Feature 2: Expense Tracker */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(13,148,136,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center mb-4 shadow-md shadow-teal-600/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Wallet className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">দৈনিক ও মাসিক খরচ ট্র্যাকার</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                মেসেজে খরচের কথা লিখলেই (যেমন: "বাজারে ৫০০ টাকা") স্বয়ংক্রিয়ভাবে হিসাব ও ক্যাটাগরি তৈরি হবে।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                💰 স্বয়ংক্রিয় ব্যালেন্স হিসাব
              </span>
            </div>

            {/* Feature 3: Debt / Udhar Tracker */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(245,158,11,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center mb-4 shadow-md shadow-amber-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <HandCoins className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">ধার-দেনা ও বাকি খাতা</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                কাকে কত টাকা ধার দিয়েছেন বা কার কাছে কত লোন—নাম ধরে নিখুঁত বাকি ও উসুলের হিসাব রাখুন।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                🤝 ব্যক্তিভিত্তিক বাকি খাতা
              </span>
            </div>

            {/* Feature 4: Medicine Routine */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(239,68,68,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 text-white flex items-center justify-center mb-4 shadow-md shadow-rose-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Pill className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">ওষুধের রুটিন রিমাইন্ডার</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                প্রেসক্রিপশন অনুযায়ী সকাল, দুপুর, রাতের ওষুধ খাওয়ার আগে বা পরে সময়মতো রিমাইন্ডার পাবেন।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full">
                💊 কোর্স ও ডোজ অ্যালার্ট
              </span>
            </div>

            {/* Feature 5: AI Smart Wish Card */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(236,72,153,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center mb-4 shadow-md shadow-pink-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <Cake className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">বিশেষ দিনের শুভেচ্ছা</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                প্রিয় মানুষের জন্মদিন বা অ্যানিভার্সারিতে আপনার পক্ষ থেকে আকর্ষণীয় এআই উইশ কার্ড পৌঁছে যাবে।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-50 px-3 py-1 rounded-full">
                🎉 অ্যানিমেটেড উইশ কার্ড
              </span>
            </div>

            {/* Feature 6: Ramadan & Prayer */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(20,184,166,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mb-4 shadow-md shadow-emerald-600/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Moon className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">রমজান ও সেহরি ওয়েক-আপ</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                দেশের ৬৪ জেলার সঠিক সেহরি ও ইফতারের লাইভ সময়সূচী, সেহরির অ্যালার্ম এবং প্রয়োজনীয় দোয়া।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                🌙 সেহরি অ্যালার্ম ও দোয়া
              </span>
            </div>

            {/* Feature 7: Document & Prescription Vault */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(99,102,241,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-md shadow-blue-600/25 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <FolderLock className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">প্রেসক্রিপশন ও ফাইল ভল্ট</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                জরুরি প্রেসক্রিপশন বা মেমোর ছবি পাঠিয়ে সুরক্ষিত রাখুন এবং যেকোনো সময় চেয়ে নিলেই ফেরত পান।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                🔒 নিরাপদ ক্লাউড ভল্ট
              </span>
            </div>

            {/* Feature 8: Smart Notes & Vault */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(14,165,233,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white flex items-center justify-center mb-4 shadow-md shadow-sky-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">নোট ও তথ্য ভল্ট</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                বাসার ঠিকানা, রক্তের গ্রুপ বা ওয়াইফাই পাসওয়ার্ড সেভ রাখুন—জিজ্ঞেস করলেই সাথে সাথে উত্তর পাবেন।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-full">
                📋 তথ্য মনে রাখার স্বস্তি
              </span>
            </div>

            {/* Feature 9: To-Do & Checklist */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(168,85,247,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-violet-600 text-white flex items-center justify-center mb-4 shadow-md shadow-purple-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <ListTodo className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">টু-ডু ও বাজারের ফর্দ</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                কেনাকাটার ফর্দ কিংবা কাজের চেকলিস্ট সহজে বানিয়ে রাখুন এবং সম্পন্ন হলে টিকচিহ্ন দিয়ে আপডেট করুন।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                🛒 স্মার্ট চেকলিস্ট
              </span>
            </div>

            {/* Feature 10: Bangla Voice Notes */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(249,115,22,0.12)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 text-white flex items-center justify-center mb-4 shadow-md shadow-orange-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Mic className="w-7 h-7" />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">সরাসরি বাংলা ভয়েস কমান্ড</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4">
                লিখতে ইচ্ছে না হলে সরাসরি WhatsApp-এ বাংলায় ভয়েস নোট পাঠান—এআই শুনে বুঝে কাজ করে দেবে।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-50 px-3 py-1 rounded-full">
                🎙️ ভয়েস এআই প্রসেসিং
              </span>
            </div>

            {/* Feature 11: Messenger AI Shop SaaS */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgba(10,119,86,0.18)] hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center group sm:col-span-2 lg:col-span-1 xl:col-span-2 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 border-emerald-500/20">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#063828] to-[#0A543A] text-emerald-400 flex items-center justify-center mb-4 shadow-md shadow-emerald-950/20 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <Store className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 text-[10px] font-extrabold uppercase mb-1.5 border border-emerald-400/30">
                <span>F-Commerce SaaS</span>
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-1.5">মেসেঞ্জার এআই সেলস শপ</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed mb-4 max-w-md">
                আপনার ফেসবুক পেজ কানেক্ট করলেই এআই ২৪/৭ কাস্টমারদের সাথে বাংলায় কথা বলে পণ্যের তথ্য দেবে, নাম-ফোন-ঠিকানা নিয়ে অর্ডার কনফার্ম করবে এবং তৎক্ষণাৎ আপনার হোয়াটসঅ্যাপে অর্ডার অ্যালার্ট পাঠাবে।
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-3.5 py-1 rounded-full">
                🚀 ২৪/৭ অটো সেলস ও ক্যাটালগ
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* 4. HOW TO USE? (3 STEPS) (কীভাবে কাজ করে) - CONNECTED GLASS STEPS */}
      <section id="how-it-works" className="py-8 sm:py-10 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          
          {/* Section Heading */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-xs mb-3">
              <Zap className="w-3.5 h-3.5 text-[#0A7756]" />
              <span>সহজ ৩ ধাপ</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              কীভাবে ব্যবহার করবেন?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1.5">
              কোনো জটিলতা ছাড়াই মাত্র ১ মিনিটে শুরু করুন
            </p>
          </div>

          {/* Steps Horizontal Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 relative">
            
            {/* Step 1 */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl md:rounded-3xl p-3.5 sm:p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-row md:flex-col items-center md:items-center text-left md:text-center gap-3.5 md:gap-0 relative group">
              <div className="relative shrink-0 md:mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-50/80 text-[#0A7756] flex items-center justify-center border border-emerald-100/60 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-6 h-6 md:w-7 md:h-7" />
                </div>
                <span className="absolute -top-1.5 -left-1.5 md:-top-2 md:-right-2 md:left-auto w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-tr from-[#0A7756] to-[#12A57A] text-white text-[11px] md:text-xs font-black flex items-center justify-center shadow-xs">
                  1
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg mb-0.5 md:mb-2">
                  বাংলায় মেসেজ বা ভয়েস দিন
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  WhatsApp বা ওয়েবসাইটে আপনার কাজ, মিটিং বা প্রয়োজনীয় নোট সাধারণ কথায় লিখে বা মুখে বলুন।
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl md:rounded-3xl p-3.5 sm:p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-row md:flex-col items-center md:items-center text-left md:text-center gap-3.5 md:gap-0 relative group">
              <div className="relative shrink-0 md:mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-50/80 text-amber-600 flex items-center justify-center border border-amber-100/60 group-hover:scale-105 transition-transform">
                  <Bot className="w-6 h-6 md:w-7 md:h-7" />
                </div>
                <span className="absolute -top-1.5 -left-1.5 md:-top-2 md:-right-2 md:left-auto w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white text-[11px] md:text-xs font-black flex items-center justify-center shadow-xs">
                  2
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg mb-0.5 md:mb-2">
                  AI নিজে থেকে সেট করবে
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  আমাদের স্মার্ট AI স্বয়ংক্রিয়ভাবে তারিখ ও সময় বুঝে নিয়ে আপনার জন্য নিখুঁত রিমাইন্ডার সাজিয়ে নেবে।
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl md:rounded-3xl p-3.5 sm:p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-row md:flex-col items-center md:items-center text-left md:text-center gap-3.5 md:gap-0 relative group">
              <div className="relative shrink-0 md:mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-50/80 text-teal-600 flex items-center justify-center border border-teal-100/60 group-hover:scale-105 transition-transform">
                  <Bell className="w-6 h-6 md:w-7 md:h-7" />
                </div>
                <span className="absolute -top-1.5 -left-1.5 md:-top-2 md:-right-2 md:left-auto w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-tr from-[#25D366] to-teal-500 text-white text-[11px] md:text-xs font-black flex items-center justify-center shadow-xs">
                  3
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 text-sm sm:text-base md:text-lg mb-0.5 md:mb-2">
                  সময়মতো WhatsApp অ্যালার্ট পান
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                  নির্ধারিত মুহূর্তে সরাসরি আপনার বা প্রিয়জনের WhatsApp নম্বরে স্বয়ংক্রিয় মেসেজ পৌঁছে যাবে।
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. PRICING SECTION: ONE SIMPLE PLAN (প্রাইসিং) - MODERN AI GLASS PLAN */}
      <section id="pricing" className="py-8 sm:py-10 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Title Area (5 Cols) */}
            <div className="md:col-span-5 text-left space-y-3">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-[#0A7756]" />
                <span>স্বচ্ছ প্রাইসিং</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-tight">
                একটি সহজ প্ল্যান
              </h2>
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
                কোনো হিডেন চার্জ নেই। সব গুরুত্বপূর্ণ AI প্রিমিয়াম সুবিধা একসাথে উপভোগ করুন।
              </p>
            </div>

            {/* Right Plan Card (7 Cols) - Glassmorphic SaaS Card */}
            <div className="md:col-span-7">
              <div className="bg-white/85 backdrop-blur-2xl rounded-3xl border border-emerald-500/25 shadow-[0_20px_50px_-15px_rgba(10,119,86,0.18)] overflow-hidden relative">
                
                {/* Glowing Top Pill Header */}
                <div className="bg-gradient-to-r from-[#0A7756] to-[#0E9069] py-3 text-center text-white font-bold text-sm tracking-wide flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>অল-ইন-ওয়ান AI প্ল্যান</span>
                </div>

                {/* Card Body */}
                <div className="p-7 sm:p-9 space-y-6">
                  
                  {/* Price Header */}
                  <div className="text-center pb-4 border-b border-slate-100">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">৳ ১৯০</span>
                      <span className="text-base text-slate-500 font-semibold">/ মাস</span>
                    </div>
                    <p className="text-xs text-emerald-700 font-medium mt-1">সব ফিচার আনলিমিটেড</p>
                  </div>

                  {/* Bullet Checklist */}
                  <ul className="space-y-3.5 text-sm sm:text-base font-semibold text-slate-700">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>অসীম রিমাইন্ডার ও ওয়েক-আপ অ্যালার্ম</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>WhatsApp মেসেজ (নিজের ও অন্যদের নম্বরে)</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>দৈনিক খরচ ও ধার-দেনার স্বয়ংক্রিয় হিসাব</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>ওষুধের কোর্স রুটিন ও সেহরি অ্যালার্ট</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>বিশেষ দিনের এআই শুভেচ্ছা ও অ্যানিমেটেড কার্ড</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>ডকুমেন্ট, প্রেসক্রিপশন ও তথ্য ভল্ট</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0A7756] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span>বাংলা ভয়েস নোট প্রসেসিং ও ২৪/৭ AI বট সাপোর্ট</span>
                    </li>
                  </ul>

                  {/* Subscribe Action Button */}
                  <button
                    onClick={handleSubscribe}
                    className="w-full bg-gradient-to-r from-[#0A7756] via-[#0B8560] to-[#0E9E73] hover:from-[#086347] hover:to-[#0A7756] active:scale-98 text-white font-bold text-base py-4 rounded-full shadow-lg shadow-[#0A7756]/25 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
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

      {/* 5.5. FAQ SECTION: সাধারণ প্রশ্ন - FROSTED GLASS ACCORDION */}
      <section id="faq" className="py-8 sm:py-10 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#0A7756] font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-xs mb-3">
              <HelpCircle className="w-4 h-4 text-[#0A7756]" />
              <span>সাধারণ প্রশ্ন ও উত্তর</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              সচরাচর জিজ্ঞাসিত প্রশ্ন
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-2">
              SmritiLife সম্পর্কে আপনার যা কিছু জানা দরকার
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/80 shadow-xs hover:border-emerald-500/30 overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-slate-900 hover:text-[#0A7756] transition cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#0A7756]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100/80">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. BOTTOM CONTACT FOOTER BAR (GLASS) */}
      <footer className="mt-auto bg-white/75 backdrop-blur-2xl border-t border-slate-200/60 pt-7 pb-24 sm:py-9">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Left info with WhatsApp Icon */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-[#25D366]/25">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-900 text-base">আরো কিছু জানতে চান?</h4>
              <p className="text-xs sm:text-sm text-slate-500">আমাদের বুদ্ধিমান AI WhatsApp Agent-এ কথা বলুন</p>
            </div>
          </div>

          {/* Right WhatsApp Action Button */}
          <button
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white hover:bg-emerald-50 active:scale-95 text-[#0A7756] font-bold text-sm sm:text-base px-6 py-3 rounded-full border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
          >
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            <span>WhatsApp-এ কথা বলুন</span>
          </button>

        </div>
      </footer>

      {/* Persistent Floating Action Button at Bottom Right Corner */}
      <button
        onClick={handleSubscribe}
        className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-50 inline-flex items-center gap-2 sm:gap-2.5 bg-gradient-to-r from-[#0A7756] via-[#0B8560] to-[#0E9E73] hover:from-[#086347] hover:to-[#0A7756] active:scale-95 text-white font-black text-sm sm:text-base px-5 py-3 sm:px-6 sm:py-3.5 rounded-full shadow-[0_12px_28px_rgba(10,119,86,0.45)] hover:shadow-[0_18px_36px_rgba(10,119,86,0.6)] border border-emerald-300/40 backdrop-blur-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
        aria-label="শুরু করুন"
      >
        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
        <span>শুরু করুন</span>
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
      </button>

    </div>
  );
}
