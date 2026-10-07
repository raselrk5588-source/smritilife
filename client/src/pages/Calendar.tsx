import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  const nextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:bg-slate-50"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <button onClick={nextMonth} className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:bg-slate-50"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <h2 className="text-center font-bold text-lg mb-4 text-slate-800">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-xs font-semibold text-slate-400 py-1">{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 text-center text-slate-300"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
            return (
              <div key={day} className={`p-2 flex justify-center items-center rounded-lg aspect-square text-sm font-medium ${isToday ? 'bg-primary text-white shadow-md' : 'text-slate-700 hover:bg-slate-50 cursor-pointer'}`}>
                {day}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-slate-900 mb-3 flex items-center"><Gift className="w-5 h-5 text-accent mr-2" /> Upcoming Events</h3>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm text-center">No upcoming events this month.</p>
        </div>
      </div>
    </div>
  );
}
