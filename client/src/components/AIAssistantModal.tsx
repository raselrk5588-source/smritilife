import { useState, useEffect } from 'react';
import { X, Mic, MessageSquare, Calendar, Clock, BellRing, Edit, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AIAssistantModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'parsed'>('idle');
  const [isEditing, setIsEditing] = useState(false);
  const [parsedText, setParsedText] = useState('আগামীকাল সকাল ১০ টায় রাহিম ভাইকে\nফোন করতে মনে করিয়ে দিও');
  const [liveTranscript, setLiveTranscript] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('idle');
      setIsEditing(false);
      setParsedText('আগামীকাল সকাল ১০ টায় রাহিম ভাইকে\nফোন করতে মনে করিয়ে দিও');
      setLiveTranscript('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMicClick = () => {
    if (mode === 'idle') {
      setMode('listening');
      setLiveTranscript('');
      
      const fullText = "আগামীকাল সকাল ১০ টায় রাহিম ভাইকে ফোন করতে মনে করিয়ে দিও...";
      let currentIndex = 0;
      
      const typingInterval = setInterval(() => {
        if (currentIndex <= fullText.length) {
          setLiveTranscript(fullText.slice(0, currentIndex));
          currentIndex++;
        }
      }, 50);

      // Simulate listening for 3 seconds
      setTimeout(() => {
        clearInterval(typingInterval);
        setMode('processing');
        // Simulate processing for 1.5 seconds
        setTimeout(() => {
          setMode('parsed');
        }, 1500);
      }, 3000);
    }
  };

  const handleSetReminder = () => {
    toast.success('রিমাইন্ডার সফলভাবে সেট করা হয়েছে!');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f0fcf5] font-sans animate-in slide-in-from-bottom-full duration-300">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-10 -left-10 w-40 h-40 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="absolute top-40 -right-10 w-40 h-40 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

      {/* Header */}
      <div className="flex justify-between items-center p-6 relative z-10">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-slate-800">Smriti <span className="font-medium text-slate-600 text-sm">(স্মৃতি)</span></h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:bg-slate-50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 relative z-10 flex flex-col items-center">
        
        {/* Giant Mic Button */}
        <div className="relative mt-4 mb-4">
          {mode === 'listening' && (
            <>
              <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
              <div className="absolute inset-[-15px] bg-emerald-200 rounded-full opacity-30 animate-pulse"></div>
              <div className="absolute inset-[-30px] bg-emerald-100 rounded-full opacity-40 animate-pulse"></div>
            </>
          )}
          
          <button 
            onClick={handleMicClick}
            disabled={mode !== 'idle'}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 ${
              mode === 'idle' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-emerald-500/30' : 
              mode === 'listening' ? 'bg-gradient-to-b from-red-400 to-red-600 shadow-red-500/30' :
              'bg-emerald-200 cursor-not-allowed'
            }`}
          >
            {mode === 'processing' ? <Loader2 className="w-10 h-10 animate-spin" /> : <Mic className="w-10 h-10" />}
          </button>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {mode === 'idle' ? 'বলুন...' : 
           mode === 'listening' ? 'শুনছি...' : 
           mode === 'processing' ? 'প্রসেস করছি...' : 'ফলাফল'}
        </h2>
        <p className="text-xs text-slate-500 font-medium mb-6 text-center">
          {mode === 'idle' ? 'ভয়েস আইকনে ক্লিক করে কথা বলুন' : 
           mode === 'listening' ? 'আপনার রিমাইন্ডারটি বলুন' : 
           mode === 'processing' ? 'দয়া করে অপেক্ষা করুন' : 'আপনার ভয়েস থেকে তৈরি রিমাইন্ডার'}
        </p>

        {/* Audio Wave (Simulated) */}
        {mode === 'listening' && (
          <div className="flex flex-col items-center w-full max-w-sm mb-6 animate-in fade-in duration-300">
            <div className="flex items-center space-x-1 h-8 mb-4">
              <div className="w-1 h-2 bg-red-200 rounded-full animate-pulse"></div>
              <div className="w-1 h-3 bg-red-300 rounded-full animate-bounce"></div>
              <div className="w-1 h-5 bg-red-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-6 bg-red-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-8 bg-red-600 rounded-full animate-pulse"></div>
              <div className="w-1 h-6 bg-red-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-7 bg-red-600 rounded-full animate-pulse"></div>
              <div className="w-1 h-5 bg-red-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-3 bg-red-300 rounded-full animate-bounce"></div>
              <div className="w-1 h-2 bg-red-200 rounded-full animate-pulse"></div>
            </div>
            
            {/* Live Preview Text */}
            <div className="bg-white/60 px-4 py-3 rounded-2xl border border-emerald-100 shadow-sm w-full min-h-[60px] flex items-center justify-center">
              <p className="text-sm font-medium text-slate-700 italic text-center">
                {liveTranscript || "..."}
              </p>
            </div>
          </div>
        )}

        {/* Parsed Result Card */}
        {mode === 'parsed' && (
          <div className="w-full bg-white rounded-3xl p-4 shadow-sm border border-emerald-50 mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center font-bold text-emerald-700 text-xs">
                <MessageSquare className="w-4 h-4 mr-1.5" />
                আপনার কথা
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setMode('idle')}
                  className="flex items-center text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> মুছে ফেলুন
                </button>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full hover:bg-emerald-100 transition"
                >
                  <Edit className="w-3 h-3 mr-1" /> {isEditing ? 'সেভ করুন' : 'সম্পাদনা'}
                </button>
              </div>
            </div>
            
            {isEditing ? (
              <textarea 
                value={parsedText}
                onChange={(e) => setParsedText(e.target.value)}
                className="w-full bg-white p-3 rounded-2xl mb-3 text-slate-700 font-medium text-xs leading-relaxed border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none min-h-[80px]"
                autoFocus
              />
            ) : (
              <div className="bg-[#f8fbf9] p-3 rounded-2xl mb-3 text-slate-700 font-medium text-xs leading-relaxed border border-emerald-50 whitespace-pre-wrap">
                {parsedText}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center text-slate-600 font-medium text-xs">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="w-12">তারিখ</span>
                  <span className="text-slate-800">
                    {(() => {
                      const tomorrow = new Date(Date.now() + 86400000);
                      const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
                      const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
                      const toBn = (num: number) => num.toString().split('').map(d => bnNumbers[parseInt(d)] || d).join('');
                      return `আগামীকাল (${toBn(tomorrow.getDate())} ${months[tomorrow.getMonth()]}, ${toBn(tomorrow.getFullYear())})`;
                    })()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-slate-600 font-medium text-xs">
                  <Clock className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="w-12">সময়</span>
                  <span className="text-slate-800">সকাল ১০:০০</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {mode === 'parsed' && (
          <button 
            onClick={handleSetReminder}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm py-3.5 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-transform animate-in fade-in zoom-in duration-500"
          >
            <BellRing className="w-4 h-4 mr-2" />
            রিমাইন্ডার সেট করুন
          </button>
        )}
      </div>
    </div>
  );
}
