import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Loader2, Trash2, Download, ExternalLink, Image as ImageIcon, X, Search, Edit3, Save } from 'lucide-react';


export default function History() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', amount: '', date: '', category: 'Other' });

  const filteredExpenses = expenses.filter(expense => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return expense.name.toLowerCase().includes(query) || expense.amount.toString().includes(query);
  });

  // Group filtered expenses by date
  const groupedByDay = filteredExpenses.reduce((acc, expense) => {
    const dateKey = expense.date.split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = { expenses: [], total: 0 };
    acc[dateKey].expenses.push(expense);
    acc[dateKey].total += Number(expense.amount);
    return acc;
  }, {});

  const dayLabel = (dateStr) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, dd MMM yyyy');
  };

  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_savings')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditMode = () => {
    setEditForm({
      name: selectedExpense.name,
      amount: selectedExpense.amount,
      category: selectedExpense.category || 'Other',
      date: selectedExpense.date.split('T')[0], // ensures yyyy-MM-dd format for input type="date"
      transaction_id: selectedExpense.transaction_id || '',
      payment_mode: selectedExpense.payment_mode || 'UPI'
    });
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!editForm.name || !editForm.amount || !editForm.date) {
      return alert("Please fill in all fields.");
    }
    
    setIsSaving(true);
    try {
      // Create a full timestamp by combining selected date with current time to avoid 05:30 AM bug
      const d = new Date(editForm.date);
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      const normalizedDate = d.toISOString();

      const { error } = await supabase
        .from('expenses')
        .update({ 
          name: editForm.name, 
          amount: parseFloat(editForm.amount),
          category: editForm.category,
          date: normalizedDate,
          transaction_id: editForm.transaction_id || null,
          payment_mode: editForm.payment_mode
        })
        .eq('id', selectedExpense.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state smoothly
      const updatedExpense = {
        ...selectedExpense,
        name: editForm.name,
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: normalizedDate,
        transaction_id: editForm.transaction_id || null,
        payment_mode: editForm.payment_mode
      };
      
      setExpenses(expenses.map(exp => exp.id === selectedExpense.id ? updatedExpense : exp));
      setSelectedExpense(updatedExpense);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating expense:', err);
      alert('Failed to update expense.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeDetailsModal = () => {
    setSelectedExpense(null);
    setIsEditing(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    
    setIsDeleting(true);
    try {
      // Find expense to potentially delete image
      const expense = expenses.find(exp => exp.id === id);
      
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Attempt to delete image from storage if it exists
      if (expense?.image_url) {
        // We'll extract the filename from the URL, but if it fails we just catch and ignore
        try {
          const urlParts = expense.image_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const path = `${user.id}/${fileName}`;
          await supabase.storage.from('receipts').remove([path]);
        } catch (storageErr) {
          console.error("Failed to delete associated storage file:", storageErr);
        }
      }

      setExpenses(expenses.filter(exp => exp.id !== id));
      if (selectedExpense?.id === id) setSelectedExpense(null);
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense.');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportCSV = () => {
    if (filteredExpenses.length === 0) return;
    
    const headers = ['Date,Name,Amount'];
    const rows = filteredExpenses.map(exp => {
      const date = format(parseISO(exp.date), 'yyyy-MM-dd');
      // Wrap name in quotes to handle commas
      const name = `"${exp.name.replace(/"/g, '""')}"`;
      return `${date},${name},${exp.amount}`;
    });

    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mt-2" />
          </div>
        </div>
        <div className="space-y-5 mt-8">
          {[1, 2, 3].map(day => (
            <div key={day} className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
              </div>
              <div className="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {[1, 2].map(item => (
                  <div key={item} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3.5">
                      <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                          <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Expense History</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review, search, and export your records.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="btn-primary whitespace-nowrap bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-300! border! border-slate-200! dark:border-slate-700! hover:bg-slate-50! dark:hover:bg-slate-800! flex items-center gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="relative mt-8">
        {/* The Activity Line (Timeline) */}
        <div className="absolute left-4.5 top-2 bottom-0 w-[2px] bg-linear-to-b from-emerald-500/50 via-teal-500/20 to-transparent pointer-events-none" />

        {Object.keys(groupedByDay).length > 0 ? (
          <div className="space-y-12">
            {Object.entries(groupedByDay).map(([dateKey, { expenses: dayExpenses, total: dayTotal }]) => (
              <div key={dateKey} className="relative pl-10">
                {/* Sticky Date Bubble */}
                <div className="sticky top-4 z-20 -ml-10 mb-6 flex items-center gap-3">
                   <div className="h-9 w-9 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] relative z-30">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                   </div>
                   <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-100 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-4 group">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">{dayLabel(dateKey)}</span>
                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">₹{dayTotal.toLocaleString('en-IN')}</span>
                   </div>
                </div>

                {/* Expense Cards for this day */}
                <div className="space-y-4 relative">
                  {dayExpenses.map((expense) => {
                    const realTimeSource = expense.created_at ? new Date(expense.created_at) : new Date(expense.date);
                    const timeStr = realTimeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    
                    return (
                    <div
                      key={expense.id}
                      className="relative group cursor-pointer active:scale-[0.99] transition-all"
                      onClick={() => setSelectedExpense(expense)}
                    >
                      {/* Connector Dot */}
                      <div className="absolute -left-[1.65rem] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:border-emerald-500 group-hover:bg-emerald-500 transition-all z-10 shadow-sm" />

                      <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-3xl p-5 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner">
                              {expense.image_url ? <ImageIcon className="h-5 w-5 text-emerald-500 group-hover:text-white" /> : <span className="text-xl">💳</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 dark:text-white truncate pr-2 tracking-tight">{expense.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-500/70 transition-colors">{expense.category || 'Other'}</span>
                                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span className="text-[9px] font-bold text-slate-400">{timeStr}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">₹{Number(expense.amount).toLocaleString('en-IN')}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button
                                 onClick={(e) => handleDelete(expense.id, e)}
                                 disabled={isDeleting}
                                 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                               >
                                 <Trash2 className="h-3.5 w-3.5" />
                               </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm mb-6">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-[0.2em] mb-2">
              {expenses.length > 0 ? "No Signal Detected" : "Empty Records"}
            </p>
            <p className="text-sm text-slate-500 font-medium">
              {expenses.length > 0 ? "Adjust your search parameters" : "Transactions will manifest here"}
            </p>
          </div>
        )}
      </div>

      {/* Modal for viewing / editing details */}
      {selectedExpense && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-6 pb-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer transition-opacity duration-300"
            onClick={() => {
              if(!isEditing) setSelectedExpense(null);
            }}
          />
          <div 
            className="relative w-full sm:w-lg bg-white dark:bg-slate-900 sm:rounded-3xl rounded-t-4xl shadow-2xl flex flex-col transform transition-all duration-300 translate-y-0 pb-safe sm:pb-0 max-h-[90vh] sm:max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute left-1/2 top-4 -translate-x-1/2 w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full sm:hidden" />
            
            <div className="flex items-center justify-between p-5 pt-8 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 rounded-t-4xl">
              <div className="flex items-center gap-2">
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {isEditing ? 'Edit Expense' : 'Transaction Details'}
                </h3>
              </div>
              {!isEditing && (
                <button 
                  onClick={() => setSelectedExpense(null)}
                  className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">

              {/* Amount hero card */}
              <div className="rounded-2xl bg-linear-to-br from-teal-500 to-teal-700 p-5 text-white relative overflow-hidden">
                <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />
                <p className="text-teal-100 text-xs font-semibold uppercase tracking-widest mb-1">Amount Paid</p>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-xl px-3 py-2 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-white/50"
                    value={editForm.amount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                ) : (
                  <p className="text-4xl font-extrabold tracking-tight">₹{Number(selectedExpense.amount).toFixed(2)}</p>
                )}
              </div>

              {/* Name + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 col-span-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Expense Name</p>
                  {isEditing ? (
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-slate-900 dark:text-white font-bold text-lg">{selectedExpense.name}</p>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Category</p>
                  {isEditing ? (
                    <select
                      className="input-field py-[0.6rem] text-sm font-medium"
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      required
                    >
                      <option value="Food & Dining">Food & Dining</option>
                      <option value="Transport">Transport</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Health">Health</option>
                      <option value="Housing">Housing</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                      {selectedExpense.category || 'Other'}
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Date</p>
                  {isEditing ? (
                    <input
                      type="date"
                      className="input-field text-sm"
                      value={editForm.date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                      max={new Date().toISOString().split('T')[0]}
                      required
                    />
                  ) : (
                    <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">{format(parseISO(selectedExpense.date), 'MMM dd, yyyy')}</p>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Time</p>
                  <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">
                    {(selectedExpense.created_at ? new Date(selectedExpense.created_at) : new Date(selectedExpense.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>

                {/* Payment Mode */}
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 col-span-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Payment Mode</p>
                  {isEditing ? (
                    <div className="relative flex p-1 bg-slate-200 dark:bg-slate-900 rounded-xl w-full sm:w-64 isolate">
                      {/* Sliding Pill Background */}
                      <div 
                        className="absolute inset-y-1 transition-all duration-300 ease-out bg-white dark:bg-slate-700 rounded-lg shadow-sm z-[-1]"
                        style={{
                          width: 'calc(50% - 4px)',
                          left: editForm.payment_mode === 'UPI' ? '4px' : 'calc(50%)',
                        }}
                      />
                      {['UPI', 'Cash'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, payment_mode: mode }))}
                          className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                            editForm.payment_mode === mode
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {selectedExpense.payment_mode || 'UPI'}
                    </span>
                  )}
                </div>

                {/* Transaction ID */}
                {(isEditing || selectedExpense.transaction_id) && (
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 col-span-2">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">UTR / Txn ID</p>
                    {isEditing ? (
                      <input
                        type="text"
                        className="input-field font-mono text-xs"
                        placeholder="e.g. 425912345678"
                        value={editForm.transaction_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                      />
                    ) : (
                      <p className="text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold break-all leading-relaxed">
                        {selectedExpense.transaction_id}
                      </p>
                    )}
                  </div>
                )}

                {/* Debited From Information */}
                {!isEditing && selectedExpense.savings_account_id && (
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 col-span-2 border border-slate-100 dark:border-slate-800/50">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <ExternalLink className="h-3 w-3" /> Debited From
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                        <Save className="h-4 w-4" />
                      </div>
                      <p className="text-slate-900 dark:text-white font-bold text-sm">
                        {accounts.find(a => a.id === selectedExpense.savings_account_id)?.bank_name || 'Linked Account'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Receipt image */}
              {selectedExpense.image_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> Receipt
                  </p>
                  <a href={selectedExpense.image_url} target="_blank" rel="noreferrer">
                    <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex justify-center hover:opacity-90 transition-opacity cursor-zoom-in">
                      <img
                        src={selectedExpense.image_url}
                        alt="Receipt"
                        className="max-h-56 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                  </a>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              {isEditing ? (
                <div className="flex gap-2.5">
                  <button
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleEditSave}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <button
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                    onClick={openEditMode}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                    onClick={(e) => handleDelete(selectedExpense.id, e)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
