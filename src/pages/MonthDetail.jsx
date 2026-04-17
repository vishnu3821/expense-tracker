import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Image as ImageIcon, X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function MonthDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { year, month } = useParams();
  
  const selectedYear = Number(year);
  const selectedMonthIndex = Number(month);

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user && year && month) fetchMonthData();
  }, [user, year, month]);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(Date.UTC(selectedYear, selectedMonthIndex, 1)).toISOString();
      // Get the last day of the month
      const endDate = new Date(Date.UTC(selectedYear, selectedMonthIndex + 1, 0, 23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExpenses(data || []);
      const total = (data || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      setMonthTotal(total);
    } catch (err) {
      console.error('Error fetching month details:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxExpenseId = expenses.length > 0 ? expenses.reduce((prev, current) => (Number(prev.amount) > Number(current.amount)) ? prev : current).id : null;
  const minExpenseId = expenses.length > 0 && expenses.length > 1 ? expenses.reduce((prev, current) => (Number(prev.amount) < Number(current.amount)) ? prev : current).id : null;

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    
    setIsDeleting(true);
    try {
      const expense = expenses.find(exp => exp.id === id);
      
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (expense?.image_url) {
        try {
          const urlParts = expense.image_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const path = `${user.id}/${fileName}`;
          await supabase.storage.from('receipts').remove([path]);
        } catch (storageErr) {
          console.error("Failed to delete associated storage file:", storageErr);
        }
      }

      setExpenses(prev => prev.filter(exp => exp.id !== id));
      if (selectedExpense?.id === id) setSelectedExpense(null);
      // recalculate total
      setMonthTotal(prev => prev - Number(expense.amount));
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto pb-6 relative min-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/more/year')}
            className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
              {MONTH_NAMES[selectedMonthIndex]}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Archive Detail {selectedYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Scan</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {/* Total Banner Header - The Wealth Pulse */}
          <div className="relative group perspective-1000">
            <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/10 transition-all duration-500">
               {/* Pulsing Aura */}
               <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
               
               <div className="relative z-10 flex flex-col items-center text-center py-4">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-3">Monthly Outflow Ledger</p>
                  <p className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white to-white/60">
                    ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="mt-6 flex items-center gap-4">
                     <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">{expenses.length} Records</span>
                     </div>
                  </div>
               </div>

               {/* Background Decorative Rings */}
               <div className="absolute -top-10 -right-10 h-40 w-40 border border-white/5 rounded-full" />
               <div className="absolute -bottom-10 -left-10 h-32 w-32 border border-white/5 rounded-full" />
            </div>
          </div>

          <div className="space-y-6 relative">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Transaction Stream</h3>
               <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 mx-4" />
            </div>
            
            {/* The Scanner Beam */}
            <div className="absolute left-0 right-0 h-10 bg-linear-to-b from-emerald-500/20 to-transparent blur-xl pointer-events-none z-20 animate-scanner-beam" />

            {expenses.length === 0 ? (
              <div className="p-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-400 italic">No recorded transactions detected.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {expenses.map((expense) => {
                  const isMax = expense.id === maxExpenseId;
                  const isMin = expense.id === minExpenseId;
                  
                  return (
                  <button
                    key={expense.id}
                    onClick={() => setSelectedExpense(expense)}
                    className={`relative overflow-hidden p-6 flex items-center justify-between text-left transition-all duration-300 active:scale-[0.98] rounded-[2rem] border group ${
                      isMax 
                        ? 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-500/5' 
                        : isMin 
                          ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    {isMax && <div className="absolute top-2 right-6 text-[8px] font-black text-red-500 uppercase tracking-widest">Highest Outlier</div>}
                    {isMin && <div className="absolute top-2 right-6 text-[8px] font-black text-emerald-500 uppercase tracking-widest">Lowest Record</div>}
                    
                    <div className="flex items-center gap-5 overflow-hidden pr-4">
                      <div className={`h-14 w-14 shrink-0 rounded-[1.25rem] flex items-center justify-center transition-all duration-500 ${
                        isMax ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                        isMin ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                        'bg-slate-50 dark:bg-slate-800/50 group-hover:bg-emerald-500 group-hover:text-white'
                      }`}>
                        {expense.image_url ? (
                          <ImageIcon className="h-6 w-6" />
                        ) : (
                          <span className="text-xl font-bold">{isMax ? '📉' : isMin ? '📈' : '💳'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-900 dark:text-white truncate tracking-tight">{expense.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{expense.category || 'Other'}</span>
                           <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                           <span className="text-[10px] font-bold text-slate-400">{format(parseISO(expense.date), 'MMM dd')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 text-right">
                      <p className={`text-xl font-black tracking-tighter ${isMax ? 'text-red-600' : isMin ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                        ₹{Number(expense.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes scanner-beam {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scanner-beam {
          animation: scanner-beam 4s infinite linear;
        }
      `}</style>

      {/* Transaction Modal Base styles from history slightly adapted */}
      {selectedExpense && (
        <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer transition-opacity duration-300"
            onClick={() => setSelectedExpense(null)}
          />
          <div 
            className="relative w-full sm:w-lg bg-white dark:bg-slate-900 sm:rounded-3xl rounded-t-4xl shadow-2xl flex flex-col transform transition-all duration-300 translate-y-0 pb-safe sm:pb-0 max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom"
          >
            <div className="absolute left-1/2 top-4 -translate-x-1/2 w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full sm:hidden" />
            
            <div className="flex items-center justify-between p-5 pt-8 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 rounded-t-4xl">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Transaction Details</h3>
              </div>
              <button 
                onClick={() => setSelectedExpense(null)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-6 space-y-5">
              <div className="rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 p-5 text-white shadow-xl relative overflow-hidden">
                 <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1 relative z-10">Amount</p>
                 <p className="text-4xl font-extrabold tracking-tight relative z-10">₹{Number(selectedExpense.amount).toFixed(2)}</p>
                 <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 col-span-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Expense Name</p>
                  <p className="text-slate-900 dark:text-white font-bold text-lg">{selectedExpense.name}</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                    {selectedExpense.category || 'Other'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date & Time</p>
                  <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">
                    {format(parseISO(selectedExpense.date), 'MMM dd, yyyy')}
                    <span className="block text-[10px] opacity-60 mt-0.5">
                      {(selectedExpense.created_at ? new Date(selectedExpense.created_at) : parseISO(selectedExpense.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 col-span-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Mode</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    {selectedExpense.payment_mode || 'UPI'}
                  </span>
                </div>

                {selectedExpense.transaction_id && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">UTR / Txn ID</p>
                    <p className="text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold break-all leading-relaxed">
                      {selectedExpense.transaction_id}
                    </p>
                  </div>
                )}
              </div>

              {selectedExpense.image_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> Receipt
                  </p>
                  <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex justify-center">
                    <img
                      src={selectedExpense.image_url}
                      alt="Receipt"
                      className="max-h-64 w-auto object-contain rounded-xl"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 z-10 pb-[env(safe-area-inset-bottom,16px)]">
              <button
                className="w-full py-3.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => handleDelete(selectedExpense.id)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
