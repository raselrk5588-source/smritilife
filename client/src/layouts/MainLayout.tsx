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
      
      {/* Web View Top Navigation (Consumer Style) */}
      <header className="hidden md:flex bg-white text-slate-800 sticky top-0 z-50 shadow-sm h-16 items-center px-8 lg:px-16 border-b border-slate-100">
        <Link to="/app" className="flex items-center space-x-2 mr-10">
          <h1 className="text-xl font-bold tracking-wide text-slate-800">Smriti <span className="font-medium text-slate-500">(স্মৃতি)</span></h1>
        </Link>
        
        <nav className="flex-1 flex items-center justify-center space-x-2 lg:space-x-8">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/app' && location.pathname === '/app/');
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 ${isActive ? 'bg-[#0A7756]/10 text-[#0A7756] font-bold' : 'hover:bg-slate-50 font-medium text-slate-600'}`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
          
          {/* AI Voice Assistant Button on Web */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 transition-all duration-300"
          >
            <Mic className="w-4 h-4 stroke-[2.5]" />
            <span className="text-sm">{t('ভয়েস অ্যাসিস্ট্যান্ট', 'Voice Assistant')}</span>
          </button>
        </nav>

        <div className="flex items-center space-x-4">
          {/* Web View Notification Button */}
          <Link to="/app/notifications" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 transition border border-slate-200">
            <Bell className="w-5 h-5" />
          </Link>
          
          <Link to="/app/profile" className="flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 transition px-4 py-1.5 rounded-full border border-slate-200">
            <div className="w-8 h-8 bg-[#0A7756] text-white rounded-full flex items-center justify-center font-bold text-sm">
              {(localStorage.getItem('userName') || 'Riyad').charAt(0).toUpperCase()}
            </div>
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
          <p>© {new Date().getFullYear()} Smriti (স্মৃতি). {t('সর্বস্বত্ব সংরক্ষিত।', 'All rights reserved.')}</p>
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
