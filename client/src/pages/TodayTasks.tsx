import { ArrowLeft, Calendar, FileText, Bell, Gift, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

export default function TodayTasks() {
  const { t } = useSettings();
  const navigate = useNavigate();

  const today = new Date();
  const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBn = (num: number) => num.toString().split('').map(d => bnNumbers[parseInt(d)] || d).join('');
  const todayStr = `${toBn(today.getDate())} ${months[today.getMonth()]}, ${toBn(today.getFullYear())}`;
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'reminder' | 'note'>('all');
  const [loading, setLoading] = useState(true);

  const format12h = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return timeStr || '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${ampm}`;
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const [notesRes, remindersRes] = await Promise.all([
          fetchWithAuth(`${import.meta.env.VITE_API_URL}/notes`),
          fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`)
        ]);
        
        let allTasks: any[] = [];
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        if (notesRes.ok) {
          const notes = await notesRes.json();
          const todayNotes = notes.filter((n: any) => {
            const date = new Date(n.createdAt);
            return date >= startOfToday && date <= endOfToday;
          });
          
          allTasks = [...allTasks, ...todayNotes.map((n: any) => ({
            id: `note_${n._id}`,
            type: 'note',
            title: n.title,
            time: new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            desc: n.content.replace(/<[^>]+>/g, '').substring(0, 50) + (n.content.length > 50 ? '...' : ''),
            color: 'emerald',
            createdAt: new Date(n.createdAt)
          }))];
        }

        if (remindersRes.ok) {
          const reminders = await remindersRes.json();
          const todayReminders = reminders.filter((r: any) => {
            const date = new Date(r.date);
            return date >= startOfToday && date <= endOfToday;
          });
          
          allTasks = [...allTasks, ...todayReminders.map((r: any) => ({
            id: `rem_${r._id}`,
            type: 'reminder',
            title: r.title,
            time: format12h(r.time),
            recipientPhone: r.recipientPhone,
            desc: r.recipientPhone ? `প্রাপক: ${r.recipientPhone} • ${r.description || ''}` : (r.description || 'রিমাইন্ডার'),
            color: 'orange',
            createdAt: new Date(r.createdAt || r.date)
          }))];
        }

        // Sort by creation/target time
        allTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setTasks(allTasks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, []);

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans">
      {/* Header */}
      <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40 md:hidden">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-3 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{t('আজকের কাজ', "Today's Tasks")}</h1>
            <p className="text-[10px] text-slate-500 font-medium">{todayStr}</p>
          </div>
        </div>
      </header>

      {/* Desktop Header Extension */}
      <div className="hidden md:block bg-white border-b border-slate-100 py-6 px-8 mb-6">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition active:scale-95 border border-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{t('আজকের কাজ', "Today's Tasks")}</h1>
              <p className="text-sm text-slate-500 font-medium flex items-center mt-1">
                <Calendar className="w-4 h-4 mr-1.5" /> {todayStr}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 md:px-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-3">
          <h2 className="text-sm md:text-base font-bold text-slate-700">{t('আপনার আজকের সব কাজ', 'All your tasks for today')}</h2>
          <span className="text-[10px] md:text-xs font-bold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full">
            {toBn(tasks.length)} {t('টি কাজ', 'Tasks')}
          </span>
        </div>

        {/* Filter Tabs: All, Reminders, Notes */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: t('সব কাজ', 'All') },
            { id: 'reminder', label: t('⏰ রিমাইন্ডার', 'Reminders') },
            { id: 'note', label: t('📝 নোট', 'Notes') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${filter === tab.id ? 'bg-[#0A7756] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500 font-medium">লোড হচ্ছে...</div>
        ) : (() => {
          const displayedTasks = filter === 'all' ? tasks : tasks.filter(t => t.type === filter);
          if (displayedTasks.length === 0) {
            return (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[30vh]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-1">{t('কোনো তথ্য পাওয়া যায়নি', 'No tasks found')}</h3>
                <p className="text-xs text-slate-500">{t('এই ক্যাটাগরিতে আজকের জন্য কোনো কাজ নেই।', 'No tasks for this category today.')}</p>
              </div>
            );
          }
          return (
            <div className="space-y-3 md:space-y-4">
              {displayedTasks.map((task) => (
                <div key={task.id} className={`bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-${task.color}-100 flex items-start cursor-pointer hover:shadow-md transition group`}>
                  <div className={`w-10 h-10 md:w-12 md:h-12 bg-${task.color}-50 text-${task.color}-500 rounded-full flex items-center justify-center mr-4 shrink-0 group-hover:bg-${task.color}-100 transition`}>
                    {task.type === 'note' && <FileText className="w-5 h-5 md:w-6 md:h-6" />}
                    {task.type === 'reminder' && <Bell className="w-5 h-5 md:w-6 md:h-6" />}
                    {task.type === 'wish' && <Gift className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm md:text-base font-bold text-slate-800 truncate pr-2">{task.title}</h3>
                    <span className={`text-[10px] md:text-xs font-bold text-${task.color}-600 bg-${task.color}-50 px-2 py-0.5 rounded-full shrink-0`}>
                      {task.time}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-500 font-medium truncate mb-2">{task.desc}</p>
                  <div className="flex items-center text-[9px] md:text-[11px] font-bold text-slate-400">
                    <span className="uppercase tracking-wider">
                      {task.type === 'note' && t('নোট', 'Note')}
                      {task.type === 'reminder' && t('রিমাইন্ডার', 'Reminder')}
                      {task.type === 'wish' && t('উইশ', 'Wish')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
        
        {/* Floating Add Button for Mobile (Optional, since they have FAB) */}
      </div>
    </div>
  );
}
