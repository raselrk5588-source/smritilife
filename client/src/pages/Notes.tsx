import { useState, useEffect } from 'react';
import { Search, Plus, Star, Heart, GraduationCap, Briefcase, ShoppingCart, FileText, X, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

export default function Notes() {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState(t('সব', 'All'));
  const tabs = [t('সব', 'All'), t('ব্যক্তিগত', 'Personal'), t('কাজ', 'Work'), t('পড়াশোনা', 'Study')];

  const [notes, setNotes] = useState<any[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [hasReminder, setHasReminder] = useState(false);

  const fetchNotes = async () => {
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/notes`);
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((item: any) => ({
          id: item._id,
          title: item.title,
          date: new Date(item.createdAt).toLocaleDateString(),
          time: new Date(item.createdAt).toLocaleTimeString(),
          category: item.category,
          icon: FileText,
          color: 'bg-emerald-50',
          headerColor: 'bg-emerald-100/50 text-emerald-700',
          text: item.content,
          starred: item.favorite
        }));
        setNotes(formatted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleAddNote = async () => {
    if (!newNoteTitle.trim()) {
      toast.error(t('নোটের টাইটেল দিন', 'Enter a note title'));
      return;
    }
    
    try {
      await fetchWithAuth(`${import.meta.env.VITE_API_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteText || ' ',
          category: 'ব্যক্তিগত'
        })
      });
      fetchNotes();
      setIsAddingNote(false);
      setNewNoteTitle('');
      setNewNoteText('');
      setHasReminder(false);
      toast.success(t('নোট সেভ করা হয়েছে!', 'Note saved!'));
    } catch (e) {
      toast.error('Failed to save note');
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Top Header */}
      <header className="bg-primary p-4 pt-10 pb-8 flex items-center justify-between border-b border-slate-100 relative overflow-hidden rounded-b-3xl mb-4 shadow-sm">
        {/* Notebook Theme */}
        <div className="absolute inset-0 z-0 bg-cover" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center 40%", opacity: "0.9" }}></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/60 via-primary/30 to-black/40"></div>
        
        <div className="w-10"></div>
        <div className="text-center relative z-10">
          <h1 className="text-2xl font-bold text-white drop-shadow-md">{t('নোট', 'Notes')}</h1>
          <p className="text-white/90 text-[11px] font-medium mt-1 drop-shadow-sm">{t('আপনার সব গুরুত্বপূর্ণ নোট এখানে', 'All your important notes here')}</p>
        </div>
        <button 
          onClick={() => setIsAddingNote(true)}
          className="bg-white text-primary p-2 rounded-full shadow-md transition-transform hover:scale-105 relative z-10"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4">
        {/* Search */}
        <div className="bg-slate-50 rounded-2xl p-3 flex items-center mb-4 border border-slate-100">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder={t("নোট খুঁজুন...", "Search notes...")}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 placeholder-slate-400"
          />
          <button className="text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide mb-4">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
          <button className="px-2.5 py-1.5 rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50 shrink-0">
            <Heart className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          {notes.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 mt-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[250px] text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-slate-800 font-bold text-lg mb-2">{t('কোনো নোট নেই', 'No notes found')}</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-[250px]">
                {t('আপনার গুরুত্বপূর্ণ ভাবনা এবং কাজের তালিকা লিখে রাখুন।', 'Write down your important thoughts and task lists.')}
              </p>
              <button 
                onClick={() => setIsAddingNote(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-3 rounded-full hover:shadow-lg hover:scale-105 transition-all"
              >
                {t('+ নতুন নোট তৈরি করুন', '+ Create New Note')}
              </button>
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} className={`${note.color} rounded-xl p-3 shadow-sm relative overflow-hidden group cursor-pointer border border-transparent hover:border-black/5 transition-all`}>
                
                {/* Left Color Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${note.headerColor.split(' ')[0]}`}></div>
                
                <div className="flex justify-between items-start mb-2 pl-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${note.headerColor}`}>
                      <note.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-[15px]">{note.title}</h3>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {note.date} <span className="mx-1">•</span> {note.time}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button className={`${note.starred ? 'text-amber-400' : 'text-slate-300'}`}>
                      <Star className={`w-5 h-5 ${note.starred ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="pl-14 pr-2">
                  {note.text ? (
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{note.text}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {note.items?.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start text-sm text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 mr-2 flex-shrink-0"></div>
                          <span className="line-clamp-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Note Modal */}
      {isAddingNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800">{t('নতুন নোট', 'New Note')}</h2>
              <button onClick={() => setIsAddingNote(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder={t("নোটের টাইটেল (যেমন: বাজারের তালিকা)", "Note Title (e.g. Grocery list)")}
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 text-sm text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[t('বাজারের তালিকা', 'Grocery List'), t('আজকের কাজ', "Today's Work"), t('মিটিং', 'Meeting'), t('পড়াশোনা', 'Study')].map(title => (
                <button 
                  key={title}
                  onClick={() => setNewNoteTitle(title)}
                  className="bg-slate-100 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 text-slate-500 hover:text-emerald-600 text-[10px] font-bold py-1 px-2.5 rounded-full transition-colors"
                >
                  + {title}
                </button>
              ))}
            </div>
            
            <textarea 
              placeholder={t("নোটের বিস্তারিত লিখুন...", "Write note details...")}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-sm text-slate-600 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            
            {/* Reminder Toggle */}
            <div className="flex items-center justify-between mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${hasReminder ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700">{t('রিমাইন্ডার সেট করুন', 'Set Reminder')}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{t('এই নোটের জন্য অ্যালার্ট পেতে চান?', 'Want an alert for this note?')}</p>
                </div>
              </div>
              <div 
                onClick={() => setHasReminder(!hasReminder)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex shrink-0 shadow-inner ${hasReminder ? 'bg-primary' : 'bg-slate-300'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${hasReminder ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {hasReminder && (
              <div className="flex gap-2 mb-5 animate-in slide-in-from-top-2 fade-in duration-200">
                <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                <input type="time" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
            )}
            
            <button 
              onClick={handleAddNote}
              className="w-full bg-gradient-to-r from-primary to-emerald-600 text-white font-bold py-3.5 rounded-full hover:shadow-lg active:scale-95 transition-transform"
            >
              {t('নোট সেভ করুন', 'Save Note')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
