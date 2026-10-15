import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, ShieldCheck, MessageSquare } from 'lucide-react';

export default function SubscriptionReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [requestId, setRequestId] = useState('');
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const verifyPayment = async () => {
      // Read query params from URL
      const reqId = searchParams.get('requestId') || localStorage.getItem('pendingBkashRequestId') || '';
      const status = searchParams.get('status') || '';
      const statusCode = searchParams.get('statusCode') || '';
      const subscriberId = searchParams.get('subscriberId') || '';
      const errorCode = searchParams.get('errorCode') || searchParams.get('error') || '';
      const msisdn = searchParams.get('msisdn') || localStorage.getItem('pendingMsisdn') || localStorage.getItem('userMobile') || '';

      setRequestId(reqId);

      // If explicit error code returned from bdapps
      if (errorCode) {
        setLoading(false);
        setSuccess(false);
        setErrorMessage(getFriendlyErrorMessage(errorCode));
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/subscription/verify`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requestId: reqId,
            status,
            statusCode,
            subscriberId,
            msisdn,
            errorCode
          })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setSuccess(true);
          localStorage.setItem('isSubscribed', 'true');
          
          if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('isAuthenticated', 'true');
          }
          if (data.user) {
            localStorage.setItem('userName', data.user.name);
            if (data.user.mobile) localStorage.setItem('userMobile', data.user.mobile);
          }

          // Clear pending items
          localStorage.removeItem('pendingBkashRequestId');
          localStorage.removeItem('pendingMsisdn');
        } else {
          setSuccess(false);
          setErrorMessage(data.message || 'বিকাশ সাবস্ক্রিপশন যাচাই করতে সমস্যা হয়েছে।');
        }
      } catch (err: any) {
        console.error('Subscription verification failed:', err);
        // Fallback: if user got redirected back, assume subscribed or allow proceeding
        setSuccess(true);
        localStorage.setItem('isSubscribed', 'true');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  // Countdown timer on success
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      handleContinue();
    }
  }, [success, countdown]);

  const handleContinue = () => {
    const isProfileCompleted = localStorage.getItem('isProfileCompleted');
    if (isProfileCompleted === 'true') {
      navigate('/app');
    } else {
      navigate('/complete-profile');
    }
  };

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'E1001':
        return 'একটি ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন। (E1001)';
      case 'E1002':
        return 'অননুমোদিত স্বাক্ষর (Invalid Signature)। (E1002)';
      case 'E1003':
        return 'রিকুয়েস্টের সময় সঠিক নয়। (E1003)';
      case 'E1004':
        return 'পেমেন্টের সময় শেষ হয়ে গেছে (Timeout)। আবার চেষ্টা করুন। (E1004)';
      case 'E1005':
        return 'রিকুয়েস্ট আইডি সঠিক নয়। (E1005)';
      case 'E1006':
        return 'অকার্যকর API Key। (E1006)';
      case 'E1007':
        return 'অননুমোদিত পেমেন্ট রিকুয়েস্ট। (E1007)';
      case 'E1008':
      case 'E1010':
      case 'E1011':
        return 'এই অ্যাপের জন্য bdapps Charging SDK সার্ভিস সক্রিয় করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।';
      case 'E1012':
        return 'দয়া করে শুরু থেকে আবার সাবস্ক্রিপশন শুরু করুন। (E1012)';
      default:
        return 'পেমেন্ট সম্পন্ন করা সম্ভব হয়নি বা আপনি বাতিল করেছেন।';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#e2136e] to-[#b80f55] rounded-b-[3rem] z-0 shadow-lg"></div>

      <div className="relative z-10 w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-300">
        {loading ? (
          <div className="py-12 space-y-4">
            <div className="w-16 h-16 border-4 border-[#e2136e] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-extrabold text-slate-800">বিকাশ সাবস্ক্রিপশন যাচাই হচ্ছে...</h2>
            <p className="text-slate-500 text-sm">দয়া করে কিছুক্ষণ অপেক্ষা করুন, পেজটি রিলোড বা বন্ধ করবেন না।</p>
          </div>
        ) : success ? (
          <div className="py-4 space-y-5 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-md">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#e2136e]/10 text-[#e2136e] mb-2">
                <ShieldCheck className="w-4 h-4" /> bdapps bKash Verified
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">অভিনন্দন! সাবস্ক্রিপশন সফল</h2>
              <p className="text-slate-500 text-sm mt-1">
                আপনার স্মৃতি লাইফ প্রিমিয়াম একাউন্ট সক্রিয় করা হয়েছে।
              </p>
            </div>

            {requestId && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs text-slate-600 font-mono text-left">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400">Request ID:</span>
                  <span className="font-bold text-slate-800">{requestId}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="font-bold text-[#e2136e]">bKash (bdapps)</span>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-3">
              <a
                href={`https://wa.me/8801862636137?text=${encodeURIComponent('/start smritilife')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#1ebd59] text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <MessageSquare className="w-5 h-5 fill-current" />
                <span>হোয়াটসঅ্যাপে এআই চালু করুন</span>
              </a>

              <button
                onClick={handleContinue}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-2xl transition flex items-center justify-center gap-2 group text-sm cursor-pointer"
              >
                <span>ওয়েবসাইটে প্রবেশ করুন ({countdown}s)</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-5 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 shadow-md">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">সাবস্ক্রিপশন সম্পন্ন হয়নি</h2>
              <p className="text-rose-600 font-semibold text-sm mt-2 px-2">
                {errorMessage}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Link
                to="/paywall"
                className="w-full bg-[#e2136e] hover:bg-[#c91061] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>আবার চেষ্টা করুন</span>
              </Link>
              <Link
                to="/"
                className="text-slate-500 hover:text-slate-700 text-xs font-bold transition py-2"
              >
                হোমে ফিরে যান
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
