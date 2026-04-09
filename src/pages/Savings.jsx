import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  ChevronLeft, 
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  X,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Savings() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Form state
  const [bankName, setBankName] = useState('');
  const [balance, setBalance] = useState('');

  useEffect(() => {
    if (user) fetchSavings();
  }, [user]);

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_savings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching savings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bankName || !balance) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('user_savings')
          .update({ bank_name: bankName, balance: parseFloat(balance) })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('user_savings')
          .insert([{ 
            user_id: user.id, 
            bank_name: bankName, 
            balance: parseFloat(balance) 
          }]);
        if (error) throw error;
      }

      setBankName('');
      setBalance('');
      setEditingId(null);
      setShowModal(false);
      fetchSavings();
    } catch (err) {
      console.error('Error saving account:', err);
      alert('Failed to save account. Did you run the SQL in Supabase?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this account?')) return;

    try {
      const { error } = await supabase
        .from('user_savings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setAccounts(accounts.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting account:', err);
    }
  };

  const openEdit = (account) => {
    setBankName(account.bank_name);
    setBalance(account.balance);
    setEditingId(account.id);
    setShowModal(true);
  };

  const totalSavings = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  if (loading && accounts.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/more" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ChevronLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Your Savings</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Track your balance manually across banks.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPrivate(!isPrivate)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
            title={isPrivate ? "Show Balances" : "Hide Balances"}
          >
            {isPrivate ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setBankName('');
              setBalance('');
              setShowModal(true);
            }}
            className="h-10 w-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="relative overflow-hidden rounded-3xl bg-teal-600 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <p className="text-teal-100 text-xs font-bold uppercase tracking-[0.2em]">Combined Savings Portfolio</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">
              {isPrivate ? '••••••••' : `₹${totalSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </span>
            {!isPrivate && <TrendingUp className="h-5 w-5 text-teal-200" />}
          </div>
          <div className="mt-6 flex gap-4">
            <div className="flex items-center gap-2 text-teal-50 px-3 py-1 bg-teal-500/30 rounded-full text-xs">
              <CreditCard className="h-3 w-3" />
              <span>{accounts.length} Accounts</span>
            </div>
          </div>
        </div>
        {/* Background blobs for design */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-teal-500 blur-3xl opacity-50" />
        <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-teal-700 blur-3xl opacity-50" />
      </div>

      {/* Accounts List */}
      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No bank accounts added yet.</p>
            <button 
              onClick={() => setShowModal(true)}
              className="mt-4 text-teal-600 font-semibold hover:underline"
            >
              Add your first account
            </button>
          </div>
        ) : (
          accounts.map((acc, idx) => (
            <div key={acc.id} className="relative overflow-hidden card group hover:shadow-md transition-all border-slate-100 dark:border-slate-800/50">
              {/* Subtle background gradient based on index for variety */}
              <div className={`absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-br ${
                idx % 3 === 0 ? 'from-teal-500 to-blue-500' : 
                idx % 3 === 1 ? 'from-indigo-500 to-purple-500' : 
                'from-emerald-500 to-teal-500'
              }`} />
              
              <div className="p-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-5">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${
                    idx % 3 === 0 ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' : 
                    idx % 3 === 1 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 
                    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                  }`}>
                    <Wallet className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{acc.bank_name}</h3>
                      {idx === 0 && <ShieldCheck className="h-3.5 w-3.5 text-teal-500" title="Primary Account" />}
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1 font-mono tracking-tight">
                      {isPrivate ? '••••••' : `₹${Number(acc.balance).toLocaleString('en-IN')}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openEdit(acc)}
                    className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-all"
                    title="Adjust Balance"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(acc.id)}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    title="Delete Account"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingId ? 'Update Bank Account' : 'Add Bank Account'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Savings, Cash Wallet"
                  className="input-field"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="input-field"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full h-12 flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    {editingId ? 'Update Account' : 'Save Account'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
