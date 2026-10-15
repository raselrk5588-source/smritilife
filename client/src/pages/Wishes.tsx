import { useState, useEffect } from 'react';
import { ChevronLeft, Sparkles, Image as ImageIcon, Mic, Copy, Download, Share2, Wand2, Calendar, Phone, Clock, Trash2, CheckCircle2, Gift, Eye, RefreshCw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { generateWishTemplates } from '../utils/wishGenerator';
import { useSettings } from '../contexts/SettingsContext';
import { fetchWithAuth } from '../utils/api';

const formatName = (name: string) => {
  if (!name) return name;
  return name.trim().split(/\s+/).map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

const getOccasionBadge = (occasion: string) => {
  const map: Record<string, string> = {
    birthday: '🎂 জন্মদিন',
    anniversary: '💍 বিবাহবার্ষিকী',
    eid: '🌙 ঈদ মোবারক',
    newyear: '🎆 শুভ নববর্ষ',
    valentine: '❤️ ভালোবাসা দিবস',
    mothersday: '💐 মা দিবস',
    fathersday: '👔 বাবা দিবস',
    other: '🎉 বিশেষ দিন'
  };
  return map[occasion?.toLowerCase()] || `🎉 ${occasion || 'শুভেচ্ছা'}`;
};

const PRESET_CARD_IMAGES = [
  { id: 'cake', title: 'শুভ জন্মদিন', label: '🎂 কেক ও বেলুন', url: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?q=80&w=600&auto=format&fit=crop' },
  { id: 'gift', title: 'শুভ জন্মদিন', label: '🎁 উপহার বক্স', url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=600&auto=format&fit=crop' },
  { id: 'flowers', title: 'শুভ ভালোবাসা দিবস', label: '🌹 লাল গোলাপ', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=600&auto=format&fit=crop' },
  { id: 'celebrate', title: 'শুভ কামনা', label: '✨ উৎসবের আলো', url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=600&auto=format&fit=crop' },
  { id: 'eid', title: 'ঈদ মোবারক', label: '🌙 চাঁদ ও তারা', url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=600&auto=format&fit=crop' }
];

export default function Wishes() {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState('text');
  
  // Form States
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [senderName, setSenderName] = useState(() => localStorage.getItem('userName') || '');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [customOccasion, setCustomOccasion] = useState('');
  
  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWish, setGeneratedWish] = useState<{title: string, body: string[]} | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleMethod, setScheduleMethod] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [successPopup, setSuccessPopup] = useState<{show: boolean, type: 'send' | 'schedule'}>({show: false, type: 'send'});
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleContact, setScheduleContact] = useState('');

  // Image/Card states
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [cardSignOff, setCardSignOff] = useState('ভালোবাসা অন্তে,');
  const [recipientPrefix, setRecipientPrefix] = useState('প্রিয়,');
  const [generatedLink, setGeneratedLink] = useState('');
  const [createdWishId, setCreatedWishId] = useState<string | null>(null);
  const [imageShape, setImageShape] = useState<'round' | 'rounded' | 'square' | 'heart'>('round');
  const [bgMusic, setBgMusic] = useState('none');
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);

  // Scheduled Wishes List States
  const [scheduledWishes, setScheduledWishes] = useState<any[]>([]);
  const [loadingWishes, setLoadingWishes] = useState(false);
  const [wishFilter, setWishFilter] = useState<'all' | 'scheduled' | 'sent'>('all');

  const fetchWishes = async () => {
    setLoadingWishes(true);
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setScheduledWishes(data);
        }
      }
    } catch (err) {
      console.error('Failed to load wishes:', err);
    } finally {
      setLoadingWishes(false);
    }
  };

  const handleDeleteWish = async (id: string) => {
    if (!window.confirm(t('আপনি কি নিশ্চিত যে এই উইশটি মুছে ফেলতে চান?', 'Are you sure you want to delete this wish?'))) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success(t('উইশটি মুছে ফেলা হয়েছে!', 'Wish deleted!'));
        fetchWishes();
      } else {
        toast.error('Failed to delete wish');
      }
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const cached = localStorage.getItem('userName');
        if (cached) setSenderName(cached);

        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/users/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data?.name) {
            setSenderName(data.name);
            localStorage.setItem('userName', data.name);
          }
        }
      } catch (err) {
        console.error('Failed to load user profile in Wishes:', err);
      }
    };

    const fetchTemplates = async () => {
      try {
        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wish-templates`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setDbTemplates(data);
        }
      } catch (err) {
        console.error('Failed to load DB templates:', err);
      }
    };
    fetchUserProfile();
    fetchTemplates();
    fetchWishes();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      e.target.value = ''; // Reset so the user can re-select if needed

      if (file.size > 15 * 1024 * 1024) {
        toast.error(t('ছবিটি অনেক বড় (সর্বোচ্চ ১৫MB)। দয়া করে ছোট ছবি দিন।', 'Image is too large (max 15MB).'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max dimensions for the greeting card image
            const MAX_SIZE = 800;
            if (width > height && width > MAX_SIZE) {
              height = Math.round(height * (MAX_SIZE / width));
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width = Math.round(width * (MAX_SIZE / height));
              height = MAX_SIZE;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
              setCardImage(compressedBase64);
              toast.success(t('ছবি সফলভাবে যুক্ত হয়েছে!', 'Image selected successfully!'));
            } else {
              setCardImage(event.target?.result as string);
              toast.success(t('ছবি যুক্ত হয়েছে!', 'Image selected!'));
            }
          } catch (err) {
            setCardImage(event.target?.result as string);
            toast.success(t('ছবি যুক্ত হয়েছে!', 'Image selected!'));
          }
        };
        img.onerror = () => {
          toast.error(t('ছবিটি প্রসেস করা সম্ভব হয়নি। অন্য ছবি দিন।', 'Failed to load image.'));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        toast.error(t('ছবি পড়তে সমস্যা হয়েছে।', 'Failed to read image file.'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateLink = async () => {
    if (!cardImage || !cardTitle || cardTitle === 'custom:' || !cardMessage) {
      alert(t('দয়া করে ছবি, টাইটেল এবং মেসেজ দিন।', 'Please provide image, title and message.'));
      return;
    }
    setIsGenerating(true);
    try {
      const actualTitle = cardTitle.startsWith('custom:') ? cardTitle.replace('custom:', '') : cardTitle;
      const occasionKey = actualTitle.includes('বিবাহ') ? 'anniversary' : actualTitle.includes('জন্মদিন') ? 'birthday' : actualTitle.includes('ভালোবাসা') ? 'valentine' : actualTitle.includes('মা দিবস') ? 'mothersday' : actualTitle.includes('বাবা দিবস') ? 'fathersday' : actualTitle.includes('ঈদ') ? 'eid' : actualTitle.includes('নববর্ষ') ? 'newyear' : 'other';
      
      const payload = {
        recipientName: `${recipientPrefix} ${recipient}`.trim() || 'Unknown',
        occasion: occasionKey,
        message: cardMessage.trim(),
        scheduledAt: new Date().toISOString(),
        deliveryMethod: ['SMS'],
        status: 'Sent',
        isSmartCard: true,
        cardData: {
          image: cardImage,
          title: actualTitle,
          shape: imageShape,
          senderName: senderName || 'আপনার শুভাকাঙ্ক্ষী',
          animation: 'envelope',
          signOff: cardSignOff,
          music: bgMusic
        }
      };

      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const textResponse = await res.text();
      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (err) {
        throw new Error(`সার্ভার থেকে সঠিক তথ্য আসেনি: ${textResponse.substring(0, 80)}...`);
      }
      
      if (res.ok) {
        setCreatedWishId(data._id);
        setGeneratedLink(`${window.location.origin}/w/${data.smartCardId || data._id}`);
        toast.success(t('ম্যাজিক লিংক তৈরি সম্পন্ন!', 'Magic link created!'));
        fetchWishes();
      } else {
        toast.error(data.message || 'কার্ড জেনারেট করতে সমস্যা হয়েছে!');
      }
    } catch (e: any) {
      toast.error(e.message || 'সার্ভার এরর!');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    // Reset Common Fields
    setRecipient('');
    // Lock senderName to verified account name
    setSenderName(localStorage.getItem('userName') || senderName);
    setScheduleContact('');
    setScheduleDate('');
    setScheduleTime('');
    setShowScheduleForm(false);
    
    // Reset Greeting Card Fields
    setCardImage(null);
    setCardTitle('');
    setCardMessage('');
    setCardSignOff('ভালোবাসা অন্তে,');
    setRecipientPrefix('প্রিয়,');
    setGeneratedLink('');
    setCreatedWishId(null);
    setImageShape('round');
    setBgMusic('none');

    // Reset Text/Voice Wish Fields
    setSelectedOccasion('');
    setSelectedStyle('');
    setExtraPrompt('');
    setCustomOccasion('');
    setGeneratedWish(null);
    setVoiceTranscript('');
  };

  const handleSaveWish = async (type: 'send' | 'schedule', isLink: boolean = false) => {
    if (!scheduleContact || !scheduleContact.trim()) {
      toast.error(t('দয়া করে ফোন নম্বর দিন', 'Please enter recipient phone number'));
      return;
    }

    let schedDate = new Date();
    if (type === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        toast.error(t('দয়া করে তারিখ ও সময় দিন', 'Please enter date and time'));
        return;
      }
      schedDate = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (isNaN(schedDate.getTime())) {
        toast.error(t('সঠিক তারিখ ও সময় নির্বাচন করুন', 'Please select a valid date and time'));
        return;
      }
    }

    try {
      if (isLink) {
        // Digital Greeting Card Flow
        if (!cardImage || !cardTitle || cardTitle === 'custom:' || !cardMessage) {
          toast.error(t('দয়া করে ছবি, টাইটেল এবং মেসেজ দিন।', 'Please provide image, title and message.'));
          return;
        }

        const actualTitle = cardTitle.startsWith('custom:') ? cardTitle.replace('custom:', '') : cardTitle;
        const occasionKey = actualTitle.includes('বিবাহ') ? 'anniversary' : actualTitle.includes('জন্মদিন') ? 'birthday' : actualTitle.includes('ভালোবাসা') ? 'valentine' : actualTitle.includes('মা দিবস') ? 'mothersday' : actualTitle.includes('বাবা দিবস') ? 'fathersday' : actualTitle.includes('ঈদ') ? 'eid' : actualTitle.includes('নববর্ষ') ? 'newyear' : (selectedOccasion || 'other');

        const cardPayload = {
          recipientName: `${recipientPrefix} ${recipient}`.trim() || 'Unknown',
          recipientContact: scheduleContact.trim(),
          occasion: occasionKey,
          message: cardMessage.trim(), // Keep card message clean without raw link
          scheduledAt: schedDate.toISOString(),
          deliveryMethod: [scheduleMethod === 'sms' ? 'SMS' : 'WhatsApp'],
          status: type === 'send' ? 'Processing' : 'Scheduled',
          isSmartCard: true,
          cardData: {
            image: cardImage,
            title: actualTitle,
            shape: imageShape,
            senderName: senderName || 'আপনার শুভাকাঙ্ক্ষী',
            animation: 'envelope',
            signOff: cardSignOff,
            music: bgMusic
          }
        };

        if (createdWishId) {
          // Update the already generated wish so it gets recipient contact, schedule, and triggers dispatch
          const updateRes = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes/${createdWishId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardPayload)
          });
          if (!updateRes.ok) {
            const errData = await updateRes.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to update wish');
          }
        } else {
          // Create the full smart card wish directly
          const createRes = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardPayload)
          });
          if (!createRes.ok) {
            const errData = await createRes.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to create wish');
          }
          const createdData = await createRes.json();
          setCreatedWishId(createdData._id);
          setGeneratedLink(`${window.location.origin}/w/${createdData.smartCardId || createdData._id}`);
        }
      } else {
        // Standard Text/Voice Wish Flow
        let msg = generatedWish ? `${generatedWish.title}\n\n${generatedWish.body.join('\n')}` : '';
        if (!msg.trim()) {
          toast.error(t('দয়া করে উইশ বার্তা লিখুন বা তৈরি করুন', 'Please generate or enter wish message'));
          return;
        }

        const createRes = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/wishes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: recipient || 'Unknown',
            recipientContact: scheduleContact.trim(),
            occasion: selectedOccasion || 'other',
            message: msg.trim(),
            scheduledAt: schedDate.toISOString(),
            deliveryMethod: [scheduleMethod === 'sms' ? 'SMS' : 'WhatsApp'],
            status: type === 'send' ? 'Processing' : 'Scheduled'
          })
        });
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to create wish');
        }
      }

      setSuccessPopup({ show: true, type });
      resetForm();
      fetchWishes();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t('দুঃখিত, কোনো সমস্যা হয়েছে!', 'Sorry, an error occurred!'));
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(true);
    setVoiceTranscript('');
    
    // Simulate recording for 2.5 seconds
    setTimeout(() => {
      setIsRecording(false);
      setVoiceTranscript('"আমার স্ত্রীর জন্য সুন্দর একটি জন্মদিনের শুভেচ্ছা তৈরি করো এবং আগামীকাল সকাল ১০টায় ০১৭xxxxxx নম্বরে শিডিউল করে দাও।"');
      setIsGenerating(true);
      
      // Simulate AI processing
      setTimeout(() => {
        setGeneratedWish({
          title: 'শুভ\nজন্মদিন',
          body: [
            'প্রিয় স্ত্রী,',
            'শুভ জন্মদিন! তুমি আমার জীবনের সবচেয়ে সুন্দর উপহার। তোমার হাসিমুখ আমাকে সবসময় ভালো থাকার অনুপ্রেরণা দেয়।',
            'পৃথিবীর সব সুখ যেন তোমার হয়। অনেক অনেক ভালোবাসা।'
          ]
        });
        
        // AI smart auto-schedule
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        
        setScheduleDate(`${yyyy}-${mm}-${dd}`);
        setScheduleTime('10:00');
        setScheduleContact('017xxxxxx');
        setScheduleMethod('sms');
        setShowScheduleForm(true);
        
        setIsGenerating(false);
      }, 2000);
    }, 2500);
  };

  const handleGenerate = () => {
    if (!extraPrompt && (!selectedOccasion || !recipient)) {
      alert(t('দয়া করে ইভেন্ট এবং নাম নির্বাচন করুন, অথবা নিজের ইচ্ছা মতো একটি মেসেজ লিখুন।', 'Please select an event and name, or write a custom message.'));
      return;
    }
    
    setIsGenerating(true);
    
    // Simulate AI Generation
    setTimeout(() => {
      const occasionObj = occasions.find(o => o.id === selectedOccasion);
      const styleObj = styles.find(s => s.id === selectedStyle);
      
      const fmtRecipient = formatName(recipient);
      const fmtSender = formatName(senderName);
      
      let occasionLabel = occasionObj?.label || 'দিন';
      if (selectedOccasion === 'other' && customOccasion) {
        occasionLabel = customOccasion;
      }

      let title = `শুভ\n${occasionLabel}`;
      if (selectedOccasion === 'eid') title = `ঈদ\nমোবারক`;
      if (selectedOccasion === 'newyear') title = `শুভ\nনববর্ষ`;
      if (selectedOccasion === 'valentine') title = `শুভ\nভালোবাসা\nদিবস`;
      if (selectedOccasion === 'mothersday') title = `শুভ\nমা দিবস`;
      if (selectedOccasion === 'fathersday') title = `শুভ\nবাবা দিবস`;

      let body: string[] = [];

      if (!selectedOccasion && !recipient && extraPrompt) {
        title = `আপনার\nমেসেজ`;
        body = extraPrompt.split('\n').filter(line => line.trim() !== '');
      } else {
        // Map occasion to DB category
        let dbCategory = 'General';
        if (selectedOccasion === 'birthday') dbCategory = 'Birthday';
        if (selectedOccasion === 'anniversary') dbCategory = 'Anniversary';
        if (selectedOccasion === 'eid') dbCategory = 'Eid';
        if (selectedOccasion === 'newyear') dbCategory = 'New Year';
        if (selectedOccasion === 'valentine') dbCategory = 'Valentine';
        if (selectedOccasion === 'mothersday') dbCategory = 'Mothers Day';
        if (selectedOccasion === 'fathersday') dbCategory = 'Fathers Day';

        const matchingTemplates = dbTemplates.filter(t => t.category === dbCategory);
        
        if (matchingTemplates.length > 0) {
          // Use a random DB template
          const randomDbTemp = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];
          let text = randomDbTemp.content;
          // Basic placeholder replacement if any
          text = text.replace(/\[Name\]/g, fmtRecipient || 'প্রিয়');
          text = text.replace(/\[Sender\]/g, fmtSender || 'আমি');
          body = text.split('\n').filter((l: string) => l.trim() !== '');
        } else {
          // Fallback to hardcoded AI offline templates
          const templates = generateWishTemplates(selectedOccasion, selectedStyle, customOccasion, fmtRecipient);
          body = [...templates[Math.floor(Math.random() * templates.length)]];
        }
        
        if (extraPrompt) {
          body.push(`(বিশেষ নোট: ${extraPrompt})`);
        }
      }

      if (fmtSender) {
        body.push(`ইতি, ${fmtSender}`);
      }

      setGeneratedWish({ title, body });
      setIsGenerating(false);
    }, 2000);
  };
  
  const occasions = [
    { id: 'birthday', icon: '🎂', label: t('জন্মদিন', 'Birthday') },
    { id: 'anniversary', icon: '💍', label: t('বিবাহ বার্ষিকী', 'Anniversary') },
    { id: 'eid', icon: '🌙', label: t('ঈদ', 'Eid') },
    { id: 'newyear', icon: '🎆', label: t('নতুন বছর', 'New Year') },
    { id: 'valentine', icon: '💖', label: t('ভালোবাসা দিবস', 'Valentine') },
    { id: 'mothersday', icon: '🤱', label: t('মা দিবস', 'Mothers Day') },
    { id: 'fathersday', icon: '👨‍👧', label: t('বাবা দিবস', 'Fathers Day') },
    { id: 'special', icon: '🌸', label: t('বিশেষ দিন', 'Special Day') },
    { id: 'other', icon: '🎁', label: t('অন্যান্য', 'Other') },
  ];

  const styles = [
    { id: 'normal', icon: '💬', label: t('সাধারণ', 'Normal') },
    { id: 'emotional', icon: '❤️', label: t('আবেগপূর্ণ', 'Emotional') },
    { id: 'religious', icon: '🕌', label: t('ধর্মীয়', 'Religious') },
    { id: 'funny', icon: '😀', label: t('মজার', 'Funny') },
    { id: 'professional', icon: '💼', label: t('পেশাদারী', 'Professional') },
    { id: 'poetic', icon: '✒️', label: t('কবিতা স্টাইল', 'Poetic') },
  ];

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Top Header Banner */}
      <div className="bg-primary text-white p-4 pt-6 md:pt-8 pb-8 rounded-b-3xl relative overflow-hidden shadow-sm">
        {/* Notebook Theme */}
        <div className="absolute inset-0 z-0 bg-cover" style={{ backgroundImage: "url('/theme-bg.png')", backgroundPosition: "center 40%", opacity: "0.9" }}></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/60 via-primary/30 to-black/40"></div>
        
        <div className="flex items-center mb-6 relative z-10">
          <div className="flex-1 text-center flex flex-col items-center justify-center w-full">
            <h1 className="text-2xl font-bold flex items-center justify-center drop-shadow-md">
              <Sparkles className="w-5 h-5 mr-2" /> {t('AI শুভেচ্ছা তৈরি', 'AI Wish Creator')}
            </h1>
            <p className="text-white/90 text-[11px] font-medium mt-1 drop-shadow-sm">{t('আপনার কথায়, সুন্দর একটি শুভেচ্ছা বার্তা তৈরি করুন', 'Create a beautiful wish message with your words')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5">
        {/* Main Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1.5 border border-slate-100 mb-6 relative z-20">
          <div className="grid grid-cols-4 gap-1">
            <button 
              onClick={() => setActiveTab('text')}
              className={`py-2 px-1 rounded-xl font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'text' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/60' 
                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">{t('টেক্সট', 'Text')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('image')}
              className={`py-2 px-1 rounded-xl font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'image' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/60' 
                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">{t('গ্রিটিং কার্ড', 'Greeting Card')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('voice')}
              className={`py-2 px-1 rounded-xl font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'voice' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/60' 
                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">{t('ভয়েস', 'Voice')}</span>
            </button>
            <button 
              onClick={() => { setActiveTab('list'); fetchWishes(); }}
              className={`relative py-2 px-1 rounded-xl font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'list' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200/60' 
                  : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Calendar className="w-4 h-4 shrink-0" />
                {scheduledWishes.length > 0 && (
                  <span className="sm:hidden absolute -top-1.5 -right-2.5 bg-[#0A7756] text-white text-[9px] px-1 py-0.2 rounded-full font-bold leading-none shadow-xs">
                    {scheduledWishes.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap">{t('শিডিউলড', 'Scheduled')}</span>
              {scheduledWishes.length > 0 && (
                <span className="hidden sm:inline-flex bg-[#0A7756] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0">
                  {scheduledWishes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'text' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Left Form Area */}
          <div className="space-y-6">
            {/* Step 1 */}
            <div>
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">1</div>
                <h2 className="text-[13px] font-bold text-slate-700">{t('উপলক্ষ্য নির্বাচন করুন', 'Select Occasion')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {occasions.map(occ => (
                  <button 
                    key={occ.id} 
                    onClick={() => setSelectedOccasion(occ.id)}
                    className={`rounded-xl p-1.5 flex flex-col items-center justify-center shadow-sm transition-colors border ${selectedOccasion === occ.id ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100 hover:border-primary/30'}`}
                  >
                    <span className="text-lg mb-0.5">{occ.icon}</span>
                    <span className={`text-[9px] font-bold text-center leading-tight ${selectedOccasion === occ.id ? 'text-emerald-700' : 'text-slate-700'}`}>{occ.label}</span>
                  </button>
                ))}
              </div>
              {selectedOccasion === 'other' && (
                <div className="mt-2 bg-white border border-slate-200 rounded-xl p-2.5 flex items-center shadow-sm animate-in fade-in zoom-in-95 duration-200">
                  <input 
                    type="text" 
                    value={customOccasion}
                    onChange={(e) => setCustomOccasion(e.target.value)}
                    placeholder={t("নিজের মতো উপলক্ষ্য লিখুন...", "Write your custom occasion...")}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm px-1" 
                  />
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div>
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">2</div>
                <h2 className="text-[13px] font-bold text-slate-700">{t('যাকে উইশ করবেন তার নাম লিখুন', 'Enter recipient name')}</h2>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center shadow-sm">
                <User className="w-5 h-5 text-slate-400 mr-2" />
                <input 
                  type="text" 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  onBlur={() => setRecipient(formatName(recipient))}
                  placeholder={t("যেমন: বন্ধু, ভাই, বোন, মা, বাবা...", "e.g. friend, brother, sister, mother, father...")}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm" 
                />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">3</div>
                  <h2 className="text-[13px] font-bold text-slate-700">{t('প্রেরকের নাম (আপনার অ্যাকাউন্ট)', 'Sender Name')}</h2>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {t('ভেরিফাইড', 'Verified')}
                </span>
              </div>
              <div 
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-xs select-none"
                title={t('সুরক্ষার স্বার্থে প্রেরকের নাম পোর্টাল অ্যাকাউন্ট থেকে নির্ধারিত', 'Sender name is locked to your verified portal account')}
              >
                <div className="flex items-center min-w-0">
                  <User className="w-5 h-5 text-emerald-600 mr-2 shrink-0" />
                  <span className="text-sm font-bold text-slate-800 truncate">{senderName || localStorage.getItem('userName') || 'অ্যাকাউন্ট ব্যবহারকারী'}</span>
                </div>
                <Lock className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <span>🔒 {t('অ্যাকাউন্টের সুরক্ষায় পোর্টাল অ্যাকাউন্টের নামই স্বয়ংক্রিয়ভাবে প্রেরক হিসেবে থাকবে।', 'For security, your portal account name is used as the verified sender.')}</span>
              </p>
            </div>

            {/* Step 4 */}
            <div>
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">4</div>
                <h2 className="text-[13px] font-bold text-slate-700">{t('উইশের ধরন বা স্টাইল নির্বাচন করুন', 'Select wish style or tone')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {styles.map(style => (
                  <button 
                    key={style.id} 
                    onClick={() => setSelectedStyle(style.id)}
                    className={`rounded-xl p-1.5 flex flex-col items-center justify-center shadow-sm transition-colors border ${selectedStyle === style.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-100 hover:border-primary/30'}`}
                  >
                    <span className="text-lg mb-0.5">{style.icon}</span>
                    <span className={`text-[9px] font-bold text-center leading-tight ${selectedStyle === style.id ? 'text-blue-700' : 'text-slate-700'}`}>{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 5 */}
            <div>
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold mr-2">5</div>
                <h2 className="text-[13px] font-bold text-slate-700">{t('নিজের ইচ্ছা মতো মেসেজ লিখুন (ঐচ্ছিক)', 'Write a custom message (Optional)')}</h2>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition">
                <textarea 
                  rows={2} 
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  maxLength={200}
                  placeholder={t("আপনার নিজের কোনো কথা বা মেসেজ এখানে লিখতে পারেন...", "Write any custom thoughts or messages here...")}
                  className="w-full bg-transparent border-none focus:outline-none text-sm resize-none"
                ></textarea>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full text-white rounded-xl py-3 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center cursor-pointer ${
                isGenerating 
                  ? 'bg-primary/70 cursor-wait' 
                  : 'bg-gradient-to-r from-[#0A7756] to-emerald-600 hover:from-[#086146] hover:to-emerald-700 active:scale-95 shadow-emerald-700/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>{t('তৈরি করা হচ্ছে...', 'Generating...')}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  <span>{t('AI দিয়ে মেসেজ তৈরি করুন', 'Generate Message with AI')}</span>
                </>
              )}
            </button>
          </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300 mb-6 relative overflow-hidden">
            <h2 className="text-xl font-bold text-slate-800 mb-2">{t('স্মার্ট ভয়েস অ্যাসিস্ট্যান্ট', 'Smart Voice Assistant')}</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">
              {t('একসাথে মেসেজ তৈরি এবং শিডিউল করার কথা বলতে পারেন। যেমন: "স্ত্রীর জন্মদিনের উইশ লিখে কাল ১০টায় পাঠাও।"', 'You can generate and schedule messages by voice. e.g. "Write a birthday wish for wife and schedule it for tomorrow 10am."')}
            </p>
            
            <button 
              onClick={handleVoiceRecord}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all z-10 relative ${isRecording ? 'bg-red-50 text-red-500 animate-pulse border-4 border-red-200' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 shadow-md border border-purple-100'}`}
            >
              <Mic className={`w-10 h-10 ${isRecording ? 'animate-bounce' : ''}`} />
            </button>
            <p className={`mt-4 text-sm font-bold z-10 relative ${isRecording ? 'text-red-500' : 'text-slate-400'}`}>
              {isRecording ? t('শুনছি...', 'Listening...') : t('ট্যাপ করে কথা বলুন', 'Tap to speak')}
            </p>

            {voiceTranscript && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl w-full text-left animate-in fade-in slide-in-from-bottom-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">আপনার কথা:</span>
                <p className="text-slate-700 font-medium italic text-sm">{voiceTranscript}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'image' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">{t('ডিজিটাল গ্রিটিং কার্ড তৈরি', 'Create Digital Greeting Card')}</h2>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6 text-center">
              {t('প্রিয়জনের ছবি ও মেসেজ দিয়ে একটি সুন্দর ওয়েবপেজ তৈরি করুন এবং লিংক শেয়ার করুন।', 'Create a beautiful webpage with image and message for your loved ones and share the link.')}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('ছবি আপলোড করুন', 'Upload Image')}</label>
                
                <input id="wish-image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                
                {cardImage ? (
                  <div className="border border-slate-200 rounded-2xl p-4 text-center bg-slate-50 shadow-inner">
                    <div className="flex flex-col items-center justify-center py-2 relative w-full">
                      <div 
                        onClick={() => document.getElementById('wish-image-upload')?.click()}
                        className={`cursor-pointer w-32 h-32 relative group transition-all duration-500 ${imageShape === 'round' ? 'rounded-full' : imageShape === 'rounded' ? 'rounded-2xl' : imageShape === 'heart' ? '' : 'rounded-none'}`}
                        style={imageShape === 'heart' ? { WebkitMaskImage: 'url(\'data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>\')', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', backgroundColor: '#fcd34d' } : { padding: '4px', background: 'linear-gradient(to top right, #fbbf24, #ec4899)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                      >
                        <img 
                          src={cardImage} 
                          alt="Preview" 
                          className={`w-full h-full object-cover transition-all duration-500 ${imageShape === 'round' ? 'rounded-full border-4 border-white' : imageShape === 'rounded' ? 'rounded-2xl border-4 border-white' : imageShape === 'heart' ? 'border-none' : 'border-4 border-white rounded-none'}`} 
                        />
                        <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 ${imageShape === 'round' ? 'rounded-full' : imageShape === 'rounded' ? 'rounded-2xl' : imageShape === 'heart' ? '' : 'rounded-none'}`}>
                          <span className="text-white text-xs font-bold px-2 py-1 bg-black/50 rounded-lg">{t('পরিবর্তন', 'Change')}</span>
                        </div>
                      </div>

                      {/* Image Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => document.getElementById('wish-image-upload')?.click()}
                          className="text-xs font-bold text-primary hover:text-primary-dark px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-sm transition"
                        >
                          {t('ছবি পরিবর্তন করুন', 'Change Image')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardImage(null)}
                          className="text-xs font-bold text-red-500 hover:text-red-700 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-sm transition"
                        >
                          {t('মুছে ফেলুন', 'Remove')}
                        </button>
                      </div>
                      
                      {/* Shape Selector */}
                      <div className="mt-4 flex flex-col items-center w-full">
                        <label className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">{t('ছবির আকার (শেপ)', 'Image Shape')}</label>
                        <div className="grid grid-cols-4 gap-1.5 bg-white rounded-xl p-1.5 w-full shadow-sm border border-slate-100">
                          <button onClick={(e) => { e.preventDefault(); setImageShape('round'); }} className={`py-2 rounded-lg text-[10px] font-bold transition-all ${imageShape === 'round' ? 'bg-amber-100 text-amber-700 shadow-sm transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>⭕ {t('গোল', 'Round')}</button>
                          <button onClick={(e) => { e.preventDefault(); setImageShape('rounded'); }} className={`py-2 rounded-lg text-[10px] font-bold transition-all ${imageShape === 'rounded' ? 'bg-amber-100 text-amber-700 shadow-sm transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>⬜ {t('রাউন্ড', 'Rounded')}</button>
                          <button onClick={(e) => { e.preventDefault(); setImageShape('square'); }} className={`py-2 rounded-lg text-[10px] font-bold transition-all ${imageShape === 'square' ? 'bg-amber-100 text-amber-700 shadow-sm transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>⬛ {t('চারকোনা', 'Square')}</button>
                          <button onClick={(e) => { e.preventDefault(); setImageShape('heart'); }} className={`py-2 rounded-lg text-[10px] font-bold transition-all ${imageShape === 'heart' ? 'bg-pink-100 text-pink-700 shadow-sm transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>❤️ {t('লাভ', 'Heart')}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => document.getElementById('wish-image-upload')?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 hover:border-amber-300 transition-all cursor-pointer relative overflow-hidden group"
                  >
                    <div className="flex flex-col items-center justify-center py-2 group-hover:scale-105 transition-transform duration-300">
                      <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-100 transition-colors">
                        <ImageIcon className="w-6 h-6 text-amber-500" />
                      </div>
                      <span className="text-sm font-bold text-slate-600">{t('ক্লিক করে ছবি নির্বাচন করুন', 'Click to select image')}</span>
                      <span className="text-[10px] font-medium text-slate-400 mt-1">{t('গ্যালারি বা ক্যামেরা থেকে ছবি দিন (JPG, PNG)', 'From gallery or camera (JPG, PNG)')}</span>
                    </div>
                  </div>
                )}

                {/* Preset sample images quick select */}
                <div className="mt-3">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">
                    {t('অথবা পছন্দের রেডিমেড ছবি বেছে নিন:', 'Or choose a ready-made image:')}
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_CARD_IMAGES.map((preset) => {
                      const isSelected = cardImage === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setCardImage(preset.url);
                            if (!cardTitle || cardTitle === 'custom:') {
                              setCardTitle(preset.title);
                            }
                          }}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all group ${
                            isSelected ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-slate-200 hover:border-slate-300'
                          }`}
                          title={preset.label}
                        >
                          <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-end p-1">
                            <span className="text-[9px] text-white font-bold truncate drop-shadow-sm leading-tight">{preset.label.split(' ')[0]}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('টাইটেল নির্বাচন করুন', 'Select Title')}</label>
                <div className="flex flex-col gap-2">
                  <select 
                    value={cardTitle.startsWith('custom:') ? 'custom' : cardTitle}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCardTitle('custom:');
                      } else {
                        setCardTitle(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 bg-white"
                  >
                    <option value="">{t('নির্বাচন করুন...', 'Select...')}</option>
                    <option value="শুভ জন্মদিন">শুভ জন্মদিন (Happy Birthday)</option>
                    <option value="শুভ বিবাহ বার্ষিকী">শুভ বিবাহ বার্ষিকী (Happy Anniversary)</option>
                    <option value="শুভ নববর্ষ">শুভ নববর্ষ (Happy New Year)</option>
                    <option value="ঈদ মোবারক">ঈদ মোবারক (Eid Mubarak)</option>
                    <option value="শুভ ভালোবাসা দিবস">শুভ ভালোবাসা দিবস (Happy Valentine's)</option>
                    <option value="শুভ মা দিবস">শুভ মা দিবস (Happy Mother's Day)</option>
                    <option value="শুভ বাবা দিবস">শুভ বাবা দিবস (Happy Father's Day)</option>
                    <option value="শুভ কামনা">শুভ কামনা (Best Wishes)</option>
                    <option value="custom">{t('অন্যান্য (নিজে লিখুন)', 'Other (Custom)')}</option>
                  </select>
                  
                  {cardTitle.startsWith('custom:') && (
                    <input 
                      type="text" 
                      value={cardTitle.replace('custom:', '')}
                      onChange={(e) => setCardTitle('custom:' + e.target.value)}
                      placeholder={t('আপনার নিজের মতো টাইটেল লিখুন', 'Enter your custom title')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 animate-in fade-in" 
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('যাকে পাঠাবেন (তার নাম)', 'Recipient Name')}</label>
                <div className="flex gap-2">
                  <select 
                    value={recipientPrefix}
                    onChange={(e) => setRecipientPrefix(e.target.value)}
                    className="w-[115px] sm:w-[130px] shrink-0 rounded-xl border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:border-primary/50 bg-white"
                  >
                    <option value="প্রিয়,">প্রিয়,</option>
                    <option value="শ্রদ্ধেয়,">শ্রদ্ধেয়,</option>
                    <option value="শ্রদ্ধেয়া,">শ্রদ্ধেয়া,</option>
                    <option value="স্নেহের,">স্নেহের,</option>
                    <option value="আদরের,">আদরের,</option>
                    <option value="সম্মানিত,">সম্মানিত,</option>
                    <option value="প্রিয় বন্ধু,">প্রিয় বন্ধু,</option>
                    <option value="">(কিছু না)</option>
                  </select>
                  <input 
                    type="text" 
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={t('নাম লিখুন...', 'e.g. Name...')}
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-primary/50" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('আপনার মেসেজ', 'Your Message')}</label>
                <textarea 
                  rows={3}
                  value={cardMessage}
                  onChange={(e) => setCardMessage(e.target.value)}
                  placeholder={t('আপনার সুন্দর মেসেজটি এখানে লিখুন...', 'Write your beautiful message here...')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 resize-none" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('ব্যাকগ্রাউন্ড মিউজিক (শুধু সুর/ইন্সট্রুমেন্টাল)', 'Background Music (Instrumental Only)')}</label>
                <select 
                  value={bgMusic}
                  onChange={(e) => setBgMusic(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 bg-white"
                >
                  <option value="none">{t('কোনো মিউজিক নয়', 'No Music')}</option>
                  <option value="birthday">{t('জন্মদিনের সুর (Birthday Tune)', 'Birthday Tune')}</option>
                  <option value="romantic">{t('রোমান্টিক সুর (Romantic Melody)', 'Romantic Melody')}</option>
                  <option value="joyful">{t('উৎসবের সুর (Joyful Tune)', 'Joyful Tune')}</option>
                  <option value="newyear">{t('নতুন বছরের সুর (New Year Tune)', 'New Year Tune')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                  <span>{t('যিনি পাঠাচ্ছেন (আপনার নাম)', 'Sender Details')}</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {t('ভেরিফাইড অ্যাকাউন্ট', 'Verified Account')}
                  </span>
                </label>
                <div className="flex gap-2">
                  <select 
                    value={cardSignOff}
                    onChange={(e) => setCardSignOff(e.target.value)}
                    className="w-[115px] sm:w-[130px] shrink-0 rounded-xl border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:border-primary/50 bg-white"
                  >
                    <option value="ভালোবাসা অন্তে,">ভালোবাসা অন্তে,</option>
                    <option value="ইতি,">ইতি,</option>
                    <option value="শুভেচ্ছান্তে,">শুভেচ্ছান্তে,</option>
                    <option value="বিনীত,">বিনীত,</option>
                    <option value="আপনারই,">আপনারই,</option>
                    <option value="স্নেহাশীষ,">স্নেহাশীষ,</option>
                    <option value="">(কিছু না)</option>
                  </select>
                  <div 
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm flex items-center justify-between text-slate-800 font-semibold select-none shadow-2xs"
                    title={t('সুরক্ষার স্বার্থে প্রেরকের নাম পোর্টাল অ্যাকাউন্ট থেকে নির্ধারিত', 'Sender name is locked to your verified portal account')}
                  >
                    <span className="truncate">{senderName || localStorage.getItem('userName') || 'অ্যাকাউন্ট ব্যবহারকারী'}</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <span>🔒 {t('অ্যাকাউন্টের সুরক্ষায় প্রেরক হিসেবে পোর্টাল অ্যাকাউন্টের নামই ব্যবহৃত হবে।', 'For security, your portal account name is used as the verified sender.')}</span>
                </p>
              </div>

              {!generatedLink ? (
                <button 
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className={`w-full text-white rounded-xl py-3.5 font-bold text-sm shadow-md transition-all flex items-center justify-center mt-2 ${isGenerating ? 'bg-primary/70 cursor-wait' : 'bg-primary hover:bg-primary-dark hover:scale-[1.01] active:scale-95'}`}
                >
                  {isGenerating ? t('তৈরি হচ্ছে...', 'Generating...') : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" /> {t('ম্যাজিক লিংক তৈরি করুন', 'Generate Magic Link')}
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-4 animate-in zoom-in-95">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-emerald-900 font-bold text-sm text-center">
                      {t('আপনার গ্রিটিং কার্ড তৈরি হয়েছে!', 'Your Greeting Card is Ready!')}
                    </h3>
                  </div>

                  <div className="bg-white border border-emerald-200/90 rounded-xl p-2 pl-3 flex items-center justify-between mb-3 shadow-xs">
                    <span className="text-xs text-slate-600 font-mono truncate mr-2 select-all">{generatedLink}</span>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        toast.success(t('লিংক কপি করা হয়েছে!', 'Link Copied!'));
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 active:scale-95 border border-emerald-200/60"
                      title={t('লিংক কপি করুন', 'Copy Link')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('কপি', 'Copy')}</span>
                    </button>
                  </div>

                  {/* WhatsApp Direct Share Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      const shareText = encodeURIComponent(`🎉 আপনার জন্য একটি সুন্দর গ্রিটিং কার্ড তৈরি করা হয়েছে! দেখতে লিংকে ট্যাপ করুন:\n${generatedLink}`);
                      window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
                    }}
                    className="w-full flex items-center justify-center py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white rounded-xl text-xs font-bold transition shadow-xs gap-2 mb-2"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>{t('হোয়াটসঅ্যাপে পাঠান', 'Share on WhatsApp')}</span>
                  </button>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={generatedLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center justify-center py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs gap-1.5"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{t('প্রিভিউ দেখুন', 'Preview')}</span>
                    </a>
                    <button 
                      type="button"
                      onClick={() => {
                        setScheduleMethod('whatsapp');
                        setShowScheduleForm(prev => !prev);
                      }}
                      className={`flex items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition shadow-xs gap-1.5 active:scale-95 border ${
                        showScheduleForm 
                          ? 'bg-emerald-700 text-white border-emerald-700' 
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{t('শিডিউল করুন', 'Schedule')}</span>
                    </button>
                  </div>

                  {/* Reset/Create New */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-emerald-200/60 mt-3 text-[11px] text-emerald-800">
                    <span>{t('নতুন কোনো কার্ড তৈরি করতে চান?', 'Want to create another card?')}</span>
                    <button
                      type="button"
                      onClick={() => resetForm()}
                      className="font-bold underline text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      {t('নতুন তৈরি করুন', 'Create New')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {showScheduleForm && activeTab === 'image' && (
              <div className="mt-4 p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 animate-in fade-in slide-in-from-top-2 text-left">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>{t('কার্ড পাঠানোর তথ্য দিন', 'Enter card sending details')}</span>
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => setShowScheduleForm(false)} 
                    className="w-6 h-6 rounded-full hover:bg-emerald-200/60 flex items-center justify-center text-xs text-slate-500 hover:text-slate-700 transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">{t('কীভাবে পাঠাবেন?', 'How to send?')}</label>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setScheduleMethod('whatsapp')} 
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          scheduleMethod === 'whatsapp' ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        WhatsApp
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setScheduleMethod('sms')} 
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          scheduleMethod === 'sms' ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        SMS
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">{t('তারিখ ও সময়', 'Date & Time')}</label>
                    <div className="flex gap-2">
                      <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white" />
                      <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">
                      {scheduleMethod === 'whatsapp' ? t('রিসিভারের WhatsApp নম্বর', 'Recipient WhatsApp number') : t('রিসিভারের ফোন নম্বর', 'Recipient phone number')}
                    </label>
                    <input type="tel" value={scheduleContact} onChange={e => setScheduleContact(e.target.value)} placeholder="যেমন: 017..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white" />
                  </div>
                  <div className="flex gap-2 mt-4 pt-1">
                    <button type="button" onClick={() => handleSaveWish('send', true)} className="flex-1 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 rounded-xl py-2.5 text-xs font-bold transition shadow-xs active:scale-95">{t('এখুনি পাঠান', 'Send Now')}</button>
                    <button type="button" onClick={() => handleSaveWish('schedule', true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-bold transition shadow-xs active:scale-95">{t('শিডিউল করুন', 'Schedule')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Preview Area - Shared for Text and Voice */}
        {(activeTab === 'text' || activeTab === 'voice') && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xs border border-slate-200/80 flex flex-col mb-4">
            <div className="flex justify-between items-center mb-3">
              <div className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> {t('মেসেজ প্রিভিউ', 'Message Preview')}
              </div>
              {generatedWish && (
                <button onClick={activeTab === 'text' ? handleGenerate : handleVoiceRecord} className="text-emerald-600 text-xs font-bold flex items-center hover:bg-emerald-50 px-2 py-1 rounded transition cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  {t('পুনরায় তৈরি', 'Regenerate')}
                </button>
              )}
            </div>
            
            {/* Generated Card Preview */}
            <div className={`w-full rounded-xl sm:rounded-2xl transition-all relative ${
              isGenerating
                ? 'p-5 min-h-[110px] bg-amber-50/50 border border-dashed border-amber-200 flex flex-col items-center justify-center'
                : !generatedWish
                ? 'p-3.5 sm:p-4 min-h-[80px] sm:min-h-[90px] bg-gradient-to-br from-amber-50/50 to-orange-50/30 border border-dashed border-amber-200/80 flex flex-col items-center justify-center text-center'
                : 'p-4 sm:p-5 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-yellow-100/60 border border-amber-200/90 shadow-2xs'
            }`}>
              {/* Content */}
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-3 border-orange-200 border-t-orange-500 animate-spin"></div>
                  <p className="text-orange-700 font-bold animate-pulse text-xs">{t('সুন্দর কথা তৈরি হচ্ছে...', 'Generating beautiful wish...')}</p>
                </div>
              ) : !generatedWish ? (
                <div className="flex flex-col items-center justify-center text-center py-1">
                  <Wand2 className="w-5 h-5 mb-1 text-amber-500/60" />
                  <p className="text-xs font-medium text-amber-900/80 leading-snug">
                    {activeTab === 'text' 
                      ? t('তথ্য পূরণ করে উপরের বাটনে চাপুন, এখানে সুন্দর উইশ তৈরি হবে ✨', 'Fill out the form and tap generate to see your wish ✨') 
                      : t('মাইকে কথা বলে ম্যাজিক মেসেজ তৈরি করুন ✨', 'Speak into the mic to generate your wish ✨')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="absolute top-2.5 right-3 text-xl opacity-40">
                    {occasions.find(o => o.id === selectedOccasion)?.icon || '✨'}
                  </div>
                  
                  <h2 className="text-base sm:text-lg font-black text-amber-800 mb-2 tracking-tight text-center leading-snug">
                    {generatedWish.title}
                  </h2>
                  
                  <div className="text-slate-800 text-xs sm:text-sm text-center leading-relaxed space-y-1.5 max-w-sm mx-auto font-medium">
                    {generatedWish.body.map((paragraph: string, idx: number) => (
                      <p key={idx} className={idx === 0 ? "font-bold text-xs sm:text-sm text-amber-900" : paragraph.startsWith('ইতি,') ? "font-bold text-amber-800 mt-2 italic" : "text-slate-700"}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Actions / Send Options */}
            {generatedWish && (
              <>
                <h3 className="text-xs font-bold text-slate-400 mb-3 text-center uppercase tracking-wider mt-4">{t('কীভাবে পাঠাতে চান নির্বাচন করুন', 'Select how to send')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setScheduleMethod('whatsapp'); setShowScheduleForm(true); }}
                    className="flex flex-col items-center justify-center py-3 bg-green-50 hover:bg-green-100 border border-green-100 rounded-2xl transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center mb-1.5 shadow-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-green-700">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => { setScheduleMethod('sms'); setShowScheduleForm(true); }}
                    className="flex flex-col items-center justify-center py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1.5 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700">SMS</span>
                  </button>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => {
                      if (generatedWish) {
                        const text = generatedWish.title + '\n\n' + generatedWish.body.join('\n');
                        navigator.clipboard.writeText(text).then(() => {
                          toast.success(t('টেক্সট কপি করা হয়েছে!', 'Text copied!'));
                        });
                      }
                    }}
                    className="flex-1 flex items-center justify-center py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition border border-slate-100"
                  >
                    <Copy className="w-4 h-4 mr-1.5" /> {t('কপি করুন', 'Copy')}
                  </button>
                  <button 
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    className="flex-1 flex items-center justify-center py-2.5 bg-purple-50 hover:bg-purple-100 rounded-xl text-xs font-bold text-purple-600 transition border border-purple-100"
                  >
                    <Calendar className="w-4 h-4 mr-1.5" /> {t('শিডিউল করুন', 'Schedule')}
                  </button>
                </div>

                {showScheduleForm && (
                  <div className="mt-4 p-4 bg-purple-50/50 rounded-2xl border border-purple-100 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">{t('মেসেজ পাঠানোর তথ্য দিন', 'Enter message details')}</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t('কীভাবে পাঠাবেন?', 'How to send?')}</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setScheduleMethod('whatsapp')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${scheduleMethod === 'whatsapp' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}
                          >WhatsApp</button>
                          <button 
                            onClick={() => setScheduleMethod('sms')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${scheduleMethod === 'sms' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}
                          >SMS</button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t('তারিখ ও সময়', 'Date & Time')}</label>
                        <div className="flex gap-2">
                          <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-300" />
                          <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-300" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">
                          {scheduleMethod === 'whatsapp' ? t('রিসিভারের WhatsApp নম্বর', 'Recipient WhatsApp number') : t('রিসিভারের ফোন নম্বর', 'Recipient phone number')}
                        </label>
                        <input 
                          type="tel" 
                          value={scheduleContact}
                          onChange={e => setScheduleContact(e.target.value)}
                          placeholder="যেমন: +8801..." 
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-purple-300" 
                        />
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <button 
                          onClick={() => handleSaveWish('send', false)}
                          className="flex-1 bg-white hover:bg-slate-50 text-purple-700 border border-purple-200 rounded-lg py-2.5 text-sm font-bold transition shadow-sm"
                        >
                          {t('এখুনি পাঠান', 'Send Now')}
                        </button>
                        <button 
                          onClick={() => handleSaveWish('schedule', false)}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2.5 text-sm font-bold transition shadow-sm"
                        >
                          {t('শিডিউল করুন', 'Schedule')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 4: Scheduled Wishes List */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 mb-28 pb-6 md:mb-6">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center">
                  <Gift className="w-5 h-5 mr-2 text-pink-500" /> {t('আপনার শিডিউলড শুভেচ্ছা তালিকা', 'Your Scheduled Wishes')}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('কাকে কোন দিন কোন সময়ে উইশ পাঠানো হবে তার সম্পূর্ণ তালিকা', 'Complete list of who will receive wishes and when')}
                </p>
              </div>
              <button 
                onClick={fetchWishes} 
                disabled={loadingWishes}
                className="text-xs font-bold text-primary bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full flex items-center transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingWishes ? 'animate-spin' : ''}`} />
                {t('রিফ্রেশ', 'Refresh')}
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: 'all', label: t('সব', 'All'), count: scheduledWishes.length },
                { id: 'scheduled', label: t('অপেক্ষমাণ', 'Scheduled'), count: scheduledWishes.filter(w => w.status === 'Scheduled' || w.status === 'Pending').length },
                { id: 'sent', label: t('পাঠানো হয়েছে', 'Sent'), count: scheduledWishes.filter(w => w.status === 'Sent').length }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setWishFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                    wishFilter === f.id 
                      ? 'bg-emerald-700 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    wishFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {loadingWishes ? (
              <div className="py-12 text-center text-slate-400 text-sm font-medium">
                {t('উইশ তালিকা লোড হচ্ছে...', 'Loading wishes...')}
              </div>
            ) : (() => {
              const baseFiltered = wishFilter === 'all' 
                ? scheduledWishes 
                : wishFilter === 'scheduled' 
                ? scheduledWishes.filter(w => w.status === 'Scheduled' || w.status === 'Pending')
                : scheduledWishes.filter(w => w.status === 'Sent');

              const filtered = [...baseFiltered].sort((a, b) => {
                const timeA = new Date(a.createdAt || a.scheduledAt || 0).getTime();
                const timeB = new Date(b.createdAt || b.scheduledAt || 0).getTime();
                return timeB - timeA;
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-3">
                      <Gift className="w-8 h-8 text-pink-300" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">{t('কোনো উইশ পাওয়া যায়নি', 'No wishes found')}</h3>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">
                      {t('আপনি এখনো কাউকে শুভেচ্ছা শিডিউল করেননি। ওপরের "টেক্সট" বা "গ্রিটিং কার্ড" ট্যাব থেকে শিডিউল করতে পারেন।', 'You have not scheduled any wishes yet. Schedule one from Text or Greeting Card tabs above.')}
                    </p>
                    <button
                      onClick={() => setActiveTab('text')}
                      className="bg-[#0A7756] hover:bg-[#086146] text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
                    >
                      {t('+ নতুন উইশ শিডিউল করুন', '+ Schedule New Wish')}
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map((w) => {
                    const isSent = w.status === 'Sent';
                    const isCancelled = w.status === 'Cancelled';
                    const isPending = !isSent && !isCancelled;
                    const scheduledDate = new Date(w.scheduledAt || w.createdAt);
                    const dateFormatted = scheduledDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeFormatted = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                      <div 
                        key={w._id} 
                        className={`bg-white rounded-2xl p-4 border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col gap-3 relative ${
                          isSent 
                            ? 'border-emerald-200/90 border-l-4 border-l-emerald-500' 
                            : isPending 
                            ? 'border-amber-200/90 border-l-4 border-l-amber-500' 
                            : 'border-slate-200 border-l-4 border-l-slate-400'
                        }`}
                      >
                        {/* Top Bar: Occasion & Status & Actions */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 flex items-center shadow-2xs">
                              {getOccasionBadge(w.occasion)}
                            </span>
                            {w.isSmartCard && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                {t('ডিজিটাল কার্ড', 'Digital Card')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSent ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{t('পাঠানো হয়েছে', 'Sent')}</span>
                              </span>
                            ) : isCancelled ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                {t('বাতিল', 'Cancelled')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>{t('অপেক্ষমাণ', 'Scheduled')}</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteWish(w._id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition active:scale-90"
                              title={t('মুছে ফেলুন', 'Delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Recipient Details & Channel Pill */}
                        <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-800 font-extrabold text-sm flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
                              {(w.recipientName || 'প্র')[0]}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none mb-0.5">
                                {t('প্রাপক', 'Recipient')}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm truncate leading-snug">
                                {w.recipientName || t('প্রিয়জন', 'Loved One')}
                              </h4>
                              {w.recipientContact && (
                                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mt-0.5 font-mono">
                                  <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{w.recipientContact}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delivery Channel Badge */}
                          <div className="shrink-0">
                            {w.deliveryMethod?.includes('WhatsApp') ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
                                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                WhatsApp
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs">
                                SMS
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Schedule & Sender Metadata */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 px-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{dateFormatted}</span>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 font-bold text-emerald-700">
                              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{timeFormatted}</span>
                            </span>
                          </div>

                          {w.cardData?.senderName && (
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <span>{t('প্রেরক:', 'From:')}</span>
                              <strong className="font-bold text-slate-800">{w.cardData.senderName}</strong>
                            </div>
                          )}
                        </div>

                        {/* Smart Card Preview Box with 3-button Actions */}
                        {(w.isSmartCard || w.smartCardId) ? (
                          <div className="bg-gradient-to-br from-purple-50/70 via-pink-50/30 to-white rounded-2xl p-3 border border-purple-100 space-y-2.5 shadow-2xs">
                            <div className="flex items-start gap-3">
                              {w.cardData?.image ? (
                                <img 
                                  src={w.cardData.image} 
                                  alt="Card" 
                                  className="w-12 h-12 rounded-xl object-cover border border-purple-200 shrink-0 shadow-2xs" 
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200">
                                  <Gift className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs md:text-sm font-bold text-slate-800 line-clamp-1 leading-snug">
                                  {w.cardData?.title || t('ডিজিটাল গ্রিটিং কার্ড', 'Digital Greeting Card')}
                                </h5>
                                {w.message && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2 italic mt-0.5 leading-relaxed">
                                    "{w.message}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons: 3 Columns Grid */}
                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-purple-100/70">
                              <Link
                                to={`/w/${w.smartCardId || w._id}`}
                                target="_blank"
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                <span>{t('প্রিভিউ', 'Preview')}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  const cardUrl = `${window.location.origin}/w/${w.smartCardId || w._id}`;
                                  navigator.clipboard.writeText(cardUrl);
                                  toast.success(t('কার্ড লিংক কপি হয়েছে!', 'Card link copied!'));
                                }}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95"
                              >
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>{t('কপি', 'Copy')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const cardUrl = `${window.location.origin}/w/${w.smartCardId || w._id}`;
                                  const text = encodeURIComponent(`🎉 আপনার জন্য একটি সুন্দর শুভেচ্ছা কার্ড পাঠানো হয়েছে! দেখতে লিংকে ট্যাপ করুন:\n${cardUrl}`);
                                  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                                }}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95"
                              >
                                <Share2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{t('শেয়ার', 'Share')}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          w.message && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 italic leading-relaxed font-sans">
                              "{w.message}"
                            </div>
                          )
                        )}

                        {/* Plain Message Share if applicable */}
                        {(!w.isSmartCard && !w.smartCardId && w.message) && (
                          <div className="flex items-center justify-end text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                const text = encodeURIComponent(w.message || '');
                                window.open(`https://api.whatsapp.com/send?phone=${w.recipientContact || ''}&text=${text}`, '_blank');
                              }}
                              className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 text-xs active:scale-95 transition"
                            >
                              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('হোয়াটসঅ্যাপে পাঠান', 'Send to WhatsApp')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Success Popup Modal */}
      {successPopup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center text-center border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-500 shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">
              {successPopup.type === 'schedule' ? t('সফলভাবে শিডিউল হয়েছে!', 'Scheduled Successfully!') : t('মেসেজ পাঠানো হয়েছে!', 'Message Sent!')}
            </h3>
            
            <p className="text-slate-500 text-sm mb-6 font-medium leading-relaxed">
              {successPopup.type === 'schedule' 
                ? t('আপনার মেসেজটি সফলভাবে শিডিউল করা হয়েছে। নির্দিষ্ট সময়ে এটি অটোমেটিক রিসিভারের কাছে পৌঁছে যাবে।', 'Your message has been scheduled successfully. It will automatically reach the recipient at the specified time.')
                : t('আপনার মেসেজটি সফলভাবে রিসিভারের কাছে পাঠানো হয়েছে।', 'Your message was sent successfully to the recipient.')}
            </p>
            
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => {
                  setSuccessPopup({show: false, type: 'send'});
                  setActiveTab('list');
                  fetchWishes();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-xs"
              >
                {t('শিডিউল তালিকা দেখুন', 'View Schedule')}
              </button>
              <button 
                onClick={() => setSuccessPopup({show: false, type: 'send'})}
                className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold py-2.5 rounded-xl transition text-xs"
              >
                {t('নতুন তৈরি করুন', 'Create New')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
