import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { Loader2, Trash2, Download, ExternalLink, Image as ImageIcon, X, Search, Edit3, Save } from 'lucide-react';

export default function History() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', amount: '', date: '' });

  const filteredExpenses = expenses.filter(expense => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return expense.name.toLowerCase().includes(query) || expense.amount.toString().includes(query);
  });

  useEffect(() => {
    if (user) fetchExpenses();
  }, [user]);

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
      date: selectedExpense.date.split('T')[0], // ensures yyyy-MM-dd format for input type="date"
      transaction_id: selectedExpense.transaction_id || ''
    });
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!editForm.name || !editForm.amount || !editForm.date) {
      return alert("Please fill in all fields.");
    }
    
    setIsSaving(true);
    try {
      // Normalize date to ISO format representing start of day in UTC roughly
      let [year, month, day] = editForm.date.split("-");
      const normalizedDate = new Date(Date.UTC(year, month - 1, day)).toISOString();

      const { error } = await supabase
        .from('expenses')
        .update({ 
          name: editForm.name, 
          amount: parseFloat(editForm.amount), 
          date: normalizedDate,
          transaction_id: editForm.transaction_id || null
        })
        .eq('id', selectedExpense.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state smoothly
      const updatedExpense = {
        ...selectedExpense,
        name: editForm.name,
        amount: parseFloat(editForm.amount),
        date: normalizedDate,
        transaction_id: editForm.transaction_id || null
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
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Expense History</h2>
          <p className="text-slate-500 text-sm mt-1">Review all your transactions and export data.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="btn-primary whitespace-nowrap !bg-white !text-slate-700 !border !border-slate-200 hover:!bg-slate-50 flex items-center gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-medium text-sm">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredExpenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedExpense(expense)}
                  >
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {format(parseISO(expense.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{expense.name}</span>
                        {expense.image_url && (
                          <ImageIcon className="h-4 w-4 text-teal-600 shrink-0" title="Has receipt" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      ₹{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => handleDelete(expense.id, e)}
                        disabled={isDeleting}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
              <ExternalLink className="h-6 w-6 text-slate-400" />
            </div>
            <p className="font-medium text-slate-900 mb-1">
              {expenses.length > 0 ? "No search results match" : "No expenses yet"}
            </p>
            <p className="text-sm">
              {expenses.length > 0 ? "Try adjusting your search query." : "When you record transactions, they'll appear here."}
            </p>
          </div>
        )}
      </div>

      {/* Modal for viewing / editing details */}
      {selectedExpense && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeDetailsModal}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <h3 className="text-base font-bold text-slate-800">
                  {isEditing ? 'Edit Expense' : 'Expense Details'}
                </h3>
              </div>
              {!isEditing && (
                <button
                  onClick={closeDetailsModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* ── Scrollable body ── */}
            <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">

              {/* Amount hero card */}
              <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-5 text-white relative overflow-hidden">
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
                <div className="bg-slate-50 rounded-2xl p-4 col-span-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Expense Name</p>
                  {isEditing ? (
                    <input
                      type="text"
                      className="input-field"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  ) : (
                    <p className="text-slate-900 font-bold text-lg">{selectedExpense.name}</p>
                  )}
                </div>

                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</p>
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
                    <p className="text-slate-900 font-semibold text-sm">{format(parseISO(selectedExpense.date), 'MMM dd, yyyy')}</p>
                  )}
                </div>

                {/* Transaction ID */}
                {(isEditing || selectedExpense.transaction_id) && (
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">UTR / Txn ID</p>
                    {isEditing ? (
                      <input
                        type="text"
                        className="input-field font-mono text-xs"
                        placeholder="e.g. 425912345678"
                        value={editForm.transaction_id}
                        onChange={(e) => setEditForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                      />
                    ) : (
                      <p className="text-slate-700 font-mono text-xs font-semibold break-all leading-relaxed">
                        {selectedExpense.transaction_id}
                      </p>
                    )}
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

            {/* ── Footer actions ── */}
            <div className="px-5 py-4 border-t border-slate-100 bg-white">
              {isEditing ? (
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 py-3 text-sm font-semibold text-white bg-teal-600 rounded-2xl hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleEditSave}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    onClick={openEditMode}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    className="flex-1 py-3 text-sm font-semibold text-white bg-red-500 rounded-2xl hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={(e) => handleDelete(selectedExpense.id, e)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
