import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { 
  Loader2, UploadCloud, CheckCircle, AlertCircle, X, Sparkles, Hash, Landmark, 
  ReceiptText, ShieldCheck, CreditCard, ArrowRight,
  Utensils, Car, ShoppingBag, Film, Zap, HeartPulse, Home, MoreHorizontal
} from 'lucide-react';
import { get, del } from 'idb-keyval';

import { createWorker } from 'tesseract.js';

const CATEGORIES = [
  { name: 'Food & Dining', icon: Utensils, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { name: 'Transport', icon: Car, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { name: 'Shopping', icon: ShoppingBag, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { name: 'Entertainment', icon: Film, color: 'bg-pink-50 text-pink-600 border-pink-100' },
  { name: 'Utilities', icon: Zap, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  { name: 'Health', icon: HeartPulse, color: 'bg-red-50 text-red-600 border-red-100' },
  { name: 'Housing', icon: Home, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { name: 'Other', icon: MoreHorizontal, color: 'bg-slate-50 text-slate-600 border-slate-100' }
];

async function analyzeReceiptImage(imageFile) {
  const worker = await createWorker('eng');
  try {
    const imageUrl = URL.createObjectURL(imageFile);
    const { data: { text } } = await worker.recognize(imageUrl);
    URL.revokeObjectURL(imageUrl);

    // Extract transaction ID / UTR — look for labels first, then long alphanumeric string
    let transaction_id = '';
    const txnLabels = text.match(
      /(?:UTR|UPI Ref|Transaction ID|Txn ID|Ref No|Order ID|Reference)[^\w]*([\w]{8,})/i
    );
    if (txnLabels) {
      transaction_id = txnLabels[1];
    } else {
      const fallbackId = text.match(/\b([A-Z0-9]{12,})\b/);
      if (fallbackId) transaction_id = fallbackId[1];
    }

    return { transaction_id };
  } finally {
    await worker.terminate();
  }
}


export default function AddExpense() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [successName, setSuccessName] = useState(null); // stores item name for toast
  const [error, setError] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const imagePreviewUrl = useRef(null);

  // Animation State
  const [transferStatus, setTransferStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [transferStep, setTransferStep] = useState(0);
  const [rewardMessage, setRewardMessage] = useState('');

  const REWARDS = [
    "Wealth Secured! 💰",
    "Financial Goal Updated! 🚀",
    "Budget Protocol Active! 🛡️",
    "Expense Logged to Ledger! 📜",
    "Smart Saving Move! ✨",
    "Transaction Certified! ✅"
  ];


  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'Other',
    date: format(new Date(), 'yyyy-MM-dd'),
    transaction_id: '',
    payment_mode: 'UPI',
    savings_account_id: '',
    image: null
  });

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl.current) {
        URL.revokeObjectURL(imagePreviewUrl.current);
      }
    };
  }, []);

  useEffect(() => {
    async function checkSharedImage() {
      try {
        const sharedBlob = await get('shared-image');
        if (sharedBlob) {
          setFormData(prev => ({ ...prev, image: sharedBlob }));
          await del('shared-image');
        }
      } catch (e) {
        console.error('Failed to load shared image', e);
      }
    }
    checkSharedImage();
  }, []);

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_savings')
        .select('id, bank_name, balance')
        .eq('user_id', user.id);
      if (!error) setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      const file = files[0];
      setFormData(prev => ({ ...prev, [name]: file }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleScanImage = async () => {
    if (!formData.image) return;

    setScanning(true);
    setScanMessage(null);

    try {
      const result = await analyzeReceiptImage(formData.image);

      if (result.transaction_id && result.transaction_id !== '') {
        setFormData(prev => ({ ...prev, transaction_id: result.transaction_id }));
        setScanMessage({ type: 'success', text: `✓ Auto-filled: transaction ID` });
      } else {
        setScanMessage({ type: 'warn', text: 'No transaction ID detected. Please fill manually.' });
      }
    } catch (err) {
      setScanMessage({ type: 'error', text: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
    setScanMessage(null);
    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessName(null);
    const savedName = formData.name; // capture before reset

    try {
      // Start Animation Protocol
      setTransferStatus('processing');
      if (formData.savings_account_id) {
        setTransferStep(1); // Initiating
        await new Promise(r => setTimeout(r, 800));
        setTransferStep(2); // Deducting
      } else {
        setTransferStep(3); // General Recording
        await new Promise(r => setTimeout(r, 500));
      }

      let image_url = null;
      if (formData.image) {
        const fileNameOriginal = formData.image.name || 'shared_receipt.png';
        const fileExt = fileNameOriginal.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, formData.image);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
        image_url = publicUrl;
      }

      if (formData.savings_account_id) {
        setTransferStep(3); // Syncing with ledger
        await new Promise(r => setTimeout(r, 600));
      }

      const { data: newExpense, error: dbError } = await supabase
        .from('expenses')
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: (() => {
              const d = new Date(formData.date);
              const now = new Date();
              d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
              return d.toISOString();
            })(),
            transaction_id: formData.transaction_id || null,
            payment_mode: formData.payment_mode,
            image_url,
            savings_account_id: formData.savings_account_id || null
          }
        ]).select().single();

      if (dbError) throw dbError;

      setSuccessName(savedName);

      // Deduct balance from the selected account
      if (formData.savings_account_id) {
        const selectedAccount = accounts.find(a => a.id === formData.savings_account_id);
        if (selectedAccount) {
          const newBalance = Number(selectedAccount.balance) - parseFloat(formData.amount);
          const { error: updateError } = await supabase
            .from('user_savings')
            .update({ balance: newBalance })
            .eq('id', formData.savings_account_id);
          
          if (updateError) {
            console.error('Failed to deduct balance:', updateError);
          } else {
            fetchAccounts();
          }
        }
      }
      setTransferStep(4); // Finalizing
      await new Promise(r => setTimeout(r, 800));
      setRewardMessage(REWARDS[Math.floor(Math.random() * REWARDS.length)]);
      setTransferStatus('success');

      setFormData({
        name: '',
        amount: '',
        category: 'Other',
        date: format(new Date(), 'yyyy-MM-dd'),
        transaction_id: '',
        payment_mode: 'UPI',
        savings_account_id: '',
        image: null
      });

      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';
      setScanMessage(null);

      setTimeout(() => setSuccessName(null), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while adding the expense.');
      setTransferStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const imagePreview = formData.image ? URL.createObjectURL(formData.image) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Expense</h2>
        <p className="text-slate-500 text-sm mt-1">Upload a payment screenshot and let AI auto-fill the details.</p>
      </div>

      <div className="card pt-1 shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Receipt Image Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Receipt / Payment Screenshot
              <span className="ml-2 text-xs font-normal text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">AI auto-fill ✨</span>
            </label>

            {formData.image ? (
              <div className="space-y-3">
                <div className="relative mt-2 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex justify-center items-center">
                  <img
                    src={imagePreview}
                    alt="Receipt Preview"
                    className="w-full h-auto max-h-[300px] object-contain rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-sm transition-all z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* AI Scan Button */}
                <button
                  type="button"
                  onClick={handleScanImage}
                  disabled={scanning}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-100 hover:border-teal-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing screenshot...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Scan with AI — Auto-fill Amount & Transaction ID
                    </>
                  )}
                </button>

                {scanMessage && (
                  <div className={`rounded-xl p-3 text-sm font-medium flex items-center gap-2 ${
                    scanMessage.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                    scanMessage.type === 'warn' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {scanMessage.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0" />}
                    {scanMessage.type !== 'success' && <AlertCircle className="h-4 w-4 shrink-0" />}
                    {scanMessage.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 flex justify-center rounded-xl border border-dashed border-slate-300 px-6 py-8 hover:bg-slate-50 transition-colors">
                <div className="text-center group">
                  <UploadCloud className="mx-auto h-10 w-10 text-slate-400 group-hover:text-teal-500 transition-colors" />
                  <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                    <label
                      htmlFor="image-upload"
                      className="relative cursor-pointer rounded-md font-semibold text-teal-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-600 focus-within:ring-offset-2 hover:text-teal-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="image-upload"
                        name="image"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Expense Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Amazon Order, Electricity Bill"
                className="input-field"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium text-slate-700">
                Amount (₹)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="input-field"
                value={formData.amount}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-3 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
              
              {/* Active Category Trigger Card */}
              <button
                type="button"
                onClick={() => setIsCategoryOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-teal-600 dark:text-teal-400 border border-slate-100 dark:border-slate-700 transition-transform group-active:scale-95">
                    {(() => {
                      const cat = CATEGORIES.find(c => c.name === formData.category) || CATEGORIES[CATEGORIES.length - 1];
                      const Icon = cat.icon;
                      return <Icon className="h-6 w-6" />;
                    })()}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active Selection</p>
                    <p className="text-base font-bold text-slate-900 dark:text-white leading-none">{formData.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg uppercase">Change</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                </div>
              </button>

              {/* Floating Modal / Box Overlay */}
              {isCategoryOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                  <div 
                    className="absolute inset-0" 
                    onClick={() => setIsCategoryOpen(false)} 
                  />
                  
                  <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl w-full max-w-sm rounded-[2.5rem] border border-white/20 dark:border-slate-800/50 shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Choose Category</h3>
                      <button 
                        type="button"
                        onClick={() => setIsCategoryOpen(false)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                      >
                        <X className="h-5 w-5 text-slate-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = formData.category === cat.name;
                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category: cat.name }));
                              setIsCategoryOpen(false);
                            }}
                            className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                              isSelected ? 'scale-110' : 'hover:scale-105 active:scale-95'
                            }`}
                          >
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all border ${
                              isSelected 
                                ? 'bg-teal-500 border-teal-400 text-white shadow-lg shadow-teal-500/40' 
                                : 'bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 shadow-sm'
                            }`}>
                              <Icon className="h-7 w-7" />
                            </div>
                            <span className={`text-[10px] font-bold text-center tracking-tight leading-none uppercase ${
                              isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'
                            }`}>
                              {cat.name.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="date" className="text-sm font-medium text-slate-700">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                className="input-field block w-full"
                value={formData.date}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="transaction_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Transaction ID / UTR <span className="text-slate-400 font-normal">(Optional)</span>
                {formData.transaction_id && <span className="text-xs text-teal-600 ml-2">✓ auto-filled</span>}
              </label>
              <input
                id="transaction_id"
                name="transaction_id"
                type="text"
                placeholder="e.g. 129083109283"
                className="input-field font-mono text-sm placeholder:font-sans placeholder:text-base bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                value={formData.transaction_id}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="savings_account_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Paid From (Account)
              </label>
              <select
                id="savings_account_id"
                name="savings_account_id"
                className="input-field py-[0.6rem]"
                value={formData.savings_account_id}
                onChange={handleChange}
              >
                <option value="">Select Account (Optional)</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} (₹{Number(acc.balance).toLocaleString()})
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-[10px] text-slate-500">No accounts found. Add one in 'More' to use auto-deduction.</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment Mode</label>
              <div className="relative flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-64 isolate">
                <div 
                  className="absolute inset-y-1 transition-all duration-300 ease-out bg-white dark:bg-slate-700 rounded-lg shadow-sm z-[-1]"
                  style={{
                    width: 'calc(50% - 4px)',
                    left: formData.payment_mode === 'UPI' ? '4px' : 'calc(50%)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'UPI' }))}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    formData.payment_mode === 'UPI'
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, payment_mode: 'Cash' }))}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${
                    formData.payment_mode === 'Cash'
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Cash
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Expense'
              )}
            </button>
          </div>
        </form>
      </div>

      {successName && (
        <div
          className="fixed bottom-24 left-0 right-0 z-70 flex justify-center pointer-events-none px-4"
          style={{
            animation: 'toastPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards'
          }}
        >
          <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3.5 rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm pointer-events-auto relative">
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <p className="text-xs text-slate-400 leading-none mb-1">Added successfully</p>
              <p className="text-sm font-bold leading-tight capitalize truncate" title={successName}>{successName}</p>
            </div>
            <button 
              onClick={() => setSuccessName(null)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes toastPop {
          0%   { opacity: 0; transform: translateY(20px) scale(0.9); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes money-flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes chime {
          0% { transform: scale(1) rotate(0); }
          25% { transform: scale(1.2) rotate(5deg); }
          50% { transform: scale(1.1) rotate(-5deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .animate-chime {
          animation: chime 0.5s ease-in-out;
        }
        .animate-money-flow {
          animation: money-flow 1.5s infinite linear;
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-100vh) rotate(0); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #10b981;
          top: -10px;
          animation: confetti-fall 3s linear forwards;
        }
      `}</style>
       
      {transferStatus === 'success' && (
        <div className="fixed inset-0 pointer-events-none z-110 overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div 
              key={i} 
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#10b981', '#34d399', '#059669', '#6ee7b7'][Math.floor(Math.random() * 4)],
                animationDelay: `${Math.random() * 2}s`,
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 5 + 5}px`,
                borderRadius: i % 2 === 0 ? '50%' : '2px'
              }}
            />
          ))}
        </div>
      )}
      
      {(transferStatus !== 'idle') && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm mx-4 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            <div className="p-8 pb-4 flex flex-col items-center">
              <div className="relative flex items-center justify-between w-64 mx-auto h-32 mb-8">
                <div className="absolute top-1/2 left-8 right-8 h-px bg-slate-100 dark:bg-slate-800 -translate-y-1/2 overflow-hidden">
                   {transferStatus === 'processing' && (
                     <div className="absolute inset-0 bg-teal-500 animate-money-flow" />
                   )}
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                   <div className={`h-16 w-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all duration-500 ${transferStep >= 2 ? 'ring-4 ring-teal-500/20 scale-110 shadow-lg' : 'shadow-sm'}`}>
                      <Landmark className={`h-8 w-8 ${transferStep >= 2 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                   </div>
                   <div className="absolute -bottom-6 flex flex-col items-center w-32">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center truncate w-full">
                       {formData.savings_account_id 
                         ? (accounts.find(a => a.id === formData.savings_account_id)?.bank_name || 'Bank')
                         : 'Manual Entry'}
                     </span>
                   </div>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`h-16 w-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all duration-500 ${transferStep >= 4 ? 'bg-teal-50 dark:bg-teal-900/30' : 'shadow-sm'}`}>
                       {transferStatus === 'success' ? (
                         <div className="animate-chime">
                           <CheckCircle className="h-8 w-8 text-teal-600" />
                         </div>
                       ) : (
                         <ReceiptText className={`h-8 w-8 ${transferStep >= 3 ? 'text-teal-600 dark:text-teal-400 animate-pulse' : 'text-slate-400'}`} />
                       )}
                       <div className="absolute -bottom-6 flex flex-col items-center w-24">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Expense</span>
                       </div>
                    </div>
                </div>
              </div>

              <div className="w-full space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 min-h-[100px] flex flex-col items-center justify-center text-center">
                   {transferStatus === 'processing' ? (
                     <div className="animate-in fade-in slide-in-from-bottom-2">
                        <Loader2 className="h-5 w-5 text-teal-600 animate-spin mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {transferStep === 1 && "Initiating Transaction..."}
                          {transferStep === 2 && `Deducting ₹${parseFloat(formData.amount).toLocaleString()} from ${accounts.find(a=>a.id === formData.savings_account_id)?.bank_name}...`}
                          {transferStep === 3 && "Syncing with Ledger..."}
                          {transferStep === 4 && "Finalizing Expense..."}
                        </p>
                     </div>
                   ) : transferStatus === 'success' ? (
                     <div className="animate-in zoom-in duration-300">
                        <div className="h-10 w-10 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-teal-500/30">
                          <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                         <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{rewardMessage}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium px-6 leading-relaxed">
                            Added <span className="text-teal-600 dark:text-teal-400 font-black">"{successName}"</span> and updated bank balance.
                         </p>
                     </div>
                   ) : (
                     <div className="animate-in fade-in">
                        <X className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-900 dark:text-white italic">Something went wrong</p>
                        <p className="text-xs text-slate-500 mt-1">{error || "Please try again"}</p>
                     </div>
                   )}
                </div>

                {transferStatus === 'success' && (
                  <button 
                    onClick={() => setTransferStatus('idle')}
                    className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-[1.25rem] shadow-xl shadow-teal-500/20 transition-all active:scale-[0.98]"
                  >
                    Done
                  </button>
                )}
                
                {transferStatus === 'error' && (
                  <button 
                    onClick={() => setTransferStatus('idle')}
                    className="w-full h-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-[1.25rem] shadow-sm transition-all"
                  >
                    Close & Retry
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-2">
                 <ShieldCheck className="h-3 w-3 text-slate-400" />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Secure Ledger Protocol 2.0</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
