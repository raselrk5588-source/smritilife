import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { ChevronRight, Camera, Settings, Cloud, Crown, Palette, Globe, Shield, User, LogOut, Mail, Phone, MessageSquare } from 'lucide-react';
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
  const [isEditProfile, setIsEditProfile] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);
  
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile on load
  useEffect(() => {
    // Fallback to local storage first for instant load
    const savedName = localStorage.getItem('userName');
    const savedEmail = localStorage.getItem('userEmail');
    const savedMobile = localStorage.getItem('userMobile');
    const savedWhatsapp = localStorage.getItem('whatsappNumber');
    
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (savedMobile) setMobile(savedMobile);
    if (savedWhatsapp) setWhatsapp(savedWhatsapp);

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
        if (data.username) setUsername(data.username);
        if (data.profilePic) setProfilePic(data.profilePic);
      })
      .catch(err => console.error('Error fetching profile:', err));
  }, []);

  const handleSaveProfile = async () => {
    try {
      const payload: any = { name, mobile, whatsapp };
      
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
  
  // Real stats will be fetched here, defaulting to 0 instead of hardcoded values
  const [stats, setStats] = useState({ notes: 0, reminders: 0, specialDates: 0 });

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Top Header */}
      <header className="bg-gradient-to-b from-primary/10 to-transparent pt-8 pb-4 relative overflow-hidden">
        
        {/* Notebook Theme Background */}
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('/theme-bg.png')" }}></div>
        
        <div className="flex justify-between items-center px-6 mb-4 relative z-10">
          <h1 className="text-xl font-bold text-slate-800"></h1>
        </div>
        
        {/* Profile Info */}
        <div className="flex flex-col items-center mt-2 relative z-10">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-md overflow-hidden relative">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl">{name ? name.charAt(0) : 'U'}</div>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full border-2 border-white shadow-sm hover:bg-emerald-600 transition">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-3">{name}</h2>
          <p className="text-sm text-slate-500 font-medium">{email}</p>
        </div>
        
        {/* Background Decorative element */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-emerald-50 to-green-50 rounded-b-[3rem] -z-10"></div>
      </header>

      <div className="px-5 mt-2 space-y-4">
        
        {/* Stats Row */}
        <div className="flex justify-center space-x-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="text-center flex-1 border-r border-slate-100">
            <div className="text-xl font-bold text-primary">{stats.notes}</div>
            <div className="text-[10px] font-medium text-slate-500 mt-1">{t('নোট', 'Notes')}</div>
          </div>
          <div className="text-center flex-1 border-r border-slate-100">
            <div className="text-xl font-bold text-orange-500">{stats.reminders}</div>
            <div className="text-[10px] font-medium text-slate-500 mt-1">{t('রিমাইন্ডার', 'Reminders')}</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xl font-bold text-pink-500">{stats.specialDates}</div>
            <div className="text-[10px] font-medium text-slate-500 mt-1">{t('স্পেশাল ডেট', 'Special Dates')}</div>
          </div>
        </div>



        {/* Menu Items */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div onClick={() => setIsEditProfile(true)} className="px-5 py-4 flex items-center justify-between border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center">
              <User className="w-5 h-5 text-slate-600 mr-3" />
              <span className="text-sm font-medium text-slate-700">{t('আমার প্রোফাইল সম্পাদনা', 'Edit My Profile')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>


        </div>

        {/* App Preferences */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div onClick={() => setIsThemeOpen(true)} className="px-5 py-4 flex items-center justify-between border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center">
              <Palette className="w-5 h-5 text-slate-600 mr-3" />
              <span className="text-sm font-medium text-slate-700">{t('অ্যাপ থিম', 'App Theme')}</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 mr-2">{t(theme, theme === 'সবুজ (ডিফল্ট)' ? 'Green (Default)' : theme === 'ডার্ক মোড' ? 'Dark Mode' : theme === 'লাইট মোড' ? 'Light Mode' : 'System Default')}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div onClick={() => setIsLanguageOpen(true)} className="px-5 py-4 flex items-center justify-between border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-slate-600 mr-3" />
              <span className="text-sm font-medium text-slate-700">{t('ভাষা পরিবর্তন', 'Change Language')}</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 mr-2">{language}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-red-100 overflow-hidden mt-6">
          <div onClick={() => setShowLogoutConfirm(true)} className="px-5 py-4 flex items-center justify-center hover:bg-red-50 transition cursor-pointer">
            <div className="flex items-center">
              <LogOut className="w-5 h-5 text-red-500 mr-2.5" />
              <span className="text-sm font-bold text-red-500">{t('লগআউট', 'Logout')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-3">
          <div onClick={() => setShowUnsubscribeConfirm(true)} className="px-5 py-4 flex items-center justify-center hover:bg-slate-50 transition cursor-pointer">
            <span className="text-sm font-bold text-slate-500">{t('আনসাবস্ক্রাইব করুন', 'Unsubscribe')}</span>
          </div>
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
