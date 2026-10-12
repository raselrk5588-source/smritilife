import { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Phone, Trash2, ArrowLeft, 
  Upload, UserPlus, Smartphone, MessageSquare, 
  X, Check, AlertCircle, Info, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface ContactItem {
  _id: string;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  relationship: string;
  notes?: string;
  createdAt?: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & Sheets
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showMethodsInfo, setShowMethodsInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
    relationship: 'Friend',
    notes: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Handle single contact creation
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('নাম এবং ফোন নম্বর দেওয়া আবশ্যক');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success(`'${formData.name}' সফলভাবে সেভ হয়েছে!`);
        setIsAddModalOpen(false);
        setFormData({
          name: '',
          nickname: '',
          phone: '',
          email: '',
          relationship: 'Friend',
          notes: ''
        });
        fetchContacts();
      } else {
        const data = await res.json();
        toast.error(data.message || 'কন্ট্যাক্ট সেভ করা যায়নি');
      }
    } catch {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete contact
  const handleDeleteContact = async (id: string, name: string) => {
    if (!window.confirm(`আপনি কি '${name}' কন্ট্যাক্টটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/contacts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('কন্ট্যাক্ট মুছে ফেলা হয়েছে');
        setContacts(prev => prev.filter(c => c._id !== id));
      } else {
        toast.error('মুছে ফেলা সম্ভব হয়নি');
      }
    } catch {
      toast.error('সার্ভার এরর');
    }
  };

  // Import via native device Contact Picker API
  const handleNativeContactPicker = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel', 'email'];
        const opts = { multiple: true };
        const selected = await (navigator as any).contacts.select(props, opts);
        
        if (selected && selected.length > 0) {
          const formatted = selected.map((c: any) => ({
            name: c.name?.[0] || 'Unknown',
            phone: c.tel?.[0]?.replace(/[^\d+]/g, '') || '',
            email: c.email?.[0] || '',
            relationship: 'Friend'
          })).filter((c: any) => c.phone);

          if (formatted.length === 0) {
            toast.error('কোনো বৈধ ফোন নম্বর পাওয়া যায়নি');
            return;
          }

          const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/contacts/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: formatted })
          });

          if (res.ok) {
            const data = await res.json();
            toast.success(data.message || `${formatted.length}টি কন্ট্যাক্ট ইম্পোর্ট হয়েছে!`);
            fetchContacts();
          }
        }
      } catch (err: any) {
        console.error('Contact picker error:', err);
      }
    } else {
      // Fallback: trigger vCard file picker
      fileInputRef.current?.click();
    }
  };

  // Parse .vcf (vCard) file
  const handleVCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r\n|\r|\n/);
      const parsedContacts: { name: string; phone: string; email?: string }[] = [];
      let currentName = '';
      let currentPhone = '';
      let currentEmail = '';

      for (const line of lines) {
        if (line.startsWith('BEGIN:VCARD')) {
          currentName = '';
          currentPhone = '';
          currentEmail = '';
        } else if (line.startsWith('FN:') || line.startsWith('FN;')) {
          currentName = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('TEL') && !currentPhone) {
          currentPhone = line.split(':')[1]?.replace(/[^\d+]/g, '').trim() || '';
        } else if (line.startsWith('EMAIL') && !currentEmail) {
          currentEmail = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('END:VCARD')) {
          if (currentName && currentPhone) {
            parsedContacts.push({
              name: currentName,
              phone: currentPhone,
              email: currentEmail || undefined
            });
          }
        }
      }

      if (parsedContacts.length === 0) {
        toast.error('ফাইলের মধ্যে কোনো কন্ট্যাক্ট পাওয়া যায়নি (.vcf ফরম্যাট নিশ্চিত করুন)');
        return;
      }

      try {
        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/contacts/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: parsedContacts })
        });

        if (res.ok) {
          toast.success(`${parsedContacts.length}টি কন্ট্যাক্ট সফলভাবে ইম্পোর্ট করা হয়েছে!`);
          fetchContacts();
        } else {
          toast.error('ইম্পোর্ট করতে সমস্যা হয়েছে');
        }
      } catch {
        toast.error('সার্ভারে যোগাযোগ করা যায়নি');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Filtered contacts
  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.nickname && c.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-28 text-slate-800">
      {/* Hidden vCard file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleVCardUpload} 
        accept=".vcf,text/vcard" 
        className="hidden" 
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Link to="/app" className="text-slate-500 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">কন্ট্যাক্টস & ডিরেক্টরি</h1>
            <p className="text-[11px] font-medium text-slate-500">
              {contacts.length}টি কন্ট্যাক্ট সংরক্ষিত আছে
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowMethodsInfo(!showMethodsInfo)}
            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
            title="৩ পদ্ধতিতে কন্ট্যাক্ট যোগ করার নিয়ম"
          >
            <Info className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all shadow-emerald-200 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন</span>
          </button>
        </div>
      </header>

      {/* 3 Methods Explanatory Box (Toggleable or Visible) */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="bg-linear-to-br from-indigo-500/10 via-emerald-500/5 to-sky-500/10 border border-indigo-100 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                ৩ উপায়ে কন্ট্যাক্ট যুক্ত করার সহজ নিয়ম
              </h2>
            </div>
            <button 
              onClick={() => setShowMethodsInfo(!showMethodsInfo)}
              className="text-[11px] text-indigo-600 font-semibold underline"
            >
              {showMethodsInfo ? 'লুকান' : 'বিস্তারিত'}
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            স্মৃতি লাইফ আপনার কন্ট্যাক্টসের নাম চিনে হোয়াটসঅ্যাপে অটো মেসেজ পাঠাতে পারে। যেমনঃ <em>"রনিকে মেসেজ দাও যে কাল মিটিং হবে না"</em>।
          </p>

          {showMethodsInfo && (
            <div className="mt-3 pt-3 border-t border-indigo-100/60 grid grid-cols-1 gap-2.5 text-xs">
              <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">পদ্ধতি ১ (অ্যাপ ও ফাইল ইম্পোর্ট):</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    উপরের 'নতুন' বাটনে ক্লিক করে ম্যানুয়ালি যোগ করুন অথবা আপনার ফোনের <strong>.vcf ফাইল ইম্পোর্ট</strong> করুন।
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">পদ্ধতি ২ (WhatsApp চ্যাটে টেক্সট মেসেজ):</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    হোয়াটসঅ্যাপে শুধু লিখুনঃ <code>"রনির নম্বর সেভ করো: 017XXXXXXXX"</code> বা <code>"আম্মুর ফোন নাম্বার 018... সম্পর্ক পরিবার"</code>।
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">পদ্ধতি ৩ (WhatsApp কন্ট্যাক্ট কার্ড শেয়ার):</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    হোয়াটসঅ্যাপের 📎 Attachment থেকে সরাসরি কারো <strong>Contact Card</strong> স্মৃতিকে পাঠিয়ে দিন। স্মৃতি সাথে সাথে তা সেভ করে নিবে!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="mt-3 flex items-center space-x-2">
            <button 
              onClick={handleNativeContactPicker}
              className="flex-1 flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-98"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              <span>ফোন কন্ট্যাক্ট / .vcf ইম্পোর্ট</span>
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-98"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>নতুন কন্ট্যাক্ট লিখুন</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম, ডাকনাম বা নম্বর দিয়ে খুঁজুন..." 
            className="w-full bg-white rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Contacts List */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            কন্ট্যাক্ট লোড হচ্ছে...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <UserPlus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">কোনো কন্ট্যাক্ট পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              নতুন কন্ট্যাক্ট যোগ করুন অথবা হোয়াটসঅ্যাপে কারো নাম ও নম্বর লিখে স্মৃতিকে মেসেজ পাঠান!
            </p>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
            >
              কন্ট্যাক্ট যোগ করুন
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((c) => {
              const avatarLetter = (c.name || 'U').trim()[0].toUpperCase();
              return (
                <div 
                  key={c._id} 
                  className="bg-white rounded-2xl p-3.5 shadow-2xs border border-slate-100 flex items-center justify-between hover:border-slate-200 transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-linear-to-tr from-emerald-500 to-teal-400 text-white font-bold flex items-center justify-center text-sm shadow-2xs shrink-0">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {c.name}
                        </h3>
                        {c.nickname && (
                          <span className="text-[11px] text-slate-400 truncate">
                            ({c.nickname})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="text-xs text-slate-500 font-mono">
                          {c.phone || 'নম্বর নেই'}
                        </p>
                        {c.relationship && (
                          <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                            {c.relationship}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {c.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    {c.phone && (
                      <>
                        <a 
                          href={`tel:${c.phone}`}
                          className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                          title="কল করুন"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a 
                          href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                          title="WhatsApp মেসেজ"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    <button 
                      onClick={() => handleDeleteContact(c._id, c.name)}
                      className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>নতুন কন্ট্যাক্ট যোগ করুন</span>
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পুরো নাম <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="যেমন: রনি আহমেদ"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ডাকনাম (ঐচ্ছিক)
                  </label>
                  <input 
                    type="text" 
                    placeholder="যেমন: রনি"
                    value={formData.nickname}
                    onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সম্পর্ক
                  </label>
                  <select 
                    value={formData.relationship}
                    onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="Friend">বন্ধু (Friend)</option>
                    <option value="Family">পরিবার (Family)</option>
                    <option value="Work">সহকর্মী (Work)</option>
                    <option value="Relative">আত্মীয় (Relative)</option>
                    <option value="Other">অন্যান্য (Other)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ফোন নম্বর <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  required
                  placeholder="যেমন: 01712345678"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইমেইল (ঐচ্ছিক)
                </label>
                <input 
                  type="email" 
                  placeholder="roni@example.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নোট বা অতিরিক্ত তথ্য (ঐচ্ছিক)
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: অফিস কলিগ, প্রজেক্ট ম্যানেজার"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'সেভ হচ্ছে...' : 'কন্ট্যাক্ট সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
