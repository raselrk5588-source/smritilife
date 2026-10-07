import { useState } from 'react';
import { ChevronLeft, Calendar, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

export default function Notifications() {
  const { t } = useSettings();
  const [notifications, setNotifications] = useState<any[]>([]);

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans">
      {/* Top Header */}
      <header className="bg-primary text-white p-4 pt-10 pb-6 flex justify-between items-center relative overflow-hidden rounded-b-3xl shadow-sm z-20">
        <div className="absolute inset-0 z-0 bg-cover" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center 40%", opacity: "0.9" }}></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/60 via-primary/30 to-black/40"></div>
        
        <Link to="/app" className="p-1 relative z-10 hover:bg-white/20 rounded-full transition"><ChevronLeft className="w-6 h-6" /></Link>
        <div className="text-center flex-1 relative z-10">
          <h1 className="text-2xl font-bold drop-shadow-md">{t('নোটিফিকেশন', 'Notifications')}</h1>
          <p className="text-white/90 text-[11px] font-medium drop-shadow-sm mt-0.5">{t('আপনার সকল রিমাইন্ডার ও আপডেট', 'All your reminders and updates')}</p>
        </div>
        <div className="w-8"></div> {/* Spacer for centering */}
      </header>

      <div className="px-4 mt-6">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-600 text-sm font-bold mb-1">{t('কোনো নোটিফিকেশন নেই', 'No notifications')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div key={notif.id} className="bg-white rounded-2xl p-4 flex items-center border border-slate-100 shadow-sm relative overflow-hidden">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 ${notif.bg} ${notif.color}`}>
                  <notif.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-800">{notif.title}</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
