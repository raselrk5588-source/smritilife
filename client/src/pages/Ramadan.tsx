import { useState, useEffect } from 'react';
import { Moon, Clock, MapPin, Bell, Check, Sparkles, Share2, BookOpen, Volume2, Calendar, ShieldCheck, Heart, Sun, Compass } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface DistrictOption {
  id: string;
  nameEn: string;
  nameBn: string;
}

interface PrayerTimes {
  fajr: string;
  fajrFormatted: string;
  sunrise: string;
  sunriseFormatted: string;
  dhuhr: string;
  dhuhrFormatted: string;
  asr: string;
  asrFormatted: string;
  maghrib: string;
  maghribFormatted: string;
  isha: string;
  ishaFormatted: string;
}

interface RamadanTimes {
  district: string;
  districtBn: string;
  dateStr: string;
  isRamadan: boolean;
  hijriDay: number;
  hijriMonth: number;
  hijriMonthName: string;
  hijriYear: number;
  ramadanDay?: number;
  sehriEnd: string;
  sehriFormatted: string;
  iftar: string;
  iftarFormatted: string;
  fajr: string;
  maghrib: string;
  prayers: PrayerTimes;
}

interface DuaItem {
  title: string;
  arabic: string;
  pronunciation: string;
  meaning: string;
}

export default function Ramadan() {
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Dhaka');
  const [times, setTimes] = useState<RamadanTimes | null>(null);
  const [duas, setDuas] = useState<Record<string, DuaItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Active view mode: 'prayer' (default when not Ramadan) or 'ramadan' (default during Ramadan)
  const [activeTab, setActiveTab] = useState<'prayer' | 'ramadan'>('prayer');

  // Countdown state
  const [countdownText, setCountdownText] = useState<{ title: string; subtitle?: string; hours: number; minutes: number; seconds: number } | null>(null);

  // Settings
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [sehriMinsBefore, setSehriMinsBefore] = useState(40);
  const [iftarAlertEnabled, setIftarAlertEnabled] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load settings if logged in
        if (localStorage.getItem('token')) {
          try {
            const sRes = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/ramadan/settings`);
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData.district) setSelectedDistrict(sData.district);
              if (sData.ramadanAlerts) {
                setAlertsEnabled(!!sData.ramadanAlerts.enabled);
                setSehriMinsBefore(sData.ramadanAlerts.sehriMinutesBefore || 40);
                setIftarAlertEnabled(!!sData.ramadanAlerts.iftarAlert);
              }
            }
          } catch (e) {}
        }

        // Fetch times
        const res = await fetch(`${import.meta.env.VITE_API_URL}/ramadan/times?district=${selectedDistrict}`);
        if (res.ok) {
          const data = await res.json();
          setTimes(data.times);
          setDistricts(data.districts);
          // Set initial tab based on season
          if (data.times?.isRamadan) {
            setActiveTab('ramadan');
          }
        }

        // Fetch duas
        const dRes = await fetch(`${import.meta.env.VITE_API_URL}/ramadan/duas`);
        if (dRes.ok) {
          const dData = await dRes.json();
          setDuas(dData.duas);
        }
      } catch (err) {
        toast.error('নামাজ ও রোজার সময়সূচি লোড করতে সমস্যা হয়েছে');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update times when district changes
  const handleDistrictChange = async (newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/ramadan/times?district=${newDistrict}`);
      if (res.ok) {
        const data = await res.json();
        setTimes(data.times);
      }
    } catch (e) {}

    // Save to user profile if logged in
    if (localStorage.getItem('token')) {
      try {
        await fetchWithAuth(`${import.meta.env.VITE_API_URL}/ramadan/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ district: newDistrict })
        });
        toast.success(`আপনার জেলা ${newDistrict} সেট করা হয়েছে!`, { icon: '📍' });
      } catch (e) {}
    }
  };

  // Save Alert Settings
  const handleSaveSettings = async () => {
    if (!localStorage.getItem('token')) {
      toast.error('সেটিংস সেভ করতে দয়া করে লগইন করুন');
      return;
    }

    try {
      setSavingSettings(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/ramadan/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district: selectedDistrict,
          ramadanAlerts: {
            enabled: alertsEnabled,
            sehriAlert: alertsEnabled,
            sehriMinutesBefore: sehriMinsBefore,
            iftarAlert: iftarAlertEnabled
          }
        })
      });

      if (res.ok) {
        toast.success('স্বয়ংক্রিয় সতর্কবার্তা আপডেট হয়েছে! 🌙', { icon: '✅' });
      } else {
        toast.error('সেভ করতে ব্যর্থ হয়েছে');
      }
    } catch (e) {
      toast.error('সমস্যা হয়েছে, পরে চেষ্টা করুন');
    } finally {
      setSavingSettings(false);
    }
  };

  // Real-time live countdown
  useEffect(() => {
    if (!times) return;

    const updateCountdown = () => {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const currentSecs = now.getSeconds();

      const [iH, iM] = times.iftar.split(':').map(Number);
      const [sH, sM] = times.sehriEnd.split(':').map(Number);
      const iftarTotalMins = iH * 60 + iM;
      const sehriTotalMins = sH * 60 + sM;

      if (activeTab === 'ramadan' || times.isRamadan) {
        // Fasting / Ramadan countdown
        if (currentMins < iftarTotalMins) {
          const diffSecs = (iftarTotalMins * 60) - (currentMins * 60 + currentSecs);
          const hours = Math.floor(diffSecs / 3600);
          const minutes = Math.floor((diffSecs % 3600) / 60);
          const seconds = diffSecs % 60;
          setCountdownText({ title: 'আজকের ইফতারের বাকি', hours, minutes, seconds });
        } else {
          const tomorrowSehriSecs = ((24 * 60 + sehriTotalMins) * 60) - (currentMins * 60 + currentSecs);
          const hours = Math.floor(tomorrowSehriSecs / 3600);
          const minutes = Math.floor((tomorrowSehriSecs % 3600) / 60);
          const seconds = tomorrowSehriSecs % 60;
          setCountdownText({ title: 'আগামী সেহরির শেষ সময়ের বাকি', hours, minutes, seconds });
        }
      } else if (times.prayers) {
        // Prayer Countdown (Find next prayer)
        const parsePrayerMins = (tStr: string) => {
          const [h, m] = tStr.split(':').map(Number);
          return h * 60 + m;
        };

        const prayerList = [
          { name: 'ফজর', mins: parsePrayerMins(times.prayers.fajr) },
          { name: 'সূর্যোদয়', mins: parsePrayerMins(times.prayers.sunrise) },
          { name: 'জোহর', mins: parsePrayerMins(times.prayers.dhuhr) },
          { name: 'আসর', mins: parsePrayerMins(times.prayers.asr) },
          { name: 'মাগরিব', mins: parsePrayerMins(times.prayers.maghrib) },
          { name: 'এশা', mins: parsePrayerMins(times.prayers.isha) }
        ];

        let nextPrayer = prayerList.find(p => p.mins > currentMins);
        let diffSecs = 0;

        if (nextPrayer) {
          diffSecs = (nextPrayer.mins * 60) - (currentMins * 60 + currentSecs);
        } else {
          // Next is tomorrow's Fajr
          nextPrayer = prayerList[0];
          diffSecs = ((24 * 60 + nextPrayer.mins) * 60) - (currentMins * 60 + currentSecs);
        }

        const hours = Math.floor(diffSecs / 3600);
        const minutes = Math.floor((diffSecs % 3600) / 60);
        const seconds = diffSecs % 60;

        setCountdownText({
          title: `পরবর্তী ওয়াক্ত: ${nextPrayer.name}`,
          subtitle: `${nextPrayer.name} শুরু হতে বাকি`,
          hours,
          minutes,
          seconds
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [times, activeTab]);

  // Share to WhatsApp
  const handleShareToWhatsApp = () => {
    if (!times) return;
    const isRam = activeTab === 'ramadan' || times.isRamadan;
    let text = '';
    if (isRam) {
      text = `🌙 *পবিত্র রমজান সময়সূচি (${times.districtBn} জেলা)* 🌙\n📅 ${times.hijriDay} ${times.hijriMonthName} ${times.hijriYear} হিজরি\n\n⏰ সেহরি শেষ সময়: *${times.sehriFormatted}*\n🍽️ ইফতারের সময়: *${times.iftarFormatted}*\n\n🤲 *ইফতারের দোয়া:*\n"আল্লাহুম্মা লাকা সুমতু ওয়া আলা রিজক্বিকা আফত্বারতু"\n\nস্মৃতি লাইফে স্বয়ংক্রিয় সেহরি ও ইফতার অ্যালার্ম পেতে ভিজিট করুন: https://smritilife.com/app/ramadan`;
    } else {
      text = `🕌 *আজকের ৫ ওয়াক্ত নামাজের সময়সূচি (${times.districtBn} জেলা)*\n📅 ${times.hijriDay} ${times.hijriMonthName} ${times.hijriYear} হিজরি\n\n• ফজর: ${times.prayers?.fajrFormatted || times.fajr}\n• সূর্যোদয়: ${times.prayers?.sunriseFormatted}\n• জোহর: ${times.prayers?.dhuhrFormatted}\n• আসর: ${times.prayers?.asrFormatted}\n• মাগরিব: ${times.prayers?.maghribFormatted || times.iftar}\n• এশা: ${times.prayers?.ishaFormatted}\n\nস্মৃতি লাইফে নামাজের অ্যালার্ম ও নফল রোজার সময়সূচি: https://smritilife.com/app/ramadan`;
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const isRamadanMode = activeTab === 'ramadan' || times?.isRamadan;

  return (
    <div className="bg-[#061512] text-white min-h-screen pb-28 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-[#0a231d] to-[#061512] p-5 pt-7 md:pt-10 pb-8 border-b border-emerald-500/20 shadow-2xl">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-0 right-10 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-0 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto text-center space-y-3">
          
          {/* Mode Pill Badges */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveTab('prayer')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'prayer'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-950/70 text-emerald-300/80 hover:bg-emerald-900/60 border border-emerald-500/20'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>৫ ওয়াক্ত নামাজ</span>
            </button>

            <button
              onClick={() => setActiveTab('ramadan')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ramadan'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30 font-extrabold'
                  : 'bg-emerald-950/70 text-amber-300/80 hover:bg-emerald-900/60 border border-amber-500/20'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{times?.isRamadan ? 'রমজানুল মুবারক' : 'রমজান ও নফল রোজা'}</span>
            </button>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-amber-200 to-emerald-300 drop-shadow-md">
            {activeTab === 'ramadan' || times?.isRamadan ? 'সেহরি ও ইফতার সময়সূচি' : 'দৈনিক ৫ ওয়াক্ত নামাজের সময়সূচি'}
          </h1>
          
          <p className="text-emerald-100/70 text-[11px] md:text-xs font-medium">
            {times ? `${times.hijriDay} ${times.hijriMonthName} ${times.hijriYear} হিজরি • ইসলামিক ফাউন্ডেশন অনুযায়ী নির্ভুল সময়` : 'ইসলামিক ফাউন্ডেশন বাংলাদেশের ৬৪ জেলার নির্ভুল সময়সূচি'}
          </p>

          {/* District Selector Pill */}
          <div className="pt-1 flex items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 bg-emerald-900/70 hover:bg-emerald-900/90 border border-emerald-500/40 px-3.5 py-1 rounded-2xl shadow-inner transition cursor-pointer">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-emerald-200">জেলা:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-1"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.nameEn} className="bg-slate-900 text-white font-medium">
                    {d.nameBn} ({d.nameEn})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-4 relative z-20 space-y-4">
        
        {/* Live Countdown Hero Card */}
        {countdownText && (
          <div className="bg-gradient-to-br from-emerald-900/80 via-emerald-950/90 to-black rounded-3xl p-4 md:p-5 border border-emerald-500/30 shadow-2xl backdrop-blur-md relative overflow-hidden text-center">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-emerald-300/90 text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              {countdownText.subtitle || countdownText.title}
            </p>

            <div className="flex items-center justify-center gap-3 md:gap-4 my-2">
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-t from-emerald-300 to-white">
                  {countdownText.hours.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-emerald-400/70 font-semibold uppercase">ঘণ্টা</span>
              </div>
              <span className="text-2xl font-bold text-emerald-500/60 -mt-3">:</span>
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-t from-emerald-300 to-white">
                  {countdownText.minutes.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-emerald-400/70 font-semibold uppercase">মিনিট</span>
              </div>
              <span className="text-2xl font-bold text-emerald-500/60 -mt-3">:</span>
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-t from-amber-300 to-white">
                  {countdownText.seconds.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-amber-400/70 font-semibold uppercase">সেকেন্ড</span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-200/60 mt-1 italic">
              {activeTab === 'ramadan' || times?.isRamadan
                ? '"ইফতারের পূর্ব মুহূর্ত দোয়ার সর্বোৎকৃষ্ট সময়"'
                : '"নিশ্চয়ই নামাজ মুমিনদের ওপর নির্দিষ্ট সময়ে ফরজ"'}
            </p>
          </div>
        )}

        {/* 5 Daily Prayer Times Grid (Available Year-Round) */}
        {times?.prayers && (
          <div className="bg-[#09221b] rounded-3xl p-4 md:p-5 border border-emerald-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-extrabold text-white flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>আজকের ৫ ওয়াক্ত নামাজের সময় ({times.districtBn})</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-300/80 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-600/30">
                হানাফি মানদণ্ড
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { name: 'ফজর', time: times.prayers.fajrFormatted, sub: `সেহরি শেষ: ${times.sehriEnd}` },
                { name: 'সূর্যোদয়', time: times.prayers.sunriseFormatted, sub: 'ইশরাক শুরু' },
                { name: 'জোহর', time: times.prayers.dhuhrFormatted, sub: 'দুপুর' },
                { name: 'আসর', time: times.prayers.asrFormatted, sub: 'বিকাল' },
                { name: 'মাগরিব', time: times.prayers.maghribFormatted, sub: 'ইফতারের সময়' },
                { name: 'এশা', time: times.prayers.ishaFormatted, sub: 'তারাবিহ ও তাহাজ্জুদ' }
              ].map((p, idx) => (
                <div key={idx} className="bg-emerald-950/60 rounded-2xl p-2.5 border border-emerald-500/15 text-center flex flex-col justify-between hover:border-emerald-400/40 transition">
                  <span className="text-[11px] font-bold text-emerald-300">{p.name}</span>
                  <span className="text-xs md:text-sm font-black text-white font-mono my-0.5">{p.time.replace(/ভোর |সকাল |দুপুর |বিকাল |সন্ধ্যা |রাত /g, '')}</span>
                  <span className="text-[9px] text-emerald-200/60 line-clamp-1">{p.sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dual Cards: Sehri & Iftar (For Ramadan & Year-Round Nafl Fasting) */}
        {times && (
          <div className="grid grid-cols-2 gap-3">
            {/* Sehri Card */}
            <div className="bg-gradient-to-br from-[#0c2e26] to-[#071d18] rounded-3xl p-4 border border-emerald-500/25 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <Moon className="w-4 h-4 text-emerald-400" />
                  <span>সেহরি শেষ সময়</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight mt-1">
                  {times.sehriEnd}
                </h2>
                <p className="text-emerald-300/80 text-xs font-semibold">
                  {times.sehriFormatted}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-emerald-800/40 text-[11px] text-emerald-200/60 flex items-center justify-between">
                <span>ফজরের ওয়াক্ত</span>
                <span className="font-bold text-white font-mono">{times.fajr}</span>
              </div>
            </div>

            {/* Iftar Card */}
            <div className="bg-gradient-to-br from-[#2a2110] to-[#171107] rounded-3xl p-4 border border-amber-500/25 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>ইফতারের সময়</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-amber-200 font-mono tracking-tight mt-1">
                  {times.iftar}
                </h2>
                <p className="text-amber-300/80 text-xs font-semibold">
                  {times.iftarFormatted}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-amber-800/40 text-[11px] text-amber-200/60 flex items-center justify-between">
                <span>মাগরিবের ওয়াক্ত</span>
                <span className="font-bold text-amber-200 font-mono">{times.maghrib}</span>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Automated Alert Controls */}
        <div className="bg-[#09221b] rounded-3xl p-5 border border-emerald-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">হোয়াটসঅ্যাপ অটো সতর্কবার্তা</h3>
                <p className="text-[11px] text-emerald-200/60">সেহরি ও ইফতারের পূর্বে স্বয়ংক্রিয় অ্যালার্ম ও ওয়েক-আপ কল</p>
              </div>
            </div>

            <button
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${alertsEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${alertsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {alertsEnabled && (
            <div className="space-y-3 pt-2 border-t border-emerald-800/30">
              {/* Sehri Timing selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-100 font-medium">সেহরির অ্যালার্ম সময়:</span>
                <select
                  value={sehriMinsBefore}
                  onChange={(e) => setSehriMinsBefore(Number(e.target.value))}
                  className="bg-emerald-950 border border-emerald-600/40 rounded-xl px-2.5 py-1 text-emerald-200 font-bold outline-none cursor-pointer"
                >
                  <option value={30}>৩০ মিনিট আগে</option>
                  <option value={40}>৪০ মিনিট আগে (সেরা)</option>
                  <option value={50}>৫০ মিনিট আগে</option>
                  <option value={60}>১ ঘণ্টা আগে</option>
                </select>
              </div>

              {/* Iftar Notice toggle */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-100 font-medium">ইফতারের ১৫ মিনিট পূর্বে নোটিশ ও দোয়া:</span>
                <input
                  type="checkbox"
                  checked={iftarAlertEnabled}
                  onChange={(e) => setIftarAlertEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full mt-2 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{savingSettings ? 'সেভ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Share to WhatsApp Button */}
        <button
          type="button"
          onClick={handleShareToWhatsApp}
          className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 text-slate-950 font-black text-xs md:text-sm shadow-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>আজকের সময়সূচি হোয়াটসঅ্যাপে বন্ধুদের শেয়ার করুন</span>
        </button>

        {/* Authentic Duas */}
        {duas && (
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-extrabold text-emerald-300 flex items-center gap-1.5 px-1">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              প্রয়োজনীয় দোয়াসমূহ
            </h3>

            {/* Sehri Niyyat */}
            {duas.sehriNiyyat && (
              <div className="bg-[#09221b] rounded-3xl p-5 border border-emerald-500/20 shadow-md space-y-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-amber-400" />
                  {duas.sehriNiyyat.title}
                </span>
                <p className="text-right font-serif text-lg md:text-xl text-emerald-100 leading-relaxed tracking-wide pt-1">
                  {duas.sehriNiyyat.arabic}
                </p>
                <p className="text-xs text-emerald-200/90 font-medium">
                  <strong className="text-white">উচ্চারণ:</strong> {duas.sehriNiyyat.pronunciation}
                </p>
                <p className="text-xs text-slate-300 italic pt-1 border-t border-emerald-800/30">
                  <strong className="text-emerald-300 not-italic">অর্থ:</strong> "{duas.sehriNiyyat.meaning}"
                </p>
              </div>
            )}

            {/* Iftar Dua */}
            {duas.iftarDua && (
              <div className="bg-[#1e1707] rounded-3xl p-5 border border-amber-500/20 shadow-md space-y-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-amber-400" />
                  {duas.iftarDua.title}
                </span>
                <p className="text-right font-serif text-lg md:text-xl text-amber-100 leading-relaxed tracking-wide pt-1">
                  {duas.iftarDua.arabic}
                </p>
                <p className="text-xs text-amber-200/90 font-medium">
                  <strong className="text-white">উচ্চারণ:</strong> {duas.iftarDua.pronunciation}
                </p>
                <p className="text-xs text-slate-300 italic pt-1 border-t border-amber-800/30">
                  <strong className="text-amber-300 not-italic">অর্থ:</strong> "{duas.iftarDua.meaning}"
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
