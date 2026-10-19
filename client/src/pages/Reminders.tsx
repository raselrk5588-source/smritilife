import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Bell, Calendar, Clock, Pill, Briefcase, Bookmark, Trash2, MoreVertical, ShoppingCart, CreditCard, Gift, Edit, Phone, MessageSquare, BellRing, AlarmClock, SunMedium, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function Reminders() {
  const { t } = useSettings();
  const [isAlertOn, setIsAlertOn] = useState(true);
  const [reminderType, setReminderType] = useState<'medicine' | 'work' | 'shopping' | 'bill' | 'event' | 'other'>('medicine');
  
  // State for multiple medicines with course duration & start date
  const [medicines, setMedicines] = useState([
    { id: 1, name: '', routine: ['সকাল', 'রাত'] as string[], mealTiming: 'after', durationDays: 7 }
  ]);
  const [medicineStartDateOption, setMedicineStartDateOption] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [medicineCustomStartDate, setMedicineCustomStartDate] = useState(getCurrentDate());
  
  // States for work/other
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(getCurrentDate());
  const [reminderTime, setReminderTime] = useState(getCurrentTime());

  // States for WhatsApp Integration
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [activeFilter, setActiveFilter] = useState('all');
  
  // State for saved reminders list
  const [savedReminders, setSavedReminders] = useState<any[]>([]);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  const filteredReminders = activeFilter === 'all' 
    ? savedReminders 
    : activeFilter === 'pending'
    ? savedReminders.filter(rem => rem.status === 'Pending')
    : activeFilter === 'completed'
    ? savedReminders.filter(rem => rem.status === 'Completed')
    : activeFilter === 'message'
    ? savedReminders.filter(rem => rem.type === 'message' || !!rem.recipientPhone)
    : savedReminders.filter(rem => rem.type === activeFilter);

  // Fetch from backend on load
  const fetchReminders = async () => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`);
      if (res.ok) {
        const data = await res.json();
        
        const nonMedicineReminders: any[] = [];
        const medicineRemindersBySlot: Record<string, {
          id: string;
          legacyIds: string[];
          slot: string;
          time: string;
          dateStr: string;
          status: string;
          medicines: any[];
          rawItem: any;
        }> = {};

        data.forEach((item: any) => {
          if (item.category === 'medicine') {
            const rawRoutine = item.medicineRoutine || (
              item.title?.includes('সকাল') ? 'সকাল' :
              item.title?.includes('দুপুর') ? 'দুপুর' :
              item.title?.includes('রাত') ? 'রাত' : ''
            );
            const slot = rawRoutine || (
              (item.time || '08:30') < '12:00' ? 'সকাল' : (item.time || '08:30') < '17:00' ? 'দুপুর' : 'রাত'
            );

            if (!medicineRemindersBySlot[slot]) {
              medicineRemindersBySlot[slot] = {
                id: item._id,
                legacyIds: [item._id],
                slot,
                time: item.time || (slot === 'সকাল' ? '08:30' : slot === 'দুপুর' ? '13:30' : '21:00'),
                dateStr: item.date ? new Date(item.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '',
                status: item.status || 'Pending',
                medicines: [],
                rawItem: item
              };
            } else {
              medicineRemindersBySlot[slot].legacyIds.push(item._id);
            }

            if (item.medicines && Array.isArray(item.medicines) && item.medicines.length > 0) {
              item.medicines.forEach((m: any) => {
                const already = medicineRemindersBySlot[slot].medicines.find(x => x.name?.toLowerCase() === m.name?.toLowerCase());
                if (!already) {
                  medicineRemindersBySlot[slot].medicines.push(m);
                }
              });
            } else {
              // Legacy single-medicine reminder
              const medName = item.title ? item.title.replace(/\s*\([^)]*\)/g, '').trim() : 'ওষুধ';
              const already = medicineRemindersBySlot[slot].medicines.find(x => x.name?.toLowerCase() === medName.toLowerCase());
              if (!already) {
                medicineRemindersBySlot[slot].medicines.push({
                  name: medName,
                  mealTiming: item.mealTiming || 'after',
                  durationDays: item.durationDays || 7,
                  startDate: item.startDate || item.date,
                  endDate: item.endDate
                });
              }
            }
          } else {
            nonMedicineReminders.push(item);
          }
        });

        const formattedNonMed = nonMedicineReminders.map((item: any) => {
          let icon = Bookmark;
          let color = 'text-purple-500';
          let bg = 'bg-purple-50';
          
          if (item.category === 'wakeup' || item.category === 'alarm' || item.isAlarm) { icon = AlarmClock; color = 'text-amber-500'; bg = 'bg-amber-50'; }
          else if (item.category === 'work') { icon = Briefcase; color = 'text-blue-500'; bg = 'bg-blue-50'; }
          else if (item.category === 'shopping') { icon = ShoppingCart; color = 'text-emerald-500'; bg = 'bg-emerald-50'; }
          else if (item.category === 'bill') { icon = CreditCard; color = 'text-orange-500'; bg = 'bg-orange-50'; }
          else if (item.category === 'event') { icon = Gift; color = 'text-pink-500'; bg = 'bg-pink-50'; }
          else if (item.category === 'message' || item.recipientPhone) { icon = MessageSquare; color = 'text-teal-500'; bg = 'bg-teal-50'; }

          let formattedTime = item.time || '10:00';
          if (formattedTime.includes(':')) {
            const parts = formattedTime.split(':');
            const h = parseInt(parts[0], 10);
            if (!isNaN(h)) {
              const ampm = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 === 0 ? 12 : h % 12;
              formattedTime = `${h12}:${parts[1]} ${ampm}`;
            }
          }

          const dateStr = item.date ? new Date(item.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : '';

          return {
            id: item._id,
            type: item.category,
            title: item.title,
            description: item.description,
            recipientPhone: item.recipientPhone,
            dateStr,
            formattedTime,
            subtitle: item.description || `${dateStr} • ${formattedTime}`,
            icon, color, bg,
            status: item.status || 'Pending',
            active: item.status !== 'Cancelled',
            originalDate: item.date,
            originalTime: item.time,
            startDate: item.startDate,
            endDate: item.endDate,
            durationDays: item.durationDays,
            mealTiming: item.mealTiming,
            medicineRoutine: item.medicineRoutine
          };
        });

        const slotIcons: Record<string, string> = {
          'সকাল': '🌅',
          'Morning': '🌅',
          'দুপুর': '☀️',
          'Afternoon': '☀️',
          'রাত': '🌙',
          'Night': '🌙'
        };

        const formattedMed = Object.values(medicineRemindersBySlot).map(slotGroup => {
          let formattedTime = slotGroup.time || '08:30';
          if (formattedTime.includes(':')) {
            const parts = formattedTime.split(':');
            const h = parseInt(parts[0], 10);
            if (!isNaN(h)) {
              const ampm = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 === 0 ? 12 : h % 12;
              formattedTime = `${h12}:${parts[1]} ${ampm}`;
            }
          }

          const slotIcon = slotIcons[slotGroup.slot] || '💊';
          const title = `${slotIcon} ${slotGroup.slot}ের ওষুধ`;

          return {
            id: slotGroup.id,
            legacyIds: slotGroup.legacyIds,
            type: 'medicine',
            title,
            description: `${slotGroup.slot}ের ওষুধ (${slotGroup.medicines.map(m => m.name).join(', ')})`,
            dateStr: slotGroup.dateStr,
            formattedTime,
            subtitle: `${slotGroup.slot} • ${formattedTime}`,
            icon: Pill,
            color: 'text-red-500',
            bg: 'bg-red-50',
            status: slotGroup.status,
            active: slotGroup.status !== 'Cancelled',
            originalDate: slotGroup.rawItem?.date,
            originalTime: slotGroup.time,
            medicineRoutine: slotGroup.slot,
            medicines: slotGroup.medicines
          };
        });

        setSavedReminders([...formattedMed, ...formattedNonMed]);
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

  const addMedicine = () => setMedicines([...medicines, { id: Date.now(), name: '', routine: ['সকাল', 'রাত'], mealTiming: 'after', durationDays: 7 }]);
  const removeMedicine = (id: number) => setMedicines(medicines.filter(m => m.id !== id));

  const handleSaveReminder = async () => {
    if (editingReminderId) {
      const targetTitle = reminderTitle.trim() || (reminderType === 'medicine' ? '💊 ওষুধের রিমাইন্ডার' : '');
      if (!targetTitle) {
        toast.error(t('রিমাইন্ডারের বিষয় লিখুন', 'Enter a reminder subject'));
        return;
      }
      try {
        const body: any = {
          title: targetTitle,
          category: reminderType,
          date: reminderDate ? new Date(reminderDate).toISOString() : new Date().toISOString(),
          time: reminderTime || '09:00',
          status: isAlertOn ? 'Pending' : 'Cancelled'
        };

        if (reminderType === 'medicine') {
          const validMeds = medicines.filter(m => m.name.trim() !== '');
          if (validMeds.length > 0) {
            body.medicines = validMeds;
          }
        }

        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${editingReminderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          fetchReminders();
          setEditingReminderId(null);
          setReminderTitle('');
          setReminderDate(getCurrentDate());
          setReminderTime(getCurrentTime());
          toast.success(t('রিমাইন্ডার সফলভাবে আপডেট হয়েছে!', 'Reminder updated successfully!'));
        } else {
          toast.error(t('রিমাইন্ডার আপডেট ব্যর্থ হয়েছে', 'Failed to update reminder'));
        }
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
        const routineTimes: Record<string, string> = {
          'সকাল': '08:30',
          'Morning': '08:30',
          'দুপুর': '13:30',
          'Afternoon': '13:30',
          'রাত': '21:00',
          'Night': '21:00'
        };

        const now = new Date();
        let startD = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        if (medicineStartDateOption === 'tomorrow') {
          startD.setDate(startD.getDate() + 1);
        } else if (medicineStartDateOption === 'custom' && medicineCustomStartDate) {
          const [y, m, d] = medicineCustomStartDate.split('-').map(Number);
          startD = new Date(y, m - 1, d, 0, 0, 0);
        }

        const slotMeds: Record<string, any[]> = {
          'সকাল': [],
          'দুপুর': [],
          'রাত': []
        };

        for (const med of validMeds) {
          const duration = med.durationDays || 7;
          const endD = new Date(startD);
          endD.setDate(endD.getDate() + duration - 1);
          endD.setHours(23, 59, 59, 999);

          for (const routineItem of med.routine) {
            const slotKey = routineItem.includes('সকাল') || routineItem.toLowerCase().includes('morning') ? 'সকাল'
              : routineItem.includes('দুপুর') || routineItem.toLowerCase().includes('afternoon') ? 'দুপুর'
              : 'রাত';

            slotMeds[slotKey].push({
              name: med.name.trim(),
              mealTiming: med.mealTiming || 'after',
              durationDays: duration,
              startDate: startD.toISOString(),
              endDate: endD.toISOString()
            });
          }
        }

        for (const slotKey of ['সকাল', 'দুপুর', 'রাত'] as const) {
          const list = slotMeds[slotKey];
          if (list.length === 0) continue;

          await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `${slotKey}ের ওষুধ`,
              category: 'medicine',
              medicineRoutine: slotKey,
              description: `${slotKey}ের ওষুধ (${list.map(m => m.name).join(', ')})`,
              date: startD.toISOString(),
              time: routineTimes[slotKey] || '08:30',
              repeat: 'Daily',
              medicines: list,
              status: isAlertOn ? 'Pending' : 'Cancelled'
            })
          });
        }

        fetchReminders();
        setMedicines([{ id: Date.now(), name: '', routine: ['সকাল', 'রাত'], mealTiming: 'after', durationDays: 7 }]);
        setReminderTitle('');
        setReminderDate(getCurrentDate());
        setReminderTime(getCurrentTime());
        toast.success(t('ওষুধের রুটিন রিমাইন্ডার সফলভাবে সেভ হয়েছে!', 'Medicine routine reminders saved successfully!'));
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
            isAlarm: reminderType === 'wakeup' || reminderType === 'alarm',
            date: reminderDate || new Date().toISOString(),
            time: reminderTime || '09:00',
            status: isAlertOn ? 'Pending' : 'Cancelled'
          })
        });
        fetchReminders();
        setReminderTitle('');
        setReminderDate(getCurrentDate());
        setReminderTime(getCurrentTime());
        if (reminderType === 'wakeup') {
          toast.success(t('ওয়েক-আপ অ্যালার্ম সেভ হয়েছে! নির্ধারিত সময়ে অ্যালার্ম বাজবে।', 'Wake-up alarm saved! Will ring at scheduled time.'));
        } else {
          toast.success(t('রিমাইন্ডার সেভ হয়েছে!', 'Reminder saved!'));
        }
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

  const handleDeleteReminder = async (id: string, legacyIds?: string[]) => {
    try {
      if (legacyIds && legacyIds.length > 0) {
        await Promise.all(legacyIds.map(legId => fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${legId}`, { method: 'DELETE' })));
      } else {
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${id}`, {
          method: 'DELETE'
        });
      }
      fetchReminders();
      toast.success(t('রিমাইন্ডার মুছে ফেলা হয়েছে!', 'Reminder deleted!'));
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const handleRemoveMedicineFromSlot = async (rem: any, medIndex: number) => {
    try {
      if (rem.medicines && rem.medicines.length > 0) {
        const updatedMeds = rem.medicines.filter((_: any, idx: number) => idx !== medIndex);
        if (updatedMeds.length === 0) {
          await handleDeleteReminder(rem.id, rem.legacyIds);
          return;
        }
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${rem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medicines: updatedMeds })
        });
        fetchReminders();
        toast.success(t('ওষুধ সরানো হয়েছে', 'Medicine removed'));
      } else if (rem.legacyIds && rem.legacyIds[medIndex]) {
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${rem.legacyIds[medIndex]}`, {
          method: 'DELETE'
        });
        fetchReminders();
        toast.success(t('ওষুধ সরানো হয়েছে', 'Medicine removed'));
      }
    } catch (e) {
      toast.error('Failed to remove medicine');
    }
  };

  const handleEditReminder = (rem: any) => {
    setEditingReminderId(rem.id);
    let type = rem.type === 'General' || !rem.type ? 'other' : rem.type;
    setReminderType(type as any);
    
    setReminderTitle(rem.title || '');

    // If it's a medicine reminder, populate medicines
    if (rem.type === 'medicine' && rem.medicines && Array.isArray(rem.medicines) && rem.medicines.length > 0) {
      setMedicines(rem.medicines.map((m: any, i: number) => ({
        id: Date.now() + i,
        name: m.name || '',
        routine: [rem.medicineRoutine || 'সকাল'],
        mealTiming: m.mealTiming || 'after',
        durationDays: m.durationDays || 7
      })));
    }

    if (rem.originalDate) {
      const d = new Date(rem.originalDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setReminderDate(`${y}-${m}-${day}`);
      } else {
        setReminderDate(getCurrentDate());
      }
    } else {
      setReminderDate(getCurrentDate());
    }

    setReminderTime(rem.originalTime || getCurrentTime());
    setIsAlertOn(rem.active);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24 font-sans">
      {/* Top Header Banner */}
      <div className="bg-primary text-white p-4 pt-6 md:pt-8 pb-6 flex justify-between items-center relative overflow-hidden rounded-b-3xl shadow-sm z-20">
        <div className="absolute inset-0 z-0 bg-cover" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center 40%", opacity: "0.9" }}></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/60 via-primary/30 to-black/40"></div>
        
        <div className="text-center flex-1 relative z-10 w-full flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold drop-shadow-md">{t('রিমাইন্ডার', 'Reminders')}</h1>
          <p className="text-white/90 text-[11px] font-medium drop-shadow-sm mt-0.5">{t('কখনো কিছু ভুলবেন না', 'Never forget anything')}</p>
        </div>
      </div>

      <div className="px-4 mt-6">
        
        {/* Add / Edit Reminder Form */}
        <div className={`bg-white rounded-3xl p-5 border shadow-sm mb-6 relative overflow-hidden transition-all ${editingReminderId ? 'border-amber-400 ring-4 ring-amber-100 shadow-md' : 'border-slate-100'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[100px] -z-0 opacity-50 transition-colors ${editingReminderId ? 'bg-amber-100/60' : reminderType === 'medicine' ? 'bg-red-50' : reminderType === 'work' ? 'bg-blue-50' : 'bg-purple-50'}`}></div>

          {editingReminderId && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 sm:p-3.5 mb-4 flex items-center justify-between shadow-2xs relative z-10 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold text-base shrink-0">
                  ✏️
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    <span>{t('রিমাইন্ডার এডিট করছেন', 'Editing Reminder')}</span>
                    <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full">সক্রিয় মোড</span>
                  </h4>
                  <p className="text-[11px] text-amber-800 font-medium truncate max-w-[180px] sm:max-w-xs">{reminderTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingReminderId(null);
                  setReminderTitle('');
                  setReminderDate(getCurrentDate());
                  setReminderTime(getCurrentTime());
                }}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> {t('বাতিল', 'Cancel')}
              </button>
            </div>
          )}
          
          <h2 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center relative z-10">
            <Plus className={`w-4 h-4 mr-1 ${editingReminderId ? 'text-amber-600' : reminderType === 'medicine' ? 'text-red-500' : reminderType === 'work' ? 'text-blue-500' : 'text-purple-500'}`} /> 
            {t(editingReminderId ? 'রিমাইন্ডার আপডেট করুন' : 'নতুন রিমাইন্ডার যোগ করুন', editingReminderId ? 'Update Reminder' : 'Add New Reminder')}
          </h2>

          {/* Category Selector */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5 relative z-10">
            <button 
              onClick={() => setReminderType('wakeup')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border ${reminderType === 'wakeup' ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm ring-1 ring-amber-400/50' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <AlarmClock className="w-4 h-4 text-amber-600 animate-pulse" /> {t('ঘুম ভাঙা/অ্যালার্ম', 'Wake-up Alarm')}
            </button>
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
            {reminderType === 'medicine' ? (
              <div className="space-y-4">
                {medicines.map((med, idx) => (
                  <div key={med.id} className="p-3.5 bg-red-50/40 border border-red-200/70 rounded-2xl relative shadow-2xs">
                    {medicines.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeMedicine(med.id)} 
                        className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-600 bg-white rounded-full p-1 shadow-2xs border border-red-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="mb-3">
                      <label className="text-[11px] font-bold text-slate-700 mb-1.5 block">
                        {t('ওষুধের নাম ও পরিমাণ', 'Medicine name & dose')} {medicines.length > 1 && `(${idx + 1})`}
                      </label>
                      <input 
                        type="text" 
                        value={med.name}
                        onChange={(e) => setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, name: e.target.value } : m))}
                        placeholder={t("যেমন: নাপা ৫০০, সেক্লো ২০ বা গ্যাস্ট্রিকের ওষুধ", "e.g. Napa 500, Seclo 20...")}
                        className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all bg-white" 
                      />
                    </div>

                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">{t('কখন খাবেন? (রুটিন/বেলা)', 'When to take? (Routine)')}</label>
                      <div className="flex gap-2">
                        {[t('সকাল', 'Morning'), t('দুপুর', 'Afternoon'), t('রাত', 'Night')].map(time => (
                          <button 
                            key={time}
                            type="button"
                            onClick={() => toggleRoutine(med.id, time)}
                            className={`flex-1 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${med.routine.includes(time) ? 'bg-red-500 border-red-500 text-white shadow-xs' : 'border-red-200 text-slate-600 bg-white hover:bg-red-50'}`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">{t('খাবারের আগে না পরে?', 'Before or after food?')}</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'before', label: t('খাবারের আগে', 'Before food') },
                          { id: 'after', label: t('খাবারের পরে', 'After food') }
                        ].map(timing => (
                          <button 
                            key={timing.id}
                            type="button"
                            onClick={() => setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, mealTiming: timing.id } : m))}
                            className={`flex-1 py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer ${med.mealTiming === timing.id ? 'bg-red-500 border-red-500 text-white shadow-xs' : 'border-red-200 text-slate-600 bg-white hover:bg-red-50'}`}
                          >
                            {timing.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">{t('কতদিন খাবেন? (কোর্স মেয়াদ)', 'Duration in days?')}</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[3, 5, 7, 10, 14, 30].map(days => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, durationDays: days } : m))}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${med.durationDays === days ? 'bg-red-500 border-red-500 text-white shadow-2xs' : 'border-red-200 bg-white text-slate-600 hover:bg-red-50'}`}
                          >
                            {days} দিন
                          </button>
                        ))}
                        <div className="flex items-center gap-1 ml-auto">
                          <input 
                            type="number"
                            min="1"
                            max="365"
                            value={med.durationDays || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setMedicines(meds => meds.map(m => m.id === med.id ? { ...m, durationDays: val } : m));
                            }}
                            className="w-14 border border-red-200 rounded-lg px-2 py-1 text-center text-xs font-bold bg-white focus:outline-none focus:border-red-400"
                          />
                          <span className="text-[11px] text-slate-500 font-bold">দিন</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button"
                  onClick={addMedicine}
                  className="w-full py-2.5 border-2 border-dashed border-red-200 rounded-xl text-red-500 font-bold text-xs flex items-center justify-center hover:bg-red-50 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t('আরও ওষুধ যোগ করুন (যেমন: সেক্লো, নাপা ইত্যাদি)', 'Add another medicine')}
                </button>

                {/* Course Start Date Picker */}
                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                  <label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-500" />
                    <span>{t('কবে থেকে ওষুধ খাওয়া শুরু করবেন? (শুরুর তারিখ)', 'When will you start taking the medicine?')}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { id: 'today', label: t('আজ থেকে', 'From Today') },
                      { id: 'tomorrow', label: t('কাল থেকে', 'From Tomorrow') },
                      { id: 'custom', label: t('নির্দিষ্ট তারিখ', 'Pick Date') }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMedicineStartDateOption(opt.id as any)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${medicineStartDateOption === opt.id ? 'bg-[#0A7756] border-[#0A7756] text-white shadow-2xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {medicineStartDateOption === 'custom' && (
                    <input 
                      type="date"
                      value={medicineCustomStartDate}
                      onChange={(e) => setMedicineCustomStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white focus:outline-none focus:border-[#0A7756]"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{t('কী মনে করিয়ে দিতে হবে?', 'What to remind?')}</label>
                <input 
                  type="text" 
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder={
                    reminderType === 'wakeup' ? t("যেমন: সকাল ৬টায় ঘুম থেকে ওঠা...", "e.g. Wake up at 6:00 AM...") :
                    reminderType === 'work' ? t("যেমন: বসের সাথে মিটিং...", "e.g. Meeting with boss...") : 
                    reminderType === 'shopping' ? t("যেমন: মাসের বাজার করা...", "e.g. Monthly grocery...") : 
                    reminderType === 'bill' ? t("যেমন: বিদ্যুৎ বা ইন্টারনেট বিল...", "e.g. Pay electricity bill...") : 
                    reminderType === 'event' ? t("যেমন: বন্ধুর বিয়ে...", "e.g. Friend's wedding...") : 
                    t("যেমন: কাউকে কল করা...", "e.g. Call someone...")
                  } 
                  className={`w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-slate-50/50 ${reminderType === 'wakeup' ? 'focus:border-amber-400 focus:ring-amber-100' : reminderType === 'work' ? 'focus:border-blue-300 focus:ring-blue-100' : 'focus:border-purple-300 focus:ring-purple-100'}`} 
                />
                {reminderType === 'wakeup' && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2 mt-2 font-medium">
                    <SunMedium className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('নির্ধারিত সময়ে ফুলস্ক্রিন ওয়েক-আপ অ্যালার্ম উঠবে এবং বন্ধ না করা পর্যন্ত তীব্র রিংটোন বাজবে।', 'Full-screen wake-up alarm will ring with continuous tone until stopped.')}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Date and Time pickers (shown only for non-medicine or when editing) */}
            {(reminderType !== 'medicine' || editingReminderId) && (
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
            )}

            <div className={`flex flex-col gap-2 p-3 sm:p-3.5 rounded-xl border mt-2 ${reminderType === 'medicine' ? 'bg-red-50/50 border-red-100' : reminderType === 'work' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-200/80'}`}>
              {/* App Alert Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">{t('অ্যালার্ট চালু রাখুন', 'Keep Alerts On')}</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{t('অ্যাপের মাধ্যমে নোটিফিকেশন পাঠানো হবে', 'Get notifications via the app')}</p>
                </div>
                <div 
                  onClick={() => setIsAlertOn(!isAlertOn)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex shrink-0 shadow-inner ${!isAlertOn ? 'bg-slate-300' : reminderType === 'medicine' ? 'bg-red-500' : 'bg-[#0A7756]'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${isAlertOn ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveReminder}
              className={`w-full text-white font-bold py-2.5 sm:py-3 rounded-xl transition-all text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-[0.98] mt-2 cursor-pointer ${
                reminderType === 'medicine' 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gradient-to-r from-[#0A7756] to-emerald-600 hover:from-[#086146] hover:to-emerald-700'
              }`}
            >
              {t(editingReminderId ? 'আপডেট করুন' : 'রিমাইন্ডার সেভ করুন', editingReminderId ? 'Update Reminder' : 'Save Reminder')}
            </button>
            {editingReminderId && (
              <button 
                onClick={() => {
                  setEditingReminderId(null);
                  setReminderTitle('');
                  setReminderDate(getCurrentDate());
                  setReminderTime(getCurrentTime());
                }}
                className="w-full text-slate-500 font-bold py-2 rounded-xl transition-all text-sm hover:bg-slate-100 mt-2 border border-transparent hover:border-slate-200 cursor-pointer"
              >
                বাতিল করুন (Cancel)
              </button>
            )}
          </div>
        </div>

        {/* Reminders List */}
        <div className="mt-5 sm:mt-6">
          <div className="flex justify-between items-center mb-2.5 sm:mb-3">
            <h2 className="text-sm sm:text-[15px] font-bold text-slate-800">{t('আপনার রিমাইন্ডার লিস্ট', 'Your Reminder List')}</h2>
            <div className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">{savedReminders.length} {t('টি', '')}</div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 pb-1">
            {[
              { id: 'all', label: t('সব', 'All') },
              { id: 'pending', label: t('চলমান/পেন্ডিং', 'Pending') },
              { id: 'completed', label: t('সম্পন্ন', 'Completed') },
              { id: 'message', label: t('মেসেজ', 'Messages') },
              { id: 'medicine', label: t('ওষুধ', 'Medicine') },
              { id: 'work', label: t('কাজ', 'Work') },
              { id: 'shopping', label: t('শপিং', 'Shopping') },
              { id: 'event', label: t('অনুষ্ঠান', 'Event') }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${activeFilter === tab.id ? 'bg-[#0A7756] text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredReminders.length === 0 ? (
            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 shadow-2xs">
                <Bell className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-slate-700 text-xs font-bold leading-tight">{t('কোনো রিমাইন্ডার পাওয়া যায়নি', 'No reminders found')}</p>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5 leading-snug">{t('ওপরের ফর্মটি ব্যবহার করে প্রয়োজনীয় রিমাইন্ডার যোগ করুন', 'Use the form above to add reminders')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReminders.map(rem => (
                <div key={rem.id} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm relative overflow-hidden">
                  
                  <div className="flex items-start">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mr-3 shrink-0 ${rem.bg} ${rem.color} mt-0.5`}>
                      <rem.icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-slate-800">{rem.title}</h3>
                        {rem.status === 'Completed' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ সম্পন্ন</span>
                        ) : rem.status === 'Cancelled' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">বাতিল</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏰ রানিং</span>
                        )}
                        {rem.type === 'medicine' && rem.medicines && rem.medicines.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                            💊 {rem.medicines.length}টি ওষুধ
                          </span>
                        )}
                      </div>
                      {rem.recipientPhone && (
                        <div className="text-[11px] font-bold text-teal-700 mb-1 flex items-center">
                          <Phone className="w-3 h-3 mr-1 inline shrink-0" /> প্রাপক: {rem.recipientPhone}
                        </div>
                      )}
                      {rem.type !== 'medicine' && rem.description && (
                        <p className="text-[12px] text-slate-600 font-medium line-clamp-2 mb-1">{rem.description}</p>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">
                        ⏰ {rem.formattedTime} {rem.type === 'medicine' ? '• প্রতিদিন (Daily)' : `• 📅 ${rem.dateStr}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end justify-center ml-2 gap-3 shrink-0">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditReminder(rem); }}
                          className="text-slate-300 hover:text-blue-500 transition-colors"
                          title={t('এডিট করুন', 'Edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteReminder(rem.id, rem.legacyIds); }}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title={t('মুছে ফেলুন', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Medicines List inside Medicine Slot Card */}
                  {rem.type === 'medicine' && rem.medicines && rem.medicines.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100/90">
                      <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
                        <span>💊 খাওয়ার ওষুধসমূহ:</span>
                      </div>
                      <div className="space-y-1.5">
                        {rem.medicines.map((m: any, mIdx: number) => {
                          const now = new Date();
                          const end = m.endDate ? new Date(m.endDate) : null;
                          const diffDays = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                          const isEnded = end && diffDays < 0;

                          return (
                            <div key={m._id || mIdx} className="flex items-center justify-between bg-red-50/40 border border-red-100/80 rounded-xl px-2.5 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-slate-800 truncate">{m.name}</span>
                                <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200/80 rounded px-1.5 py-0.5 shrink-0">
                                  {m.mealTiming === 'before' ? 'খাবারের আগে' : 'খাবারের পরে'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isEnded ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-red-600 border border-red-200 shadow-2xs'
                                }`}>
                                  {isEnded ? '✓ কোর্স সম্পন্ন' : `${m.durationDays || 7} দিন • বাকি ${diffDays > 0 ? diffDays : 0} দিন`}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMedicineFromSlot(rem, mIdx);
                                  }}
                                  className="text-slate-400 hover:text-red-500 p-0.5 transition-colors cursor-pointer"
                                  title="ওষুধ মুছুন"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
