import { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Plus,
  Trash2,
  Download,
  Eye,
  FileCheck,
  Shield,
  FolderOpen,
  Image as ImageIcon,
  Calendar,
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchWithAuth } from '../utils/api';
import { useSettings } from '../contexts/SettingsContext';

interface DocumentItem {
  _id: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  category: string;
  tags: string[];
  notes?: string;
  createdAt: string;
}

export default function Documents() {
  const { t } = useSettings();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState(''); // Default is empty (optional)
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});

  // Dynamically extract user-defined categories from documents
  const userCategories = Array.from(
    new Set(
      documents
        .map((d) => (d.category || '').trim())
        .filter((cat): cat is string => Boolean(cat && cat.length > 0))
    )
  );

  const hasUncategorized = documents.some((d) => !d.category || !d.category.trim());

  // Category suggestions (popular categories + user-created categories)
  const categorySuggestions = Array.from(
    new Set([
      'প্রেসক্রিপশন',
      'মেডিকেল রিপোর্ট',
      'এনআইডি ও কার্ড',
      'সার্টিফিকেট',
      'রিসিপ্ট ও বিল',
      ...userCategories
    ])
  ).slice(0, 8);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      toast.error('ডকুমেন্ট লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('ফাইলের সাইজ সর্বোচ্চ ২৫ মেগাবাইট হতে পারবে');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      toast.error('ফাইলের একটি নাম দিন (যেমন: আমার প্রেসক্রিপশন)');
      return;
    }
    if (!fileBase64 || !selectedFile) {
      toast.error('একটি ফাইল সিলেক্ট করুন');
      return;
    }

    setIsUploading(true);
    toast.loading('ফাইল আপলোড হচ্ছে...', { id: 'docUpload' });

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          category: uploadCategory,
          notes: uploadNotes.trim() || undefined,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileData: fileBase64
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('ডকুমেন্ট সফলভাবে সেভ করা হয়েছে!', { id: 'docUpload' });
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadCategory('');
        setUploadNotes('');
        setSelectedFile(null);
        setFileBase64('');
        fetchDocuments();
      } else {
        toast.error(data.message || 'আপলোড ব্যর্থ হয়েছে', { id: 'docUpload' });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('সার্ভারে সমস্যা হয়েছে', { id: 'docUpload' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${title}" ফাইলটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/documents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('ফাইলটি মুছে ফেলা হয়েছে');
        setDocuments(documents.filter((d) => d._id !== id));
      } else {
        toast.error('ডিলিট করা যায়নি');
      }
    } catch (err) {
      toast.error('ত্রুটি ঘটেছে');
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      toast.loading('ফাইল ডাউনলোড হচ্ছে...', { id: 'docDownload' });

      // If base64 is already loaded in doc
      if (doc.fileData) {
        const link = document.createElement('a');
        link.href = `data:${doc.mimeType};base64,${doc.fileData}`;
        link.download = doc.fileName || `${doc.title}.${doc.mimeType?.includes('pdf') ? 'pdf' : 'jpg'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('ডাউনলোড সম্পন্ন!', { id: 'docDownload' });
        return;
      }

      // Fetch file with authorization
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/documents/${doc._id}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `${doc.title}.${doc.mimeType?.includes('pdf') ? 'pdf' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('ডাউনলোড সম্পন্ন!', { id: 'docDownload' });
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: direct window open with query token
      const token = localStorage.getItem('token');
      window.open(`${import.meta.env.VITE_API_URL}/documents/${doc._id}/download?token=${token || ''}`, '_blank');
      toast.dismiss('docDownload');
    }
  };

  const handlePreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setPreviewBlobUrl(null);
    setIsPreviewLoading(true);

    if (doc.fileData) {
      setPreviewBlobUrl(`data:${doc.mimeType};base64,${doc.fileData}`);
      setIsPreviewLoading(false);
      return;
    }

    try {
      const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/documents/${doc._id}/view`);
      if (res.ok) {
        const blob = await res.blob();
        setPreviewBlobUrl(window.URL.createObjectURL(blob));
      } else {
        toast.error('ফাইল প্রদর্শন করা যায়নি');
      }
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('ফাইল লোড হতে সমস্যা হয়েছে');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter((doc) => {
    const docCat = (doc.category || '').trim();
    const matchesCat =
      selectedCategory === 'All'
        ? true
        : selectedCategory === 'Uncategorized'
        ? !docCat
        : docCat.toLowerCase() === selectedCategory.toLowerCase();

    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (doc.title && doc.title.toLowerCase().includes(q)) ||
      (doc.category && doc.category.toLowerCase().includes(q)) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(q)) ||
      (doc.notes && doc.notes.toLowerCase().includes(q)) ||
      (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(q)));

    return matchesCat && matchesQuery;
  });

  const getCategoryInfo = (category?: string) => {
    if (!category || !category.trim()) return null;
    const cat = category.trim();
    const lower = cat.toLowerCase();

    if (lower.includes('presc') || lower.includes('প্রেসক্রিপশন')) {
      return { label: cat, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', dot: 'bg-emerald-500' };
    }
    if (lower.includes('medic') || lower.includes('report') || lower.includes('মেডিকেল') || lower.includes('রিপোর্ট')) {
      return { label: cat, bg: 'bg-blue-50 text-blue-700 border-blue-200/70', dot: 'bg-blue-500' };
    }
    if (lower.includes('nid') || lower.includes('card') || lower.includes('কার্ড') || lower.includes('পাসপোর্ট')) {
      return { label: cat, bg: 'bg-purple-50 text-purple-700 border-purple-200/70', dot: 'bg-purple-500' };
    }
    if (lower.includes('cert') || lower.includes('সনদ') || lower.includes('সার্টিফিকেট')) {
      return { label: cat, bg: 'bg-amber-50 text-amber-700 border-amber-200/70', dot: 'bg-amber-500' };
    }
    if (lower.includes('bill') || lower.includes('invoice') || lower.includes('বিল') || lower.includes('রসিদ')) {
      return { label: cat, bg: 'bg-teal-50 text-teal-700 border-teal-200/70', dot: 'bg-teal-500' };
    }
    return { label: cat, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/70', dot: 'bg-indigo-500' };
  };

  const getThumbnailSrc = (doc: DocumentItem) => {
    if (doc.fileData) {
      return `data:${doc.mimeType};base64,${doc.fileData}`;
    }
    if (doc.fileUrl && doc.fileUrl.startsWith('http')) {
      return doc.fileUrl;
    }
    if (doc.mimeType && doc.mimeType.startsWith('image/')) {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('token') || '';
      return `${apiBase}/documents/${doc._id}/view?token=${encodeURIComponent(token)}`;
    }
    return null;
  };

  const getFileExt = (doc: DocumentItem) => {
    if (doc.fileName && doc.fileName.includes('.')) {
      return doc.fileName.split('.').pop()?.toUpperCase() || 'FILE';
    }
    if (doc.mimeType?.includes('pdf')) return 'PDF';
    if (doc.mimeType?.includes('jpeg') || doc.mimeType?.includes('jpg')) return 'JPG';
    if (doc.mimeType?.includes('png')) return 'PNG';
    return 'FILE';
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 font-sans pb-24">
      {/* Top Banner / Header (Compact & Mobile-Optimized) */}
      <div className="bg-gradient-to-r from-[#0A7756] via-emerald-700 to-teal-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-md sm:shadow-xl relative overflow-hidden mb-4 sm:mb-6">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 rounded-l-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-emerald-100 mb-1.5 backdrop-blur-xs">
              <Shield className="w-3 h-3" /> 100% সুরক্ষিত এনক্রিপ্টেড ভল্ট
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight">
              ডকুমেন্ট ও প্রেসক্রিপশন মেমোরি
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm mt-0.5 max-w-xl leading-relaxed">
              আপনার প্রেসক্রিপশন ও রিপোর্ট নিরাপদে রাখুন। WhatsApp-এ চাইলেই তৎক্ষণাৎ ফাইল পাবেন!
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="self-stretch sm:self-auto bg-white text-[#0A7756] hover:bg-emerald-50 font-bold px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>নতুন ফাইল যোগ করুন</span>
          </button>
        </div>

        {/* Quick Stats Grid (Clean 1-row compact layout on mobile) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 mt-3.5 pt-3 border-t border-white/10">
          <div className="bg-black/10 backdrop-blur-xs rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-white/10 text-center sm:text-left">
            <div className="text-[10px] sm:text-xs text-emerald-200 font-medium truncate">মোট ফাইল</div>
            <div className="text-base sm:text-2xl font-black mt-0.5">{documents.length}টি</div>
          </div>
          <div className="bg-black/10 backdrop-blur-xs rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-white/10 text-center sm:text-left">
            <div className="text-[10px] sm:text-xs text-emerald-200 font-medium truncate">ক্যাটাগরি</div>
            <div className="text-base sm:text-2xl font-black mt-0.5">{userCategories.length}টি</div>
          </div>
          <div className="bg-black/10 backdrop-blur-xs rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-white/10 text-center sm:text-left">
            <div className="text-[10px] sm:text-xs text-emerald-200 font-medium truncate">ফিল্টারকৃত ফাইল</div>
            <div className="text-base sm:text-2xl font-black mt-0.5">{filteredDocs.length}টি</div>
          </div>
          <div className="hidden sm:block bg-black/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <div className="text-xs text-emerald-200 font-medium">WhatsApp সিঙ্ক</div>
            <div className="text-sm font-bold text-emerald-300 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              সক্রিয় (Active)
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-between items-center mb-4 sm:mb-6">
        {/* Dynamic Category Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-[#0A7756] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>সব ফাইল</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {documents.length}
            </span>
          </button>

          {userCategories.map((cat) => {
            const count = documents.filter((d) => (d.category || '').trim().toLowerCase() === cat.toLowerCase()).length;
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#0A7756] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {hasUncategorized && (
            <button
              onClick={() => setSelectedCategory('Uncategorized')}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === 'Uncategorized'
                  ? 'bg-[#0A7756] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>ক্যাটাগরি ছাড়া</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === 'Uncategorized' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {documents.filter((d) => !d.category || !d.category.trim()).length}
              </span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="টাইটেল বা ক্যাটাগরি দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A7756] mb-3" />
          <p className="text-sm font-medium">ডকুমেন্টগুলো লোড হচ্ছে...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-sm text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-[#0A7756]">
            <FolderOpen className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800">কোনো ফাইল পাওয়া যায়নি</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
            আপনার কোনো প্রেসক্রিপশন বা রিপোর্ট এখনো সেভ করা নেই। আপনি ওয়েবসাইট থেকে অথবা সরাসরি{' '}
            <span className="font-bold text-[#0A7756]">স্মৃতি লাইফ WhatsApp নম্বরে</span> যেকোনো ছবি বা PDF ফাইল পাঠিয়ে ক্যাপশনে নামটি লিখলেই তা মেমোরিতে যুক্ত হয়ে যাবে!
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 sm:mt-5 bg-[#0A7756] hover:bg-[#086146] text-white font-bold px-5 sm:px-6 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>প্রথম ফাইল আপলোড করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredDocs.map((doc) => {
            const isPdf = doc.mimeType?.includes('pdf');
            const isImage = doc.mimeType?.startsWith('image/');
            const createdDate = new Date(doc.createdAt).toLocaleDateString('bn-BD', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
            const catInfo = getCategoryInfo(doc.category);
            const thumbSrc = isImage ? getThumbnailSrc(doc) : null;
            const fileExt = getFileExt(doc);

            return (
              <div
                key={doc._id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top content */}
                <div>
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / Visual Icon */}
                    <div 
                      onClick={() => handlePreview(doc)}
                      className="cursor-pointer shrink-0 group-hover:scale-105 transition-transform"
                    >
                      {thumbSrc && !failedThumbnails[doc._id] ? (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/70 shadow-2xs relative">
                          <img
                            src={thumbSrc}
                            alt={doc.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => {
                              setFailedThumbnails((prev) => ({ ...prev, [doc._id]: true }));
                            }}
                          />
                        </div>
                      ) : isPdf ? (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-rose-50 border border-rose-200/70 flex flex-col items-center justify-center text-rose-600 shadow-2xs">
                          <FileText className="w-5 h-5 stroke-[2]" />
                          <span className="text-[9px] font-black uppercase mt-0.5">PDF</span>
                        </div>
                      ) : isImage ? (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-sky-50 border border-sky-200/70 flex flex-col items-center justify-center text-sky-600 shadow-2xs">
                          <ImageIcon className="w-5 h-5 stroke-[2]" />
                          <span className="text-[9px] font-black uppercase mt-0.5">IMG</span>
                        </div>
                      ) : (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-emerald-50 border border-emerald-200/70 flex flex-col items-center justify-center text-[#0A7756] shadow-2xs">
                          <FileCheck className="w-5 h-5 stroke-[2]" />
                          <span className="text-[9px] font-black uppercase mt-0.5">DOC</span>
                        </div>
                      )}
                    </div>

                    {/* Title & Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        {catInfo ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${catInfo.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dot}`}></span>
                            <span>{catInfo.label}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">ডকুমেন্ট</span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/50 uppercase">
                          {fileExt}
                        </span>
                      </div>

                      <h3 
                        onClick={() => handlePreview(doc)}
                        className="font-bold text-slate-800 text-sm sm:text-base leading-snug line-clamp-1 group-hover:text-[#0A7756] transition-colors cursor-pointer"
                        title={doc.title}
                      >
                        {doc.title}
                      </h3>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{createdDate}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes snippet if available */}
                  {doc.notes && (
                    <p className="text-slate-600 text-[11px] italic mt-2.5 line-clamp-2 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100">
                      "{doc.notes}"
                    </p>
                  )}
                </div>

                {/* Bottom Action Toolbar */}
                <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => handlePreview(doc)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-[#0A7756] text-[#0A7756] hover:text-white font-bold text-xs transition-all border border-emerald-200/60 hover:border-transparent active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>দেখুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all active:scale-95 cursor-pointer"
                      title="ডাউনলোড করুন"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">ডাউনলোড</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc._id, doc.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-95 cursor-pointer"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#0A7756]" />
                নতুন ফাইল বা প্রেসক্রিপশন যোগ করুন
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadCategory('');
                  setUploadTitle('');
                  setUploadNotes('');
                  setSelectedFile(null);
                  setFileBase64('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  ফাইলের শিরোনাম / নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="যেমন: আমার প্রেসক্রিপশন, আম্মুর রক্তের রিপোর্ট"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A7756]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    ক্যাটাগরি <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                  </label>
                  {uploadCategory && (
                    <button
                      type="button"
                      onClick={() => setUploadCategory('')}
                      className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      মুছে ফেলুন
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="যেমন: প্রেসক্রিপশন, মেডিকেল রিপোর্ট, এনআইডি, সার্টিফিকেট ইত্যাদি (ঐচ্ছিক)"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A7756]"
                />
                {categorySuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">পরামর্শ:</span>
                    {categorySuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setUploadCategory(suggestion)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                          uploadCategory.trim().toLowerCase() === suggestion.toLowerCase()
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  ফাইল সিলেক্ট করুন (PDF, JPG, PNG) <span className="text-rose-500">*</span>
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-[#0A7756] transition bg-slate-50/50">
                  <input
                    type="file"
                    id="docFileInput"
                    accept=".pdf,image/*,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="docFileInput" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    {selectedFile ? (
                      <div className="text-xs font-bold text-emerald-700">
                        সিলেক্টেড: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-slate-700">ফাইল আপলোড করতে ক্লিক করুন</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">PDF, Image ফাইল (সর্বোচ্চ ২৫ MB)</div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">অতিরিক্ত নোট (ঐচ্ছিক)</label>
                <textarea
                  placeholder="যেমন: ডাঃ রফিক আহমেদের দেওয়া প্রেসক্রিপশন"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A7756]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadCategory('');
                    setUploadTitle('');
                    setUploadNotes('');
                    setSelectedFile(null);
                    setFileBase64('');
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2.5 bg-[#0A7756] hover:bg-[#086146] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{isUploading ? 'আপলোড হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal (Image & PDF) */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-4 overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                {previewDoc.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {previewDoc.category}
                  </span>
                )}
                <h4 className="font-bold text-sm text-slate-800 truncate">{previewDoc.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0A7756] text-xs font-bold rounded-lg flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ডাউনলোড</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewBlobUrl(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-2 flex-1 flex items-center justify-center min-h-[300px] overflow-auto">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0A7756]" />
                  <span className="text-xs font-medium">ফাইল প্রস্তুত হচ্ছে...</span>
                </div>
              ) : previewBlobUrl ? (
                previewDoc.mimeType.includes('pdf') ? (
                  <iframe
                    src={previewBlobUrl}
                    className="w-full h-[65vh] rounded-xl border border-slate-200"
                    title={previewDoc.title}
                  />
                ) : (
                  <img
                    src={previewBlobUrl}
                    alt={previewDoc.title}
                    className="rounded-xl max-h-[65vh] object-contain shadow-sm"
                  />
                )
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ফাইলটি প্রদর্শনে সমস্যা হচ্ছে। অনুগ্রহ করে ডাউনলোড করুন।
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
