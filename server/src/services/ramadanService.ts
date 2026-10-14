/**
 * Ramadan & Islamic Prayer Time Engine for Bangladesh (64 Districts)
 * Calculates accurate Sehri end, Iftar, and prayer times according to Islamic Foundation Bangladesh standards.
 */

export interface DistrictInfo {
  id: string;
  nameEn: string;
  nameBn: string;
  aliases: string[];
  sehriOffset: number; // minutes relative to Dhaka (e.g. Chittagong is -5)
  iftarOffset: number; // minutes relative to Dhaka (e.g. Chittagong is -5)
}

export interface RamadanDayTimes {
  district: string;
  districtBn: string;
  dateStr: string;
  sehriEnd: string;       // "04:30" (24h)
  sehriFormatted: string; // "ভোর ০৪:৩০"
  iftar: string;          // "17:45" (24h)
  iftarFormatted: string; // "সন্ধ্যা ০৫:৪৫"
  fajr: string;
  maghrib: string;
}

// 64 Districts of Bangladesh with official Islamic Foundation offsets from Dhaka
export const BD_DISTRICTS: DistrictInfo[] = [
  { id: 'dhaka', nameEn: 'Dhaka', nameBn: 'ঢাকা', aliases: ['dhaka', 'dacca', 'ঢাকা'], sehriOffset: 0, iftarOffset: 0 },
  { id: 'gazipur', nameEn: 'Gazipur', nameBn: 'গাজীপুর', aliases: ['gazipur', 'গাজীপুর'], sehriOffset: 0, iftarOffset: 0 },
  { id: 'narayanganj', nameEn: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', aliases: ['narayanganj', 'narayangonj', 'নারায়নগঞ্জ', 'নারায়ণগঞ্জ'], sehriOffset: -1, iftarOffset: -1 },
  { id: 'narsingdi', nameEn: 'Narsingdi', nameBn: 'নরসিংদী', aliases: ['narsingdi', 'norshingdi', 'নরসিংদী'], sehriOffset: -2, iftarOffset: -2 },
  { id: 'manikganj', nameEn: 'Manikganj', nameBn: 'মানিকগঞ্জ', aliases: ['manikganj', 'manikgonj', 'মানিকগঞ্জ'], sehriOffset: +1, iftarOffset: +2 },
  { id: 'munshiganj', nameEn: 'Munshiganj', nameBn: 'মুন্সীগঞ্জ', aliases: ['munshiganj', 'munshigonj', 'মুন্সিগঞ্জ', 'মুন্সীগঞ্জ'], sehriOffset: 0, iftarOffset: 0 },
  
  // Chattogram Division
  { id: 'chattogram', nameEn: 'Chattogram', nameBn: 'চট্টগ্রাম', aliases: ['chattogram', 'chittagong', 'ctg', 'চট্টগ্রাম', 'চাটগাঁ'], sehriOffset: -5, iftarOffset: -5 },
  { id: 'coxsbazar', nameEn: 'Cox\'s Bazar', nameBn: 'কক্সবাজার', aliases: ['coxsbazar', 'coxs bazar', 'cox', 'কক্সবাজার'], sehriOffset: -7, iftarOffset: -7 },
  { id: 'cumilla', nameEn: 'Cumilla', nameBn: 'কুমিল্লা', aliases: ['cumilla', 'comilla', 'কুমিল্লা'], sehriOffset: -2, iftarOffset: -2 },
  { id: 'feni', nameEn: 'Feni', nameBn: 'ফেনী', aliases: ['feni', 'ফেনী'], sehriOffset: -3, iftarOffset: -3 },
  { id: 'noakhali', nameEn: 'Noakhali', nameBn: 'নোয়াখালী', aliases: ['noakhali', 'নোয়াখালী', 'নোয়াখালী'], sehriOffset: -2, iftarOffset: -2 },
  { id: 'lakshmipur', nameEn: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর', aliases: ['lakshmipur', 'লক্ষীপুর', 'লক্ষ্মীপুর'], sehriOffset: -1, iftarOffset: -1 },
  { id: 'chandpur', nameEn: 'Chandpur', nameBn: 'চাঁদপুর', aliases: ['chandpur', 'চাঁদপুর'], sehriOffset: -1, iftarOffset: -1 },
  { id: 'brahmanbaria', nameEn: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া', aliases: ['brahmanbaria', 'bbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'], sehriOffset: -3, iftarOffset: -3 },
  { id: 'rangamati', nameEn: 'Rangamati', nameBn: 'রাঙ্গামাটি', aliases: ['rangamati', 'রাঙ্গামাটি'], sehriOffset: -6, iftarOffset: -6 },
  { id: 'bandarban', nameEn: 'Bandarban', nameBn: 'বান্দরবান', aliases: ['bandarban', 'বান্দরবান'], sehriOffset: -6, iftarOffset: -7 },
  { id: 'khagrachhari', nameEn: 'Khagrachhari', nameBn: 'খাগড়াছড়ি', aliases: ['khagrachhari', 'khagrachari', 'খাগড়াছড়ি', 'খাগড়াছড়ি'], sehriOffset: -5, iftarOffset: -5 },

  // Sylhet Division
  { id: 'sylhet', nameEn: 'Sylhet', nameBn: 'সিলেট', aliases: ['sylhet', 'shilhot', 'সিলেট'], sehriOffset: -7, iftarOffset: -6 },
  { id: 'moulvibazar', nameEn: 'Moulvibazar', nameBn: 'মৌলভীবাজার', aliases: ['moulvibazar', 'moulvibazar', 'মৌলভীবাজার'], sehriOffset: -6, iftarOffset: -5 },
  { id: 'habiganj', nameEn: 'Habiganj', nameBn: 'হবিগঞ্জ', aliases: ['habiganj', 'hobiganj', 'হবিগঞ্জ'], sehriOffset: -4, iftarOffset: -4 },
  { id: 'sunamganj', nameEn: 'Sunamganj', nameBn: 'সুনামগঞ্জ', aliases: ['sunamganj', 'সুনামগঞ্জ'], sehriOffset: -6, iftarOffset: -5 },

  // Rajshahi Division
  { id: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী', aliases: ['rajshahi', 'রাজশাহী'], sehriOffset: +6, iftarOffset: +7 },
  { id: 'bogura', nameEn: 'Bogura', nameBn: 'বগুড়া', aliases: ['bogura', 'bogra', 'বগুড়া', 'বগুড়া'], sehriOffset: +4, iftarOffset: +4 },
  { id: 'pabna', nameEn: 'Pabna', nameBn: 'পাবনা', aliases: ['pabna', 'পাবনা'], sehriOffset: +4, iftarOffset: +5 },
  { id: 'sirajganj', nameEn: 'Sirajganj', nameBn: 'সিরাজগঞ্জ', aliases: ['sirajganj', 'সিরাজগঞ্জ'], sehriOffset: +2, iftarOffset: +2 },
  { id: 'naogaon', nameEn: 'Naogaon', nameBn: 'নওগাঁ', aliases: ['naogaon', 'নওগাঁ'], sehriOffset: +6, iftarOffset: +6 },
  { id: 'natore', nameEn: 'Natore', nameBn: 'নাটোর', aliases: ['natore', 'নাটোর'], sehriOffset: +5, iftarOffset: +5 },
  { id: 'chapai', nameEn: 'Chapai Nawabganj', nameBn: 'চাঁপাইনবাবগঞ্জ', aliases: ['chapai', 'nawabganj', 'চাপাইনবাবগঞ্জ', 'চাঁপাইনবাবগঞ্জ'], sehriOffset: +8, iftarOffset: +9 },
  { id: 'joypurhat', nameEn: 'Joypurhat', nameBn: 'জয়পুরহাট', aliases: ['joypurhat', 'জয়পুরহাট', 'জয়পুরহাট'], sehriOffset: +5, iftarOffset: +5 },

  // Khulna Division
  { id: 'khulna', nameEn: 'Khulna', nameBn: 'খুলনা', aliases: ['khulna', 'খুলনা'], sehriOffset: +2, iftarOffset: +4 },
  { id: 'jashore', nameEn: 'Jashore', nameBn: 'যশোর', aliases: ['jashore', 'jessore', 'যশোর'], sehriOffset: +4, iftarOffset: +5 },
  { id: 'kushtia', nameEn: 'Kushtia', nameBn: 'কুষ্টিয়া', aliases: ['kushtia', 'কুষ্টিয়া', 'কুষ্টিয়া'], sehriOffset: +4, iftarOffset: +6 },
  { id: 'satkhira', nameEn: 'Satkhira', nameBn: 'সাতক্ষীরা', aliases: ['satkhira', 'সাতক্ষীরা'], sehriOffset: +3, iftarOffset: +5 },
  { id: 'chuadanga', nameEn: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা', aliases: ['chuadanga', 'চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'], sehriOffset: +5, iftarOffset: +6 },
  { id: 'jhenaidah', nameEn: 'Jhenaidah', nameBn: 'ঝিনাইদহ', aliases: ['jhenaidah', 'ঝিনাইদহ'], sehriOffset: +4, iftarOffset: +5 },
  { id: 'bagerhat', nameEn: 'Bagerhat', nameBn: 'বাগেরহাট', aliases: ['bagerhat', 'বাগেরহাট'], sehriOffset: +1, iftarOffset: +3 },
  { id: 'magura', nameEn: 'Magura', nameBn: 'মাগুরা', aliases: ['magura', 'মাগুরা'], sehriOffset: +3, iftarOffset: +4 },
  { id: 'narail', nameEn: 'Narail', nameBn: 'নড়াইল', aliases: ['narail', 'নড়াইল', 'নড়াইল'], sehriOffset: +3, iftarOffset: +4 },
  { id: 'meherpur', nameEn: 'Meherpur', nameBn: 'মেহেরপুর', aliases: ['meherpur', 'মেহেরপুর'], sehriOffset: +5, iftarOffset: +7 },

  // Barishal Division
  { id: 'barishal', nameEn: 'Barishal', nameBn: 'বরিশাল', aliases: ['barishal', 'barisal', 'বরিশাল'], sehriOffset: 0, iftarOffset: +1 },
  { id: 'patuakhali', nameEn: 'Patuakhali', nameBn: 'পটুয়াখালী', aliases: ['patuakhali', 'পটুয়াখালী', 'পটুয়াখালী'], sehriOffset: 0, iftarOffset: +1 },
  { id: 'bhola', nameEn: 'Bhola', nameBn: 'ভোলা', aliases: ['bhola', 'ভোলা'], sehriOffset: -1, iftarOffset: -1 },
  { id: 'pirojpur', nameEn: 'Pirojpur', nameBn: 'পিরোজপুর', aliases: ['pirojpur', 'পিরোজপুর'], sehriOffset: +1, iftarOffset: +2 },
  { id: 'barguna', nameEn: 'Barguna', nameBn: 'বরগুনা', aliases: ['barguna', 'বরগুনা'], sehriOffset: +1, iftarOffset: +2 },
  { id: 'jhalokati', nameEn: 'Jhalokati', nameBn: 'ঝালকাঠি', aliases: ['jhalokati', 'ঝালকাঠি'], sehriOffset: 0, iftarOffset: +1 },

  // Rangpur Division
  { id: 'rangpur', nameEn: 'Rangpur', nameBn: 'রংপুর', aliases: ['rangpur', 'রংপুর'], sehriOffset: +4, iftarOffset: +2 },
  { id: 'dinajpur', nameEn: 'Dinajpur', nameBn: 'দিনাজপুর', aliases: ['dinajpur', 'দিনাজপুর'], sehriOffset: +6, iftarOffset: +4 },
  { id: 'kurigram', nameEn: 'Kurigram', nameBn: 'কুড়িগ্রাম', aliases: ['kurigram', 'কুড়িগ্রাম', 'কুড়িগ্রাম'], sehriOffset: +2, iftarOffset: 0 },
  { id: 'gaibandha', nameEn: 'Gaibandha', nameBn: 'গাইবান্ধা', aliases: ['gaibandha', 'গাইবান্ধা'], sehriOffset: +3, iftarOffset: +2 },
  { id: 'nilphamari', nameEn: 'Nilphamari', nameBn: 'নীলফামারী', aliases: ['nilphamari', 'নীলফামারী'], sehriOffset: +5, iftarOffset: +3 },
  { id: 'thakurgaon', nameEn: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও', aliases: ['thakurgaon', 'ঠাকুরগাঁও'], sehriOffset: +8, iftarOffset: +5 },
  { id: 'panchagarh', nameEn: 'Panchagarh', nameBn: 'পঞ্চগড়', aliases: ['panchagarh', 'পঞ্চগড়', 'পঞ্চগড়'], sehriOffset: +9, iftarOffset: +5 },
  { id: 'lalmonirhat', nameEn: 'Lalmonirhat', nameBn: 'লালমনিরহাট', aliases: ['lalmonirhat', 'লালমনিরহাট'], sehriOffset: +3, iftarOffset: +1 },

  // Mymensingh Division
  { id: 'mymensingh', nameEn: 'Mymensingh', nameBn: 'ময়মনসিংহ', aliases: ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'], sehriOffset: -1, iftarOffset: 0 },
  { id: 'jamalpur', nameEn: 'Jamalpur', nameBn: 'জামালপুর', aliases: ['jamalpur', 'জামালপুর'], sehriOffset: +1, iftarOffset: +1 },
  { id: 'netrokona', nameEn: 'Netrokona', nameBn: 'নেত্রকোণা', aliases: ['netrokona', 'netrakona', 'নেত্রকোনা', 'নেত্রকোণা'], sehriOffset: -3, iftarOffset: -2 },
  { id: 'sherpur', nameEn: 'Sherpur', nameBn: 'শেরপুর', aliases: ['sherpur', 'শেরপুর'], sehriOffset: +1, iftarOffset: +1 },

  // Remaining Dhaka Division Districts
  { id: 'tangail', nameEn: 'Tangail', nameBn: 'টাঙ্গাইল', aliases: ['tangail', 'টাঙ্গাইল'], sehriOffset: +1, iftarOffset: +1 },
  { id: 'faridpur', nameEn: 'Faridpur', nameBn: 'ফরিদপুর', aliases: ['faridpur', 'ফরিদপুর'], sehriOffset: +1, iftarOffset: +2 },
  { id: 'gopalganj', nameEn: 'Gopalganj', nameBn: 'গোপালগঞ্জ', aliases: ['gopalganj', 'গোপালগঞ্জ'], sehriOffset: +1, iftarOffset: +2 },
  { id: 'madaripur', nameEn: 'Madaripur', nameBn: 'মাদারীপুর', aliases: ['madaripur', 'মাদারিপুর', 'মাদারীপুর'], sehriOffset: 0, iftarOffset: +1 },
  { id: 'rajbari', nameEn: 'Rajbari', nameBn: 'রাজবাড়ী', aliases: ['rajbari', 'রাজবাড়ী', 'রাজবাড়ী'], sehriOffset: +2, iftarOffset: +3 },
  { id: 'shariatpur', nameEn: 'Shariatpur', nameBn: 'শরীয়তপুর', aliases: ['shariatpur', 'শরীয়তপুর', 'শরীয়তপুর'], sehriOffset: 0, iftarOffset: 0 },
  { id: 'kishoreganj', nameEn: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ', aliases: ['kishoreganj', 'কিশোরগঞ্জ'], sehriOffset: -2, iftarOffset: -2 }
];

/**
 * Astronomical Solar Calculation for Dhaka Reference Point
 * Coordinates: 23.8103° N, 90.4125° E
 * Calculates Sunrise, Sunset, Fajr (18° angle) and Maghrib with Islamic Foundation cautionary offsets.
 */
function calculateDhakaTimes(date: Date): { sehriEnd: string; fajr: string; iftar: string } {
  // Day of year
  const startOfYear = new Date(Date.UTC(date.getFullYear(), 0, 1));
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

  // Fractional year in radians
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);

  // Equation of time in minutes
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

  // Solar declination angle in radians
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const latRad = (23.8103 * Math.PI) / 180;
  const lng = 90.4125;
  const timeZoneOffset = 6; // UTC+6 for Dhaka

  // Solar noon in minutes from midnight
  const timeOffset = eqtime + 4 * lng - 60 * timeZoneOffset;
  const tnoon = 720 - timeOffset;

  // Hour angle for sunset / sunrise (zenith = 90.833° for atmospheric refraction)
  const zenithRad = (90.833 * Math.PI) / 180;
  const cosH0 = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));
  const H0 = Math.acos(Math.max(-1, Math.min(1, cosH0))) * (180 / Math.PI);

  // Hour angle for Fajr (zenith = 108° -> 18° below horizon standard for Bangladesh)
  const fajrZenithRad = (108 * Math.PI) / 180;
  const cosHf = (Math.cos(fajrZenithRad) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));
  const Hf = Math.acos(Math.max(-1, Math.min(1, cosHf))) * (180 / Math.PI);

  // Fajr time in minutes from midnight (plus 2 min rounding adjustment)
  const fajrMinutes = Math.round(tnoon - 4 * Hf);
  // Sunset / Maghrib in minutes from midnight
  const sunsetMinutes = Math.round(tnoon + 4 * H0);

  // Islamic Foundation Bangladesh rules:
  // Sehri ends 3 minutes before Fajr start
  const sehriEndMinutes = fajrMinutes - 3;
  // Iftar starts at Maghrib (sunset + 3 minutes cautionary safety buffer)
  const iftarMinutes = sunsetMinutes + 3;

  const minToTimeStr = (totalMins: number): string => {
    const mins = ((totalMins % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return {
    sehriEnd: minToTimeStr(sehriEndMinutes),
    fajr: minToTimeStr(fajrMinutes),
    iftar: minToTimeStr(iftarMinutes)
  };
}

/**
 * Match user text to one of the 64 districts in Bangladesh
 */
export function matchDistrict(query: string): DistrictInfo {
  if (!query) return BD_DISTRICTS[0]; // Default Dhaka

  const clean = query.trim().toLowerCase().replace(/[\s\-_]/g, '');

  for (const d of BD_DISTRICTS) {
    if (d.id === clean || d.nameEn.toLowerCase() === clean || d.nameBn === query.trim()) {
      return d;
    }
    for (const alias of d.aliases) {
      if (clean.includes(alias.toLowerCase().replace(/\s/g, '')) || query.includes(alias)) {
        return d;
      }
    }
  }

  return BD_DISTRICTS[0]; // Default Dhaka if unknown
}

/**
 * Format 24h "HH:mm" time to Bengali "ভোর ০৪:৩০" or "সন্ধ্যা ০৫:৪৫"
 */
export function formatBanglaTime(time24: string): string {
  const bnDigits: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  let prefix = '';
  if (h < 5) prefix = 'ভোর ';
  else if (h < 12) prefix = 'সকাল ';
  else if (h < 15) prefix = 'দুপুর ';
  else if (h < 18) prefix = 'বিকাল ';
  else if (h < 20) prefix = 'সন্ধ্যা ';
  else prefix = 'রাত ';

  const h12 = h % 12 === 0 ? 12 : h % 12;
  const formatted12 = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`.replace(/\d/g, d => bnDigits[d] || d);
  return `${prefix}${formatted12}`;
}

/**
 * Get Ramadan Day Times for a given District
 */
export function getRamadanTimes(districtQuery: string, date: Date = new Date()): RamadanDayTimes {
  const district = matchDistrict(districtQuery);
  const dhakaTimes = calculateDhakaTimes(date);

  // Apply district offset in minutes
  const applyOffset = (timeStr: string, offsetMins: number): string => {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + offsetMins;
    const normalized = ((total % 1440) + 1440) % 1440;
    const finalH = Math.floor(normalized / 60);
    const finalM = normalized % 60;
    return `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`;
  };

  const finalSehriEnd = applyOffset(dhakaTimes.sehriEnd, district.sehriOffset);
  const finalFajr = applyOffset(dhakaTimes.fajr, district.sehriOffset);
  const finalIftar = applyOffset(dhakaTimes.iftar, district.iftarOffset);

  const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

  return {
    district: district.nameEn,
    districtBn: district.nameBn,
    dateStr,
    sehriEnd: finalSehriEnd,
    sehriFormatted: formatBanglaTime(finalSehriEnd),
    iftar: finalIftar,
    iftarFormatted: formatBanglaTime(finalIftar),
    fajr: finalFajr,
    maghrib: finalIftar
  };
}

/**
 * Essential Ramadan Duas with Arabic, Bengali pronunciation, and meaning
 */
export const RAMADAN_DUAS = {
  sehriNiyyat: {
    title: 'রোজার নিয়ত (সেহরির দোয়া)',
    arabic: 'نَوَيْتُ اَنْ اُصُوْمَ غَدًا مِّنْ شَهْرِ رَمَضَانَ الْمُبَارَكِ فَرْضًا لَكَ يَا اللهُ فَتَقَبَّلْ مِنِّى اِنَّكَ اَنْتَ السَّمِيْعُ الْعَلِيْمُ',
    pronunciation: 'নাওয়াইতু আন আছুমা গাদাম মিন শাহরি রমাদানাল মুবারাকি ফারদাল্লাকা ইয়া আল্লাহু, ফাতাক্বাব্বাল মিন্নি ইন্নাকা আনতাস সামিউল আলিম।',
    meaning: 'হে আল্লাহ! আমি আগামীকাল পবিত্র রমজান মাসের তোমার নির্ধারিত ফরজ রোজা রাখার নিয়ত করলাম। অতএব আমার পক্ষ থেকে তা কবুল করুন, নিশ্চয়ই আপনি সর্বশ্রোতা ও সর্বজ্ঞ।'
  },
  iftarDua: {
    title: 'ইফতারের দোয়া',
    arabic: 'اللَّهُمَّ لَكَ صُمْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ',
    pronunciation: 'আল্লাহুম্মা লাকা সুমতু ওয়া আলা রিজক্বিকা আফত্বারতু।',
    meaning: 'হে আল্লাহ! আমি আপনার সন্তুষ্টির জন্য রোজা রেখেছিলাম এবং আপনার দেওয়া রিজিক দ্বারাই ইফতার করলাম।'
  },
  iftarSunnahDua: {
    title: 'ইফতার গ্রহণের পরের দোয়া (সুন্নাহ)',
    arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ',
    pronunciation: 'যাহাবাজ জামাউ, ওয়াবতাল্লাতিল উরূকু, ওয়া সাবাতাল আজরু ইনশাআল্লাহ।',
    meaning: 'পিপাসা দূর হলো, শিরা-উপশিরা সিক্ত হলো এবং ইনশাআল্লাহ প্রতিদানও নিশ্চিত হলো।'
  }
};
