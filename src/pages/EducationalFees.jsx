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
  Search,
  Calendar,
  IndianRupee,
  Building2,
  Trash2,
  ImageIcon
} from 'lucide-react';
import AddEducationRecord from '../components/Education/AddEducationRecord';

export default function EducationalFees() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState([]);
  
  // View states: 'years' | 'semesters' | 'categories' | 'records'
  const [viewLevel, setViewLevel] = useState('years');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('education_fees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchFees();
      setSelectedRecord(null);
    } catch (err) {
      console.error('Error deleting record:', err);
      alert('Failed to delete record');
    } finally {
      setLoading(false);
    }
  };

  // Navigations
  const goBack = () => {
    if (viewLevel === 'records') {
      setViewLevel('categories');
      setSelectedCategory(null);
      setSelectedRecord(null);
    } else if (viewLevel === 'categories') {
      setViewLevel('semesters');
      setSelectedSemester(null);
    } else if (viewLevel === 'semesters') {
      setViewLevel('years');
      setSelectedYear(null);
    }
  };

  // Derived Data
  const filteredFees = fees.filter(f => {
    if (selectedYear && f.year !== selectedYear) return false;
    if (selectedSemester && f.semester !== selectedSemester) return false;
    if (selectedCategory && f.category !== selectedCategory) return false;
    return true;
  });

  const getUniqueFolders = (key) => {
    const vals = filteredFees.map(f => f[key]);
    return [...new Set(vals)].sort();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      );
    }

    if (viewLevel === 'years') {
      const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a)); // Descending years
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-right-4 duration-300">
          {years.length === 0 ? (
            <div className="col-span-1 sm:col-span-2 text-center py-12 px-4">
              <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <FolderOpen className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Academic Records Yet</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">Add your first educational fee to start building your academic folder structure.</p>
              <button onClick={() => setIsAddModalOpen(true)} className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                Add First Record
              </button>
            </div>
          ) : (
            years.map(year => (
              <button
                key={year}
                onClick={() => { setSelectedYear(year); setViewLevel('semesters'); }}
                className="card flex items-center justify-between p-5 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 transition-colors">
                    <Folder className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Academic Year {year}</h3>
                    <p className="text-xs text-slate-500 font-medium">Folders inside</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            ))
          )}
        </div>
      );
    }

    if (viewLevel === 'semesters') {
      const semesters = getUniqueFolders('semester');
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-right-4 duration-300">
          {semesters.map(sem => (
            <button
              key={sem}
              onClick={() => { setSelectedSemester(sem); setViewLevel('categories'); }}
              className="card flex items-center justify-between p-5 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 transition-colors">
                  <Folder className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{sem}</h3>
                  <p className="text-xs text-slate-500 font-medium">View categories</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </button>
          ))}
        </div>
      );
    }

    if (viewLevel === 'categories') {
      const categories = getUniqueFolders('category');
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-right-4 duration-300">
          {categories.map(cat => {
            const count = filteredFees.filter(f => f.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setViewLevel('records'); }}
                className="card flex items-center justify-between p-5 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 transition-colors">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{cat}</h3>
                    <p className="text-xs text-slate-500 font-medium">{count} record{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            )
          })}
        </div>
      );
    }

    if (viewLevel === 'records') {
      return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          {filteredFees.map(record => (
            <div key={record.id} className="card p-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all cursor-pointer" onClick={() => setSelectedRecord(record)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 border border-slate-100 dark:border-slate-800/80">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Amount ₹{record.amount}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(record.date), 'dd MMM yyyy')}
                    </div>
                    {record.amount_info && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{record.amount_info}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg text-sm">
                  {record.receipt_no || record.order_number || 'View'}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {viewLevel !== 'years' ? (
            <button 
              onClick={goBack}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/more" className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {viewLevel === 'years' && 'Educational Fees'}
              {viewLevel === 'semesters' && `Year ${selectedYear}`}
              {viewLevel === 'categories' && `${selectedSemester}`}
              {viewLevel === 'records' && `${selectedCategory}`}
            </h1>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="h-3 w-3" />
              <span>Academic Records</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Record</span>
        </button>
      </div>

      {/* Path Breadcrumbs */}
      {viewLevel !== 'years' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-wider overflow-x-auto whitespace-nowrap hide-scrollbar">
          <span className="cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => { setViewLevel('years'); setSelectedYear(null); setSelectedSemester(null); setSelectedCategory(null); }}>Root</span>
          
          {selectedYear && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0" />
               <span className={`cursor-pointer hover:text-emerald-500 transition-colors ${viewLevel === 'semesters' ? 'text-slate-700 dark:text-slate-300' : ''}`} onClick={() => { setViewLevel('semesters'); setSelectedSemester(null); setSelectedCategory(null); }}>{selectedYear}</span>
             </>
          )}
          {selectedSemester && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0" />
               <span className={`cursor-pointer hover:text-emerald-500 transition-colors ${viewLevel === 'categories' ? 'text-slate-700 dark:text-slate-300' : ''}`} onClick={() => { setViewLevel('categories'); setSelectedCategory(null); }}>{selectedSemester}</span>
             </>
          )}
          {selectedCategory && (
             <>
               <ChevronRight className="h-3 w-3 shrink-0" />
               <span className="text-slate-700 dark:text-slate-300">{selectedCategory}</span>
             </>
          )}
        </div>
      )}

      {/* Render Dynamic View */}
      {renderContent()}

      {/* Add Modal */}
      {isAddModalOpen && (
        <AddEducationRecord 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchFees();
          }}
          prefilledYear={selectedYear}
          prefilledSemester={selectedSemester}
          prefilledCategory={selectedCategory}
        />
      )}

      {/* Record Preview Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-500" />
                Record Details
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Receipt Image */}
              {selectedRecord.image_url ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[200px]">
                  <img src={selectedRecord.image_url} alt="Receipt" className="w-full h-auto object-contain max-h-[40vh]" />
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center h-32 text-slate-400">
                  <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No receipt generated</p>
                </div>
              )}

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount Paid</p>
                  <p className="text-lg text-slate-900 dark:text-white font-black">₹{selectedRecord.amount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{format(parseISO(selectedRecord.date), 'dd MMM yyyy')}</p>
                </div>
                {selectedRecord.receipt_no && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receipt No</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.receipt_no}</p>
                  </div>
                )}
                {selectedRecord.order_number && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Number</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.order_number}</p>
                  </div>
                )}
                {selectedRecord.payment_gateway && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gateway</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.payment_gateway}</p>
                  </div>
                )}
                {selectedRecord.bank_reference_no && (
                  <div className="space-y-1 text-wrap break-all">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Ref / UTR</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedRecord.bank_reference_no}</p>
                  </div>
                )}
              </div>
              
              {selectedRecord.amount_info && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRecord.amount_info}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button 
                onClick={() => handleDelete(selectedRecord.id)}
                className="px-4 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-semibold text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Delete Post
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
