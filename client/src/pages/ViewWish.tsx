import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Heart } from 'lucide-react';

export default function ViewWish() {
  const { id } = useParams();
  const [showContent, setShowContent] = useState(false);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [wishData, setWishData] = useState({
    image: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=80&w=600&auto=format&fit=crop',
    title: 'শুভ জন্মদিন',
    recipient: 'প্রিয় বন্ধু,',
    message: 'তোমার এই বিশেষ দিনে অনেক অনেক ভালোবাসা ও শুভকামনা। জীবন হোক সুন্দর ও আনন্দময়!',
    sender: 'রিয়াদ',
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
          setWishData({
            image: data.cardData?.image || wishData.image,
            title: data.cardData?.title || wishData.title,
            recipient: data.recipientName || wishData.recipient,
            message: data.message || wishData.message,
            sender: data.cardData?.senderName || 'আপনার শুভাকাঙ্ক্ষী', 
            occasion: data.occasion || wishData.occasion,
            shape: data.cardData?.shape || wishData.shape,
            animation: data.cardData?.animation || 'envelope',
            signOff: data.cardData?.signOff || 'ভালোবাসা অন্তে,',
            music: data.cardData?.music || 'none'
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWish();
  }, [id]);

  const handleOpenEnvelope = () => {
    setEnvelopeOpen(true);
    
    // Play sound based on music preference
    try {
      let audioSrc = '';
      if (wishData.music && wishData.music !== 'none') {
        audioSrc = `/music/${wishData.music}.mp3`;
      } else {
        audioSrc = 'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg'; // Default magic sound when opening envelope
      }
      const audio = new Audio(audioSrc);
      audio.volume = 0.5;
      if (wishData.music !== 'none') {
        audio.loop = true; // Loop background music
      }
      audio.play().catch(() => console.log('Audio playback prevented by browser'));
    } catch(e) {}

    setTimeout(() => {
      setShowContent(true);
    }, 800);
  };

  const getDecorations = (occasion: string) => {
    switch (occasion) {
      case 'birthday':
        return {
          bg: 'from-indigo-900 via-purple-900 to-fuchsia-900',
          glow: 'from-purple-400 to-pink-500',
          floating: ['🎈', '🎉', '🎁', '🎂', '✨'],
          icon: '🎂'
        };
      case 'anniversary':
        return {
          bg: 'from-rose-900 via-red-900 to-pink-900',
          glow: 'from-rose-400 to-pink-500',
          floating: ['❤️', '💖', '✨', '💍'],
          icon: '💍'
        };
      case 'eid':
        return {
          bg: 'from-emerald-900 via-teal-900 to-cyan-900',
          glow: 'from-emerald-400 to-teal-500',
          floating: ['🌙', '✨', '🕌', '🌟'],
          icon: '🌙'
        };
      case 'newyear':
        return {
          bg: 'from-blue-900 via-indigo-900 to-violet-900',
          glow: 'from-blue-400 to-indigo-500',
          floating: ['🎆', '🎇', '✨', '🎉'],
          icon: '🎆'
        };
      case 'valentine':
        return {
          bg: 'from-pink-900 via-rose-900 to-red-900',
          glow: 'from-pink-400 to-red-500',
          floating: ['💖', '💘', '🌹', '✨', '❤️'],
          icon: '💖'
        };
      case 'mothersday':
        return {
          bg: 'from-purple-900 via-fuchsia-900 to-pink-900',
          glow: 'from-purple-400 to-pink-500',
          floating: ['🤱', '🌸', '💖', '✨', '💐'],
          icon: '🤱'
        };
      case 'fathersday':
        return {
          bg: 'from-blue-900 via-cyan-900 to-teal-900',
          glow: 'from-blue-400 to-cyan-500',
          floating: ['👨‍👧', '👨‍👦', '💙', '✨', '🌟'],
          icon: '👔'
        };
      default:
        return {
          bg: 'from-slate-900 via-blue-900 to-indigo-900',
          glow: 'from-amber-400 to-orange-500',
          floating: ['✨', '🌸', '💫', '🎉'],
          icon: '🎉'
        };
    }
  };

  const deco = getDecorations(wishData.occasion);

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading your surprise...</div>;
  }

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br ${deco.bg} flex flex-col items-center justify-center p-4`}>
      
      {/* Background Animations */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {envelopeOpen && (
          Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={i} 
              className="absolute text-4xl animate-float opacity-40" 
              style={{ 
                left: `${Math.random() * 100}%`, 
                top: `${100 + Math.random() * 20}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 8}s`
              }}
            >
              {deco.floating[Math.floor(Math.random() * deco.floating.length)]}
            </div>
          ))
        )}
      </div>

      <AnimatePresence mode="wait">
        {!envelopeOpen && wishData.animation === 'envelope' ? (
          <motion.div
            key="envelope"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0, y: -100, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            onClick={handleOpenEnvelope}
            className="relative z-20 cursor-pointer flex flex-col items-center group"
          >
            <div className="relative w-64 h-48 bg-amber-100 rounded-lg shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
              {/* Envelope Flap (Closed) */}
              <div className="absolute top-0 left-0 w-full h-1/2 bg-amber-200 origin-top transform rotate-x-0 z-20 border-b border-amber-300 shadow-md flex justify-center items-end pb-2">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-red-600 animate-pulse">
                  <Heart className="text-white w-6 h-6 fill-current" />
                </div>
              </div>
              {/* Envelope Body */}
              <div className="absolute inset-0 bg-amber-50 shadow-inner z-10 flex items-center justify-center pt-8">
                <p className="text-amber-800/50 font-serif font-bold text-xl italic px-4 text-center">{wishData.recipient && wishData.recipient !== 'Unknown' ? wishData.recipient : 'For You'}</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent z-30 pointer-events-none"></div>
            </div>
            <p className="mt-8 text-white/90 font-bold tracking-widest uppercase animate-pulse text-sm">Tap to Open</p>
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.5, y: 100, rotateX: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1, delay: 0.2, type: "spring", bounce: 0.4 }}
            className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md rounded-[2.5rem] p-8 shadow-2xl border border-white/20"
          >
            {/* Image Container with Glow */}
            <div className="relative w-48 h-48 mx-auto mb-8">
              <div className={`absolute inset-0 bg-gradient-to-r ${deco.glow} blur-xl opacity-60 animate-pulse ${wishData.shape === 'round' ? 'rounded-full' : wishData.shape === 'rounded' ? 'rounded-3xl' : wishData.shape === 'heart' ? '' : 'rounded-none'}`}></div>
              <div 
                className={`w-full h-full shadow-2xl relative z-10 ${wishData.shape === 'round' ? 'rounded-full border-4 border-white/30 overflow-hidden' : wishData.shape === 'rounded' ? 'rounded-3xl border-4 border-white/30 overflow-hidden' : wishData.shape === 'heart' ? 'overflow-visible' : 'rounded-none border-4 border-white/30 overflow-hidden'}`}
                style={wishData.shape === 'heart' ? { WebkitMaskImage: 'url(\'data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>\')', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', backgroundColor: 'rgba(255,255,255,0.3)' } : {}}
              >
                <img 
                  src={wishData.image} 
                  alt="Greeting" 
                  className={`w-full h-full object-cover ${wishData.shape === 'heart' ? 'border-none' : ''}`}
                />
              </div>
              <div className="absolute -bottom-4 -right-4 text-6xl z-20 animate-bounce drop-shadow-xl">{deco.icon}</div>
            </div>

            {/* Text Content */}
            <div className="text-center space-y-6">
              <h1 
                className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-md leading-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {wishData.title}
              </h1>
              
              <div className="w-20 h-1 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent mx-auto rounded-full"></div>
              
              <div className="px-2">
                {wishData.recipient && wishData.recipient !== 'Unknown' && (
                  <p className="text-amber-100 font-bold text-2xl mb-3 drop-shadow-sm">{wishData.recipient}</p>
                )}
                <p className="text-white text-xl leading-relaxed font-medium drop-shadow-sm whitespace-pre-line">
                  {wishData.message}
                </p>
              </div>
              
              <div className="pt-6 pb-2">
                <p className="text-white/70 text-sm font-medium">{wishData.signOff}</p>
                <p className="text-amber-300 font-bold text-2xl mt-1 drop-shadow-sm">{wishData.sender}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Powered by footer */}
      <div className="fixed bottom-6 text-center w-full z-10 opacity-50">
        <p className="text-white text-xs font-medium tracking-wide">Made with ❤️ using <Link to="/" className="font-bold underline hover:text-amber-300 transition-colors">Smriti (স্মৃতি)</Link></p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-1200px) rotate(360deg); opacity: 0; }
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
