import { useState, useEffect } from 'react';
import { Search, Bell, Mic, FileText, Calendar, Users, Gift, LayoutTemplate, Phone, Video, ShoppingCart, Cake, Bot, ChevronRight, MoreVertical } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import AIAssistantModal from '../components/AIAssistantModal';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

export default function Home() {
  const { t } = useSettings();
  const userName = localStorage.getItem('userName') || "রিয়াদ";
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(location.state?.showProfileCompletion || false);

  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [upcomingSpecialDates, setUpcomingSpecialDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesCount, setNotesCount] = useState(0);
  const [remindersCount, setRemindersCount] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [notesRes, remindersRes, specialDatesRes] = await Promise.all([
          fetchWithAuth(`${import.meta.env.VITE_API_URL}/notes`),
          fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`),
          fetchWithAuth(`${import.meta.env.VITE_API_URL}/special-dates`)
        ]);
        
        let allTasks: any[] = [];
        let allNotes: any[] = [];
        let allSpecialDates: any[] = [];
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        if (notesRes.ok) {
          const notes = await notesRes.json();
          setNotesCount(notes.length);
          allNotes = notes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          const todayNotes = notes.filter((n: any) => {
            const date = new Date(n.createdAt);
            return date >= startOfToday && date <= endOfToday;
          });
          
          allTasks = [...allTasks, ...todayNotes.map((n: any) => ({
            id: `note_${n._id}`,
            type: 'note',
            title: n.title,
            time: new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            color: 'emerald',
            createdAt: new Date(n.createdAt)
          }))];
        }

        if (remindersRes.ok) {
          const reminders = await remindersRes.json();
          const pendingReminders = reminders.filter((r: any) => r.status !== 'Completed');
          setRemindersCount(pendingReminders.length);
          const todayReminders = reminders.filter((r: any) => {
            const date = new Date(r.date);
            return date >= startOfToday && date <= endOfToday;
          });
          
          allTasks = [...allTasks, ...todayReminders.map((r: any) => ({
            id: `rem_${r._id}`,
            type: 'reminder',
            title: r.title,
            time: r.time,
            color: 'orange',
            createdAt: new Date(r.createdAt || r.date)
          }))];
        }

        if (specialDatesRes.ok) {
          const specialDates = await specialDatesRes.json();
          allSpecialDates = specialDates.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const todaySpecialDates = specialDates.filter((s: any) => {
            const date = new Date(s.date);
            return date >= startOfToday && date <= endOfToday;
          });
          
          allTasks = [...allTasks, ...todaySpecialDates.map((s: any) => ({
            id: `sd_${s._id}`,
            type: 'wish',
            title: s.title,
            time: 'সারাদিন', // All day
            color: 'pink',
            createdAt: new Date(s.date)
          }))];
        }

        allTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setTodayTasks(allTasks.slice(0, 3));
        setRecentNotes(allNotes.slice(0, 2));
        setUpcomingSpecialDates(allSpecialDates.filter((s: any) => new Date(s.date) >= startOfToday).slice(0, 2));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  const handleAIAction = (text: string) => {
    toast.success(`"${text}" - AI প্রসেস করছে...`);
    setTimeout(() => setIsModalOpen(true), 800);
  };

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans">
      <AIAssistantModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      {/* Top Section with Scenic Background */}
      <div className="relative pt-3 md:pt-6 pb-16 md:pb-24 px-3 md:px-5 rounded-b-[2rem] md:rounded-b-[2.5rem] overflow-hidden">
        {/* Background Image / Gradient mimicking the scenic view */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ 
            backgroundImage: "url('/theme-bg.png')",
            backgroundPosition: "center 30%",
            opacity: "0.95"
          }}
        ></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 via-white/40 to-[#f6f8f9]"></div>

        <div className="relative z-10">
          {/* Header (Hidden on Web because MainLayout has a Top Nav) */}
          <header className="flex md:hidden justify-between items-center mb-6">
            <div className="flex items-center bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-sm border border-white/50">
              <h1 className="text-xl font-extrabold tracking-wide text-primary">Smriti <span className="font-bold text-slate-600 text-[13px]">(স্মৃতি)</span></h1>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/app/notifications')} className="w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm text-slate-600 relative active:scale-95 transition">
                <Bell className="w-4 h-4" />
              </button>
              <div onClick={() => navigate('/app/profile')} className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer active:scale-95 transition">
                <img src={`https://ui-avatars.com/api/?name=${userName}&background=0a7756&color=fff`} alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </header>

          {/* Greeting */}
          <div className="mb-3 md:mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-slate-800 mb-0.5 md:mb-1">{t('শুভ সকাল,', 'Good Morning,')} <br/>{userName}! 👋</h2>
              <p className="text-[10px] md:text-sm text-slate-600 font-medium drop-shadow-sm">{t('আজকের দিনটাকে সুন্দর ও গোছানো করে শুরু করি।', 'Let\'s start the day beautifully and organized.')}</p>
            </div>
            {(() => {
              const today = new Date();
              
              const getBengaliDate = (date: Date) => {
                const d = date.getDate(), m = date.getMonth(), y = date.getFullYear();
                let bDay, bMonth, bYear;
                const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
                const bMonths = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
                
                if(m===0) { if(d<14){ bMonth=8; bDay=d+17; } else { bMonth=9; bDay=d-13; } }
                else if(m===1) { if(d<13){ bMonth=9; bDay=d+18; } else { bMonth=10; bDay=d-12; } }
                else if(m===2) { if(d<15){ bMonth=10; bDay=d+(isLeapYear?17:16); } else { bMonth=11; bDay=d-14; } }
                else if(m===3) { if(d<14){ bMonth=11; bDay=d+17; } else { bMonth=0; bDay=d-13; } }
                else if(m===4) { if(d<15){ bMonth=0; bDay=d+17; } else { bMonth=1; bDay=d-14; } }
                else if(m===5) { if(d<15){ bMonth=1; bDay=d+17; } else { bMonth=2; bDay=d-14; } }
                else if(m===6) { if(d<16){ bMonth=2; bDay=d+16; } else { bMonth=3; bDay=d-15; } }
                else if(m===7) { if(d<16){ bMonth=3; bDay=d+16; } else { bMonth=4; bDay=d-15; } }
                else if(m===8) { if(d<16){ bMonth=4; bDay=d+16; } else { bMonth=5; bDay=d-15; } }
                else if(m===9) { if(d<16){ bMonth=5; bDay=d+15; } else { bMonth=6; bDay=d-15; } }
                else if(m===10) { if(d<15){ bMonth=6; bDay=d+16; } else { bMonth=7; bDay=d-14; } }
                else { if(d<15){ bMonth=7; bDay=d+16; } else { bMonth=8; bDay=d-14; } }
                
                bYear = y - 593;
                if (m < 3 || (m === 3 && d < 14)) bYear--;
                const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
                const toBn = (num: number) => num.toString().split('').map(n => bnNumbers[parseInt(n)] || n).join('');
                return `${toBn(bDay)} ${bMonths[bMonth]} ${toBn(bYear)}`;
              };

              // True Bengali Calendar Date
              const bnDate = getBengaliDate(today);
              // English Date
              const enDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(today);
              // Arabic/Hijri Date (in Bengali script)
              let arDate = new Intl.DateTimeFormat('bn-BD-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(today);
              arDate = arDate.replace('যুগ', 'হিজরি'); 
              
              return (
                <div className="bg-white/80 backdrop-blur-sm px-3 md:px-4 py-2 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex flex-col items-end text-right justify-center">
                  <span className="text-[11px] md:text-[13px] font-extrabold text-[#0A7756] mb-0.5">{bnDate}</span>
                  <span className="text-[10px] md:text-[11px] font-bold text-[#0A7756] mb-0.5">{enDate}</span>
                  <span className="text-[10px] md:text-[11px] font-bold text-[#0A7756]">{arDate}</span>
                </div>
              );
            })()}
          </div>

          {/* Smart Input Bar */}
          <div 
            onClick={() => setIsModalOpen(true)}
            className="bg-white rounded-full p-1 pl-2.5 md:p-1.5 md:pl-3 flex items-center shadow-sm border border-slate-200 cursor-text active:scale-95 transition w-[78%] md:w-[60%] max-w-[280px] md:max-w-[380px] mt-2 mb-2 mr-auto"
          >
            <Mic className="w-3 h-3 md:w-4 md:h-4 text-slate-400 mr-2 md:mr-2.5" />
            <div className="flex-1">
              <p className="text-[9px] md:text-[11px] text-slate-700 font-bold leading-tight">{t('কিছু লিখুন বা বলে বলুন...', 'Type or say something...')}</p>
              <p className="text-[7px] md:text-[9px] text-slate-400 leading-tight mt-[1px]">{t('যেমন: আগামীকাল সকাল ১০টায় মিটিং মনে করিয়ে দাও', 'e.g. Remind me about the meeting tomorrow at 10 AM')}</p>
            </div>
            <button className="w-6 h-6 md:w-8 md:h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-sm hover:bg-[#086146] transition shrink-0 ml-1 md:ml-2">
              <Mic className="w-3 h-3 md:w-4 md:h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-5 -mt-8 md:-mt-16 relative z-20 space-y-3 md:space-y-5">
        
        {/* Quick Access Pills Grid */}
        <div className="grid grid-cols-4 gap-1.5 md:gap-2">
          <Link to="/app/notes" className="bg-white py-2.5 md:py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center hover:bg-slate-50 transition active:scale-95">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-1 md:mb-1 relative">
              <FileText className="w-4 h-4 md:w-5 md:h-5" />
              {notesCount > 0 && <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full shadow-sm">{notesCount}</div>}
            </div>
            <span className="text-[10px] font-bold text-slate-700">{t('নোট', 'Notes')}</span>
          </Link>
          <Link to="/app/reminders" className="bg-white py-2.5 md:py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center hover:bg-slate-50 transition active:scale-95">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-1 md:mb-1 relative">
              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              {remindersCount > 0 && <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full shadow-sm">{remindersCount}</div>}
            </div>
            <span className="text-[10px] font-bold text-slate-700">{t('রিমাইন্ডার', 'Reminders')}</span>
          </Link>
          <Link to="/app/wishes" className="bg-white py-2.5 md:py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center hover:bg-slate-50 transition active:scale-95">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-pink-50 text-pink-500 rounded-xl flex items-center justify-center mb-1 md:mb-1">
              <Gift className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-700">{t('বিশেষ দিন', 'Wishes')}</span>
          </Link>
          <div onClick={() => toast('টেমপ্লেট ফিচারটি খুব শীঘ্রই আসছে!', { icon: '🚀' })} className="bg-white py-2.5 md:py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 active:scale-95 transition">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-1 md:mb-1 relative">
              <LayoutTemplate className="w-4 h-4 md:w-5 md:h-5" />
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full shadow-sm">20</div>
            </div>
            <span className="text-[10px] font-bold text-slate-700 mt-[2px]">{t('টেমপ্লেট', 'Templates')}</span>
          </div>
        </div>

        {/* Tasks and Calendar Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          
          {/* Today's Tasks */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-2.5 md:p-4 shadow-sm border border-slate-100 flex flex-col min-h-[140px] md:min-h-[220px]">
            <div className="flex justify-between items-center mb-2 md:mb-4">
              <h3 className="font-bold text-slate-800 text-[12px] md:text-sm flex items-center">
                <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5 text-slate-500" /> {t('আজকের কাজ', "Today's Tasks")}
              </h3>
              <Link to="/app/today-tasks" className="text-[10px] md:text-[12px] font-bold text-[#0A7756]">{t('সব দেখুন', 'See all')} {'>'}</Link>
            </div>
            
            {/* Populated State */}
            <div className="flex-1 flex flex-col space-y-2 mt-1">
              {loading ? (
                <div className="text-center py-4 text-xs text-slate-400">লোড হচ্ছে...</div>
              ) : todayTasks.length > 0 ? (
                todayTasks.map((task) => (
                  <div key={task.id} className={`flex items-start bg-${task.color}-50/50 p-2 rounded-xl border border-${task.color}-100`}>
                    <div className={`w-8 h-8 bg-${task.color}-100 text-${task.color}-600 rounded-full flex items-center justify-center mr-2 shrink-0`}>
                      {task.type === 'note' && <FileText className="w-4 h-4" />}
                      {task.type === 'reminder' && <Bell className="w-4 h-4" />}
                      {task.type === 'wish' && <Gift className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] md:text-[13px] font-bold text-slate-800 truncate">{task.title}</h4>
                      <p className="text-[9px] md:text-[11px] text-slate-500 truncate">
                        {task.type === 'note' ? 'নোট' : task.type === 'reminder' ? 'রিমাইন্ডার' : 'উইশ'} • {task.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-4 md:py-6 text-center">
                  <div className="w-10 h-10 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2 md:mb-3">
                    <Calendar className="w-5 h-5 md:w-8 md:h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">{t('আজকের জন্য কোনো কাজ নেই', 'No tasks for today')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Mini Calendar Widget */}
          {(() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDayOfMonth = new Date(year, month, 1).getDay();
            const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
            const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            const toBn = (num: number) => num.toString().split('').map(d => bnNumbers[parseInt(d)] || d).join('');

            return (
              <div className="bg-white rounded-3xl p-3 md:p-4 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex justify-between items-center mb-3 px-2">
                  <ChevronLeft className="w-4 h-4 text-slate-300" />
                  <h3 className="font-bold text-slate-800 text-xs md:text-sm">
                    {months[month]} {toBn(year)}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
                  <div>{t('রবি', 'Sun')}</div><div>{t('সোম', 'Mon')}</div><div>{t('মঙ্গল', 'Tue')}</div><div>{t('বুধ', 'Wed')}</div><div>{t('বৃহঃ', 'Thu')}</div><div>{t('শুক্র', 'Fri')}</div><div>{t('শনি', 'Sat')}</div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-700">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-1"></div>
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate();
                    return (
                      <div key={day} className="flex items-center justify-center p-1">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#0A7756] text-white shadow-sm' : 'hover:bg-slate-50 cursor-pointer'}`}>
                          {toBn(day)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          
        </div>

        {/* AI Assistant Banner */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl md:rounded-3xl p-2 md:p-4 shadow-sm border border-emerald-100 cursor-pointer hover:shadow-md active:scale-95 transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 md:space-x-3">
              <div className="w-7 h-7 md:w-10 md:h-10 bg-emerald-100 text-emerald-600 rounded-lg md:rounded-2xl flex items-center justify-center">
                <Bot className="w-4 h-4 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-[10px] md:text-sm">{t('AI সহায়ক', 'AI Assistant')}</h3>
                <p className="text-[8px] md:text-[10px] text-slate-500 font-medium">{t('ভয়েসের মাধ্যমে রিমাইন্ডার বা নোট তৈরি করুন', 'Create reminders or notes via voice')}</p>
              </div>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-sm">
              <Mic className="w-3 h-3 md:w-4 md:h-4" />
            </div>
          </div>
        </div>

        {/* Two Big Action Cards */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl md:rounded-3xl p-2 md:p-4 shadow-sm border border-orange-100 relative overflow-hidden flex flex-col justify-between min-h-[100px] md:min-h-[140px]">
            <div className="absolute -right-2 -bottom-2 md:-right-3 md:-bottom-3 opacity-50 text-4xl md:text-6xl">🎁</div>
            <div className="relative z-10">
              <h3 className="font-bold text-orange-900 text-[10px] md:text-sm mb-0.5 md:mb-1">{t('বিশেষ দিনের শুভেচ্ছা', 'Special Day Wishes')}</h3>
              <p className="text-[8px] md:text-[10px] text-orange-800/70 font-medium leading-tight mb-2 md:mb-3">{t('আপনার প্রিয়জনদের জন্য', 'For your loved ones')}<br className="hidden md:block" /> {t('সুন্দর শুভেচ্ছা পাঠান', 'send beautiful wishes')}</p>
            </div>
            <Link to="/app/wishes" className="bg-orange-500 text-white text-[8px] md:text-[10px] font-bold py-1 px-2 md:py-1.5 md:px-3 rounded-full self-start shadow-sm flex items-center relative z-10 hover:bg-orange-600 transition">
              {t('শুভেচ্ছা তৈরি ➔', 'Create Wish ➔')}
            </Link>
          </div>
          
          <div className="bg-gradient-to-br from-blue-100 to-indigo-50 rounded-2xl md:rounded-3xl p-2 md:p-4 shadow-sm border border-blue-100 relative overflow-hidden flex flex-col justify-between min-h-[100px] md:min-h-[140px]">
            <div className="absolute -right-2 -bottom-2 md:-right-2 md:-bottom-2 opacity-50 text-4xl md:text-6xl">📝</div>
            <div className="relative z-10">
              <h3 className="font-bold text-blue-900 text-[10px] md:text-sm mb-0.5 md:mb-1">{t('নোট লিখুন', 'Write a Note')}</h3>
              <p className="text-[8px] md:text-[10px] text-blue-800/70 font-medium leading-tight mb-2 md:mb-3">{t('আপনার ভাবনা, কাজের তালিকা,', 'Your thoughts, to-do lists,')}<br className="hidden md:block" /> {t('আইডিয়া সব এক জায়গায়', 'ideas all in one place')}</p>
            </div>
            <Link to="/app/notes" className="bg-blue-600 text-white text-[8px] md:text-[10px] font-bold py-1 px-2 md:py-1.5 md:px-3 rounded-full self-start shadow-sm flex items-center relative z-10 hover:bg-blue-700 transition">
              {t('নতুন নোট তৈরি ➔', 'Create New Note ➔')}
            </Link>
          </div>
        </div>

        {/* Recent Notes Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center">
              <FileText className="w-4 h-4 mr-1.5 text-slate-500" /> {t('সাম্প্রতিক নোট', 'Recent Notes')}
            </h3>
            <Link to="/app/notes" className="text-[10px] font-bold text-primary">{t('সব দেখুন', 'See all')} {'>'}</Link>
          </div>
          
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col min-h-[160px]">
            {loading ? (
              <div className="text-center py-4 text-xs text-slate-400">লোড হচ্ছে...</div>
            ) : recentNotes.length > 0 ? (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <Link key={note._id} to="/app/notes" className="flex items-start bg-blue-50/50 p-3 rounded-xl border border-blue-100 hover:shadow-sm transition">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-3 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{note.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-500 text-xs font-medium mb-1">{t('কোনো নোট পাওয়া যায়নি', 'No notes found')}</p>
                <p className="text-slate-400 text-[10px] mb-4">{t('আপনার গুরুত্বপূর্ণ তথ্য লিখে রাখুন', 'Write down your important info')}</p>
                <Link to="/app/notes" className="bg-[#0A7756]/10 text-[#0A7756] text-xs font-bold px-4 py-2 rounded-full hover:bg-[#0A7756]/20 transition inline-block">
                  {t('+ নতুন নোট', '+ New Note')}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Special Days / Scheduled Messages */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center">
              <Gift className="w-4 h-4 mr-1.5 text-slate-500" /> {t('শিডিউলড মেসেজ ও বিশেষ দিন', 'Scheduled Messages & Special Days')}
            </h3>
            <Link to="/app/wishes" className="text-[10px] font-bold text-primary">{t('সব দেখুন', 'See all')} {'>'}</Link>
          </div>
          
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col min-h-[160px]">
            {loading ? (
              <div className="text-center py-4 text-xs text-slate-400">লোড হচ্ছে...</div>
            ) : upcomingSpecialDates.length > 0 ? (
              <div className="space-y-2">
                {upcomingSpecialDates.map((date) => (
                  <Link key={date._id} to="/app/wishes" className="flex items-start bg-pink-50/50 p-3 rounded-xl border border-pink-100 hover:shadow-sm transition">
                    <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mr-3 shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{date.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {new Date(date.date).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Gift className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-500 text-xs font-medium mb-1">{t('কোনো বিশেষ দিন বা মেসেজ শিডিউল নেই', 'No special days or scheduled messages')}</p>
                <p className="text-slate-400 text-[10px] mb-4">{t('প্রিয়জনের জন্মদিন বা শুভেচ্ছা শিডিউল করে রাখুন', 'Schedule birthdays or wishes for loved ones')}</p>
                <Link to="/app/wishes" className="bg-[#0A7756]/10 text-[#0A7756] text-xs font-bold px-4 py-2 rounded-full hover:bg-[#0A7756]/20 transition inline-block">
                  {t('+ মেসেজ শিডিউল করুন', '+ Schedule Message')}
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
      {/* Profile Setup Modal */}
      {showProfileSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowProfileSetup(false)}></div>
          <div className="bg-white rounded-[2rem] w-full max-w-sm relative z-10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border-none">
            <div className="bg-gradient-to-br from-[#0A7756] to-[#12A57A] p-6 text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{t('প্রোফাইল সেটআপ করুন!', 'Setup Profile!')}</h2>
              <p className="text-white/80 text-sm font-medium">{t('Smriti (স্মৃতি) অ্যাপে আপনাকে স্বাগতম', 'Welcome to Smriti App')}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t('আপনার পুরো নাম', 'Your Full Name')}</label>
                <input type="text" placeholder={t("যেমন: রিয়াদ আহমেদ", "e.g. Riyad Ahmed")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all border-none" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t('আপনার ডাকনাম (অ্যাপ এই নামে ডাকবে)', 'Nickname (App will call you this)')}</label>
                <input type="text" placeholder={t("যেমন: রিয়াদ", "e.g. Riyad")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all border-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t('জন্ম তারিখ', 'Date of Birth')}</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-slate-600 border-none" />
              </div>
              
              <button 
                onClick={() => {
                  toast.success(t('প্রোফাইল আপডেট হয়েছে!', 'Profile Updated!'));
                  setShowProfileSetup(false);
                  navigate('.', { replace: true, state: {} });
                }}
                className="w-full bg-primary text-white rounded-xl py-3.5 font-bold mt-2 hover:bg-primary-dark active:scale-95 transition-all shadow-md border-none"
              >
                {t('সেভ করুন ও শুরু করুন', 'Save & Start')}
              </button>
              <button 
                onClick={() => {
                  setShowProfileSetup(false);
                  navigate('.', { replace: true, state: {} });
                }}
                className="w-full text-slate-400 font-bold text-xs py-2 hover:text-slate-600 transition border-none bg-transparent shadow-none"
              >
                {t('পরে করবো', 'Skip for now')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Heart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
