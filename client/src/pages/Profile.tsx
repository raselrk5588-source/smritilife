import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { ChevronRight, Camera, Settings, Cloud, Crown, Palette, Globe, Shield, User, LogOut, Mail, Phone, MessageSquare, FileText, Bell, Gift, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

export default function Profile() {
  const { language, setLanguage, theme, setTheme, t } = useSettings();
  const [name, setName] = useState('ব্যবহারকারী');
  const [email, setEmail] = useState('user@example.com');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [username, setUsername] = useState('user_01');
  const [honorific, setHonorific] = useState('');
  const [isEditProfile, setIsEditProfile] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);
  
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [stats, setStats] = useState({ notes: 0, reminders: 0, specialDates: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile on load
  useEffect(() => {
    // Fallback to local storage first for instant load
    const savedName = localStorage.getItem('userName');
    const savedEmail = localStorage.getItem('userEmail');
    const savedMobile = localStorage.getItem('userMobile');
    const savedWhatsapp = localStorage.getItem('whatsappNumber');
    const savedHonorific = localStorage.getItem('userHonorific');
    
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedMobile) setMobile(savedMobile);
    if (savedWhatsapp) setWhatsapp(savedWhatsapp);
    if (savedHonorific) setHonorific(savedHonorific);

    // Then try to fetch from real DB
    fetchWithAuth(`${import.meta.env.VITE_API_URL}/users/profile`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setName(data.name);
          localStorage.setItem('userName', data.name);
        }
        if (data.email) {
          setEmail(data.email);
          localStorage.setItem('userEmail', data.email);
        }
        if (data.mobile) {
          setMobile(data.mobile);
          localStorage.setItem('userMobile', data.mobile);
        }
        if (data.whatsapp) {
          setWhatsapp(data.whatsapp);
          localStorage.setItem('whatsappNumber', data.whatsapp);
        }
        if (data.honorific) {
          setHonorific(data.honorific);
          localStorage.setItem('userHonorific', data.honorific);
        }
        if (data.username) setUsername(data.username);
        if (data.profilePic) setProfilePic(data.profilePic);
        if (data.stats) setStats(data.stats);
      })
      .catch(err => console.error('Error fetching profile:', err));
  }, []);

  const handleSaveProfile = async () => {
    try {
      const payload: any = { name, mobile, whatsapp, honorific };
      
      if (email.trim() !== '' && email !== 'user@example.com') {
        payload.email = email;
      }
      if (username.trim() !== '' && username !== 'user_01') {
        payload.username = username;
      }
      if (profilePic) {
        payload.profilePic = profilePic;
      }

      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        localStorage.setItem('userName', name);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userMobile', mobile);
        localStorage.setItem('whatsappNumber', whatsapp);
        if (honorific) localStorage.setItem('userHonorific', honorific);
        
        toast.success(t('প্রোফাইল আপডেট হয়েছে!', 'Profile updated!'));
        setIsEditProfile(false);
      } else {
        toast.error(t('আপডেট করতে সমস্যা হয়েছে', 'Failed to update'));
      }
    } catch (err) {
      toast.error(t('সার্ভারের সাথে কানেক্ট করা যাচ্ছে না', 'Failed to connect to server'));
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
        toast.success(t('প্রোফাইল ছবি নির্বাচন করা হয়েছে! সেভ বাটনে ক্লিক করুন।', 'Profile picture selected! Click save.'));
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Stats state is defined above

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-24">
      {/* Modern Hero Profile Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#064e3b] to-emerald-950 pt-6 sm:pt-8 pb-12 sm:pb-14 px-6 sm:px-8 text-white rounded-b-[2rem] shadow-lg">
        {/* Ambient Decorative Lighting */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 left-10 w-56 h-56 bg-teal-400/15 rounded-full blur-2xl pointer-events-none"></div>

        {/* Center Profile Avatar & Information */}
        <div className="max-w-xl mx-auto flex flex-col items-center text-center relative z-10">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-emerald-500 p-0.5 shadow-xl ring-4 ring-white/20 backdrop-blur-md">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-emerald-800 to-teal-700 flex items-center justify-center text-white font-black text-3xl shadow-inner">
                    {name ? name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()} 
              className="absolute bottom-0 right-0 bg-emerald-500 hover:bg-emerald-400 text-white p-2 rounded-full border-2 border-slate-900 shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer border-none"
              title={t('ছবি পরিবর্তন করুন', 'Change Photo')}
            >
              <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* User Name & Status Badge */}
          <div className="mt-3 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{name}</h1>
              {honorific && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/25 text-amber-200 border border-amber-400/40 backdrop-blur-sm shadow-xs">
                  🎖️ {honorific}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                সদস্য
              </span>
            </div>
            
            <p className="text-xs sm:text-sm text-emerald-100/75 mt-0.5 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 opacity-70" />
              {email}
            </p>

            {/* WhatsApp Contact Badge */}
            {whatsapp && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-emerald-200 transition shadow-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                <MessageSquare className="w-3 h-3 text-emerald-300" />
                <span className="font-mono tracking-wide">{whatsapp}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area Overlapping Banner */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 space-y-3 sm:space-y-4">
        
        {/* Stats Grid: Modern Bento Cards (Compact, well-proportioned) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Notes Stat */}
          <div className="bg-white/95 backdrop-blur-sm py-2.5 px-2 sm:py-3.5 sm:px-3 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all text-center flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 border border-emerald-100/50">
              <FileText className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">{stats.notes}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">{t('নোট', 'Notes')}</span>
          </div>

          {/* Reminders Stat */}
          <div className="bg-white/95 backdrop-blur-sm py-2.5 px-2 sm:py-3.5 sm:px-3 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all text-center flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1 border border-amber-100/50">
              <Bell className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">{stats.reminders}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">{t('রিমাইন্ডার', 'Reminders')}</span>
          </div>

          {/* Special Dates Stat */}
          <div className="bg-white/95 backdrop-blur-sm py-2.5 px-2 sm:py-3.5 sm:px-3 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all text-center flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center mb-1 border border-rose-100/50">
              <Gift className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">{stats.specialDates}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">{t('বিশেষ দিন', 'Special Dates')}</span>
          </div>
        </div>

        {/* Account Details & Edit Section */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/70 overflow-hidden divide-y divide-slate-100">
          <div 
            onClick={() => setIsEditProfile(true)} 
            className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-emerald-100/60">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  {t('আমার প্রোফাইল সম্পাদনা', 'Edit My Profile')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">নাম, ইমেইল এবং মোবাইল নম্বর পরিবর্তন করুন</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* App Preferences (Theme & Language) */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/70 overflow-hidden divide-y divide-slate-100">
          <div 
            onClick={() => setIsThemeOpen(true)} 
            className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform border border-indigo-100/60">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{t('অ্যাপ থিম', 'App Theme')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">লাইট অথবা ডার্ক মোড নির্ধারণ করুন</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg whitespace-nowrap">
                {theme === 'Dark mode' ? t('ডার্ক মোড', 'Dark mode') : t('লাইট মোড', 'Light mode')}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => setIsLanguageOpen(true)} 
            className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform border border-teal-100/60">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{t('ভাষা পরিবর্তন', 'Change Language')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">অ্যাপের ডিসপ্লে ভাষা নির্বাচন করুন</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">{language}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Danger & Logout Actions */}
        <div className="pt-2 flex flex-col gap-2.5">
          <button 
            type="button"
            onClick={() => setShowLogoutConfirm(true)} 
            className="w-full p-3.5 rounded-2xl bg-white hover:bg-rose-50 border border-rose-200/80 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs hover:border-rose-300 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('লগআউট', 'Logout')}</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowUnsubscribeConfirm(true)} 
            className="w-full text-center text-xs text-slate-400 hover:text-rose-500 py-2 transition-colors cursor-pointer border-none bg-transparent hover:underline"
          >
            {t('আনসাবস্ক্রাইব করুন', 'Unsubscribe')}
          </button>
        </div>
      </div>
      
      {/* Edit Profile Modal */}
      {isEditProfile && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-slate-800">{t('প্রোফাইল সম্পাদনা', 'Edit Profile')}</h2>
              <button onClick={() => setIsEditProfile(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">{t('নাম', 'Name')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all" 
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">{t('ইমেইল', 'Email')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all" 
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">{t('মোবাইল নম্বর', 'Mobile Number')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="tel" 
                    value={mobile} 
                    onChange={e => setMobile(e.target.value)} 
                    placeholder="017..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all" 
                  />
                </div>
              </div>
              
              <div className="mb-2">
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1">{t('WhatsApp নম্বর (রিমাইন্ডারের জন্য)', 'WhatsApp Number')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MessageSquare className="h-5 w-5 text-slate-400" />
                  </div>
                  <input 
                    type="tel" 
                    value={whatsapp} 
                    onChange={e => setWhatsapp(e.target.value)} 
                    placeholder="017..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] focus:ring-2 focus:ring-[#0A7756]/20 transition-all" 
                  />
                </div>
              </div>

              {/* Honorific / Salutation Selector */}
              <div className="mb-2">
                <label className="text-xs font-bold text-slate-500 mb-1.5 block ml-1 flex items-center justify-between">
                  <span>{t('AI অ্যাসিস্ট্যান্টের সম্বোধন', 'AI Assistant Salutation')}</span>
                  <span className="text-[11px] text-emerald-600 font-semibold">{honorific ? `"${honorific}"` : 'সেট করা নেই'}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['চিফ', 'স্যার', 'বস', 'ভাই', 'আপু', 'ম্যাডাম'].map(title => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => setHonorific(title)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        honorific === title
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {title === 'চিফ' && '🎖️ '}
                      {title === 'স্যার' && '👔 '}
                      {title === 'বস' && '👑 '}
                      {title === 'ভাই' && '🤝 '}
                      {title === 'আপু' && '🌸 '}
                      {title === 'ম্যাডাম' && '✨ '}
                      {title}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 ml-1">
                  WhatsApp ও মেসেজে AI আপনাকে এই নামে সম্মান জানিয়ে কথা বলবে
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsEditProfile(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 transition rounded-2xl font-bold text-slate-600 text-sm">
                {t('বাতিল', 'Cancel')}
              </button>
              <button onClick={handleSaveProfile} className="flex-1 py-4 bg-[#0A7756] hover:bg-[#086146] transition text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#0A7756]/30 flex items-center justify-center">
                {t('সেভ করুন', 'Save Profile')}
              </button>
            </div>
          </div>
        </div>
      )}






      {/* Theme Modal */}
      {isThemeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">{t('অ্যাপ থিম বেছেনিন', 'Choose App Theme')}</h2>
            <div className="space-y-2 mb-5">
              {(['Light mode', 'Dark mode'] as const).map(thm => (
                <div key={thm} onClick={() => setTheme(thm)} className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-colors ${theme === thm ? 'border-primary bg-primary/5' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <span className={`text-sm font-bold ${theme === thm ? 'text-primary' : 'text-slate-700'}`}>{thm === 'Light mode' ? t('লাইট মোড', 'Light mode') : t('ডার্ক মোড', 'Dark mode')}</span>
                  {theme === thm && <div className="w-4 h-4 bg-primary rounded-full shadow-sm flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                </div>
              ))}
            </div>
            <button onClick={() => { setIsThemeOpen(false); toast.success('থিম আপডেট হয়েছে!'); }} className="w-full py-3 bg-primary hover:bg-emerald-600 transition text-white rounded-xl font-bold text-sm shadow-sm">সেভ করুন</button>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {isLanguageOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">ভাষা পরিবর্তন</h2>
            <div className="space-y-2 mb-5">
              {['বাংলা', 'English'].map(l => (
                <div key={l} onClick={() => setLanguage(l)} className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-colors ${language === l ? 'border-primary bg-primary/5' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <span className={`text-sm font-bold ${language === l ? 'text-primary' : 'text-slate-700'}`}>{l}</span>
                  {language === l && <div className="w-4 h-4 bg-primary rounded-full shadow-sm flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                </div>
              ))}
            </div>
            <button onClick={() => { setIsLanguageOpen(false); toast.success('ভাষা সেট করা হয়েছে!'); }} className="w-full py-3 bg-primary hover:bg-emerald-600 transition text-white rounded-xl font-bold text-sm shadow-sm">সেভ করুন</button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">{t('লগআউট করতে চান?', 'Want to logout?')}</h2>
            <p className="text-sm text-slate-500 mb-6">{t('আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?', 'Are you sure you want to logout?')}</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
                {t('না', 'No')}
              </button>
              <button onClick={() => {
                localStorage.removeItem('isAuthenticated');
                toast.success(t('আপনি সফলভাবে লগআউট হয়েছেন', 'You have been logged out successfully'));
                setTimeout(() => { window.location.href = '/'; }, 1500);
              }} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-sm shadow-red-500/30 transition">
                {t('হ্যাঁ, লগআউট', 'Yes, logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsubscribe Confirmation Modal */}
      {showUnsubscribeConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl text-center animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-2">{t('আনসাবস্ক্রাইব করতে চান?', 'Want to unsubscribe?')}</h2>
            <p className="text-sm text-slate-500 mb-6">{t('আপনি কি নিশ্চিত যে আপনি আনসাবস্ক্রাইব করতে চান? এতে আপনার প্রোফাইলের সাবস্ক্রিপশন বাতিল হয়ে যাবে।', 'Are you sure you want to unsubscribe? This will cancel your profile subscription.')}</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowUnsubscribeConfirm(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
                {t('ফিরে যান', 'Go back')}
              </button>
              <button onClick={() => {
                toast.success(t('সাবস্ক্রিপশন বাতিল করা হয়েছে', 'Subscription cancelled'));
                setTimeout(() => { window.location.href = '/'; }, 1500);
              }} className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition">
                {t('নিশ্চিত করুন', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
