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
  ClipboardPaste
} from 'lucide-react';
import AddEducationRecord from '../components/Education/AddEducationRecord';
import BulkUploadEducation from '../components/Education/BulkUploadEducation';

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
    return fees.filter(filterFn).reduce((sum, f) => sum + parseFloat(f.amount), 0);
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
        <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-slate-500 font-medium animate-pulse">Loading Academic Files...</p>
        </div>
      );
    }

    if (viewLevel === 'years') {
      const years = getDerivedYears();
      const totalOverall = calculateTotal(() => true);
      
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Summary Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Total Academic Paid</p>
                <h2 className="text-3xl font-black">₹{totalOverall.toLocaleString()}</h2>
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
                        <p className="text-xs text-slate-500 font-bold mt-0.5">₹{yearTotal.toLocaleString()} total</p>
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
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{totalYear.toLocaleString()}</span>
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
                        <p className="text-xs text-slate-500 font-bold">₹{semTotal.toLocaleString()}</p>
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
                <span className="text-2xl font-black text-emerald-400">₹{semTotal.toLocaleString()}</span>
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
              
              return (
                <div key={folder} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 relative group hover:shadow-2xl hover:shadow-amber-500/10 hover:border-amber-500/30 transition-all duration-300 overflow-hidden active:scale-[0.98]">
                  <div onClick={() => { setSelectedFolder(folder); setViewLevel('records'); }} className="p-6 pr-16 h-full flex items-center gap-4 cursor-pointer">
                    <FolderOpen className="h-12 w-12 text-amber-500 fill-amber-100 dark:fill-amber-900/30 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{folder}</h3>
                      <p className="text-xs text-slate-500 font-bold">₹{folderTotal.toLocaleString()} &bull; {count} items</p>
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
      const records = fees.filter(f => f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder);
      const folderTotal = calculateTotal(f => f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder);
      
      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-amber-500 fill-amber-100 dark:fill-amber-900/30" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedFolder}</h2>
                  <p className="text-xs text-slate-500 font-bold">Total: ₹{folderTotal.toLocaleString()}</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button 
                onClick={() => setIsBulkModalOpen(true)}
                className="h-11 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-sm"
              >
                <ClipboardPaste className="h-5 w-5" /> Bulk
              </button>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-sm"
              >
                <Plus className="h-5 w-5" /> Add New
              </button>
            </div>
          </div>

          <div className="space-y-3">
             {records.length === 0 ? (
               <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                 <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                 <p className="font-medium">No receipts in this folder.</p>
               </div>
             ) : (
               records.map(record => (
                 <div key={record.id} className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm active:scale-[0.99]" onClick={() => setSelectedRecord(record)}>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       {record.image_url ? (
                         <div className="relative group">
                            <img src={record.image_url} alt="Receipt" className="h-14 w-14 rounded-2xl object-cover border-2 border-slate-50 dark:border-slate-800 shadow-sm" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors rounded-2xl" />
                         </div>
                       ) : (
                         <div className="h-14 w-14 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
                           <FileText className="h-6 w-6" />
                         </div>
                       )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                           <div className="min-w-0 flex-1">
                              <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                 {record.amount_info || record.receipt_no || 'Fee Record'}
                              </h4>
                              <p className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                 <Calendar className="h-3 w-3" />
                                 {format(parseISO(record.date), 'dd MMM yyyy')}
                                 {record.receipt_no && record.amount_info && (
                                    <span className="opacity-40 ml-1"># {record.receipt_no}</span>
                                 )}
                              </p>
                           </div>
                           <div className="text-right shrink-0">
                              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">₹{parseFloat(record.amount).toLocaleString()}</p>
                           </div>
                        </div>
                      </div>
                      <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-300 group-hover:text-emerald-500 transition-colors ml-2">
                         <ChevronRight className="h-4 w-4" />
                      </div>
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
             <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
               Academic Fees
             </h1>
             <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest pl-0.5">Education Safe</p>
          </div>
        </div>
      </div>

      {/* OS Style Breadcrumbs Log */}
      {viewLevel !== 'years' && (
        <div className="flex items-center gap-1 px-4 py-3 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl text-[10px] font-black uppercase tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
          <button className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors" onClick={() => { setViewLevel('years'); setSelectedYear(null); setSelectedSemester(null); setSelectedFolder(null); }}>
             ROOT
          </button>
          
          {selectedYear && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className={`px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${viewLevel === 'semesters' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => { setViewLevel('semesters'); setSelectedSemester(null); setSelectedFolder(null); }}>{selectedYear}</button>
             </>
          )}
          {selectedSemester && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className={`px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${viewLevel === 'folders' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => { setViewLevel('folders'); setSelectedFolder(null); }}>{selectedSemester}</button>
             </>
          )}
          {selectedFolder && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 ring-1 ring-emerald-500/20">{selectedFolder}</button>
             </>
          )}
        </div>
      )}

      {/* Render Current Directory Content */}
      <div className="relative">
         {renderContent()}
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
          onSuccess={() => {
            setIsBulkModalOpen(false);
            fetchFees();
          }}
          year={selectedYear}
          semester={selectedSemester}
          category={selectedFolder}
        />
      )}

      {/* Custom Tailwind Input Prompt Modal */}
      {promptConfig && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
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
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
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
                <div className="group relative rounded-[32px] border-4 border-slate-50 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-black shadow-2xl">
                  <img src={selectedRecord.image_url} alt="Receipt snapshot" className="w-full h-auto object-contain max-h-[45vh] group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="rounded-[32px] border-4 border-dashed border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center h-48 text-slate-400">
                  <ImageIcon className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-40">No Snapshot attached</p>
                </div>
              )}

              {/* Secure Metdata Grid */}
              <div className="grid grid-cols-2 gap-8 px-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                  <p className="text-4xl text-slate-900 dark:text-emerald-400 font-black">₹{parseFloat(selectedRecord.amount).toLocaleString()}</p>
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

    </div>
  );
}
