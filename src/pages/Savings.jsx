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
  TrendingUp,
  CreditCard,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRightLeft,
  Banknote,
  Landmark,
  Smartphone,
  SmartphoneNfc,
  ArrowRight,
  Clipboard,
  Check,
  History as HistoryIcon,
  ArrowDownLeft,
  ArrowUpRight as ArrowUpRightIcon,
  Clock,
  ArrowDown,
  Share2,
  CheckCircle2,
  ArrowRightCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PinModal from '../components/PinModal';

export default function Savings() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState('idle'); // 'idle' | 'processing' | 'success'
  const [transferStep, setTransferStep] = useState(0); // 0-4
  const [currentOp, setCurrentOp] = useState('transfer'); // 'transfer' | 'update'
  const [receiptData, setReceiptData] = useState(null);
  
  // PIN state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState('verify'); // 'verify' | 'setup'
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [hasPin, setHasPin] = useState(false);

  // Activity Feed state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [accountActivity, setAccountActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  // Form state
  const [bankName, setBankName] = useState('');
  const [balance, setBalance] = useState('');

  // Prevent body scroll when any modal/drawer is open
  useEffect(() => {
    if (showModal || showTransferModal || selectedAccountId || transferStatus !== 'idle') {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'unset';
    }
    return () => { 
      document.body.style.overflow = 'unset'; 
      document.body.style.touchAction = 'unset';
    };
  }, [showModal, showTransferModal, selectedAccountId, transferStatus]);
  const [accountType, setAccountType] = useState('bank');



  useEffect(() => {
    if (user) {
      fetchSavings();
      checkPinStatus();
    }
  }, [user]);

  const checkPinStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('transaction_pin')
        .eq('id', user.id)
        .single();
      
      if (data?.transaction_pin) {
        setHasPin(true);
      }
    } catch (err) {
      console.error('Error checking PIN status:', err);
    }
  };

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
    setCurrentOp('update');
    setTransferStatus('processing');
    setTransferStep(1); // Step 1: Initializing

    try {
      await new Promise(r => setTimeout(r, 800));
      setTransferStep(2); // Step 2: Validating
      
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('user_savings')
          .update({ 
            bank_name: bankName, 
            balance: parseFloat(balance),
            type: accountType 
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('user_savings')
          .insert([{ 
            user_id: user.id, 
            bank_name: bankName, 
            balance: parseFloat(balance),
            type: accountType
          }]);
        if (error) throw error;
      }

      await new Promise(r => setTimeout(r, 800));
      setTransferStep(3); // Step 3: Syncing
      fetchSavings();

      await new Promise(r => setTimeout(r, 800));
      setTransferStep(4); // Step 4: Finalizing
      await new Promise(r => setTimeout(r, 600));

      setBankName('');
      setBalance('');
      setAccountType('bank');
      setEditingId(null);
      setShowModal(false);
      
      // We don't show receipt for manual updates, just close and reset
      setTransferStatus('idle');
      setTransferStep(0);
    } catch (err) {
      console.error('Error saving account:', err);
      setTransferStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    if (e) e.preventDefault();
    if (!fromAccount || !toAccount || !transferAmount || fromAccount === toAccount) return;

    // Check for PIN if set
    if (hasPin && pinMode !== 'completed') {
      setPinMode('verify');
      setShowPinModal(true);
      setPendingTransfer(true);
      return;
    }
    
    setPinMode('verify'); // Reset for next time
    setCurrentOp('transfer');
    setTransferStatus('processing');
    setTransferStep(1); // Step 1: Initiating
    const amount = parseFloat(transferAmount);
    const source = accounts.find(a => a.id === fromAccount);
    const dest = accounts.find(a => a.id === toAccount);

    if (source.balance < amount) {
      alert('Insufficient balance in source account!');
      return;
    }

    setTransferStatus('processing');
    setTransferStep(1); // Step 1: Initiating

    try {
      // 📝 Generate Metadata early
      const txnId = `TRF-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      const now = new Date();
      const timestamp = now.toISOString();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await new Promise(r => setTimeout(r, 800));
      setTransferStep(2); // Step 2: Debiting

      // Perform updates in DB
      const { error: error1 } = await supabase
        .from('user_savings')
        .update({ balance: source.balance - amount })
        .eq('id', fromAccount);

      if (error1) throw error1;

      await new Promise(r => setTimeout(r, 800));
      setTransferStep(3); // Step 3: Transferring

      const { error: error2 } = await supabase
        .from('user_savings')
        .update({ balance: dest.balance + amount })
        .eq('id', toAccount);

      if (error2) throw error2;

      // Log transactions
      await supabase.from('expenses').insert([
        {
          user_id: user.id,
          name: `Transfer to ${dest.bank_name}`,
          amount: amount,
          category: 'Transfer',
          date: timestamp,
          transaction_id: txnId,
          payment_mode: 'Cash',
          savings_account_id: fromAccount
        },
        {
          user_id: user.id,
          name: `Transfer from ${source.bank_name}`,
          amount: amount,
          category: 'Transfer',
          date: timestamp,
          transaction_id: txnId,
          payment_mode: 'Cash',
          savings_account_id: toAccount
        }
      ]);

      await new Promise(r => setTimeout(r, 800));
      setTransferStep(4); // Step 4: Finalizing
      await new Promise(r => setTimeout(r, 600));

      setReceiptData({
        from: source.bank_name,
        fromType: source.type,
        to: dest.bank_name,
        toType: dest.type,
        amount,
        txnId,
        date: now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
        time: timeStr
      });

      setTransferStatus('success');
      setShowTransferModal(false);
      fetchSavings();
    } catch (err) {
      console.error('Transfer Error:', err);
      setTransferStatus('idle');
      alert('Transfer failed. Please try again.');
    }
  };

  const fetchActivity = async (accountId) => {
    try {
      setLoadingActivity(true);
      setSelectedAccountId(accountId);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('savings_account_id', accountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAccountActivity(data || []);
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleViewReceipt = (txn) => {
    const currentAccount = accounts.find(a => a.id === selectedAccountId)?.bank_name || 'Account';
    let from = currentAccount;
    let to = txn.name;

    // Smart label parsing for professional receipts
    if (txn.name.startsWith('Transfer to ')) {
      to = txn.name.replace('Transfer to ', '');
    } else if (txn.name.startsWith('Transfer from ')) {
      from = txn.name.replace('Transfer from ', '');
      to = currentAccount;
    }

    const txnDate = new Date(txn.date);
    // Use created_at for time to avoid the "05:30 AM" issue caused by date-only database columns
    const realTimeSource = txn.created_at ? new Date(txn.created_at) : txnDate;
    const timeStr = realTimeSource.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setReceiptData({
      from,
      to,
      amount: Number(txn.amount),
      txnId: txn.transaction_id || 'N/A',
      date: txnDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
      time: timeStr
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
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
    setAccountType(account.type || 'bank');
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
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
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
            onClick={() => setShowTransferModal(true)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/40 text-slate-600 dark:text-slate-400 hover:text-teal-600 rounded-xl transition-all"
            title="Transfer Money"
          >
            <ArrowRightLeft className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setIsPrivate(!isPrivate)}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
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

          {/* Wealth Distribution Bar */}
          {!isPrivate && totalSavings > 0 && (
            <div className="mt-8 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                <span>Wealth Distribution</span>
                <span>{accounts.length} Sources</span>
              </div>
              <div className="h-3 w-full bg-teal-700/40 rounded-full flex overflow-hidden border border-white/10 p-px">
                {accounts.map((acc, i) => {
                  const width = (acc.balance / totalSavings) * 100;
                  if (width < 1) return null;
                  const colors = ['bg-white', 'bg-teal-200', 'bg-white/40', 'bg-teal-300', 'bg-white/70'];
                  return (
                    <div 
                      key={acc.id}
                      style={{ width: `${width}%` }}
                      className={`${colors[i % colors.length]} h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 hover:opacity-80`}
                      title={`${acc.bank_name}: ${width.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
            </div>
          )}
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
            <div 
              key={acc.id} 
              onClick={() => fetchActivity(acc.id)}
              className="relative overflow-hidden card group hover:shadow-md transition-all border-slate-100 dark:border-slate-800/50 cursor-pointer active:scale-[0.99]"
            >
              {/* Subtle background gradient based on index for variety */}
              <div className={`absolute inset-0 opacity-[0.03] pointer-events-none bg-linear-to-br ${
                idx % 3 === 0 ? 'from-teal-500 to-blue-500' : 
                idx % 3 === 1 ? 'from-indigo-500 to-purple-500' : 
                'from-emerald-500 to-teal-500'
              }`} />
              
              <div className="p-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-5">
                  <div className="p-px rounded-2xl bg-slate-100 dark:bg-slate-800 transition-all duration-300 transform group-hover:scale-110">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                      idx % 3 === 0 ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' : 
                      idx % 3 === 1 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 
                      'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}>
                      {acc.type === 'cash' ? <Banknote className="h-7 w-7" /> : 
                       acc.type === 'upi' ? <Smartphone className="h-7 w-7" /> : 
                       <Landmark className="h-7 w-7" />}
                    </div>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(acc);
                    }}
                    className="p-2.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-all"
                    title="Adjust Balance"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(acc.id);
                    }}
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
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Account Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bank', label: 'Bank', icon: Landmark },
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'upi', label: 'UPI/App', icon: SmartphoneNfc },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAccountType(t.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                        accountType === t.id 
                          ? 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-400' 
                          : 'bg-white border-slate-100 text-slate-500 dark:bg-slate-950 dark:border-slate-800'
                      }`}
                    >
                      <t.icon className="h-5 w-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
                    </button>
                  ))}
                </div>
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

                {!editingId && !hasPin && (
                  <button
                    type="button"
                    onClick={() => {
                      setPinMode('setup');
                      setShowPinModal(true);
                    }}
                    className="w-full h-12 rounded-2xl border-2 border-dashed border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all mt-2"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Set Security UPI PIN (Optional)
                  </button>
                )}
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Transfer Funds</h3>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleTransfer} className="p-8 space-y-8">
              {/* Vertical Transfer Flow */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Source Account</label>
                  <select 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all outline-none appearance-none"
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    required
                  >
                    <option value="">Select source...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} (₹{a.balance.toLocaleString()})</option>)}
                  </select>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                  <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-md">
                    <ArrowRightLeft className="h-4 w-4 text-teal-600 rotate-90" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Destination Account</label>
                  <select 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all outline-none appearance-none"
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    required
                  >
                    <option value="">Select destination...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Amount to Move</label>
                  {fromAccount && (
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                      Max: ₹{accounts.find(a => a.id === fromAccount)?.balance.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-300">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-6 text-2xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all outline-none shadow-inner"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isTransferring || !fromAccount || !toAccount || fromAccount === toAccount}
                className="w-full h-16 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-xl shadow-teal-500/20 transition-all hover:-translate-y-1 active:scale-[0.98] disabled:transform-none"
              >
                {isTransferring ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-6 w-6" />
                    Confirm Transfer
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Activity Drawer */}
      {selectedAccountId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 touch-none">
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={() => setSelectedAccountId(null)}
          />
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-t-[3rem] shadow-2xl flex flex-col relative z-20 animate-in slide-in-from-bottom duration-500 h-[85vh] sm:h-auto sm:max-h-[85vh] touch-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="py-3 flex justify-center sticky top-0 bg-inherit z-10">
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            
            <div className="px-8 pb-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <HistoryIcon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {accounts.find(a => a.id === selectedAccountId)?.bank_name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAccountId(null)}
                className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {loadingActivity ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
              ) : accountActivity.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No recent activity for this account.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountActivity.map((txn) => {
                    const isTransfer = txn.category === 'Transfer';
                    const isIncome = isTransfer && txn.name.toLowerCase().includes('from');
                    
                    return (
                    <div
                      key={txn.id}
                      onClick={() => handleViewReceipt(txn)}
                      className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-teal-100 dark:hover:border-teal-900/50 transition-all group cursor-pointer active:scale-[0.98]"
                    >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                              isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 
                              'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                            }`}>
                              {isIncome ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRightIcon className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white capitalize leading-tight">{txn.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {new Date(txn.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {(txn.created_at ? new Date(txn.created_at) : new Date(txn.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {txn.category}
                              </p>
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="h-3 w-3" />
                                View Receipt
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {isIncome ? '+' : '-'}₹{Number(txn.amount).toLocaleString()}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isIncome ? 'text-emerald-600/70' : 'text-red-500/70'}`}>
                              {isIncome ? 'Credited' : 'Debited'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Transaction ID Section - Professional Monospace */}
                        {txn.transaction_id && (
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-0.5">Transaction ID</p>
                              <code className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                {txn.transaction_id}
                                <button 
                                  onClick={() => copyToClipboard(txn.transaction_id)}
                                  className="ml-2 p-1 hover:text-teal-600 transition-colors"
                                  title="Copy ID"
                                >
                                  {copiedId === txn.transaction_id ? <Check className="h-3 w-3 text-emerald-500" /> : <Clipboard className="h-3 w-3 opacity-40 group-hover:opacity-100" />}
                                </button>
                              </code>
                            </div>
                            <div className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-full uppercase tracking-widest">
                              Verified
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-8 pt-0">
              <button 
                onClick={() => setSelectedAccountId(null)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Close Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎭 Transfer Animation Overlay */}
      {transferStatus === 'processing' && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="text-center space-y-8 max-w-xs w-full px-6">
            <div className="flex justify-between items-center relative py-12">
              {/* Source Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm animate-pulse">
                <div className="absolute inset-0 rounded-3xl bg-teal-500/20 animate-ping" />
                <Landmark className="h-10 w-10 text-teal-400" />
              </div>

              {/* Digital Bridge Animation */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-12 overflow-hidden">
                <div className="h-1 w-full bg-white/5 rounded-full relative">
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow" />
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow [animation-delay:0.5s]" />
                </div>
              </div>

              {/* Destination Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <Banknote className="h-10 w-10 text-white" />
              </div>
            </div>

            <div className="space-y-4 text-left bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`h-6 w-6 shrink-0 aspect-square rounded-full flex items-center justify-center transition-all duration-500 ${transferStep >= 2 ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-white/10'}`}>
                  {transferStep >= 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-white animate-in zoom-in-50 duration-300" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20 animate-pulse" />
                  )}
                </div>
                <p className={`text-sm font-semibold transition-colors duration-300 ${transferStep >= 1 ? 'text-white' : 'text-slate-500'}`}>
                  {currentOp === 'transfer' 
                    ? `Deducting ₹${transferAmount} from ${accounts.find(a => a.id === fromAccount)?.bank_name}...`
                    : 'Verifying account credentials...'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-6 w-6 shrink-0 aspect-square rounded-full flex items-center justify-center transition-all duration-500 ${transferStep >= 3 ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-white/10'}`}>
                  {transferStep >= 3 ? (
                    <CheckCircle2 className="h-4 w-4 text-white animate-in zoom-in-50 duration-300" />
                  ) : (
                    <div className={`h-1.5 w-1.5 rounded-full bg-white/20 ${transferStep === 2 ? 'animate-pulse' : ''}`} />
                  )}
                </div>
                <p className={`text-sm font-semibold transition-colors duration-300 ${transferStep >= 2 ? 'text-white' : 'text-slate-500'}`}>
                  {currentOp === 'transfer'
                    ? 'Transferring via Digital Bridge...'
                    : 'Syncing manual balance data...'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-6 w-6 shrink-0 aspect-square rounded-full flex items-center justify-center transition-all duration-500 ${transferStep >= 4 ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-white/10'}`}>
                  {transferStep >= 4 ? (
                    <CheckCircle2 className="h-4 w-4 text-white animate-in zoom-in-50 duration-300" />
                  ) : (
                    <div className={`h-1.5 w-1.5 rounded-full bg-white/20 ${transferStep === 3 ? 'animate-pulse' : ''}`} />
                  )}
                </div>
                <p className={`text-sm font-semibold transition-colors duration-300 ${transferStep >= 3 ? 'text-white' : 'text-slate-500'}`}>
                  {currentOp === 'transfer'
                    ? `Adding ₹${transferAmount} to ${accounts.find(a => a.id === toAccount)?.bank_name}...`
                    : 'Validating ledger consistency...'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-6 w-6 shrink-0 aspect-square rounded-full flex items-center justify-center transition-all duration-500 ${transferStep === 4 ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-white/10'}`}>
                  {transferStep === 4 ? (
                    <CheckCircle2 className="h-4 w-4 text-white animate-in zoom-in-50 duration-300" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  )}
                </div>
                <p className={`text-sm font-semibold transition-colors duration-300 ${transferStep >= 4 ? 'text-white' : 'text-slate-500'}`}>
                  {currentOp === 'transfer'
                    ? 'Finalizing Ledger Update...'
                    : 'Cloud synchronization complete.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📜 Pro Success Receipt */}
      {receiptData && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-receipt-pop relative">
            {/* Design Elements */}
            <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-teal-500/10 to-transparent pointer-events-none" />
            
            <button 
              onClick={() => {
                setTransferStatus('idle');
                setReceiptData(null);
              }}
              className="absolute top-6 right-6 z-20 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-8 pb-4 text-center">
              <div className="inline-flex h-20 w-20 rounded-full bg-emerald-500 items-center justify-center shadow-xl shadow-emerald-500/20 mb-6 group">
                <CheckCircle2 className="h-10 w-10 text-white animate-in zoom-in-50 duration-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {transferStatus === 'success' ? 'Transfer Sent' : 'Transaction Receipt'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-2">Digital Receipt</p>
            </div>

            <div className="px-8 py-6">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="text-center border-b border-slate-100 dark:border-slate-800 pb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-4xl font-black text-slate-900 dark:text-white">₹{receiptData.amount.toLocaleString()}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">From Account</p>
                      <p className="font-bold text-slate-900 dark:text-slate-200">{receiptData.from}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">To Destination</p>
                      <p className="font-bold text-slate-900 dark:text-slate-200">{receiptData.to}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ref ID</p>
                      <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{receiptData.txnId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Timestamp</p>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {receiptData.date}
                        <span className="block text-[9px] opacity-60">{receiptData.time}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                  <ShieldCheck className="h-3 w-3" />
                  Transaction Verified & Logged
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 grid grid-cols-5 gap-3">
              <button 
                className="col-span-1 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                title="Share Receipt"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button 
                onClick={() => {
                  setTransferStatus('idle');
                  setReceiptData(null);
                  setFromAccount('');
                  setToAccount('');
                  setTransferAmount('');
                }}
                className="col-span-4 h-14 bg-teal-600 hover:bg-teal-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-teal-500/20 transition-all active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pin Modal */}
      <PinModal 
        isOpen={showPinModal}
        mode={pinMode}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          if (pinMode === 'setup') {
            setHasPin(true);
            alert('Transaction PIN set successfully!');
          } else if (pinMode === 'verify') {
            setPinMode('completed'); // Flag to allow handleTransfer to proceed
            setTimeout(() => handleTransfer(), 100);
          }
        }}
      />
    </div>
  );
}
