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
  const [uploadCategory, setUploadCategory] = useState('Prescription');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const categories = [
    { id: 'All', label: 'সব ফাইল', icon: FolderOpen },
    { id: 'Prescription', label: 'প্রেসক্রিপশন', icon: FileCheck },
    { id: 'Medical Report', label: 'মেডিকেল রিপোর্ট', icon: FileText },
    { id: 'NID/Card', label: 'এনআইডি ও কার্ড', icon: Shield },
    { id: 'Certificate', label: 'সার্টিফিকেট', icon: Sparkles },
    { id: 'Other', label: 'অন্যান্য', icon: FileText }
  ];

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

    // Default title from file name if empty
    if (!uploadTitle) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setUploadTitle(nameWithoutExt);
    }

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

  const handleDownload = (doc: DocumentItem) => {
    window.open(`${import.meta.env.VITE_API_URL}/documents/${doc._id}/download`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesCat = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesQuery =
      !searchQuery.trim() ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesQuery;
  });

  const prescriptionCount = documents.filter((d) => d.category === 'Prescription').length;
  const reportCount = documents.filter((d) => d.category === 'Medical Report').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-sans pb-24">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-[#0A7756] via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden mb-8">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 rounded-l-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-bold text-emerald-100 mb-3 backdrop-blur-xs">
              <Shield className="w-3.5 h-3.5" /> 100% সুরক্ষিত এনক্রিপ্টেড ফাইল ভল্ট
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              ডকুমেন্ট ও প্রেসক্রিপশন মেমোরি
            </h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-xl">
              আপনার প্রেসক্রিপশন, রিপোর্ট এবং জরুরি ফাইল নিরাপদে রাখুন। WhatsApp-এ শুধু বলবেন{' '}
              <span className="font-bold underline text-white">"আমার প্রেসক্রিপশন দাও"</span>, স্মৃতি তৎক্ষণাৎ ফাইল পাঠাবে!
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="self-start md:self-auto bg-white text-[#0A7756] hover:bg-emerald-50 font-bold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>নতুন ফাইল যোগ করুন</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <div className="text-xs text-emerald-200 font-medium">মোট সংরক্ষিত ফাইল</div>
            <div className="text-2xl font-black mt-0.5">{documents.length}টি</div>
          </div>
          <div className="bg-black/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <div className="text-xs text-emerald-200 font-medium">প্রেসক্রিপশন</div>
            <div className="text-2xl font-black mt-0.5">{prescriptionCount}টি</div>
          </div>
          <div className="bg-black/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <div className="text-xs text-emerald-200 font-medium">মেডিকেল রিপোর্ট</div>
            <div className="text-2xl font-black mt-0.5">{reportCount}টি</div>
          </div>
          <div className="bg-black/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <div className="text-xs text-emerald-200 font-medium">WhatsApp ইন্টিগ্রেশন</div>
            <div className="text-sm font-bold text-emerald-300 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              সক্রিয় (Active)
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0A7756] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ফাইল খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0A7756] shadow-2xs"
          />
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A7756] mb-3" />
          <p className="text-sm font-medium">ডকুমেন্টগুলো লোড হচ্ছে...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-[#0A7756]">
            <FolderOpen className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">কোনো ফাইল পাওয়া যায়নি</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
            আপনার কোনো প্রেসক্রিপশন বা রিপোর্ট এখনো সেভ করা নেই। আপনি ওয়েবসাইট থেকে অথবা সরাসরি{' '}
            <span className="font-bold text-[#0A7756]">স্মৃতি লাইফ WhatsApp নম্বরে</span> যেকোনো ছবি বা PDF ফাইল পাঠিয়ে ক্যাপশনে নামটি লিখলেই তা মেমোরিতে যুক্ত হয়ে যাবে!
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-5 bg-[#0A7756] hover:bg-[#086146] text-white font-bold px-6 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>প্রথম ফাইল আপলোড করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => {
            const isPdf = doc.mimeType.includes('pdf');
            const isImage = doc.mimeType.startsWith('image/');
            const createdDate = new Date(doc.createdAt).toLocaleDateString('bn-BD', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div
                key={doc._id}
                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                          isPdf
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : isImage
                            ? 'bg-sky-50 text-sky-600 border border-sky-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}
                      >
                        {isPdf ? <FileText className="w-6 h-6" /> : isImage ? <ImageIcon className="w-6 h-6" /> : <FileCheck className="w-6 h-6" />}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {doc.category}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm mt-1 leading-snug line-clamp-2">
                          {doc.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{createdDate}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                    </div>
                    {doc.notes && (
                      <p className="text-slate-600 text-[11px] italic mt-2 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                        "{doc.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="px-3 py-1.5 rounded-xl bg-[#0A7756]/10 hover:bg-[#0A7756] text-[#0A7756] hover:text-white font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ডাউনলোড</span>
                    </button>
                    {isImage && (
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition"
                        title="দেখুন"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(doc._id, doc.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
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
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
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
                <label className="text-xs font-bold text-slate-600 block mb-1">ক্যাটাগরি</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0A7756]"
                >
                  <option value="Prescription">প্রেসক্রিপশন (Prescription)</option>
                  <option value="Medical Report">মেডিকেল রিপোর্ট (Medical Report)</option>
                  <option value="NID/Card">এনআইডি ও কার্ড (NID/Passport)</option>
                  <option value="Certificate">সার্টিফিকেট (Certificate)</option>
                  <option value="Invoice/Bill">রিসিপ্ট ও বিল (Invoice/Bill)</option>
                  <option value="Other">অন্যান্য (Other)</option>
                </select>
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
                  onClick={() => setShowUploadModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
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

      {/* Image Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 overflow-hidden relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 truncate">{previewDoc.title}</h4>
              <button onClick={() => setPreviewDoc(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewDoc.fileUrl.startsWith('http') ? previewDoc.fileUrl : `${import.meta.env.VITE_API_URL}${previewDoc.fileUrl.replace('/api', '')}`}
                alt={previewDoc.title}
                className="rounded-xl max-h-[60vh] object-contain"
                onError={(e) => {
                  // Fallback to download endpoint if static direct path fails
                  (e.target as HTMLImageElement).src = `${import.meta.env.VITE_API_URL}/documents/${previewDoc._id}/download`;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
