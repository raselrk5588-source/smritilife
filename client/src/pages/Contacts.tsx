import { Search, Plus, Phone, MoreVertical, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Contacts() {
  const contacts = [
    { name: 'রাকিব হাসান', relation: 'বন্ধু', phone: '01711-223344', image: 'https://ui-avatars.com/api/?name=Rakib&background=0ea5e9&color=fff', favorite: true },
    { name: 'আম্মু', relation: 'পরিবার', phone: '01811-556677', image: 'https://ui-avatars.com/api/?name=Ammu&background=ec4899&color=fff', favorite: true },
    { name: 'বস (অফিস)', relation: 'কাজ', phone: '01922-889900', image: 'https://ui-avatars.com/api/?name=Boss&background=f59e0b&color=fff', favorite: false },
    { name: 'শফিক ভাই', relation: 'আত্মীয়', phone: '01633-445566', image: 'https://ui-avatars.com/api/?name=Shafiq&background=10b981&color=fff', favorite: false },
  ];

  return (
    <div className="bg-[#f6f8f9] min-h-screen pb-24">
      {/* Top Header */}
      <header className="bg-white p-4 pt-8 flex items-center justify-between shadow-sm">
        <Link to="/app" className="text-slate-500 hover:bg-slate-50 p-2 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-800">কন্ট্যাক্টস</h1>
          <p className="text-slate-500 text-[10px] font-medium">৪টি কন্ট্যাক্ট সেভ করা আছে</p>
        </div>
        <button className="bg-primary text-white p-2 rounded-full shadow-sm">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4">
        {/* Search */}
        <div className="bg-white rounded-xl p-3 flex items-center mb-5 shadow-sm border border-slate-100">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="নাম বা নাম্বার দিয়ে খুঁজুন..." 
            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
          />
        </div>

        {/* Contacts List */}
        <div className="space-y-3">
          {contacts.map((contact, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src={contact.image} alt={contact.name} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center">
                    {contact.name} 
                    {contact.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-1" />}
                  </h3>
                  <p className="text-[10px] text-slate-500">{contact.phone}</p>
                  <span className="inline-block px-2 py-0.5 mt-1 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                    {contact.relation}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
