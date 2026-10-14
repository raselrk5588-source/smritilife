import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Volume2, VolumeX, Sparkles } from 'lucide-react';

const cleanMessage = (text: string) => {
  if (!text) return '';
  // Remove any raw URLs accidentally injected into the message body
  return text.replace(/https?:\/\/[^\s]+/gi, '').trim();
};

export default function ViewWish() {
  const { id } = useParams();
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [wishData, setWishData] = useState({
    image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=600&auto=format&fit=crop',
    title: 'শুভ জন্মদিন',
    recipient: '',
    message: 'তোমার এই বিশেষ দিনে অনেক অনেক ভালোবাসা ও শুভকামনা। জীবন হোক সুন্দর ও আনন্দময়!',
    sender: 'আপনার শুভাকাঙ্ক্ষী',
    occasion: 'birthday',
    shape: 'round',
    animation: 'envelope',
    signOff: 'ভালোবাসা অন্তে,',
    music: 'none'
  });

  useEffect(() => {
    const fetchWish = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/wishes/public/${id}`);
        if (res.ok) {
          const data = await res.json();
          setWishData(prev => ({
            image: data.cardData?.image || prev.image,
            title: data.cardData?.title || (data.occasion === 'birthday' ? 'শুভ জন্মদিন' : data.occasion === 'anniversary' ? 'শুভ বিবাহ বার্ষিকী' : 'শুভেচ্ছা'),
            recipient: (data.recipientName && data.recipientName !== 'Unknown') ? data.recipientName : '',
            message: cleanMessage(data.message) || prev.message,
            sender: data.cardData?.senderName || 'আপনার শুভাকাঙ্ক্ষী',
            occasion: data.occasion || prev.occasion,
            shape: data.cardData?.shape || prev.shape,
            animation: data.cardData?.animation || 'envelope',
            signOff: data.cardData?.signOff || 'ভালোবাসা অন্তে,',
            music: data.cardData?.music || 'none'
          }));
        }
      } catch (err) {
        console.error('Error fetching wish:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWish();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [id]);

  const handleOpenEnvelope = () => {
    setEnvelopeOpen(true);
    
    // Play sound based on music preference
    try {
      let audioSrc = '';
      if (wishData.music && wishData.music !== 'none') {
        audioSrc = `/music/${wishData.music}.mp3`;
      } else {
        audioSrc = 'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg';
      }
      const audio = new Audio(audioSrc);
      audio.volume = 0.5;
      if (wishData.music !== 'none') {
        audio.loop = true;
      }
      audioRef.current = audio;
      audio.play().catch(() => console.log('Audio playback prevented by browser'));
    } catch (e) {}
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch(() => {});
        setIsMuted(false);
      } else {
        audioRef.current.pause();
        setIsMuted(true);
      }
    }
  };

  const getDecorations = (occasion: string) => {
    switch (occasion) {
      case 'birthday':
        return {
          bg: 'from-indigo-950 via-purple-900 to-slate-950',
          glow: 'from-amber-400 to-pink-500',
          floating: ['🎈', '🎉', '🎁', '🎂', '✨', '⭐'],
          icon: '🎂'
        };
      case 'anniversary':
        return {
          bg: 'from-rose-950 via-red-950 to-slate-950',
          glow: 'from-rose-400 to-pink-500',
          floating: ['❤️', '💖', '✨', '💍', '🌹'],
          icon: '💍'
        };
      case 'eid':
        return {
          bg: 'from-emerald-950 via-teal-900 to-slate-950',
          glow: 'from-emerald-400 to-teal-500',
          floating: ['🌙', '✨', '🕌', '🌟', '💫'],
          icon: '🌙'
        };
      case 'newyear':
        return {
          bg: 'from-blue-950 via-indigo-900 to-slate-950',
          glow: 'from-blue-400 to-indigo-500',
          floating: ['🎆', '🎇', '✨', '🎉', '🥂'],
          icon: '🎆'
        };
      case 'valentine':
        return {
          bg: 'from-pink-950 via-rose-900 to-slate-950',
          glow: 'from-pink-400 to-red-500',
          floating: ['💖', '💘', '🌹', '✨', '❤️'],
          icon: '💖'
        };
      case 'mothersday':
        return {
          bg: 'from-purple-950 via-fuchsia-900 to-slate-950',
          glow: 'from-purple-400 to-pink-500',
          floating: ['🤱', '🌸', '💖', '✨', '💐'],
          icon: '🌸'
        };
      case 'fathersday':
        return {
          bg: 'from-blue-950 via-cyan-900 to-slate-950',
          glow: 'from-blue-400 to-cyan-500',
          floating: ['👨‍👧', '👨‍👦', '💙', '✨', '🌟'],
          icon: '👔'
        };
      default:
        return {
          bg: 'from-slate-950 via-indigo-950 to-blue-950',
          glow: 'from-amber-400 to-orange-500',
          floating: ['✨', '🌸', '💫', '🎉', '🎁'],
          icon: '🎉'
        };
    }
  };

  const deco = getDecorations(wishData.occasion);
  const displayMessage = cleanMessage(wishData.message);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"></div>
        <p className="text-amber-200 text-sm font-medium animate-pulse">আপনার শুভেচ্ছা কার্ডটি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-y-auto bg-gradient-to-br ${deco.bg} flex flex-col items-center justify-between p-4 sm:p-6 text-white selection:bg-amber-400 selection:text-slate-900`}>
      
      {/* Background Floating Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {envelopeOpen && (
          Array.from({ length: 24 }).map((_, i) => (
            <div 
              key={i} 
              className="absolute text-3xl sm:text-4xl animate-float opacity-35" 
              style={{ 
                left: `${(i * 17) % 95}%`, 
                top: `${100 + (i * 7) % 30}%`,
                animationDelay: `${(i * 0.4) % 4}s`,
                animationDuration: `${5 + (i * 0.5) % 6}s`
              }}
            >
              {deco.floating[i % deco.floating.length]}
            </div>
          ))
        )}
      </div>

      {/* Floating Audio Mute Toggle Button */}
      {envelopeOpen && wishData.music !== 'none' && (
        <button
          onClick={toggleMute}
          title={isMuted ? 'মিউজিক চালু করুন' : 'মিউজিক বন্ধ করুন'}
          className="fixed top-4 right-4 z-40 p-3 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white hover:bg-white/25 transition-all shadow-lg active:scale-95"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-300" /> : <Volume2 className="w-5 h-5 text-amber-300 animate-pulse" />}
        </button>
      )}

      {/* Top Spacer / Brand */}
      <div className="w-full flex justify-center items-center py-2 relative z-20">
        <span className="text-[11px] font-bold tracking-widest uppercase text-white/50 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Smriti Life Greeting
        </span>
      </div>

      {/* Central Content (Envelope or Opened Card) */}
      <div className="w-full flex items-center justify-center my-auto py-4 relative z-10">
        <AnimatePresence mode="wait">
          {!envelopeOpen && wishData.animation === 'envelope' ? (
            <motion.div
              key="envelope"
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.3, opacity: 0, y: -80, filter: 'blur(12px)' }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              onClick={handleOpenEnvelope}
              className="relative z-20 cursor-pointer flex flex-col items-center group py-8"
            >
              <div className="relative w-72 sm:w-84 h-56 sm:h-60 bg-gradient-to-b from-[#fef9ee] to-[#fbf0d9] rounded-2xl shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500 border-2 border-amber-300/80">
                {/* Envelope Flap with crisp triangle SVG fold */}
                <div className="absolute top-0 left-0 w-full h-24 sm:h-26 z-20 pointer-events-none">
                  <svg className="w-full h-full drop-shadow-md" viewBox="0 0 320 100" preserveAspectRatio="none">
                    <polygon points="0,0 320,0 160,100" className="fill-[#fde68a] stroke-[#f59e0b] stroke-[1.5]" />
                  </svg>
                </div>

                {/* Wax Seal centered on the flap tip */}
                <div className="absolute top-[72px] sm:top-[76px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500 via-rose-600 to-red-700 rounded-full flex items-center justify-center shadow-xl border-2 border-red-300 ring-4 ring-red-400/25 animate-pulse">
                    <Heart className="text-white w-6 h-6 sm:w-7 sm:h-7 fill-current drop-shadow-xs" />
                  </div>
                </div>

                {/* Envelope Lower Area: Fully visible, high-contrast Recipient Details */}
                <div className="absolute inset-x-0 bottom-0 h-28 z-10 flex flex-col items-center justify-center px-4 pb-3 text-center space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/90 border border-amber-300/80 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                    <span className="text-xs font-black text-amber-950 tracking-wider">
                      আপনার জন্য একটি বিশেষ চিঠি
                    </span>
                  </div>
                  <p className="text-amber-950 font-serif font-black text-xl sm:text-2xl italic tracking-wide leading-tight drop-shadow-2xs line-clamp-1">
                    {wishData.recipient ? wishData.recipient : 'প্রিয় বন্ধু'}
                  </p>
                </div>
              </div>
              <p className="mt-6 text-white/95 font-bold tracking-widest uppercase animate-pulse text-xs sm:text-sm bg-white/10 px-5 py-2.5 rounded-full border border-white/20 shadow-md flex items-center gap-2">
                <span>চিঠিটি খুলতে ট্যাপ করুন</span>
                <span>✨</span>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, scale: 0.7, y: 60, rotateX: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.35 }}
              className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-white/20"
            >
              {/* Image Container with Glow */}
              <div className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto mb-6">
                <div className={`absolute inset-0 bg-gradient-to-r ${deco.glow} blur-2xl opacity-60 animate-pulse ${wishData.shape === 'round' ? 'rounded-full' : wishData.shape === 'rounded' ? 'rounded-3xl' : wishData.shape === 'heart' ? '' : 'rounded-none'}`}></div>
                <div 
                  className={`w-full h-full shadow-2xl relative z-10 ${wishData.shape === 'round' ? 'rounded-full border-4 border-white/40 overflow-hidden ring-4 ring-white/15' : wishData.shape === 'rounded' ? 'rounded-3xl border-4 border-white/40 overflow-hidden ring-4 ring-white/15' : wishData.shape === 'heart' ? 'overflow-visible' : 'rounded-none border-4 border-white/40 overflow-hidden'}`}
                  style={wishData.shape === 'heart' ? { WebkitMaskImage: 'url(\'data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>\')', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', backgroundColor: 'rgba(255,255,255,0.3)' } : {}}
                >
                  <img 
                    src={wishData.image} 
                    alt="Greeting" 
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Occasion Badge */}
                <div className="absolute -bottom-2 -right-2 text-4xl sm:text-5xl z-20 animate-bounce drop-shadow-xl select-none">
                  {deco.icon}
                </div>
              </div>

              {/* Text Content */}
              <div className="text-center space-y-4 sm:space-y-5">
                <h1 
                  className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 drop-shadow-md leading-tight"
                >
                  {wishData.title}
                </h1>
                
                <div className="w-20 h-1 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent mx-auto rounded-full"></div>
                
                {wishData.recipient && (
                  <p className="text-amber-100 font-bold text-xl sm:text-2xl drop-shadow-sm tracking-wide">
                    {wishData.recipient}
                  </p>
                )}

                {/* Clean Heartfelt Message Box */}
                {displayMessage && (
                  <div className="bg-black/25 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 shadow-inner">
                    <p className="text-white/95 text-base sm:text-lg leading-relaxed font-normal whitespace-pre-line text-center">
                      {displayMessage}
                    </p>
                  </div>
                )}
                
                {/* Sign-off & Sender */}
                <div className="pt-2">
                  <p className="text-white/70 text-xs sm:text-sm font-medium">{wishData.signOff}</p>
                  <p className="text-amber-300 font-bold text-xl sm:text-2xl mt-0.5 drop-shadow-sm">{wishData.sender}</p>
                </div>

                {/* Subscription CTA for Recipient */}
                <div className="pt-4 border-t border-white/15">
                  <Link
                    to="/paywall"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-xl hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
                    <span>নিজের জন্য বা প্রিয়জনকে উইশ পাঠাতে সাবস্ক্রাইব করুন</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Powered by footer (In natural document flow, never overlapping) */}
      <footer className="w-full text-center py-4 relative z-10">
        <p className="text-white/75 text-xs font-medium tracking-wide">
          Made with ❤️ using{' '}
          <Link to="/paywall" className="font-bold underline text-amber-300 hover:text-amber-200 transition-colors">
            Smriti Life - সাবস্ক্রিপশন নিন
          </Link>
        </p>
      </footer>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.45; }
          90% { opacity: 0.45; }
          100% { transform: translateY(-1100px) rotate(360deg); opacity: 0; }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}

