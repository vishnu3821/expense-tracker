import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  GraduationCap, 
  ArrowLeft, 
  FolderOpen, 
  Folder,
  Plus, 
  ChevronRight,
  Loader2,
  FileText,
  Calendar,
  Layers,
  Trash2,
  Edit2,
  ImageIcon,
  X,
  AlertCircle,
  TrendingUp,
  Receipt,
  ClipboardPaste,
  Table as TableIcon,
  CheckCircle2,
  Download
} from 'lucide-react';
import AddEducationRecord from '../components/Education/AddEducationRecord';
import BulkUploadEducation from '../components/Education/BulkUploadEducation';
import DownloadStatementModal from '../components/Education/DownloadStatementModal';
import { generatePDF, generateExcel, numVal } from '../components/Education/exportUtils';

export default function EducationalFees() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState([]);
  
  // Transient structural paths created this session (e.g., '2026', '2026/Sem 1', '2026/Sem 1/Hostel')
  const [createdPaths, setCreatedPaths] = useState([]);

  // View states: 'years' | 'semesters' | 'folders' | 'records'
  const [viewLevel, setViewLevel] = useState('years');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSort, setRecordSort] = useState('newest');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [folderExporting, setFolderExporting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Custom UI Prompt State
  const [promptConfig, setPromptConfig] = useState(null);
  const [promptValue, setPromptValue] = useState('');

  // Custom UI Confirmation State
  const [confirmConfig, setConfirmConfig] = useState(null);

  const openPrompt = (title, placeholder, initialValue, onConfirm) => {
    setPromptValue(initialValue || '');
    setPromptConfig({ title, placeholder, onConfirm });
  };

  const openConfirm = (title, message, onConfirm, isDangerous = false) => {
    setConfirmConfig({ title, message, onConfirm, isDangerous });
  };

  useEffect(() => {
    if (user) fetchFees();
  }, [user]);

  const fetchFees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('education_fees')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setFees(data || []);
    } catch (err) {
      console.error('Error fetching educational fees:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (filterFn) => {
    const sum = fees.filter(filterFn).reduce((acc, f) => {
      // Handle potential string amounts with commas or symbols
      const amountStr = String(f.amount || '0').replace(/[^0-9.]/g, '');
      const val = parseFloat(amountStr);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    // Return rounded to 2 decimal places to avoid floating point issues (e.g. 0.1 + 0.2)
    return Math.round(sum * 100) / 100;
  };

  const formatCurrency = (val) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.]/g, '')) : parseFloat(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Returns { emoji, bg, text } based on category name keywords
  const getCategoryIcon = (name = '') => {
    const n = name.toLowerCase();
    if (/hostel|accom|room|dormit|pg|residenc/.test(n))
      return { emoji: '🏠', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600' };
    if (/mess|food|dining|canteen|meal|lunch|dinner|breakfast/.test(n))
      return { emoji: '🍽️', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600' };
    if (/tuition|sem fee|semfee|academic|course|program|semester|term fee/.test(n))
      return { emoji: '📚', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600' };
    if (/exam|test|crt|assessment|evaluat/.test(n))
      return { emoji: '📝', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600' };
    if (/library|book|journal|reading/.test(n))
      return { emoji: '📖', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600' };
    if (/transport|bus|travel|shuttle|cab/.test(n))
      return { emoji: '🚌', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600' };
    if (/lab|laboratory|practical|workshop/.test(n))
      return { emoji: '🔬', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600' };
    if (/uniform|dress|kit|sport/.test(n))
      return { emoji: '👕', bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600' };
    if (/electricity|utility|maintenance|water|power/.test(n))
      return { emoji: '⚡', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' };
    if (/activity|event|fest|cultural|extra/.test(n))
      return { emoji: '🎭', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600' };
    if (/insurance|medical|health|hospital/.test(n))
      return { emoji: '🏥', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600' };
    if (/fee|charge|misc|other|general/.test(n))
      return { emoji: '🧾', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' };
    // Fallback
    return { emoji: '📂', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' };
  };

  const numberToWords = (n) => {
    if (n === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const g = ['', 'Thousand', 'Lakh', 'Crore'];
    
    const makeWords = (num) => {
      if (num < 20) return a[num];
      if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
      if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + makeWords(num % 100) : '');
      return '';
    };

    const numStr = Math.floor(n).toString();
    if (numStr.length > 9) return 'Amount too large';

    let words = '';
    const crores = Math.floor(n / 10000000);
    const lakhs = Math.floor((n % 10000000) / 100000);
    const thousands = Math.floor((n % 100000) / 1000);
    const remaining = Math.floor(n % 1000);

    if (crores > 0) words += makeWords(crores) + ' Crore ';
    if (lakhs > 0) words += makeWords(lakhs) + ' Lakh ';
    if (thousands > 0) words += makeWords(thousands) + ' Thousand ';
    if (remaining > 0) words += makeWords(remaining);
    
    const paise = Math.round((n % 1) * 100);
    let wordsSuffix = ' Rupees Only';
    if (paise > 0) wordsSuffix = ` Rupees and ${makeWords(paise)} Paise Only`;
    
    return words.trim() + wordsSuffix;
  };

  const getDerivedYears = () => {
    let dbYears = fees.map(f => f.year);
    let customYears = createdPaths.filter(p => !p.includes('/')).map(p => p);
    return [...new Set([...dbYears, ...customYears])].sort((a,b) => b.localeCompare(a));
  };

  const getDerivedSemesters = (year) => {
    let dbSems = fees.filter(f => f.year === year).map(f => f.semester);
    let customSems = createdPaths.filter(p => p.startsWith(year + '/') && p.split('/').length === 2).map(p => p.split('/')[1]);
    return [...new Set([...dbSems, ...customSems])].sort();
  };

  const getDerivedFolders = (year, sem) => {
    let dbFolds = fees.filter(f => f.year === year && f.semester === sem).map(f => f.category);
    let prefix = `${year}/${sem}/`;
    let customFolds = createdPaths.filter(p => p.startsWith(prefix) && p.split('/').length === 3).map(p => p.split('/')[2]);
    return [...new Set([...dbFolds, ...customFolds])].sort();
  };

  const handleAddYear = () => {
    openPrompt("Add Academic Year", "e.g. 2026", "", (val) => {
      const cleanYear = val.trim();
      setCreatedPaths(prev => [...prev, cleanYear]);
      setSelectedYear(cleanYear);
      setViewLevel('semesters');
    });
  };

  const handleAddSemester = () => {
    openPrompt("Add Semester", "e.g. Semester 1", "", (val) => {
      const cleanSem = val.trim();
      setCreatedPaths(prev => [...prev, `${selectedYear}/${cleanSem}`]);
      setSelectedSemester(cleanSem);
      setViewLevel('folders');
    });
  };

  const handleAddFolder = () => {
    openPrompt("Add Category Folder", "e.g. Tuition Fee", "", (val) => {
      const cleanFolder = val.trim();
      setCreatedPaths(prev => [...prev, `${selectedYear}/${selectedSemester}/${cleanFolder}`]);
    });
  };

  const handleRenameYear = async (e, oldYear) => {
    e.stopPropagation();
    openPrompt("Rename Academic Year", "e.g. 2026", oldYear, async (val) => {
      const cleanYear = val.trim();
      if (!cleanYear || cleanYear === oldYear) return;

      setCreatedPaths(prev => prev.map(p => {
        const parts = p.split('/');
        if (parts[0] === oldYear) {
          parts[0] = cleanYear;
          return parts.join('/');
        }
        return p;
      }));

      setLoading(true);
      try {
        const { error } = await supabase.from('education_fees').update({ year: cleanYear })
          .eq('user_id', user.id)
          .eq('year', oldYear);
        if (error) throw error;
        fetchFees();
      } catch (err) {
        console.error("Error renaming year", err);
        setLoading(false);
      }
    });
  };

  const handleDeleteYear = async (e, yearName) => {
    e.stopPropagation();
    openConfirm(
      "Delete Academic Year?",
      `This will permanently delete the year "${yearName}" and ALL semesters, folders, and receipts inside it.`,
      async () => {
        setCreatedPaths(prev => prev.filter(p => !p.startsWith(yearName)));
        setLoading(true);
        try {
          const { error } = await supabase.from('education_fees').delete()
            .eq('user_id', user.id)
            .eq('year', yearName);
          if (error) throw error;
          fetchFees();
        } catch (err) {
          console.error("Error deleting year", err);
          setLoading(false);
        }
      },
      true
    );
  };

  const handleRenameSemester = async (e, oldSem) => {
    e.stopPropagation();
    openPrompt("Rename Semester", "e.g. Semester 2", oldSem, async (val) => {
      const cleanSem = val.trim();
      if (!cleanSem || cleanSem === oldSem) return;

      setCreatedPaths(prev => prev.map(p => {
        const parts = p.split('/');
        if (parts.length >= 2 && parts[0] === selectedYear && parts[1] === oldSem) {
          parts[1] = cleanSem;
          return parts.join('/');
        }
        return p;
      }));

      setLoading(true);
      try {
        const { error } = await supabase.from('education_fees').update({ semester: cleanSem })
          .eq('user_id', user.id)
          .eq('year', selectedYear)
          .eq('semester', oldSem);
        if (error) throw error;
        fetchFees();
      } catch (err) {
        console.error("Error renaming semester", err);
        setLoading(false);
      }
    });
  };

  const handleDeleteSemester = async (e, semName) => {
    e.stopPropagation();
    openConfirm(
      "Delete Semester?",
      `This will permanently delete "${semName}" and ALL folders and receipts inside it.`,
      async () => {
        setCreatedPaths(prev => prev.filter(p => !p.startsWith(`${selectedYear}/${semName}`)));
        setLoading(true);
        try {
          const { error } = await supabase.from('education_fees').delete()
            .eq('user_id', user.id)
            .eq('year', selectedYear)
            .eq('semester', semName);
          if (error) throw error;
          fetchFees();
        } catch (err) {
          console.error("Error deleting semester", err);
          setLoading(false);
        }
      },
      true
    );
  };

  const handleRenameFolder = async (e, oldFolderName) => {
    e.stopPropagation();
    openPrompt("Rename Folder", "Enter new name", oldFolderName, async (val) => {
      const cleanName = val.trim();
      if (!cleanName || cleanName === oldFolderName) return;

      setCreatedPaths(prev => prev.map(p => {
        if (p === `${selectedYear}/${selectedSemester}/${oldFolderName}`) {
          return `${selectedYear}/${selectedSemester}/${cleanName}`;
        }
        return p;
      }));

      setLoading(true);
      try {
        const { error } = await supabase.from('education_fees').update({ category: cleanName })
          .eq('user_id', user.id)
          .eq('year', selectedYear)
          .eq('semester', selectedSemester)
          .eq('category', oldFolderName);
        if (error) throw error;
        fetchFees();
      } catch (err) {
        console.error("Error renaming folder", err);
        setLoading(false);
      }
    });
  };

  const handleDeleteFolder = async (e, folderName) => {
    e.stopPropagation();
    openConfirm(
      "Delete Folder?",
      `This will permanently delete the folder "${folderName}" and all receipts inside it. This cannot be undone.`,
      async () => {
        setCreatedPaths(prev => prev.filter(p => !p.startsWith(`${selectedYear}/${selectedSemester}/${folderName}`)));
        setLoading(true);
        try {
          const { error } = await supabase.from('education_fees').delete()
            .eq('user_id', user.id)
            .eq('year', selectedYear)
            .eq('semester', selectedSemester)
            .eq('category', folderName);
          if (error) throw error;
          fetchFees();
        } catch (err) {
          console.error("Error deleting folder", err);
          setLoading(false);
        }
      },
      true
    );
  };

  const handleDeleteRecord = async (id) => {
    openConfirm(
      "Delete Receipt?",
      "Are you sure you want to remove this academic record? You will lose the receipt snapshot.",
      async () => {
        try {
          setLoading(true);
          const { error } = await supabase.from('education_fees').delete().eq('id', id);
          if (error) throw error;
          await fetchFees();
          setSelectedRecord(null);
        } catch (err) {
          console.error('Error deleting record:', err);
          setLoading(false);
        }
      },
      true
    );
  };

  const goBack = () => {
    if (viewLevel === 'records') {
      setViewLevel('folders');
      setSelectedFolder(null);
      setSelectedRecord(null);
    } else if (viewLevel === 'folders') {
      setViewLevel('semesters');
      setSelectedSemester(null);
    } else if (viewLevel === 'semesters') {
      setViewLevel('years');
      setSelectedYear(null);
    }
  };

  const renderContent = () => {
    if (loading && fees.length === 0) {
      return (
        <div className="space-y-6 animate-pulse">
          {/* Skeleton: Grand total card */}
          <div className="h-28 rounded-3xl bg-slate-200 dark:bg-slate-800" />
          {/* Skeleton: section header */}
          <div className="flex justify-between items-center px-1">
            <div className="h-6 w-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-10 w-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
          {/* Skeleton: cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-3xl bg-slate-100 dark:bg-slate-800">
                <div className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-20 rounded-lg bg-slate-100 dark:bg-slate-750" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (viewLevel === 'years') {
      const years = getDerivedYears();
      const totalOverall = calculateTotal(() => true);
      
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Summary Card */}
          <div className="bg-linear-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Total Academic Paid</p>
                <h2 className="text-3xl font-black">₹{formatCurrency(totalOverall)}</h2>
                <p
                  className="text-[9px] font-bold text-white/70 italic mt-1 leading-relaxed"
                  title={numberToWords(totalOverall)}
                >{numberToWords(totalOverall)}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Academic Years</h2>
            <button onClick={handleAddYear} className="h-10 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm border border-slate-100 dark:border-slate-700">
              <Plus className="h-4 w-4" /> Add Year
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {years.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                <Folder className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">No records found. Start with a year.</p>
              </div>
            ) : (
              years.map(year => {
                const yearTotal = calculateTotal(f => f.year === year);
                return (
                <div key={year} className="relative group">
                  <button
                    onClick={() => { setSelectedYear(year); setViewLevel('semesters'); }}
                    className="w-full group bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 text-left relative overflow-hidden active:scale-[0.98]"
                  >
                    <div className="absolute top-0 right-0 h-24 w-24 -mr-8 -mt-8 bg-emerald-500/5 rounded-full group-hover:bg-emerald-500/10 transition-colors" />
                    <div className="flex items-center gap-4 relative z-10 pr-12">
                      <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">{year}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">₹{formatCurrency(yearTotal)} total</p>
                      </div>
                      <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>

                  {/* Year Action Buttons */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button onClick={(e) => handleRenameYear(e, year)} className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-110 transition-transform">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => handleDeleteYear(e, year)} className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl text-red-600 shadow-sm border border-red-100 dark:border-red-900 hover:scale-110 transition-transform">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                )
              })
            )}
          </div>
        </div>
      );
    }

    if (viewLevel === 'semesters') {
      const semesters = getDerivedSemesters(selectedYear);
      const totalYear = calculateTotal(f => f.year === selectedYear);
      
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Academic Year {selectedYear}</p>
             <div className="flex justify-between items-end">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Annual Total</h2>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{formatCurrency(totalYear)}</span>
                  <p
                    className="text-[10px] font-bold text-slate-400 italic leading-relaxed truncate max-w-[150px]"
                    title={numberToWords(totalYear)}
                  >{numberToWords(totalYear)}</p>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Semesters</h2>
            <button onClick={handleAddSemester} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {semesters.map(sem => {
              const semTotal = calculateTotal(f => f.year === selectedYear && f.semester === sem);
              return (
                <div key={sem} className="relative group">
                  <button
                    onClick={() => { setSelectedSemester(sem); setViewLevel('folders'); }}
                    className="w-full bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-teal-500/50 hover:shadow-xl transition-all group text-left active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4 pr-12">
                      <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 group-hover:rotate-12 transition-transform">
                        <Layers className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{sem}</h3>
                        <p className="text-xs text-slate-500 font-bold">₹{formatCurrency(semTotal)}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-teal-500 transition-colors" />
                    </div>
                  </button>

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button onClick={(e) => handleRenameSemester(e, sem)} className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-110 transition-transform">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => handleDeleteSemester(e, sem)} className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl text-red-600 shadow-sm border border-red-100 dark:border-red-900 hover:scale-110 transition-transform">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    if (viewLevel === 'folders') {
      const folders = getDerivedFolders(selectedYear, selectedSemester);
      const semTotal = calculateTotal(f => f.year === selectedYear && f.semester === selectedSemester);
      
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="bg-slate-900 dark:bg-black rounded-3xl p-6 text-white shadow-2xl overflow-hidden relative">
             <div className="absolute bottom-0 right-0 h-32 w-32 -mb-16 -mr-16 bg-white/5 rounded-full" />
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">{selectedYear} &bull; {selectedSemester}</p>
             <div className="flex justify-between items-end relative z-10">
                <h2 className="text-2xl font-black">Semester Fees</h2>
                <span className="text-2xl font-black text-emerald-400">₹{formatCurrency(semTotal)}</span>
             </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Categories</h2>
            <button onClick={handleAddFolder} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              <Plus className="h-4 w-4" /> Folder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {folders.map(folder => {
              const folderTotal = calculateTotal(f => f.year === selectedYear && f.semester === selectedSemester && f.category === folder);
              const count = fees.filter(f => f.year === selectedYear && f.semester === selectedSemester && f.category === folder).length;
              
              const catIcon = getCategoryIcon(folder);
              return (
                <div key={folder} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 relative group hover:shadow-2xl hover:border-opacity-50 transition-all duration-300 overflow-hidden active:scale-[0.98]"
                  style={{ '--tw-shadow-color': catIcon.text.replace('text-', '') }}>
                  <div onClick={() => { setSelectedFolder(folder); setViewLevel('records'); }} className="p-6 pr-16 h-full flex items-center gap-4 cursor-pointer">
                    <div className={`h-12 w-12 rounded-xl ${catIcon.bg} flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform select-none`}>
                      {catIcon.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{folder}</h3>
                      <p className="text-xs text-slate-500 font-bold">₹{formatCurrency(folderTotal)} &bull; {count} items</p>
                    </div>
                  </div>

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleRenameFolder(e, folder)} className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => handleDeleteFolder(e, folder)} className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl text-red-600 shadow-sm border border-red-100 dark:border-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      );
    }

    if (viewLevel === 'records') {
      const rawRecords = fees.filter(f => f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder);
      const folderTotal = calculateTotal(f => f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder);
      const catIcon = getCategoryIcon(selectedFolder);

      // Search across all fields
      const q = recordSearch.trim().toLowerCase();
      const searched = q
        ? rawRecords.filter(r =>
            (r.amount_info || '').toLowerCase().includes(q) ||
            (r.receipt_no || '').toLowerCase().includes(q) ||
            (r.order_number || '').toLowerCase().includes(q) ||
            (r.payment_gateway || '').toLowerCase().includes(q) ||
            String(r.amount || '').includes(q) ||
            (r.date || '').includes(q)
          )
        : rawRecords;

      // Sort
      const records = [...searched].sort((a, b) => {
        if (recordSort === 'newest')  return new Date(b.date) - new Date(a.date);
        if (recordSort === 'oldest')  return new Date(a.date) - new Date(b.date);
        if (recordSort === 'highest') return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
        if (recordSort === 'lowest')  return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
        return 0;
      });

      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          {/* Category header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl ${catIcon.bg} flex items-center justify-center text-2xl select-none shrink-0`}>
                {catIcon.emoji}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{selectedFolder}</h2>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Total: ₹{formatCurrency(folderTotal)} &bull; {rawRecords.length} record{rawRecords.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 sm:pb-0 -mb-1 sm:mb-0 w-full sm:w-auto">
              <button onClick={() => setIsBulkModalOpen(true)}
                className="h-11 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-sm">
                <ClipboardPaste className="h-5 w-5" /> Bulk
              </button>
              <button
                onClick={() => {
                  setFolderExporting(true);
                  try {
                    generatePDF(
                      rawRecords,
                      '',
                      '',
                      `${selectedFolder} – ${selectedSemester} ${selectedYear}`,
                      `${selectedFolder.replace(/\s+/g, '_')}_${selectedYear}_${selectedSemester.replace(/\s+/g, '_')}`
                    );
                  } finally {
                    setFolderExporting(false);
                  }
                }}
                disabled={rawRecords.length === 0 || folderExporting}
                className="h-11 px-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed border border-indigo-100 dark:border-indigo-800"
              >
                {folderExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </button>
              <button onClick={() => setIsAddModalOpen(true)}
                className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-sm">
                <Plus className="h-5 w-5" /> Add New
              </button>
            </div>
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/></svg>
              <input
                type="text"
                placeholder="Search description, amount, date, ref…"
                value={recordSearch}
                onChange={e => setRecordSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
              {recordSearch && (
                <button onClick={() => setRecordSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={recordSort}
              onChange={e => setRecordSort(e.target.value)}
              className="h-10 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>

          {/* Records list */}
          <div className="space-y-2.5">
            {records.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold">{recordSearch ? `No records match "${recordSearch}"` : 'No receipts in this folder.'}</p>
              </div>
            ) : (
              records.map(record => (
                <div
                  key={record.id}
                  className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/80 dark:hover:shadow-slate-900/50 transition-all duration-200 cursor-pointer active:scale-[0.99] overflow-hidden"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {record.image_url ? (
                      <img src={record.image_url} alt="Receipt" className="h-12 w-12 rounded-2xl object-cover border border-slate-100 dark:border-slate-700 shadow-sm shrink-0" />
                    ) : (
                      <div className={`h-12 w-12 shrink-0 rounded-2xl ${catIcon.bg} flex items-center justify-center text-xl select-none`}>
                        {catIcon.emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {record.amount_info || record.receipt_no || 'Fee Record'}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(record.date), 'dd MMM yyyy')}
                        </span>
                        {record.receipt_no && (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold">#{record.receipt_no}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0">₹{formatCurrency(record.amount)}</p>
                    <ChevronRight className="h-4 w-4 text-slate-200 dark:text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
  };


  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      {/* Universal Navigator Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <div className="flex items-center gap-4">
          {viewLevel !== 'years' ? (
            <button
              onClick={goBack}
              className="h-12 w-12 flex justify-center items-center rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-x-1 transition-all text-slate-700 dark:text-slate-300 active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/more" className="h-12 w-12 flex justify-center items-center rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-x-1 transition-all text-slate-700 dark:text-slate-300 active:scale-90">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Academic Fees</h1>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest pl-0.5">Education Safe</p>
          </div>
        </div>
      </div>

      {/* Pill-shaped breadcrumb chips + action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        {/* Breadcrumb chips */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 -mb-1 w-full relative before:absolute before:right-0 before:top-0 before:bottom-0 before:w-4 before:bg-linear-to-l before:from-slate-50 dark:before:from-black before:to-transparent before:pointer-events-none before:z-10">
          <button
            onClick={() => { setViewLevel('years'); setSelectedYear(null); setSelectedSemester(null); setSelectedFolder(null); setIsAuditMode(false); setRecordSearch(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide border transition-all ${
              viewLevel === 'years'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
            }`}
          >
            <GraduationCap className="h-3 w-3" /> Home
          </button>

          {selectedYear && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <button
                onClick={() => { setViewLevel('semesters'); setSelectedSemester(null); setSelectedFolder(null); setIsAuditMode(false); setRecordSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide border transition-all ${
                  viewLevel === 'semesters'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                <Calendar className="h-3 w-3" /> {selectedYear}
              </button>
            </>
          )}

          {selectedSemester && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <button
                onClick={() => { setViewLevel('folders'); setSelectedFolder(null); setIsAuditMode(false); setRecordSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide border transition-all ${
                  viewLevel === 'folders'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                <Layers className="h-3 w-3" /> {selectedSemester}
              </button>
            </>
          )}

          {selectedFolder && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide border bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20">
                <span className="text-sm leading-none">{getCategoryIcon(selectedFolder).emoji}</span>
                {selectedFolder}
              </span>
            </>
          )}
        </div>

        {/* Action toolbar: Statement + Audit */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="h-9 px-3.5 rounded-full bg-linear-to-br from-emerald-600 to-teal-500 text-white font-black text-[10px] uppercase tracking-wide flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
          >
            <Download className="h-3.5 w-3.5" /> Statement
          </button>
          <button
            onClick={() => setIsAuditMode(!isAuditMode)}
            className={`h-9 px-3.5 rounded-full flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wide transition-all border ${
              isAuditMode
                ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600 hover:border-slate-300'
            }`}
          >
            {isAuditMode ? <TableIcon className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            {isAuditMode ? 'Exit Audit' : 'Audit'}
          </button>
        </div>
      </div>

      {/* Render Current Directory Content */}
      <div className="relative">
         {isAuditMode ? (
           <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-5 mb-4">
               <div className="flex items-center gap-3 text-amber-800 dark:text-amber-400">
                 <AlertCircle className="h-5 w-5" />
                 <div>
                   <h4 className="font-black text-xs uppercase tracking-widest">Audit Mode Active</h4>
                   <p className="text-xs font-medium opacity-80 mt-1">Reviewing all records contributing to the current totals. Duplicates (same date & amount) are highlighted in amber.</p>
                 </div>
               </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Record Context</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {(() => {
                      const records = fees.filter(f => {
                        if (selectedFolder) return f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder;
                        if (selectedSemester) return f.year === selectedYear && f.semester === selectedSemester;
                        if (selectedYear) return f.year === selectedYear;
                        return true;
                      });

                      if (records.length === 0) {
                        return <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-bold italic">No records found to audit in this directory.</td></tr>;
                      }

                      return records.map((record) => {
                        const isDuplicate = records.some(other => 
                          other.id !== record.id && 
                          other.date === record.date && 
                          parseFloat(String(other.amount)) === parseFloat(String(record.amount))
                        );

                        return (
                          <tr key={record.id} className={`group transition-colors ${isDuplicate ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}>
                            <td className="px-6 py-4">
                              {isDuplicate ? (
                                <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center animate-pulse" title="Potential Duplicate Found">
                                  <AlertCircle className="h-4 w-4" />
                                </div>
                              ) : (
                                <div className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-300 flex items-center justify-center">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">
                                {record.year} &bull; {record.semester}
                              </div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate max-w-[120px]">
                                {record.category}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs font-black text-slate-900 dark:text-white">
                                {format(parseISO(record.date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                                {record.receipt_no && <span># {record.receipt_no}</span>}
                                {record.amount_info && <span className="text-emerald-600 dark:text-emerald-500 italic max-w-[100px] truncate">{record.amount_info}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-sm font-black text-slate-900 dark:text-white">₹{formatCurrency(record.amount)}</div>
                              <div className="text-[9px] font-bold text-slate-400 italic truncate max-w-[100px] block ml-auto">{numberToWords(record.amount)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedRecord(record)} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-emerald-500 hover:border-emerald-500 transition-all">
                                  <ImageIcon className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteRecord(record.id)} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500 transition-all">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
             </div>
           </div>
         ) : renderContent()}
      </div>

      {isAddModalOpen && viewLevel === 'records' && (
        <AddEducationRecord 
          onClose={() => {
            setIsAddModalOpen(false);
            setRecordToEdit(null);
          }} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            setRecordToEdit(null);
            fetchFees();
          }}
          prefilledYear={selectedYear}
          prefilledSemester={selectedSemester}
          prefilledCategory={selectedFolder}
          recordToEdit={recordToEdit}
        />
      )}

      {isBulkModalOpen && (
        <BulkUploadEducation
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={(count) => {
            setIsBulkModalOpen(false);
            fetchFees();
            showToast(`✓ ${count} record${count !== 1 ? 's' : ''} imported successfully`);
          }}
          year={selectedYear}
          semester={selectedSemester}
          category={selectedFolder}
        />
      )}

      {/* Custom Tailwind Input Prompt Modal */}
      {promptConfig && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {promptConfig.title}
              </h3>
              <button onClick={() => setPromptConfig(null)} className="h-8 w-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 border border-slate-100 dark:border-slate-700"><X size={16} /></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if(promptValue.trim()) {
                 promptConfig.onConfirm(promptValue);
                 setPromptConfig(null);
              }
            }} className="p-6 space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Input Value</label>
                 <input
                  type="text"
                  autoFocus
                  placeholder={promptConfig.placeholder}
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-base font-bold focus:border-emerald-500 dark:text-white outline-none transition-all shadow-inner"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setPromptConfig(null)}
                  className="flex-1 h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!promptValue.trim()}
                  className="flex-1 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Tailwind CONFIRMATION Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-red-500/10">
            <div className={`p-6 flex flex-col items-center text-center ${confirmConfig.isDangerous ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}>
              <div className={`h-16 w-16 rounded-3xl flex items-center justify-center mb-4 ${confirmConfig.isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-600'}`}>
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{confirmConfig.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-4 leading-relaxed">{confirmConfig.message}</p>
            </div>
            
            <div className="p-6 flex gap-4">
              <button
                onClick={() => setConfirmConfig(null)}
                className="flex-1 h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className={`flex-1 h-14 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${confirmConfig.isDangerous ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'}`}
              >
                Yes, Do it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Receipt className="h-6 w-6 text-emerald-500" />
                Receipt Audit
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setRecordToEdit(selectedRecord);
                    setIsAddModalOpen(true);
                    setSelectedRecord(null);
                  }}
                  className="h-10 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center gap-2 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Update Details
                </button>
                <button onClick={() => setSelectedRecord(null)} className="h-10 w-10 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 transition-colors border border-slate-100 dark:border-slate-700">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Receipt Image */}
              {selectedRecord.image_url ? (
                <div
                  className="group relative rounded-[32px] border-4 border-slate-50 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-black shadow-2xl cursor-zoom-in"
                  onClick={() => setLightboxUrl(selectedRecord.image_url)}
                  title="Click to view full screen"
                >
                  <img src={selectedRecord.image_url} alt="Receipt snapshot" className="w-full h-auto object-contain max-h-[45vh] group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 3h6m0 0v6m0-6L10 14M9 21H3m0 0v-6m0 6l10-11"/></svg>
                    Full screen
                  </div>
                </div>
              ) : (
                <div className="rounded-[32px] border-4 border-dashed border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center h-48 text-slate-400">
                  <ImageIcon className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-40">No Snapshot attached</p>
                </div>
              )}

              {/* Secure Metdata Grid */}
              <div className="grid grid-cols-2 gap-8 px-2">
                <div className="text-center sm:text-left flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount Paid</p>
                  <p className="text-4xl text-slate-900 dark:text-emerald-400 font-black">₹{formatCurrency(selectedRecord.amount)}</p>
                  <p className="text-[11px] font-bold text-slate-500 italic mt-1">{numberToWords(selectedRecord.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                  <p className="text-xl text-slate-800 dark:text-slate-200 font-black">{format(parseISO(selectedRecord.date), 'dd MMM yyyy')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-inner">
                {selectedRecord.receipt_no && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt ID</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{selectedRecord.receipt_no}</p>
                  </div>
                )}
                {selectedRecord.order_number && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Reference</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{selectedRecord.order_number}</p>
                  </div>
                )}
                {selectedRecord.payment_gateway && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-bold">{selectedRecord.payment_gateway}</p>
                  </div>
                )}
                {selectedRecord.bank_reference_no && (
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank UTR / Trace</p>
                    <p className="text-xs font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/40 px-3 py-2 rounded-xl border border-emerald-500/10 break-all">{selectedRecord.bank_reference_no}</p>
                  </div>
                )}
              </div>
              
              {selectedRecord.amount_info && (
                <div className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Remarks</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">"{selectedRecord.amount_info}"</p>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end items-center gap-4">
              <button 
                onClick={() => handleDeleteRecord(selectedRecord.id)}
                className="group h-14 px-8 flex items-center gap-2 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all font-black text-sm border-2 border-red-500/10 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {isDownloadModalOpen && (
        <DownloadStatementModal
          fees={fees}
          onClose={() => setIsDownloadModalOpen(false)}
        />
      )}

      {/* Success Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-600 animate-in slide-in-from-bottom-4 fade-in duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white font-bold text-sm ${
          toast.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-red-600 shadow-red-500/30'
        }`}>
          <span className="text-lg">{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 h-5 w-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs transition-colors">✕</button>
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {lightboxUrl && (
        <LightboxOverlay url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

    </div>
  );
}

// ── Lightbox Overlay ────────────────────────────────────────────────────────────
function LightboxOverlay({ url, onClose }) {
  const [zoom, setZoom] = React.useState(1);
  const MIN = 0.5;
  const MAX = 5;

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(prev => Math.min(MAX, Math.max(MIN, prev - e.deltaY * 0.001)));
  };

  const handleImgClick = (e) => {
    e.stopPropagation();
    setZoom(prev => prev > 1.05 ? 1 : 2.5);
  };

  return (
    <div className="fixed inset-0 z-900 bg-black/95 backdrop-blur-lg flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-bold opacity-60">Receipt</span>
          <span className="text-[11px] font-black text-white bg-white/10 px-2.5 py-1 rounded-full">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs hidden sm:block">Scroll to zoom · Click image to toggle zoom</span>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4" onWheel={handleWheel} onClick={onClose}>
        <img
          src={url}
          alt="Receipt full screen"
          onClick={handleImgClick}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
          className="max-w-full max-h-full object-contain transition-transform duration-150 select-none rounded-2xl shadow-2xl"
          draggable={false}
        />
      </div>
      <div className="py-4 flex items-center justify-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => setZoom(v => Math.max(MIN, v - 0.25))}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition-colors font-black">−</button>
        <button onClick={() => setZoom(1)} className="text-white/40 text-xs font-bold hover:text-white/80 transition-colors w-10 text-center">Reset</button>
        <button onClick={() => setZoom(v => Math.min(MAX, v + 0.25))}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition-colors font-black">+</button>
      </div>
    </div>
  );
}
