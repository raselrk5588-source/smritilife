import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Bell, Calendar, Clock, Pill, Briefcase, Bookmark, Trash2, MoreVertical, ShoppingCart, CreditCard, Gift, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

export default function Reminders() {
  const { t } = useSettings();
  const [isAlertOn, setIsAlertOn] = useState(true);
  const [reminderType, setReminderType] = useState<'medicine' | 'work' | 'shopping' | 'bill' | 'event' | 'other'>('medicine');
  
  // State for multiple medicines
  const [medicines, setMedicines] = useState([{ id: 1, name: '', routine: [] as string[], mealTiming: 'after' }]);
  
  // States for work/other
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // States for WhatsApp Integration
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [activeFilter, setActiveFilter] = useState('all');
  
  // State for saved reminders list
  const [savedReminders, setSavedReminders] = useState<any[]>([]);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  const filteredReminders = activeFilter === 'all' 
    ? savedReminders 
    : savedReminders.filter(rem => rem.type === activeFilter);

  // Fetch from backend on load
  const fetchReminders = async () => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`);
      if (res.ok) {
        const data = await res.json();
        // Format to UI structure, excluding completed reminders
        const formatted = data.filter((item: any) => item.status !== 'Completed').map((item: any) => {
          let icon = Bookmark;
          let color = 'text-purple-500';
          let bg = 'bg-purple-50';
          
          if (item.category === 'medicine') { icon = Pill; color = 'text-red-500'; bg = 'bg-red-50'; }
          else if (item.category === 'work') { icon = Briefcase; color = 'text-blue-500'; bg = 'bg-blue-50'; }
          else if (item.category === 'shopping') { icon = ShoppingCart; color = 'text-emerald-500'; bg = 'bg-emerald-50'; }
          else if (item.category === 'bill') { icon = CreditCard; color = 'text-orange-500'; bg = 'bg-orange-50'; }
          else if (item.category === 'event') { icon = Gift; color = 'text-pink-500'; bg = 'bg-pink-50'; }

          return {
            id: item._id,
            type: item.category,
            title: item.title,
            subtitle: item.description || `${new Date(item.date).toLocaleDateString()} • ${item.time}`,
            icon, color, bg,
            active: item.status !== 'Cancelled',
            originalDate: item.date,
            originalTime: item.time
          };
        });
        setSavedReminders(formatted.reverse());
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const toggleRoutine = (medId: number, time: string) => {
    setMedicines(meds => meds.map(med => {
      if (med.id === medId) {
        const hasTime = med.routine.includes(time);
        return { ...med, routine: hasTime ? med.routine.filter(t => t !== time) : [...med.routine, time] };
      }
      return med;
    }));
  };

  const addMedicine = () => setMedicines([...medicines, { id: Date.now(), name: '', routine: [], mealTiming: 'after' }]);
  const removeMedicine = (id: number) => setMedicines(medicines.filter(m => m.id !== id));

  const handleSaveReminder = async () => {
    if (editingReminderId) {
      if (!reminderTitle.trim()) {
        toast.error(t('রিমাইন্ডারের বিষয় লিখুন', 'Enter a reminder subject'));
        return;
      }
      try {
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${editingReminderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: reminderTitle,
            category: reminderType,
            date: reminderDate || new Date().toISOString(),
            time: reminderTime || '09:00',
            status: isAlertOn ? 'Pending' : 'Cancelled'
          })
        });
        fetchReminders();
        setEditingReminderId(null);
        setReminderTitle('');
        setReminderDate('');
        setReminderTime('');
        toast.success(t('রিমাইন্ডার আপডেট হয়েছে!', 'Reminder updated!'));
      } catch (e) {
        toast.error('Failed to update');
      }
      return;
    }

    if (reminderType === 'medicine') {
      const validMeds = medicines.filter(m => m.name.trim() !== '' && m.routine.length > 0);
      if (validMeds.length === 0) {
        toast.error(t('অন্তত একটি ওষুধের নাম ও রুটিন দিন', 'Please add at least one medicine and routine'));
        return;
      }
      
      try {
        for (const med of validMeds) {
          await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: med.name,
              category: 'medicine',
              description: `${t('খাওয়ার সময়', 'Time')}: ${med.routine.join(', ')} - ${med.mealTiming === 'before' ? t('খাবারের আগে', 'Before food') : t('খাবারের পরে', 'After food')}`,
              date: new Date().toISOString(), // medicine usually daily, so we just put today
              time: '08:00', // default time for medicine
              status: isAlertOn ? 'Pending' : 'Cancelled'
            })
          });
        }
        fetchReminders();
        setMedicines([{ id: Date.now(), name: '', routine: [], mealTiming: 'after' }]);
        toast.success(t('ওষুধের রিমাইন্ডার সেভ হয়েছে!', 'Medicine reminder saved!'));
      } catch (e) {
        toast.error('Failed to save');
      }
    } else {
      if (!reminderTitle.trim()) {
        toast.error(t('রিমাইন্ডারের বিষয় লিখুন', 'Enter a reminder subject'));
        return;
      }
      
      try {
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: reminderTitle,
            category: reminderType,
            date: reminderDate || new Date().toISOString(),
            time: reminderTime || '09:00',
            status: isAlertOn ? 'Pending' : 'Cancelled'
          })
        });
        fetchReminders();
        setReminderTitle('');
        setReminderDate('');
        setReminderTime('');
        toast.success(t('রিমাইন্ডার সেভ হয়েছে!', 'Reminder saved!'));
      } catch (e) {
        toast.error('Failed to save');
      }
    }
  };

  const toggleReminderStatus = async (id: string, currentActive: boolean) => {
    try {
      await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentActive ? 'Cancelled' : 'Pending' })
      });
      setSavedReminders(savedReminders.map(r => r.id === id ? { ...r, active: !r.active } : r));
    } catch (e) {}
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${id}`, {
        method: 'DELETE'
      });
      fetchReminders();
      toast.success(t('রিমাইন্ডার মুছে ফেলা হয়েছে!', 'Reminder deleted!'));
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const handleEditReminder = (rem: any) => {
    setEditingReminderId(rem.id);
    let type = rem.type === 'General' || !rem.type ? 'other' : rem.type;
    setReminderType(type as any);
    
    setReminderTitle(rem.title);
    setReminderDate(rem.originalDate ? rem.originalDate.split('T')[0] : '');
    setReminderTime(rem.originalTime || '');
    setIsAlertOn(rem.active);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans">
      {/* Top Header */}
      <header className="bg-primary text-white p-4 pt-10 pb-6 flex justify-between items-center relative overflow-hidden rounded-b-3xl shadow-sm z-20">
        <div className="absolute inset-0 z-0 bg-cover" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center 40%", opacity: "0.9" }}></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/60 via-primary/30 to-black/40"></div>
        
        <div className="text-center flex-1 relative z-10 w-full flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold drop-shadow-md">{t('রিমাইন্ডার', 'Reminders')}</h1>
          <p className="text-white/90 text-[11px] font-medium drop-shadow-sm mt-0.5">{t('কখনো কিছু ভুলবেন না', 'Never forget anything')}</p>
        </div>
      </header>

      <div className="px-4 mt-6">
        
        {/* Add New Reminder Form */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm mb-6 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[100px] -z-0 opacity-50 transition-colors ${reminderType === 'medicine' ? 'bg-red-50' : reminderType === 'work' ? 'bg-blue-50' : 'bg-purple-50'}`}></div>
          
          <h2 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center relative z-10">
            <Plus className={`w-4 h-4 mr-1 ${reminderType === 'medicine' ? 'text-red-500' : reminderType === 'work' ? 'text-blue-500' : 'text-purple-500'}`} /> 
            {t(editingReminderId ? 'রিমাইন্ডার আপডেট করুন' : 'নতুন রিমাইন্ডার যোগ করুন', editingReminderId ? 'Update Reminder' : 'Add New Reminder')}
          </h2>

          {/* Category Selector */}
          <div className="grid grid-cols-3 gap-2 mb-5 relative z-10">
            <button 
              onClick={() => setReminderType('medicine')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'medicine' ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Pill className="w-4 h-4" /> {t('ওষুধ', 'Medicine')}
            </button>
            <button 
              onClick={() => setReminderType('work')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'work' ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Briefcase className="w-4 h-4" /> {t('কাজ/মিটিং', 'Work')}
            </button>
            <button 
              onClick={() => setReminderType('shopping')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'shopping' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <ShoppingCart className="w-4 h-4" /> {t('শপিং/বাজার', 'Shopping')}
            </button>
            <button 
              onClick={() => setReminderType('bill')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'bill' ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <CreditCard className="w-4 h-4" /> {t('বিল পেমেন্ট', 'Bill Pay')}
            </button>
            <button 
              onClick={() => setReminderType('event')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'event' ? 'bg-pink-50 text-pink-600 border-pink-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Gift className="w-4 h-4" /> {t('অনুষ্ঠান', 'Event')}
            </button>
            <button 
              onClick={() => setReminderType('other')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'other' ? 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Bookmark className="w-4 h-4" /> {t('অন্যান্য', 'Other')}
            </button>
          </div>
          
          <div className="space-y-4 relative z-10">
            {reminderType === 'medicine' && !editingReminderId ? (
              <div className="space-y-4">
                {medicines.map((med, idx) => (
                  <div key={med.id} className="p-3 bg-red-50/50 border border-red-100 rounded-xl relative">
                    {medicines.length > 1 && (
                      <button 
                        onClick={() => removeMedicine(med.id)} 
                        className="absolute top-2 right-2 text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="mb-3">
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">{t('ওষুধের নাম ও পরিমাণ', 'Medicine name and dose')} {medicines.length > 1 && `(${idx + 1})`}</label>
                      <input 
                        type="text" 
                        value={med.name}
                        onChange={(e) => setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, name: e.target.value } : m))}
                        placeholder={t("যেমন: নাপা (১টি) বা গ্যাস্ট্রিকের ওষুধ", "e.g. Paracetamol (1) or antacid")}
                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all bg-white" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">{t('কখন খাবেন? (রুটিন)', 'When to take? (Routine)')}</label>
                      <div className="flex gap-2">
                        {[t('সকাল', 'Morning'), t('দুপুর', 'Afternoon'), t('রাত', 'Night')].map(time => (
                          <button 
                            key={time}
                            onClick={() => toggleRoutine(med.id, time)}
                            className={`flex-1 py-1.5 border rounded-md text-[11px] font-bold transition ${med.routine.includes(time) ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'border-red-200 text-slate-500 bg-white hover:bg-red-50'}`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">{t('খাবারের আগে না পরে?', 'Before or after food?')}</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'before', label: t('খাবারের আগে', 'Before food') },
                          { id: 'after', label: t('খাবারের পরে', 'After food') }
                        ].map(timing => (
                          <button 
                            key={timing.id}
                            onClick={() => setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, mealTiming: timing.id } : m))}
                            className={`flex-1 py-1.5 border rounded-md text-[11px] font-bold transition ${med.mealTiming === timing.id ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'border-red-200 text-slate-500 bg-white hover:bg-red-50'}`}
                          >
                            {timing.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={addMedicine}
                  className="w-full py-2.5 border-2 border-dashed border-red-200 rounded-xl text-red-500 font-bold text-xs flex items-center justify-center hover:bg-red-50 transition"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t('আরও ওষুধ যোগ করুন', 'Add another medicine')}
                </button>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t('কী মনে করিয়ে দিতে হবে?', 'What to remind?')}</label>
                <input 
                  type="text" 
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder={
                    reminderType === 'work' ? t("যেমন: বসের সাথে মিটিং...", "e.g. Meeting with boss...") : 
                    reminderType === 'shopping' ? t("যেমন: মাসের বাজার করা...", "e.g. Monthly grocery...") : 
                    reminderType === 'bill' ? t("যেমন: বিদ্যুৎ বা ইন্টারনেট বিল...", "e.g. Pay electricity bill...") : 
                    reminderType === 'event' ? t("যেমন: বন্ধুর বিয়ে...", "e.g. Friend's wedding...") : 
                    t("যেমন: কাউকে কল করা...", "e.g. Call someone...")
                  } 
                  className={`w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-slate-50/50 ${reminderType === 'work' ? 'focus:border-blue-300 focus:ring-blue-100' : 'focus:border-purple-300 focus:ring-purple-100'}`} 
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {t('তারিখ', 'Date')}</label>
                <input 
                  type="date" 
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-slate-50/50 ${reminderType === 'medicine' ? 'focus:border-red-300 focus:ring-red-100' : reminderType === 'work' ? 'focus:border-blue-300 focus:ring-blue-100' : 'focus:border-purple-300 focus:ring-purple-100'}`} 
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center"><Clock className="w-3 h-3 mr-1"/> {t('সময়', 'Time')}</label>
                <input 
                  type="time" 
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-slate-50/50 ${reminderType === 'medicine' ? 'focus:border-red-300 focus:ring-red-100' : reminderType === 'work' ? 'focus:border-blue-300 focus:ring-blue-100' : 'focus:border-purple-300 focus:ring-purple-100'}`} 
                />
              </div>
            </div>

            <div className={`flex flex-col gap-2 p-4 rounded-xl border mt-2 ${reminderType === 'medicine' ? 'bg-red-50/50 border-red-100' : reminderType === 'work' ? 'bg-blue-50/50 border-blue-100' : 'bg-purple-50/50 border-purple-100'}`}>
              {/* App Alert Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{t('অ্যালার্ট চালু রাখুন', 'Keep Alerts On')}</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{t('অ্যাপের মাধ্যমে নোটিফিকেশন পাঠানো হবে', 'Get notifications via the app')}</p>
                </div>
                <div 
                  onClick={() => setIsAlertOn(!isAlertOn)}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex shrink-0 shadow-inner ${!isAlertOn ? 'bg-slate-300' : reminderType === 'medicine' ? 'bg-red-500' : reminderType === 'work' ? 'bg-blue-500' : 'bg-purple-500'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${isAlertOn ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
              </div>

            </div>

            <button 
              onClick={handleSaveReminder}
              className={`w-full text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-md hover:shadow-lg active:scale-[0.98] mt-2 ${reminderType === 'medicine' ? 'bg-red-500 hover:bg-red-600' : reminderType === 'work' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {t(editingReminderId ? 'আপডেট করুন' : 'রিমাইন্ডার সেভ করুন', editingReminderId ? 'Update Reminder' : 'Save Reminder')}
            </button>
            {editingReminderId && (
              <button 
                onClick={() => {
                  setEditingReminderId(null);
                  setReminderTitle('');
                  setReminderDate('');
                  setReminderTime('');
                }}
                className="w-full text-slate-500 font-bold py-2 rounded-xl transition-all text-sm hover:bg-slate-100 mt-2 border border-transparent hover:border-slate-200"
              >
                বাতিল করুন (Cancel)
              </button>
            )}
          </div>
        </div>

        {/* Reminders List */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-bold text-slate-800">{t('আপনার রিমাইন্ডার লিস্ট', 'Your Reminder List')}</h2>
            <div className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">{savedReminders.length} {t('টি', '')}</div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 pb-1">
            {[
              { id: 'all', label: t('সব', 'All') },
              { id: 'medicine', label: t('ওষুধ', 'Medicine') },
              { id: 'work', label: t('কাজ', 'Work') },
              { id: 'shopping', label: t('শপিং', 'Shopping') },
              { id: 'event', label: t('অনুষ্ঠান', 'Event') }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm shrink-0 ${activeFilter === tab.id ? 'bg-[#0A7756] text-white shadow-[#0A7756]/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredReminders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center min-h-[200px]">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-600 text-sm font-bold mb-1">{t('কোনো রিমাইন্ডার সেট করা নেই', 'No reminders set')}</p>
              <p className="text-slate-400 text-[11px] font-medium max-w-[200px]">{t('ওপরের ফর্মটি ব্যবহার করে আপনার প্রয়োজনীয় কাজের রিমাইন্ডার যোগ করুন', 'Use the form above to add reminders for your tasks')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReminders.map(rem => (
                <div key={rem.id} className="bg-white rounded-xl p-3 flex items-center border border-slate-100 shadow-sm relative overflow-hidden">
                  
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 ${rem.bg} ${rem.color}`}>
                    <rem.icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">{rem.title}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">{rem.subtitle}</p>
                  </div>

                  <div className="flex flex-col items-end justify-center ml-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditReminder(rem); }}
                        className="text-slate-300 hover:text-blue-500 transition-colors"
                        title={t('এডিট করুন', 'Edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteReminder(rem.id); }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title={t('মুছে ফেলুন', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
