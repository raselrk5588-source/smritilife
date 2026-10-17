import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Database, UserCheck, Trash2 } from 'lucide-react';

export default function PrivacyPolicy() {
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
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            সর্বশেষ আপডেট: অক্টোবর ২০২৬
          </div>
        </div>

        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            গোপনীয়তা নীতি (Privacy Policy)
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            স্মৃতিলইফ (SmritiLife) এবং এফ-কমার্স (Smriti F-Commerce AI) প্ল্যাটফর্মে আপনার ডেটার সুরক্ষা এবং গোপনীয়তা আমাদের সর্বোচ্চ অগ্রাধিকার।
          </p>
        </div>

        <div className="space-y-8 text-slate-300 text-sm sm:text-base leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" /> ১. আমরা কী কী তথ্য সংগ্রহ করি?
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li><strong>অ্যাকাউন্ট তথ্য:</strong> আপনার নাম, ইমেইল, মোবাইল নম্বর এবং প্রোফাইল বিবরণ।</li>
              <li><strong>ফেসবুক পেজ কানেকশন (F-Commerce):</strong> আপনি যখন আপনার ফেসবুক পেজ সংযুক্ত করেন, আমরা ফেসবুক অফিসিয়াল OAuth এপিআই-এর মাধ্যমে পেজের নাম, পেজ আইডি এবং মেসেজিং এক্সেস টোকেন সংরক্ষণ করি যেন আমাদের AI সেলস এজেন্ট আপনার গ্রাহকদের মেসেজের উত্তর দিতে পারে।</li>
              <li><strong>অর্ডার ও গ্রাহক তথ্য:</strong> আপনার ফেসবুক পেজে ক্রেতাদের দেওয়া ডেলিভারি তথ্য (নাম, ঠিকানা, ফোন নম্বর, পণ্যের তালিকা)।</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" /> ২. তথ্যের ব্যবহার
            </h2>
            <p className="mb-2">সংগৃহীত তথ্য শুধুমাত্র নিচের সেবাগুলোতে ব্যবহৃত হয়:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>AI সেলস এজেন্টের মাধ্যমে ফেসবুক মেসেঞ্জারে স্বয়ংক্রিয় গ্রাহক সেবা প্রদান।</li>
              <li>অর্ডার ম্যানেজমেন্ট এবং মার্চেন্টকে তাৎক্ষণিক হোয়াটসঅ্যাপে অর্ডার নোটিফিকেশন পাঠানো।</li>
              <li>স্মার্ট রিলেশনশিপ ম্যানেজার (রিমাইন্ডার, নোটস, খরচ হিসাব ইত্যাদি) পরিচালনা।</li>
              <li>আমরা কখনোই আপনার বা আপনার ক্রেতাদের ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি বা শেয়ার করি না।</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" /> ৩. ডেটা নিরাপত্তা ও ফেসবুক ডাটা পলিসি
            </h2>
            <p>
              SmritiLife ফেসবুক/মেটার সকল ডেভেলপার পলিসি ও GDPR শর্তাবলী কঠোরভাবে মেনে চলে। সমস্ত ডেটা এনক্রিপ্ট করা চ্যানেলের (SSL/TLS HTTPS) মাধ্যমে আদান-প্রদান করা হয় এবং নিরাপদ ক্লাউড ডাটাবেসে সংরক্ষিত থাকে।
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-5">
            <h2 className="text-lg font-bold text-emerald-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-emerald-400" /> ৪. ইউজার ডেটা ডিলিট করার নিয়ম (User Data Deletion)
            </h2>
            <p className="mb-3 text-slate-300">
              আপনি যদি SmritiLife থেকে আপনার ফেসবুক পেজ বা অ্যাকাউন্টের সম্পূর্ণ তথ্য মুছে ফেলতে চান, তবে যেকোনো সময়:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-300">
              <li>আপনার ড্যাশবোর্ডের <strong>F-Commerce &gt; Settings</strong> এ গিয়ে <strong>"Disconnect Page"</strong> ক্লিক করুন। এতে সাথে সাথে পেজের সকল টোকেন স্থায়ীভাবে ডিলিট হয়ে যাবে।</li>
              <li>অথবা সরাসরি আমাদের সাপোর্ট ইমেইলে (<strong>smritilife0@gmail.com</strong>) আপনার নিবন্ধিত ইমেইল/মোবাইল থেকে ডেটা অপসারণের আবেদন পাঠাতে পারেন। আমাদের টিম ২৪ ঘণ্টার মধ্যে সকল সংশ্লিষ্ট ডেটা সার্ভার থেকে স্থায়ীভাবে মুছে দেবে।</li>
            </ol>
          </section>

          {/* Section 5 */}
          <section className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
            <div>&copy; {new Date().getFullYear()} SmritiLife. সর্বস্বত্ব সংরক্ষিত।</div>
            <div>
              যোগাযোগ: <a href="mailto:smritilife0@gmail.com" className="text-emerald-400 underline">smritilife0@gmail.com</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
