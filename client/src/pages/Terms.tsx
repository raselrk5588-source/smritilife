import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> ফিরে যান (Back to Home)
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full">
            <FileText className="w-4 h-4 text-emerald-400" />
            কার্যকর: অক্টোবর ২০২৬
          </div>
        </div>

        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            ব্যবহারের শর্তাবলী (Terms of Service)
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            SmritiLife প্ল্যাটফর্ম ব্যবহারের পূর্বে অনুগ্রহ করে নিচের শর্তাবলী সাবধানে পড়ুন।
          </p>
        </div>

        <div className="space-y-6 text-slate-300 text-sm sm:text-base leading-relaxed">
          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> ১. সেবা গ্রহণ ও গ্রহণযোগ্যতা
            </h2>
            <p>
              SmritiLife ওয়েবসাইট, মোবাইল অ্যাপ অথবা ফেসবুক এফ-কমার্স এআই সেবা ব্যবহারের মাধ্যমে আপনি এই সকল শর্তাবলী মেনে নিতে সম্মত হচ্ছেন।
            </p>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> ২. এফ-কমার্স এআই ও ফেসবুক পেজ ইন্টিগ্রেশন
            </h2>
            <p>
              মার্চেন্টগণ তাদের ফেসবুক পেজ সংযোগ করার মাধ্যমে আমাদের AI এজেন্টকে পেজের ইনবক্সে আসা গ্রাহক বার্তার স্বয়ংক্রিয় উত্তর প্রদানের এবং অর্ডার নিবন্ধনের অনুমতি প্রদান করেন। মার্চেন্ট নিজের পণ্যমূল্য ও স্টক তালিকার সঠিকতার জন্য দায়ী থাকবেন।
            </p>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> ৩. নিষিদ্ধ কার্যক্রম
            </h2>
            <p>
              কোনো অবৈধ পণ্য বিক্রি, স্প্যামিং বা প্রতারণামূলক কাজে আমাদের প্ল্যাটফর্ম ব্যবহার করা যাবে না। এরূপ কার্যকলাপের ক্ষেত্রে যেকোনো সময় সার্ভিস বাতিল করার অধিকার SmritiLife সংরক্ষণ করে।
            </p>
          </section>

          <section className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
            <div>&copy; {new Date().getFullYear()} SmritiLife. All Rights Reserved.</div>
            <div>
              যোগাযোগ: <a href="mailto:smritilife0@gmail.com" className="text-emerald-400 underline">smritilife0@gmail.com</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
