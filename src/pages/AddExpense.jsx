import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle, X, Sparkles, Hash } from 'lucide-react';
import { get, del } from 'idb-keyval';

import { createWorker } from 'tesseract.js';

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
  const imagePreviewUrl = useRef(null);

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
      let image_url = null;

      if (formData.image) {
        const fileNameOriginal = formData.image.name || 'shared_receipt.png';
        const fileExt = fileNameOriginal.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, formData.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        image_url = publicUrl;
      }

      const { error: dbError } = await supabase
        .from('expenses')
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: formData.date,
            transaction_id: formData.transaction_id || null,
            payment_mode: formData.payment_mode,
            image_url,
            savings_account_id: formData.savings_account_id || null
          }
        ]);

      if (dbError) throw dbError;

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
            // We don't throw here to avoid failing the whole expense add, 
            // but we could notify the user.
          } else {
            // refresh accounts locally
            fetchAccounts();
          }
        }
      }

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

      setSuccessName(savedName);
      setTimeout(() => setSuccessName(null), 4000);

    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while adding the expense.');
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
                    {scanMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
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

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-slate-700">Category</label>
              <select
                id="category"
                name="category"
                className="input-field py-[0.6rem]" // Slight padding tweak for uniform height with inputs
                value={formData.category}
                onChange={handleChange}
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

            {/* Payment Mode Segmented Control */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment Mode</label>
              <div className="relative flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-64 isolate">
                {/* Sliding Pill Background */}
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

      {/* ── Animated success toast ── */}
      {successName && (
        <div
          className="fixed bottom-24 left-0 right-0 z-[70] flex justify-center pointer-events-none px-4"
          style={{
            animation: 'toastPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards'
          }}
        >
          <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3.5 rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm pointer-events-auto relative">
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
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
      `}</style>
    </div>
  );
}
