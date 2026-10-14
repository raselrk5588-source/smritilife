import React, { useState, useEffect, useRef } from 'react';
import { BellRing, Check, Clock, Moon, Sparkles, Volume2, VolumeX, SunMedium } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';

interface ActiveAlarm {
  _id: string;
  title: string;
  time: string;
  category: string;
  isAlarm?: boolean;
}

class AlarmAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  public isPlaying = false;

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const playBeep = (freq: number, duration: number, delayMs: number, type: OscillatorType = 'triangle') => {
        setTimeout(() => {
          if (!this.ctx || !this.isPlaying) return;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
          } catch (err) {
            console.error('Audio play error:', err);
          }
        }, delayMs);
      };

      // Play urgent alarm cycle: Beep-Beep-Beep-Chime every 1.2 seconds
      const runAlarmCycle = () => {
        if (!this.isPlaying) return;
        playBeep(880, 0.12, 0, 'sawtooth');    // A5
        playBeep(880, 0.12, 140, 'sawtooth');  // A5
        playBeep(1046, 0.14, 280, 'sawtooth'); // C6
        playBeep(1318, 0.28, 440, 'triangle'); // E6 chime
      };

      runAlarmCycle();
      this.intervalId = setInterval(runAlarmCycle, 1100);
    } catch (e) {
      console.error('Web Audio initialization error:', e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }
}

const alarmSynthesizer = new AlarmAudioSynthesizer();

export default function WakeUpAlarmModal() {
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [dismissedAlarms, setDismissedAlarms] = useState<Record<string, boolean>>({});
  const vibrationIntervalRef = useRef<any>(null);

  // Live real-time clock string
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll reminders to check for wake-up alarms
  useEffect(() => {
    const checkAlarms = async () => {
      if (activeAlarm) return; // Already ringing
      if (!localStorage.getItem('token')) return;

      try {
        const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders`);
        if (!res.ok) return;

        const reminders = await res.json();
        const now = new Date();
        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime24 = `${currentHours}:${currentMinutes}`;
        const todayStr = now.toISOString().split('T')[0];

        for (const rem of reminders) {
          const isWakeup = rem.category === 'wakeup' || rem.category === 'alarm' || !!rem.isAlarm;
          if (!isWakeup) continue;
          if (rem.status === 'Completed' || rem.status === 'Cancelled') continue;
          if (dismissedAlarms[rem._id]) continue;

          // Check if due today
          const remDateStr = rem.date ? new Date(rem.date).toISOString().split('T')[0] : '';
          const isToday = remDateStr === todayStr || !rem.date;

          if (isToday && rem.time === currentTime24) {
            triggerAlarm(rem);
            break;
          }
        }
      } catch (err) {
        // Silently catch background poll error
      }
    };

    const interval = setInterval(checkAlarms, 10000);
    checkAlarms(); // Initial check

    return () => clearInterval(interval);
  }, [activeAlarm, dismissedAlarms]);

  const triggerAlarm = (rem: ActiveAlarm) => {
    setActiveAlarm(rem);
    alarmSynthesizer.start();

    // Start device vibration
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([1000, 400, 1000, 400, 1000]);
        vibrationIntervalRef.current = setInterval(() => {
          if ('vibrate' in navigator) {
            navigator.vibrate([1000, 400, 1000, 400, 1000]);
          }
        }, 3500);
      } catch (e) {}
    }
  };

  const stopAlarmSoundAndVibration = () => {
    alarmSynthesizer.stop();
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  };

  // User dismissed / awake
  const handleAwakeDismiss = async () => {
    if (!activeAlarm) return;
    const alarmId = activeAlarm._id;
    stopAlarmSoundAndVibration();
    setDismissedAlarms(prev => ({ ...prev, [alarmId]: true }));
    setActiveAlarm(null);

    try {
      await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${alarmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
      toast.success('☀️ শুভ সকাল! দিনটি আপনার জন্য সফল ও আনন্দময় হোক!', { duration: 5000 });
    } catch (e) {
      toast.success('অ্যালার্ম বন্ধ করা হয়েছে');
    }
  };

  // Snooze 5 minutes
  const handleSnooze = async () => {
    if (!activeAlarm) return;
    const alarmId = activeAlarm._id;
    stopAlarmSoundAndVibration();

    // Calculate time + 5 minutes
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const newTime = `${h}:${m}`;

    setDismissedAlarms(prev => ({ ...prev, [alarmId]: true }));
    setActiveAlarm(null);

    try {
      await fetchWithAuth(`${import.meta.env.VITE_API_URL}/reminders/${alarmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: newTime, status: 'Pending' })
      });
      toast('⏰ ৫ মিনিটের জন্য স্নুজ করা হলো', { icon: '💤', duration: 4000 });
    } catch (e) {
      toast('স্নুজ করা হয়েছে');
    }
  };

  if (!activeAlarm) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-b from-amber-950 via-slate-950 to-black text-white flex flex-col justify-between items-center p-6 md:p-12 animate-in fade-in duration-300 select-none">
      
      {/* Background Animated Glowing Rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[340px] h-[340px] md:w-[500px] md:h-[500px] rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
        <div className="w-[200px] h-[200px] md:w-[320px] md:h-[320px] rounded-full bg-rose-500/20 blur-2xl animate-ping opacity-30" />
      </div>

      {/* Top Header Badge */}
      <div className="relative z-10 pt-4 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 backdrop-blur-md shadow-lg shadow-amber-500/10 text-amber-300 font-bold text-xs uppercase tracking-widest animate-pulse">
          <SunMedium className="w-4 h-4 text-amber-400" />
          <span>ওয়েক-আপ অ্যালার্ম • শুভ সকাল!</span>
        </div>
      </div>

      {/* Center Alarm Core: Dynamic Live Clock + Pulsing Icon + Title */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto py-6 space-y-5">
        
        {/* Pulsing Alarm Bell Icon */}
        <div className="relative">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-rose-500/40 ring-4 ring-white/20 animate-bounce">
            <BellRing className="w-12 h-12 md:w-14 md:h-14 text-white drop-shadow-md" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 border-2 border-white items-center justify-center text-[10px] font-black">!</span>
          </span>
        </div>

        {/* Big Live Clock */}
        <div className="space-y-1">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 drop-shadow-lg font-mono">
            {currentTimeStr || activeAlarm.time}
          </h1>
          <p className="text-amber-200/80 text-xs md:text-sm font-semibold tracking-wider">
            ⏰ ঘুম থেকে ওঠার নির্ধারিত সময়
          </p>
        </div>

        {/* Alarm Title Box */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 px-6 py-3.5 rounded-2xl max-w-sm shadow-xl">
          <h3 className="text-lg md:text-xl font-extrabold text-white leading-snug">
            {activeAlarm.title || 'ঘুম থেকে ওঠা'}
          </h3>
          <p className="text-xs text-slate-300 mt-1 italic">
            "নতুন দিনে আপনাকে স্বাগতম, আপনার লক্ষ্যগুলো পূরণ হোক!"
          </p>
        </div>
      </div>

      {/* Bottom Action Buttons: Wake Up & Snooze */}
      <div className="relative z-10 w-full max-w-sm space-y-3 pb-6">
        {/* Primary: I'm Awake / Stop Alarm */}
        <button
          type="button"
          onClick={handleAwakeDismiss}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-black text-base md:text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer border border-emerald-400/30"
        >
          <Check className="w-6 h-6 stroke-[3]" />
          <span>জেগে গেছি (অ্যালার্ম বন্ধ করুন)</span>
        </button>

        {/* Secondary: 5 Minutes Snooze */}
        <button
          type="button"
          onClick={handleSnooze}
          className="w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-slate-200 hover:text-white font-bold text-sm shadow-md backdrop-blur-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer border border-white/20"
        >
          <Moon className="w-4 h-4 text-amber-300" />
          <span>৫ মিনিট স্নুজ করুন (Snooze)</span>
        </button>
      </div>

    </div>
  );
}
