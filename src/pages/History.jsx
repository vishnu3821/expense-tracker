import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { Loader2, Trash2, Download, ExternalLink, Image as ImageIcon, X, Search } from 'lucide-react';

export default function History() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

      {/* Modal for viewing details */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedExpense(null)}>
          <div 
            className="card bg-white w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-full" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Expense Details</h3>
              <button 
                onClick={() => setSelectedExpense(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-slate-500 font-medium mb-1">Date</p>
                  <p className="text-slate-900 font-semibold">{format(parseISO(selectedExpense.date), 'MMMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium mb-1">Amount</p>
                  <p className="text-teal-600 font-bold text-lg leading-tight">₹{Number(selectedExpense.amount).toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 font-medium mb-1">Expense Name</p>
                  <p className="text-slate-900 font-semibold text-base">{selectedExpense.name}</p>
                </div>
              </div>

              {selectedExpense.image_url && (
                <div className="border-t border-slate-100 pt-6">
                  <p className="text-slate-500 font-medium mb-3 text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Receipt Image
                  </p>
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex justify-center">
                    <a href={selectedExpense.image_url} target="_blank" rel="noreferrer" title="Open full image">
                      <img 
                        src={selectedExpense.image_url} 
                        alt="Receipt" 
                        className="max-h-[300px] w-auto object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button 
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                onClick={() => setSelectedExpense(null)}
              >
                Close
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                onClick={(e) => handleDelete(selectedExpense.id, e)}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
