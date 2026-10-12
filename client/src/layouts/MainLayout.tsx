import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Bell, Gift, Mic, Users, LayoutTemplate } from 'lucide-react';
import AIAssistantModal from '../components/AIAssistantModal';
import { Toaster } from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';

export default function MainLayout() {
  const { t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/');
    }
    
    // Scale up the application by 120% for web/mobile view to make it more legible
    // This affects all 'rem' based Tailwind classes (size, margin, padding, text)
    document.documentElement.style.fontSize = '120%';
    
    return () => {
      // Reset when leaving the main app to not affect the landing page
      document.documentElement.style.fontSize = '';
    };
  }, [navigate]);

  // New nav items based on user feedback
  const navItems = [
    { path: '/app', icon: Home, label: t('হোম', 'Home') },
    { path: '/app/notes', icon: FileText, label: t('নোট', 'Notes') },
    // Center is Voice Assistant (FAB)
    { path: '/app/reminders', icon: Bell, label: t('রিমাইন্ডার', 'Reminders') },
    { path: '/app/wishes', icon: Gift, label: t('বিশেষ দিন', 'Wishes') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f6f8f9] font-sans">
      
      {/* Web View Top Navigation (Premium Consumer Glassmorphism Style) */}
      <header className="hidden md:flex bg-white/90 backdrop-blur-md text-slate-800 sticky top-0 z-50 h-[70px] items-center px-6 lg:px-12 border-b border-slate-200/70 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] justify-between transition-all">
        {/* Brand Logo & Name */}
        <Link to="/app" className="flex items-center space-x-3 group mr-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0A7756] to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform duration-300">
            <span className="text-xl font-black tracking-tight font-serif">S</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Smriti <span className="text-[#0A7756]">Life</span></span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">স্মৃতি লাইফ</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">স্মার্ট ব্যক্তিগত সহকারী</span>
          </div>
        </Link>
        
        {/* Center Navigation Tabs (Pill Container) */}
        <nav className="flex items-center bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60 shadow-inner">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/app' && location.pathname === '/app/');
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border-none ${
                  isActive 
                    ? 'bg-white text-[#0A7756] shadow-sm shadow-slate-200' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-[#0A7756] stroke-[2.5]' : 'text-slate-500 stroke-[2]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Controls: Voice Assistant, Notifications, Profile */}
        <div className="flex items-center space-x-3.5">
          {/* AI Voice Assistant Button */}
          <button 
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#0A7756] via-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-none cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <Mic className="w-4 h-4 stroke-[2.5]" />
            <span className="text-sm font-bold tracking-tight">{t('ভয়েস সহকারী', 'AI Voice')}</span>
          </button>

          {/* Web View Notification Button */}
          <Link 
            to="/app/notifications" 
            title={t('বিজ্ঞপ্তি', 'Notifications')}
            className="relative w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:text-[#0A7756] transition-colors border border-slate-200/80 shadow-xs"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          </Link>
          
          {/* User Profile Pill */}
          <Link 
            to="/app/profile" 
            className="flex items-center space-x-2.5 pl-1.5 pr-3 py-1 bg-slate-50 hover:bg-slate-100/90 transition-all rounded-full border border-slate-200/80 shadow-xs group"
          >
            <div className="w-8 h-8 bg-gradient-to-tr from-[#0A7756] to-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-white">
              {(localStorage.getItem('userName') || 'User').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-[#0A7756] max-w-[80px] truncate hidden lg:inline-block">
              {localStorage.getItem('userName') || 'প্রোফাইল'}
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full h-full md:h-auto">
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
          <p>© {new Date().getFullYear()} Smriti Life (স্মৃতি). {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}</p>
          <div className="flex space-x-6 mt-2 md:mt-0">
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('শর্তাবলী', 'Terms')}</Link>
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('গোপনীয়তা নীতি', 'Privacy Policy')}</Link>
            <Link to="#" className="hover:text-[#0A7756] transition-colors">{t('সাহায্য', 'Help')}</Link>
          </div>
        </div>
      </footer>

      {/* AI Assistant Voice Modal */}
      <AIAssistantModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
