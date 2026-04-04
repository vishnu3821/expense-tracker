import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle, X, Sparkles, Hash } from 'lucide-react';
import { get, del } from 'idb-keyval';

async function analyzeReceiptImage(imageFile) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key is not configured.');

  // Convert image to base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  const mimeType = imageFile.type || 'image/png';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a payment receipt OCR assistant. Analyze this payment screenshot and extract:
1. The total amount paid (numbers only, no currency symbol)
2. The transaction ID / UTR number / reference number / order ID (the unique alphanumeric code)

Return ONLY a raw JSON object with exactly these two keys (no markdown, no code blocks):
{"amount": "123.45", "transaction_id": "ABC123XYZ"}

If a field is not found, use an empty string "". Do not include any other text.`
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: { maxOutputTokens: 200, temperature: 0 }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || 'Gemini API request failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse AI response. Please fill fields manually.');
  }
}

export default function AddExpense() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);
  const imagePreviewUrl = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    transaction_id: '',
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

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setScanMessage({ type: 'error', text: 'No Gemini API key found. Add VITE_GEMINI_API_KEY in .env.local and restart the server.' });
      return;
    }

    setScanning(true);
    setScanMessage(null);

    try {
      const result = await analyzeReceiptImage(formData.image);
      let filled = [];

      if (result.amount && result.amount !== '') {
        setFormData(prev => ({ ...prev, amount: result.amount }));
        filled.push('amount');
      }
      if (result.transaction_id && result.transaction_id !== '') {
        setFormData(prev => ({ ...prev, transaction_id: result.transaction_id }));
        filled.push('transaction ID');
      }

      if (filled.length > 0) {
        setScanMessage({ type: 'success', text: `✓ Auto-filled: ${filled.join(' & ')}` });
      } else {
        setScanMessage({ type: 'warn', text: 'No amount or transaction ID detected. Please fill manually.' });
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
    setSuccess(false);

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
            date: formData.date,
            transaction_id: formData.transaction_id || null,
            image_url
          }
        ]);

      if (dbError) throw dbError;

      setFormData({
        name: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        transaction_id: '',
        image: null
      });

      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';
      setScanMessage(null);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);

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

          {success && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-center gap-3 text-teal-800">
              <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
              <p className="text-sm font-medium">Expense added successfully!</p>
            </div>
          )}

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
                {formData.amount && <span className="ml-2 text-xs text-teal-600">✓ auto-filled</span>}
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
              <label htmlFor="date" className="text-sm font-medium text-slate-700">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                required
                className="input-field"
                value={formData.date}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="transaction_id" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Hash className="h-4 w-4 text-slate-400" />
                Transaction ID / UTR
                {formData.transaction_id && <span className="text-xs text-teal-600">✓ auto-filled</span>}
                <span className="text-xs font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                id="transaction_id"
                name="transaction_id"
                type="text"
                placeholder="e.g. 425912345678 or T2504041234567"
                className="input-field font-mono text-sm tracking-tight"
                value={formData.transaction_id}
                onChange={handleChange}
              />
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
    </div>
  );
}
