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
  X
} from 'lucide-react';
import AddEducationRecord from '../components/Education/AddEducationRecord';

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
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Custom Tailwind Dialog State replacing window.prompt
  const [promptConfig, setPromptConfig] = useState(null);
  const [promptValue, setPromptValue] = useState('');

  const openPrompt = (title, placeholder, initialValue, onConfirm) => {
    setPromptValue(initialValue || '');
    setPromptConfig({ title, placeholder, onConfirm });
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
    openPrompt("Add Semester", "e.g. Sem 1", "", (val) => {
      const cleanSem = val.trim();
      setCreatedPaths(prev => [...prev, `${selectedYear}/${cleanSem}`]);
      setSelectedSemester(cleanSem);
      setViewLevel('folders');
    });
  };

  const handleAddFolder = () => {
    openPrompt("Add Folder Category", "e.g. Hostel Fee", "", (val) => {
      const cleanFolder = val.trim();
      setCreatedPaths(prev => [...prev, `${selectedYear}/${selectedSemester}/${cleanFolder}`]);
    });
  };

  const handleRenameFolder = async (e, oldFolderName) => {
    e.stopPropagation();
    
    openPrompt("Rename Folder", "Enter new name", oldFolderName, async (val) => {
      const cleanName = val.trim();
      if (!cleanName || cleanName === oldFolderName) return;

      // 1. Update transient states
      setCreatedPaths(prev => prev.map(p => {
        if (p === `${selectedYear}/${selectedSemester}/${oldFolderName}`) {
          return `${selectedYear}/${selectedSemester}/${cleanName}`;
        }
        return p;
      }));

      // 2. Update all records in DB
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
        alert("Failed to rename folder. Check console.");
        setLoading(false);
      }
    });
  };

  const handleDeleteFolder = async (e, folderName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete folder "${folderName}" and ALL receipts inside it permanently?`)) return;

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
      alert("Failed to delete folder.");
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Delete this receipt? This action cannot be undone.")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('education_fees').delete().eq('id', id);
      if (error) throw error;
      await fetchFees();
      setSelectedRecord(null);
    } catch (err) {
      console.error('Error deleting record:', err);
      alert('Failed to delete record');
      setLoading(false);
    }
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

  // Rendering Levels
  const renderContent = () => {
    if (loading && fees.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      );
    }

    if (viewLevel === 'years') {
      const years = getDerivedYears();
      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Academic Years</h2>
            <button onClick={handleAddYear} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="h-4 w-4" /> Add Year
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {years.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                <p>No years created yet.</p>
              </div>
            ) : (
              years.map(year => (
                <button
                  key={year}
                  onClick={() => { setSelectedYear(year); setViewLevel('semesters'); }}
                  className="card flex items-center justify-between p-6 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-emerald-500/10 hover:shadow-xl transition-all group text-left cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 transition-colors shadow-inner">
                      <Calendar className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">Year {year}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Expand Semesters</p>
                    </div>
                  </div>
                  <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    if (viewLevel === 'semesters') {
      const semesters = getDerivedSemesters(selectedYear);
      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" /> {selectedYear} Semesters
            </h2>
            <button onClick={handleAddSemester} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-md">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {semesters.length === 0 ? (
               <div className="col-span-full text-center py-10 text-slate-400">No semesters added.</div>
            ) : (
               semesters.map(sem => (
                 <button
                   key={sem}
                   onClick={() => { setSelectedSemester(sem); setViewLevel('folders'); }}
                   className="card flex items-center justify-between p-6 hover:border-teal-300 dark:hover:border-teal-700 transition-all group text-left cursor-pointer active:scale-[0.98]"
                 >
                   <div className="flex items-center gap-4">
                     <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 transition-colors">
                       <Layers className="h-6 w-6" />
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-slate-900 dark:text-white">{sem}</h3>
                       <p className="text-xs text-slate-500 font-medium">View Folders</p>
                     </div>
                   </div>
                   <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-teal-500 transition-colors" />
                 </button>
               ))
            )}
          </div>
        </div>
      );
    }

    if (viewLevel === 'folders') {
      const folders = getDerivedFolders(selectedYear, selectedSemester);
      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
           <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" /> Categories / Folders
            </h2>
            <button onClick={handleAddFolder} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-md">
              <Plus className="h-4 w-4" /> Folder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {folders.length === 0 ? (
               <div className="col-span-full text-center py-10 text-slate-400">Empty directory. Add a folder.</div>
            ) : (
              folders.map(folder => {
                const count = fees.filter(f => f.year === selectedYear && f.semester === selectedSemester && f.category === folder).length;
                return (
                  <div key={folder} className="card relative group hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer active:scale-[0.98]">
                    <div onClick={() => { setSelectedFolder(folder); setViewLevel('records'); }} className="p-6 pr-16 h-full flex flex-col justify-center">
                      <div className="flex items-center gap-4">
                        <FolderOpen className="h-10 w-10 text-amber-500 fill-amber-100 dark:fill-amber-900/30 shrink-0" />
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{folder}</h3>
                          <p className="text-xs text-slate-500 font-medium">{count} Receipt{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar overlay absolute for editing */}
                    <div className="absolute right-2 top-0 bottom-0 py-2 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleRenameFolder(e, folder)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => handleDeleteFolder(e, folder)} className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-red-600 shadow-sm border border-red-100 dark:border-red-800">
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

    if (viewLevel === 'records') {
      const records = fees.filter(f => f.year === selectedYear && f.semester === selectedSemester && f.category === selectedFolder);
      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between border-dashed border-b-2 border-slate-200 dark:border-slate-700 pb-4 mb-6">
            <div className="flex items-center gap-3">
               <FolderOpen className="h-8 w-8 text-amber-500 fill-amber-100 dark:fill-amber-900/30 shrink-0" />
               <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedFolder}</h2>
            </div>
            {/* The ADD RECORD BUTTON IS EXCLUSIVELY MOVED HERE */}
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5" /> Add Record
            </button>
          </div>

          <div className="space-y-3">
             {records.length === 0 ? (
               <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                 <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                 This folder is currently empty.
               </div>
             ) : (
               records.map(record => (
                 <div key={record.id} className="card p-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all cursor-pointer shadow-sm hover:shadow-md" onClick={() => setSelectedRecord(record)}>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       {record.image_url ? (
                         <img src={record.image_url} alt="Receipt" className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                       ) : (
                         <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
                           <FileText className="h-5 w-5" />
                         </div>
                       )}
                       <div>
                         <h4 className="text-base font-bold text-slate-900 dark:text-white">Amount ₹{record.amount}</h4>
                         <p className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 font-medium">
                           <Calendar className="h-3 w-3" />
                           {format(parseISO(record.date), 'dd MMM yyyy')}
                         </p>
                       </div>
                     </div>
                     <ChevronRight className="h-5 w-5 text-slate-300" />
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
              className="h-11 w-11 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 text-slate-700 dark:text-slate-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/more" className="h-11 w-11 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}

          <div>
             <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
               Educational Fees
             </h1>
          </div>
        </div>
      </div>

      {/* OS Style Breadcrumbs Log */}
      {viewLevel !== 'years' && (
        <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
          <button className="px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors focus:ring-2 ring-emerald-500 outline-none" onClick={() => { setViewLevel('years'); setSelectedYear(null); setSelectedSemester(null); setSelectedFolder(null); }}>
             Root
          </button>
          
          {selectedYear && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className={`px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:ring-2 ring-emerald-500 outline-none ${viewLevel === 'semesters' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => { setViewLevel('semesters'); setSelectedSemester(null); setSelectedFolder(null); }}>{selectedYear}</button>
             </>
          )}
          {selectedSemester && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className={`px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:ring-2 ring-emerald-500 outline-none ${viewLevel === 'folders' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => { setViewLevel('folders'); setSelectedFolder(null); }}>{selectedSemester}</button>
             </>
          )}
          {selectedFolder && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
               <button className="px-2 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 focus:ring-2 ring-emerald-500 outline-none">{selectedFolder}</button>
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
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchFees();
          }}
          prefilledYear={selectedYear}
          prefilledSemester={selectedSemester}
          prefilledCategory={selectedFolder}
        />
      )}

      {/* Custom Tailwind Input Prompt Modal */}
      {promptConfig && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {promptConfig.title}
              </h3>
              <button 
                onClick={() => setPromptConfig(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors hidden"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if(promptValue.trim()) {
                 promptConfig.onConfirm(promptValue);
                 setPromptConfig(null);
              }
            }} className="p-5 space-y-4">
              <input
                type="text"
                autoFocus
                placeholder={promptConfig.placeholder}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all shadow-sm"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                required
              />
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPromptConfig(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!promptValue.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:active:scale-100"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-500" />
                Receipt Inspection
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Receipt Image */}
              {selectedRecord.image_url ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[200px] shadow-inner">
                  <img src={selectedRecord.image_url} alt="Receipt snapshot" className="w-full h-auto object-contain max-h-[40vh]" />
                </div>
              ) : (
                 <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center h-32 text-slate-400">
                  <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No image attached to this record.</p>
                </div>
              )}

              {/* Secure Metdata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount Paid</p>
                  <p className="text-xl text-slate-900 dark:text-white font-black">₹{selectedRecord.amount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-base text-slate-800 dark:text-slate-200 font-bold">{format(parseISO(selectedRecord.date), 'dd MMM yyyy')}</p>
                </div>
                {selectedRecord.receipt_no && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipt ID</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.receipt_no}</p>
                  </div>
                )}
                {selectedRecord.order_number && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order No</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.order_number}</p>
                  </div>
                )}
                {selectedRecord.payment_gateway && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gateway Terminal</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.payment_gateway}</p>
                  </div>
                )}
                {selectedRecord.bank_reference_no && (
                  <div className="space-y-1 text-wrap break-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Trace Number (UTR)</p>
                    <p className="text-sm font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md inline-block">{selectedRecord.bank_reference_no}</p>
                  </div>
                )}
              </div>
              
              {selectedRecord.amount_info && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Remarks</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedRecord.amount_info}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
              <button 
                onClick={() => handleDeleteRecord(selectedRecord.id)}
                className="px-5 py-2.5 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors font-bold text-sm border border-transparent hover:border-red-200 dark:hover:border-red-800"
              >
                <Trash2 className="h-4 w-4" />
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
