import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        toast.success('লগইন সফল হয়েছে!');
        navigate('/admin');
      } else {
        toast.error(data.message || 'ইমেইল বা পাসওয়ার্ড ভুল!');
      }
    } catch (err) {
      toast.error('সার্ভারের সাথে কানেক্ট করা যাচ্ছে না!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Smriti <span className="text-slate-500">Admin</span>
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          সুপার অ্যাডমিন প্যানেলে লগইন করুন
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700">ইমেইল অ্যাড্রেস</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border outline-none"
                  placeholder="admin@smriti.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">পাসওয়ার্ড</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors"
              >
                লগইন করুন
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}
