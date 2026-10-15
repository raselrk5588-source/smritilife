import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Bell, Gift, Mic, Users, LayoutTemplate, Moon, FolderArchive } from 'lucide-react';
import AIAssistantModal from '../components/AIAssistantModal';
import WakeUpAlarmModal from '../components/WakeUpAlarmModal';
import { Toaster } from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';

export default function MainLayout() {
  const { t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const userName = localStorage.getItem('userName') || "রিয়াদ";
  const isMainTab = ['/app', '/app/', '/app/notes', '/app/reminders', '/app/wishes', '/app/ramadan', '/app/documents'].includes(location.pathname);

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/');
    }
    
    // Scale up the application by 120% only for mobile view (< 768px) to make text readable on phone
    // On PC/desktop (>= 768px), use standard 100% to keep proportions sharp and avoid overflow
    const handleResize = () => {
      if (window.innerWidth < 768) {
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
  }, [navigate]);

  // Dynamic check for Ramadan season (Month 9 of Islamic calendar or Sha'ban 26+)
  const isRamadanSeason = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      const m = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
      const d = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
      return m === 9 || (m === 8 && d >= 26);
    } catch (e) {
      return false;
    }
  };
  const isRamadan = isRamadanSeason();

  // New nav items based on user feedback
  const navItems = [
    { path: '/app', icon: Home, label: t('হোম', 'Home') },
    { path: '/app/notes', icon: FileText, label: t('নোট', 'Notes') },
    { path: '/app/reminders', icon: Bell, label: t('রিমাইন্ডার', 'Reminders') },
    { path: '/app/wishes', icon: Gift, label: t('বিশেষ দিন', 'Wishes') },
    { path: '/app/documents', icon: FolderArchive, label: t('ডকুমেন্ট ভল্ট', 'Documents') },
    { path: '/app/ramadan', icon: Moon, label: isRamadan ? t('রমজান স্পেশাল', 'Ramadan') : t('নামাজ ও রোজা', 'Prayer & Fast') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f6f8f9] font-sans">
      
      {/* Web View Top Navigation (Premium Consumer Glassmorphism Style) */}
      <header className="hidden md:flex bg-white/95 backdrop-blur-md text-slate-800 sticky top-0 z-50 h-[64px] items-center border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] transition-all">
        <div className="w-full max-w-6xl mx-auto px-4 lg:px-6 flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <Link to="/app" className="flex items-center space-x-2.5 group select-none shrink-0">
            <div className="relative w-9 h-9 rounded-full flex items-center justify-center group-hover:scale-105 transition-all duration-300 shrink-0">
              <img 
                src="/robot-icon.png" 
                alt="SmritiLife AI" 
                className="w-full h-full rounded-full object-cover shadow-sm ring-2 ring-emerald-500/25" 
              />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900 leading-none">
                  Smriti<span className="text-[#0A7756]">Life</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">স্মৃতি লাইফ</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide leading-tight mt-0.5">স্মার্ট ব্যক্তিগত সহকারী</span>
            </div>
          </Link>
          
          {/* Center Navigation Tabs (Sleek Segmented Bar) */}
          <nav className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-inner">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/app' && location.pathname === '/app/');
              return (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border-none whitespace-nowrap ${
                    isActive 
                      ? 'bg-white text-[#0A7756] shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0A7756] stroke-[2.2]' : 'text-slate-500 stroke-[1.8]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls: Voice Assistant, Notifications, Profile */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* AI Voice Assistant Button */}
            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#0A7756] via-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-none cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="font-bold tracking-tight">{t('ভয়েস সহকারী', 'AI Voice')}</span>
            </button>

            {/* Web View Notification Button */}
            <Link 
              to="/app/notifications" 
              title={t('বিজ্ঞপ্তি', 'Notifications')}
              className="relative w-8 h-8 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:text-[#0A7756] transition-colors border border-slate-200/80 shadow-2xs shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1.5 ring-white"></span>
            </Link>
            
            {/* User Profile Pill */}
            <Link 
              to="/app/profile" 
              className="flex items-center space-x-2 pl-1 pr-2.5 py-0.5 bg-slate-50 hover:bg-slate-100/90 transition-all rounded-full border border-slate-200/80 shadow-2xs group shrink-0"
              title={userName}
            >
              <div className="w-7 h-7 bg-gradient-to-tr from-[#0A7756] to-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xs ring-1 ring-white">
                {(userName || 'User').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-[#0A7756] max-w-[110px] truncate inline-block">
                {userName || 'প্রোফাইল'}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full h-full md:h-auto">
        
        {/* Mobile Sticky Top Navigation Bar (Matches bottom nav's white background) */}
        {isMainTab && (
          <header className="sticky top-0 z-40 md:hidden flex justify-between items-center px-4 h-14 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <Link to="/app" className="flex items-center gap-2 select-none">
              <div className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                <img 
                  src="/robot-icon.png" 
                  alt="SmritiLife AI" 
                  className="w-full h-full rounded-full object-cover shadow-xs ring-1.5 ring-emerald-500/30" 
                />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Smriti<span className="text-[#0A7756]">Life</span>
              </span>
            </Link>
            <div className="flex items-center space-x-2">
              {isRamadan && (
                <Link 
                  to="/app/ramadan"
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-900 to-teal-900 text-amber-300 border border-amber-400/40 shadow-xs active:scale-95 transition"
                  title={t('রমজান স্পেশাল', 'Ramadan Special')}
                >
                  <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                  <span className="text-[11px] font-bold tracking-tight">রমজান</span>
                </Link>
              )}
              <button 
                onClick={() => navigate('/app/notifications')} 
                className="w-8 h-8 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 relative active:scale-95 transition border border-slate-200/60 cursor-pointer"
                title={t('বিজ্ঞপ্তি', 'Notifications')}
              >
                <Bell className="w-4 h-4" />
              </button>
              <div 
                onClick={() => navigate('/app/profile')} 
                className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden border border-slate-200 shadow-xs cursor-pointer active:scale-95 transition"
                title={t('প্রোফাইল', 'Profile')}
              >
                <img 
                  src={`https://ui-avatars.com/api/?name=${userName}&background=0a7756&color=fff`} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          </header>
        )}

        {/* Scrollable Page Content */}
        {/* We remove default top/side padding so all pages can span edge-to-edge if needed */}
        <div className="flex-1 pb-24 md:pb-0 w-full mx-auto max-w-5xl pt-0 px-0">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation (Hidden on Web) - With Floating FAB */}
        <div className="md:hidden fixed bottom-0 w-full z-40 pointer-events-none">
          
          {/* Floating Action Button for Voice/AI Assistant (Center) */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-7 pointer-events-auto z-50">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-16 h-16 bg-gradient-to-br from-[#0A7756] to-[#12A57A] text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(10,119,86,0.4)] border-4 border-[#f6f8f9] transform transition hover:scale-105 active:scale-95 animate-pulse"
            >
              <Mic className="w-7 h-7 stroke-[3]" />
            </button>
          </div>

          {/* Navigation Bar */}
          <nav className="bg-white px-2 pt-3 pb-3 flex justify-between items-end text-slate-400 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] pointer-events-auto rounded-t-[2rem]">
            {/* Left side items (Home, Notes) */}
            <div className="flex flex-1 justify-around pr-4">
              {navItems.slice(0, 2).map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/app' && location.pathname === '/app/');
                return (
                  <Link 
                    key={item.path}
                    to={item.path} 
                    className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-[#0A7756]' : 'hover:text-slate-500'}`}
                  >
                    <div className="mb-1 relative flex flex-col items-center">
                      <item.icon className={`w-[26px] h-[26px] ${isActive ? 'stroke-[2.5] stroke-[#0A7756]' : 'stroke-[1.5] stroke-slate-400'}`} />
                    </div>
                    <span className={`text-[11.5px] font-bold ${isActive ? 'text-[#0A7756]' : 'text-slate-400'}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* Center Spacer for FAB */}
            <div className="w-16 shrink-0 flex flex-col items-center justify-end pb-0.5">
              <span className="text-[11.5px] font-bold text-[#0A7756] mt-1">{t('AI সহায়ক', 'AI Assist')}</span>
            </div>
            
            {/* Right side items (Reminder, Wishes) */}
            <div className="flex flex-1 justify-around pl-4">
              {navItems.slice(2, 4).map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.path}
                    to={item.path} 
                    className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? 'text-[#0A7756]' : 'hover:text-slate-500'}`}
                  >
                    <div className="mb-1 relative flex flex-col items-center">
                      <item.icon className={`w-[26px] h-[26px] ${isActive ? 'stroke-[2.5] stroke-[#0A7756]' : 'stroke-[1.5] stroke-slate-400'}`} />
                    </div>
                    <span className={`text-[11.5px] font-bold ${isActive ? 'text-[#0A7756]' : 'text-slate-400'}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </main>

      {/* Web View Footer */}
      <footer className="hidden md:block bg-white border-t border-slate-100 py-4 mt-auto shadow-sm relative z-50">
        <div className="max-w-5xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs font-medium">
          <p>© {new Date().getFullYear()} Smriti Life. {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}</p>
          <div className="flex space-x-6 mt-2 md:mt-0">
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('শর্তাবলী', 'Terms')}</Link>
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('গোপনীয়তা নীতি', 'Privacy Policy')}</Link>
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('সাহায্য', 'Help')}</Link>
          </div>
        </div>
      </footer>

      {/* AI Assistant Voice Modal */}
      <AIAssistantModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Global In-App Wake-Up Alarm Engine */}
      <WakeUpAlarmModal />
    </div>
  );
}
