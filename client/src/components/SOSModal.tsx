import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Phone, 
  MapPin, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  CheckCircle, 
  X, 
  Heart, 
  Clock, 
  Send,
  Loader2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmergencyContact {
  name: string;
  phone: string;
  relation?: string;
}

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Web Audio API emergency siren player
class EmergencySirenPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: any = null;

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // Alternating high-low urgent police/ambulance siren frequencies: 800Hz <-> 1200Hz
      let toggle = false;
      const playTone = () => {
        if (!this.ctx || !this.isPlaying) return;
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(toggle ? 1100 : 750, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start();
          osc.stop(this.ctx.currentTime + 0.35);

          if ('vibrate' in navigator) {
            navigator.vibrate([150, 50, 150]);
          }

          toggle = !toggle;
        } catch (e) {
          console.error('Siren play error:', e);
        }
      };

      playTone();
      this.intervalId = setInterval(playTone, 380);
    } catch (e) {
      console.error('AudioContext error:', e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  active() {
    return this.isPlaying;
  }
}

const siren = new EmergencySirenPlayer();

export default function SOSModal({ isOpen, onClose }: SOSModalProps) {
  const [activeTab, setActiveTab] = useState<'panic' | 'contacts'>('panic');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastAlert, setLastAlert] = useState<any>(null);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const isDispatchingRef = useRef(false);
  const cachedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  
  // Profile / Contacts State
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [medicalNotes, setMedicalNotes] = useState<string>('');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('অভিভাবক');

  const countdownRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSosProfile();
      // Prefetch GPS location immediately when modal opens so it's ready when user taps
      if (navigator.geolocation) {
        setLocationStatus('জিপিএস সংযোগ খোঁজা হচ্ছে...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            cachedCoordsRef.current = coords;
            setLocationStatus('✅ জিপিএস লোকেশন প্রস্তুত');
          },
          (err) => {
            console.warn('[SOS] High-accuracy location prefetch failed, trying low accuracy...', err);
            navigator.geolocation.getCurrentPosition(
              (pos2) => {
                const coords = { latitude: pos2.coords.latitude, longitude: pos2.coords.longitude };
                cachedCoordsRef.current = coords;
                setLocationStatus('✅ জিপিএস লোকেশন প্রস্তুত');
              },
              (err2) => {
                console.warn('[SOS] Geolocation prefetch failed completely:', err2);
                setLocationStatus('⚠️ লোকেশন পারমিশন দিন');
              },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
        );
      }
    } else {
      stopCountdown();
      siren.stop();
      setIsSirenActive(false);
      cachedCoordsRef.current = null;
      setLocationStatus('');
    }
  }, [isOpen]);

  const fetchSosProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sos/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.profile) {
        setBloodGroup(data.profile.bloodGroup || '');
        setMedicalNotes(data.profile.medicalNotes || '');
        setEmergencyContacts(data.profile.emergencyContacts || []);
      }
      if (data.recentAlerts && data.recentAlerts.length > 0) {
        const active = data.recentAlerts.find((a: any) => a.status === 'active');
        if (active) setLastAlert(active);
      }
    } catch (e) {
      console.error('fetchSosProfile error:', e);
    }
  };

  const handleStartCountdown = () => {
    if (countdown !== null || isTriggering || isDispatchingRef.current) return;
    let count = 3;
    setCountdown(count);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdown(null);
        dispatchSos();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  };

  const dispatchSos = async () => {
    if (isDispatchingRef.current) return;
    isDispatchingRef.current = true;
    setIsTriggering(true);
    setLocationStatus('জিপিএস লোকেশন নেওয়া হচ্ছে...');

    let payloadSent = false;
    const sendPayload = async (coords?: { latitude: number; longitude: number }) => {
      if (payloadSent) return;
      payloadSent = true;

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sos/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            note: 'জরুরি বিপদকালীন সাহায্য প্রয়োজন'
          })
        });

        const data = await res.json();
        if (data.success) {
          toast.success(data.message, { duration: 6000 });
          setLastAlert({
            _id: data.alertId,
            status: 'active',
            location: coords ? { mapUrl: `https://maps.google.com/?q=${coords.latitude},${coords.longitude}` } : undefined,
            emergencyContactsNotified: data.contacts
          });
        } else {
          toast.error(data.message || 'অ্যালার্ট পাঠানো যায়নি। ৯৯৯-এ কল করুন!');
        }
      } catch (err: any) {
        toast.error('ইন্টারনেট বা সার্ভার সমস্যা। অবিলম্বে ৯৯৯ এ কল দিন!');
      } finally {
        setIsTriggering(false);
        setLocationStatus('');
        setTimeout(() => {
          isDispatchingRef.current = false;
        }, 3000);
      }
    };

    // 1. If coordinates are already pre-fetched and ready, dispatch immediately!
    if (cachedCoordsRef.current) {
      console.log('[SOS] Dispatching with pre-fetched coordinates:', cachedCoordsRef.current);
      sendPayload(cachedCoordsRef.current);
      return;
    }

    // 2. Otherwise request coordinates with high-accuracy, falling back to low-accuracy
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendPayload({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('[SOS] High accuracy failed, trying low accuracy fallback...', err);
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              sendPayload({
                latitude: pos2.coords.latitude,
                longitude: pos2.coords.longitude
              });
            },
            (err2) => {
              console.warn('[SOS] Geolocation completely failed:', err2);
              sendPayload();
            },
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
      );
    } else {
      sendPayload();
    }
  };

  const toggleSiren = () => {
    if (isSirenActive) {
      siren.stop();
      setIsSirenActive(false);
    } else {
      siren.start();
      setIsSirenActive(true);
      toast('🚨 বিপৎকালীন সাইরেন চালু হয়েছে', { icon: '📢' });
    }
  };

  const handleResolveAlert = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sos/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ alertId: lastAlert?._id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('✅ আপনি নিরাপদ থাকার নিশ্চিতকরণ পাঠানো হয়েছে।');
        setLastAlert(null);
        siren.stop();
        setIsSirenActive(false);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('সার্ভারে সমস্যা হয়েছে');
    }
  };

  const handleAddContact = () => {
    if (!newContactName.trim()) {
      toast.error('অভিভাবকের নাম লিখুন');
      return;
    }
    const cleanPhone = newContactPhone.replace(/[^\d]/g, '').replace(/^88(?=01)/, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      toast.error('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }
    if (emergencyContacts.length >= 5) {
      toast.error('সর্বোচ্চ ৫ জন জরুরি কন্টাক্ট যোগ করতে পারবেন');
      return;
    }

    const updated = [...emergencyContacts, {
      name: newContactName.trim(),
      phone: cleanPhone,
      relation: newContactRelation
    }];
    setEmergencyContacts(updated);
    setNewContactName('');
    setNewContactPhone('');
    saveProfile(updated, bloodGroup, medicalNotes);
  };

  const handleRemoveContact = (index: number) => {
    const updated = emergencyContacts.filter((_, i) => i !== index);
    setEmergencyContacts(updated);
    saveProfile(updated, bloodGroup, medicalNotes);
  };

  const saveProfile = async (contacts = emergencyContacts, bg = bloodGroup, med = medicalNotes) => {
    setIsSavingContacts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sos/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bloodGroup: bg,
          medicalNotes: med,
          emergencyContacts: contacts
        })
      });
      const data = await res.json();
      setIsSavingContacts(false);
      if (data.success) {
        toast.success('জরুরি কন্টাক্ট ও তথ্য সেভ হয়েছে ✅');
      }
    } catch (e) {
      setIsSavingContacts(false);
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-3 sm:p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-rose-500/30 flex flex-col my-auto max-h-[calc(100dvh-3rem)] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-normal">ইমার্জেন্সি SOS</h2>
                <span className="bg-white text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  Live Guard
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5">বিপদকালীন তাৎক্ষণিক অ্যালার্ট ও সাহায্য</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/20 shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('panic')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'panic'
                ? 'bg-white text-rose-700 shadow-xs border border-rose-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>জরুরি অ্যালার্ট ও হটলাইন</span>
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'contacts'
                ? 'bg-white text-rose-700 shadow-xs border border-rose-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-600" />
            <span>অভিভাবক ও মেডিকেল ({emergencyContacts.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">

          {activeTab === 'panic' && (
            <div className="space-y-4">

              {/* Active Alert Banner */}
              {lastAlert && lastAlert.status === 'active' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2.5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span>সতর্কবার্তা পাঠানো সম্পন্ন হয়েছে</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      সক্রিয়
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    আপনার জরুরি কন্টাক্টদের হোয়াটসঅ্যাপে আপনার লাইভ সতর্কবার্তা পাঠানো হয়েছে।
                  </p>
                  <button
                    onClick={handleResolveAlert}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>আমি এখন নিরাপদ (অ্যালার্ট সমাপ্ত করুন)</span>
                  </button>
                </div>
              )}

              {/* Main Panic Button / Countdown Circle */}
              <div className="bg-gradient-to-b from-rose-50/50 to-slate-50 p-6 rounded-3xl border border-rose-100 flex flex-col items-center text-center relative overflow-hidden">
                <div className="relative mb-3">
                  {/* Outer pulsing ring */}
                  <div className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping" />
                  <div className="absolute -inset-1.5 rounded-full bg-rose-500/30 animate-pulse" />
                  
                  {countdown !== null ? (
                    <button
                      onClick={stopCountdown}
                      className="relative w-36 h-36 rounded-full bg-gradient-to-br from-rose-600 to-red-700 text-white flex flex-col items-center justify-center shadow-2xl border-4 border-white cursor-pointer active:scale-95 transition"
                    >
                      <span className="text-4xl font-black">{countdown}</span>
                      <span className="text-[11px] font-bold text-rose-200 mt-1">বাতিল করতে ট্যাপ</span>
                    </button>
                  ) : (
                    <button
                      disabled={isTriggering}
                      onClick={handleStartCountdown}
                      className="relative w-36 h-36 rounded-full bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 hover:from-rose-700 hover:to-red-800 text-white flex flex-col items-center justify-center shadow-2xl shadow-rose-600/40 border-4 border-white cursor-pointer active:scale-95 transition group"
                    >
                      {isTriggering ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin text-white mb-1" />
                          <span className="text-xs font-bold">পাঠানো হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-10 h-10 text-white mb-1 stroke-[2.5] group-hover:scale-110 transition" />
                          <span className="text-xl font-black tracking-wider">SOS</span>
                          <span className="text-[10px] font-bold text-rose-100">ট্যাপ করে অ্যালার্ট</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-800">
                  {countdown !== null ? 'সতর্কবার্তা পাঠানোর কাউন্টডাউন...' : 'জরুরি সাহায্য পাঠাতে ট্যাপ করুন'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  ট্যাপ করলে আপনার লাইভ লোকেশন সহ {emergencyContacts.length} জন অভিভাবকের কাছে সতর্কবার্তা পৌঁছে যাবে।
                </p>
                {locationStatus && (
                  <span className="text-xs font-bold text-rose-600 mt-2 flex items-center gap-1.5 animate-pulse">
                    <MapPin className="w-3.5 h-3.5" />
                    {locationStatus}
                  </span>
                )}
              </div>

              {/* Siren and Emergency Helpline Action Bar */}
              <div className="grid grid-cols-2 gap-3">
                {/* Siren Button */}
                <button
                  type="button"
                  onClick={toggleSiren}
                  className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-xs cursor-pointer ${
                    isSirenActive
                      ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                      : 'bg-white hover:bg-rose-50/80 text-rose-700 border-rose-200'
                  }`}
                >
                  {isSirenActive ? <VolumeX className="w-4 h-4 stroke-[2.5]" /> : <Volume2 className="w-4 h-4 stroke-[2.5]" />}
                  <span>{isSirenActive ? 'সাইরেন থামান' : 'বিপৎকালীন সাইরেন'}</span>
                </button>

                {/* 999 Hotline Direct Call */}
                <a
                  href="tel:999"
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <Phone className="w-4 h-4 stroke-[2.5]" />
                  <span>জাতীয় সেবা ৯৯৯</span>
                </a>
              </div>

              {/* National Emergency Directory */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  জাতীয় জরুরি হেল্পলাইন (সরাসরি কল)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <a
                    href="tel:999"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 transition font-bold text-slate-800"
                  >
                    <span>🚓 ৯৯৯ (পুলিশ/অ্যাম্বুলেন্স/ফায়ার)</span>
                    <Phone className="w-3.5 h-3.5 text-rose-600" />
                  </a>
                  <a
                    href="tel:109"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 transition font-bold text-slate-800"
                  >
                    <span>🛡️ ১০৯ (নারী ও শিশু নির্যাতন প্রতিরোধ)</span>
                    <Phone className="w-3.5 h-3.5 text-rose-600" />
                  </a>
                  <a
                    href="tel:16263"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 transition font-bold text-slate-800"
                  >
                    <span>🚑 ১৬২৬৩ (স্বাস্থ্য বাতায়ন)</span>
                    <Phone className="w-3.5 h-3.5 text-rose-600" />
                  </a>
                  <a
                    href="tel:333"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 transition font-bold text-slate-800"
                  >
                    <span>🏛️ ৩৩৩ (সরকারি সেবা ও তথ্য)</span>
                    <Phone className="w-3.5 h-3.5 text-rose-600" />
                  </a>
                </div>
              </div>

              {/* Quick Dial Saved Contacts */}
              {emergencyContacts.length > 0 && (
                <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-rose-800 block uppercase tracking-wider">
                    অভিভাবককে সরাসরি কল দিন
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {emergencyContacts.map((c, i) => (
                      <a
                        key={i}
                        href={`tel:${c.phone}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50 transition font-bold text-slate-800"
                      >
                        <div className="truncate">
                          <span className="block truncate">{c.name} ({c.relation})</span>
                          <span className="text-[10px] text-slate-400 font-normal">{c.phone}</span>
                        </div>
                        <Phone className="w-3.5 h-3.5 text-rose-600 shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              
              {/* Emergency Contacts List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    জরুরি অভিভাবক / কন্টাক্ট তালিকা ({emergencyContacts.length}/5)
                  </label>
                </div>

                {emergencyContacts.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">আপনার কোনো জরুরি কন্টাক্ট সেভ করা নেই!</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        বিপদের সময় যাঁদের কাছে হোয়াটসঅ্যাপ সতর্কবার্তা যাবে, নিচে তাঁদের নম্বর যোগ করুন।
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emergencyContacts.map((contact, idx) => (
                      <div 
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <span>{contact.name}</span>
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-md">
                              {contact.relation}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{contact.phone}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(idx)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Contact Form */}
                {emergencyContacts.length < 5 && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">নতুন জরুরি কন্টাক্ট যোগ করুন:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="নাম (যেমন: বাবা)"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
                      />
                      <input
                        type="tel"
                        placeholder="01XXXXXXXXX"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-rose-500"
                      />
                      <select
                        value={newContactRelation}
                        onChange={(e) => setNewContactRelation(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-rose-500 cursor-pointer"
                      >
                        <option value="অভিভাবক">অভিভাবক</option>
                        <option value="বাবা">বাবা</option>
                        <option value="মা">মা</option>
                        <option value="স্বামী/স্ত্রী">স্বামী/স্ত্রী</option>
                        <option value="ভাই/বোন">ভাই/বোন</option>
                        <option value="বন্ধু">বন্ধু</option>
                        <option value="অন্যান্য">অন্যান্য</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddContact}
                      className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>কন্টাক্ট যুক্ত করুন</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Health & Medical Information */}
              <div className="bg-gradient-to-br from-rose-50/40 via-white to-slate-50 border border-rose-100/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    মেডিকেল তথ্য (Emergency Medical Card)
                  </label>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">রক্তের গ্রুপ (Blood Group)</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => {
                      setBloodGroup(e.target.value);
                      saveProfile(emergencyContacts, e.target.value, medicalNotes);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="">রক্তের গ্রুপ নির্বাচন করুন</option>
                    <option value="A+">A+ (Positive)</option>
                    <option value="A-">A- (Negative)</option>
                    <option value="B+">B+ (Positive)</option>
                    <option value="B-">B- (Negative)</option>
                    <option value="O+">O+ (Positive)</option>
                    <option value="O-">O- (Negative)</option>
                    <option value="AB+">AB+ (Positive)</option>
                    <option value="AB-">AB- (Negative)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    জরুরি মেডিকেল নোট (অ্যালার্জি, ক্রনিক অসুখ, জরুরি ওষুধ)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="যেমন: ডায়াবেটিস রোগী, পেনিসিলিন এলার্জি, নিয়মিত ইনসুলিন নেন..."
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    onBlur={() => saveProfile(emergencyContacts, bloodGroup, medicalNotes)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-rose-500 resize-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    💡 দুর্ঘটনা বা হাসপাতালে নেওয়ার প্রয়োজন হলে এই তথ্য স্বয়ংক্রিয়ভাবে প্রদান করা হবে।
                  </span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>WhatsApp-এ লিখুন <b>"SOS"</b> বা <b>"বাঁচাও"</b></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
}
