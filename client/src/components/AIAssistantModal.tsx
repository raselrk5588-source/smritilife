import { useState, useEffect } from 'react';
import { X, Mic, MessageSquare, Calendar, Clock, BellRing, Edit, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AIAssistantModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'parsed'>('idle');
  const [isEditing, setIsEditing] = useState(false);
  const [parsedText, setParsedText] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('idle');
      setIsEditing(false);
      setParsedText('');
      setLiveTranscript('');
      setParsedData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMicClick = () => {
    if (mode !== 'idle') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('আপনার ব্রাউজার ভয়েস রিকগনিশন সাপোর্ট করে না!');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setMode('listening');
      setLiveTranscript('');
    };

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(finalTranscript + interimTranscript);
    };

    recognition.onend = async () => {
      const textToProcess = liveTranscript || finalTranscript;
      if (!textToProcess.trim()) {
        setMode('idle');
        return;
      }
      
      setMode('processing');
      try {
        const url = `${import.meta.env.VITE_API_URL}/ai/parse-command`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ command: textToProcess })
        });
        const data = await res.json();
        
        if (data.success) {
          setParsedData(data.data);
          setParsedText(data.data.content || data.data.title || textToProcess);
          setMode('parsed');
        } else {
          toast.error('বুঝতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
          setMode('idle');
        }
      } catch (err) {
        console.error(err);
        toast.error('নেটওয়ার্ক সমস্যা, আবার চেষ্টা করুন');
        setMode('idle');
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      toast.error('ভয়েস শুনতে সমস্যা হয়েছে');
      setMode('idle');
    };

    recognition.start();
  };

  const handleSetReminder = async () => {
    if (!parsedData) return;
    
    toast.loading('সংরক্ষণ করা হচ্ছে...', { id: 'save' });
    try {
      let url = `${import.meta.env.VITE_API_URL}/reminders`;
      let body = { title: parsedText, date: parsedData.date || new Date().toISOString(), time: parsedData.time || "10:00" };
      
      if (parsedData.intent === 'create_note') {
        url = `${import.meta.env.VITE_API_URL}/notes`;
        body = { title: parsedText, content: parsedText } as any;
      } else if (parsedData.intent === 'create_special_date') {
        url = `${import.meta.env.VITE_API_URL}/special-dates`;
        body = { title: parsedText, date: parsedData.date || new Date().toISOString(), type: parsedData.type || 'Birthday', recurring: true } as any;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success('সফলভাবে সেভ করা হয়েছে!', { id: 'save' });
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        toast.error('সেভ করতে সমস্যা হয়েছে', { id: 'save' });
      }
    } catch (err) {
      toast.error('নেটওয়ার্ক সমস্যা', { id: 'save' });
    }
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

            {parsedData && parsedData.intent !== 'create_note' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center text-slate-600 font-medium text-xs">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="w-12">তারিখ</span>
                  <span className="text-slate-800">
                    {parsedData.date ? new Date(parsedData.date).toLocaleDateString() : new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              {parsedData.intent === 'create_reminder' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center text-slate-600 font-medium text-xs">
                  <Clock className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="w-12">সময়</span>
                  <span className="text-slate-800">{parsedData.time || "10:00"}</span>
                </div>
              </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Action Button */}
        {mode === 'parsed' && (
          <button 
            onClick={handleSetReminder}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm py-3.5 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-transform animate-in fade-in zoom-in duration-500"
          >
            {parsedData?.intent === 'create_note' ? (
              <>
                <Edit className="w-4 h-4 mr-2" />
                নোট সেভ করুন
              </>
            ) : parsedData?.intent === 'create_special_date' ? (
              <>
                <BellRing className="w-4 h-4 mr-2" />
                উইশ সেট করুন
              </>
            ) : (
              <>
                <BellRing className="w-4 h-4 mr-2" />
                রিমাইন্ডার সেট করুন
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
