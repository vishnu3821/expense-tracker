import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, X, ShieldCheck, FileText, Camera, ScanLine, CheckCircle2, Sparkles } from 'lucide-react';

// ── OCR Extractor ─────────────────────────────────────────────────────────────

/**
 * Given raw OCR text from a KL University fee receipt, extract all known fields.
 * The receipt table looks like:
 *   Receipt Number     | 2679567
 *   Order Number       | HDF:P-64313:T-1774713073
 *   Product Info       | End Sem Exam Fee...
 *   Amount             | 1500
 *   Gateway ref Number | 114397152959
 *   Bank Ref Number    | 156397504492
 *   Payment Gateway    | HDFC
 *   Last Updated       | 2026-03-28 21:21:37
 */
const extractFromOCRText = (text) => {
  const extracted = {};

  // Normalise: collapse multiple spaces, convert newlines to pipe for easier matching
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Helper: find value after a label key (same line, or next non-empty line)
  const findValue = (patterns) => {
    for (const pat of patterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for "Label: Value" or "Label  Value" on same line
        const sameLineMatch = line.match(new RegExp(`${pat}[:\\s|]+(.+)`, 'i'));
        if (sameLineMatch) {
          const val = sameLineMatch[1].trim();
          if (val && val.length > 0) return val;
        }
        // Check if this line IS the label, value is on the next line
        if (new RegExp(`^${pat}\\s*$`, 'i').test(line) && lines[i + 1]) {
          return lines[i + 1].trim();
        }
      }
    }
    return null;
  };

  // Receipt Number
  const receiptNo = findValue(['Receipt Num(?:ber)?', 'Receipt No\\.?', 'Rec(?:eipt)?\\s*#']);
  if (receiptNo) extracted.receipt_no = receiptNo.replace(/[^0-9A-Za-z\-_]/g, '').slice(0, 50);

  // Order Number
  const orderNum = findValue(['Order Num(?:ber)?', 'Order No\\.?', 'Order\\s*#']);
  if (orderNum) extracted.order_number = orderNum.trim().slice(0, 100);

  // Gateway reference Number
  const gatewayRef = findValue(['Gateway\\s*Ref(?:erence)?\\s*Num(?:ber)?', 'Gateway\\s*Ref\\.?\\s*No', 'Gateway\\s*Reference', 'GRN']);
  if (gatewayRef) extracted.gateway_reference_no = gatewayRef.replace(/[^0-9A-Za-z\-_]/g, '').slice(0, 100);

  // Bank Ref Number
  const bankRef = findValue(['Bank\\s*Ref(?:erence)?\\s*Num(?:ber)?', 'Bank\\s*Ref\\.?\\s*No', 'UTR\\s*Num(?:ber)?', 'UTR']);
  if (bankRef) extracted.bank_reference_no = bankRef.replace(/[^0-9A-Za-z\-_]/g, '').slice(0, 100);

  // Payment Gateway Source
  const gateway = findValue(['Payment\\s*Gateway\\s*Source', 'Payment\\s*Gateway', 'Gateway\\s*Source', 'Gateway\\s*Name']);
  if (gateway) extracted.payment_gateway = gateway.trim().slice(0, 50);

  // Product Info → amount_info
  const product = findValue(['Product\\s*Info(?:rmation)?', 'Product\\s*Name', 'Product', 'Description', 'Particulars']);
  if (product) extracted.amount_info = product.trim().slice(0, 200);

  // Amount — prefer the first "Amount" field, not "Amount Reflected"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Must match "Amount" but NOT "Amount Reflected" or "Amount Info"
    if (/^Amount\s*$/i.test(line) || /^Amount[:\s|]+\d/i.test(line)) {
      const sameMatch = line.match(/Amount[:\s|]+(\d+(?:\.\d+)?)/i);
      if (sameMatch) { extracted.amount = sameMatch[1]; break; }
      if (lines[i + 1] && /^\d+(?:\.\d+)?$/.test(lines[i + 1].trim())) {
        extracted.amount = lines[i + 1].trim();
        break;
      }
    }
  }

  // Last Updated → date (extract YYYY-MM-DD, strip time)
  const lastUpdated = findValue(['Last\\s*Updated', 'Updated\\s*On', 'Addedon', 'Date(?:s)?', 'Payment\\s*Date', 'Transaction\\s*Date']);
  if (lastUpdated) {
    // Match YYYY-MM-DD
    const isoMatch = lastUpdated.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) extracted.date = isoMatch[1];
    // Match DD/MM/YYYY
    const ddmm = lastUpdated.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmm && !isoMatch) extracted.date = `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
  }

  return extracted;
};

// ── Date helpers ───────────────────────────────────────────────────────────────

function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function parseDisplayDate(displayDate) {
  const parts = displayDate.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (y.length !== 4 || m.length !== 2 || d.length !== 2) return null;
  return `${y}-${m}-${d}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AddEducationRecord({ 
  onClose, 
  onSuccess,
  prefilledYear,
  prefilledSemester,
  prefilledCategory,
  recordToEdit = null
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);         // OCR in progress
  const [scanFields, setScanFields] = useState(null);       // fields extracted by OCR (for highlight)
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    receipt_no: '',
    order_number: '',
    payment_gateway: '',
    bank_reference_no: '',
    gateway_reference_no: '',
    amount: recordToEdit?.amount || '',
    amount_info: recordToEdit?.amount_info || '',
    image: null,
    manualDate: recordToEdit ? formatDisplayDate(recordToEdit.date) : formatDisplayDate(new Date().toISOString().split('T')[0])
  });

  useEffect(() => {
    if (recordToEdit) {
      setFormData({
        date: recordToEdit.date,
        receipt_no: recordToEdit.receipt_no || '',
        order_number: recordToEdit.order_number || '',
        payment_gateway: recordToEdit.payment_gateway || '',
        bank_reference_no: recordToEdit.bank_reference_no || '',
        gateway_reference_no: recordToEdit.gateway_reference_no || '',
        amount: recordToEdit.amount || '',
        amount_info: recordToEdit.amount_info || '',
        image: null,
        manualDate: formatDisplayDate(recordToEdit.date)
      });
      if (recordToEdit.image_url) setImagePreview(recordToEdit.image_url);
    }
  }, [recordToEdit]);

  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'manualDate') {
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length >= 5) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
      else if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
      setFormData(prev => ({ ...prev, manualDate: v, date: v.length === 10 ? parseDisplayDate(v) : prev.date }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── OCR Scan ────────────────────────────────────────────────────────────────
  const runOCR = async (file) => {
    setScanning(true);
    setScanFields(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      const extracted = extractFromOCRText(text);
      const filled = Object.keys(extracted).filter(k => extracted[k] !== undefined && extracted[k] !== null);

      if (filled.length === 0) {
        setError('Could not extract data from this image. Please ensure it is a clear KL University fee receipt.');
        setScanning(false);
        return;
      }

      setScanFields(new Set(filled));   // mark which fields were filled for visual highlight

      setFormData(prev => ({
        ...prev,
        ...(extracted.receipt_no       ? { receipt_no: extracted.receipt_no }             : {}),
        ...(extracted.order_number     ? { order_number: extracted.order_number }          : {}),
        ...(extracted.gateway_reference_no ? { gateway_reference_no: extracted.gateway_reference_no } : {}),
        ...(extracted.bank_reference_no ? { bank_reference_no: extracted.bank_reference_no } : {}),
        ...(extracted.payment_gateway  ? { payment_gateway: extracted.payment_gateway }    : {}),
        ...(extracted.amount_info      ? { amount_info: extracted.amount_info }            : {}),
        ...(extracted.amount           ? { amount: extracted.amount }                      : {}),
        ...(extracted.date             ? {
          date: extracted.date,
          manualDate: formatDisplayDate(extracted.date)
        } : {}),
      }));
    } catch (err) {
      console.error('OCR Error:', err);
      setError('OCR scan failed. You can still fill in the fields manually.');
    } finally {
      setScanning(false);
    }
  };

  // ── File Processing ──────────────────────────────────────────────────────────
  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
    setFormData(prev => ({ ...prev, image: file }));
    setImagePreview(URL.createObjectURL(file));
    setError(null);
    runOCR(file);
  };

  const handleImageChange = (e) => processFile(e.target.files?.[0]);
  const handleDragOver   = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave  = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop       = (e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files?.[0]); };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!prefilledYear || !prefilledSemester || !prefilledCategory) {
      setError('System Error: Component lost navigation context.');
      setLoading(false);
      return;
    }

    const isoDate = parseDisplayDate(formData.manualDate);
    if (!isoDate) { setError('Please enter a valid date in DD/MM/YYYY format.'); setLoading(false); return; }

    try {
      let image_url = recordToEdit?.image_url || null;

      if (formData.image) {
        const fileExt = formData.image.name.split('.').pop() || 'png';
        const fileName = `${user.id}/${Date.now()}_edu_receipt.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, formData.image);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
        image_url = publicUrl;
      }

      const payload = {
        date: isoDate,
        receipt_no: formData.receipt_no || null,
        order_number: formData.order_number || null,
        payment_gateway: formData.payment_gateway || null,
        bank_reference_no: formData.bank_reference_no || null,
        gateway_reference_no: formData.gateway_reference_no || null,
        amount: Math.round(parseFloat(formData.amount) * 100) / 100,
        amount_info: formData.amount_info || null,
        image_url,
      };

      if (recordToEdit) {
        const { error: updateError } = await supabase.from('education_fees').update(payload).eq('id', recordToEdit.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('education_fees').insert({
          user_id: user.id,
          year: prefilledYear,
          semester: prefilledSemester,
          category: prefilledCategory,
          ...payload,
        });
        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving education fee:', err);
      setError(err.message || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  // ── Field highlight helper ───────────────────────────────────────────────────
  const autoFilled = (field) =>
    scanFields?.has(field)
      ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 ring-1 ring-emerald-400/30'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900';

  const inputBase = 'w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all';

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {recordToEdit ? 'Update Record' : 'Add Record'}
              </h2>
              <p className="text-xs text-slate-500">
                {recordToEdit
                  ? `Modifying: ${formatDisplayDate(recordToEdit.date)}`
                  : `Into: ${prefilledYear} › ${prefilledSemester} › ${prefilledCategory}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Scanning banner */}
          {scanning && (
            <div className="mb-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3 animate-pulse">
              <ScanLine className="h-5 w-5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">Scanning receipt…</p>
                <p className="text-xs text-indigo-500 font-medium">OCR is reading your fee receipt. Fields will auto-fill in seconds.</p>
              </div>
            </div>
          )}

          {/* Scan success banner */}
          {scanFields && scanFields.size > 0 && !scanning && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                  Auto-filled {scanFields.size} field{scanFields.size !== 1 ? 's' : ''} from receipt
                </p>
                <p className="text-xs text-emerald-600/80 font-medium">Green fields were filled automatically. Review and correct if needed.</p>
              </div>
            </div>
          )}

          <form id="edu-fee-form" onSubmit={handleSubmit} className="space-y-5">

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Amount (₹) *
                {scanFields?.has('amount') && <Sparkles className="h-3 w-3 text-emerald-500" />}
              </label>
              <input
                type="number" name="amount" step="0.01" required placeholder="0.00"
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all ${scanFields?.has('amount') ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/30' : 'border-emerald-200 dark:border-emerald-900/50'}`}
                value={formData.amount}
                onChange={handleChange}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Date of Payment *
                {scanFields?.has('date') && <Sparkles className="h-3 w-3 text-emerald-500" />}
              </label>
              <input
                type="text" name="manualDate" required placeholder="DD/MM/YYYY"
                className={`${inputBase} ${autoFilled('date')}`}
                value={formData.manualDate}
                onChange={handleChange}
              />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Receipt / Ref Number
                  {scanFields?.has('receipt_no') && <Sparkles className="h-3 w-3 text-emerald-500" />}
                </label>
                <input type="text" name="receipt_no" placeholder="e.g. 2679567"
                  className={`${inputBase} ${autoFilled('receipt_no')}`}
                  value={formData.receipt_no} onChange={handleChange} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Order Number
                  {scanFields?.has('order_number') && <Sparkles className="h-3 w-3 text-emerald-500" />}
                </label>
                <input type="text" name="order_number" placeholder="e.g. HDF:P-64313..."
                  className={`${inputBase} ${autoFilled('order_number')}`}
                  value={formData.order_number} onChange={handleChange} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Payment Gateway
                  {scanFields?.has('payment_gateway') && <Sparkles className="h-3 w-3 text-emerald-500" />}
                </label>
                <input type="text" name="payment_gateway" placeholder="e.g. HDFC, Razorpay"
                  className={`${inputBase} ${autoFilled('payment_gateway')}`}
                  value={formData.payment_gateway} onChange={handleChange} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Gateway Ref No.
                  {scanFields?.has('gateway_reference_no') && <Sparkles className="h-3 w-3 text-emerald-500" />}
                </label>
                <input type="text" name="gateway_reference_no" placeholder="e.g. 114397152959"
                  className={`${inputBase} ${autoFilled('gateway_reference_no')}`}
                  value={formData.gateway_reference_no} onChange={handleChange} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Bank Ref / UTR
                  {scanFields?.has('bank_reference_no') && <Sparkles className="h-3 w-3 text-emerald-500" />}
                </label>
                <input type="text" name="bank_reference_no" placeholder="e.g. 156397504492"
                  className={`${inputBase} ${autoFilled('bank_reference_no')}`}
                  value={formData.bank_reference_no} onChange={handleChange} />
              </div>
            </div>

            {/* Amount Info / Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Amount Info (Remarks)
                {scanFields?.has('amount_info') && <Sparkles className="h-3 w-3 text-emerald-500" />}
              </label>
              <textarea
                name="amount_info" rows="2" placeholder="e.g. End Sem Exam Fee - Regular Exam Fee"
                className={`${inputBase} resize-none ${autoFilled('amount_info')}`}
                value={formData.amount_info} onChange={handleChange}
              />
            </div>

            {/* Receipt Image Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Receipt Snapshot
                <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">Auto-fills on upload</span>
              </label>

              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 transition-all group ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                    isDragging ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 scale-110' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'
                  }`}>
                    <ScanLine className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${isDragging ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                      {isDragging ? 'Drop to scan receipt' : 'Tap or drag receipt screenshot'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Fields auto-fill via OCR scan
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5">
                  <img src={imagePreview} alt="Receipt preview" className="w-full max-h-52 object-contain" />
                  {scanning && (
                    <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <ScanLine className="h-8 w-8 text-indigo-300 animate-pulse" />
                      <p className="text-white text-sm font-black">Scanning…</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, image: null }));
                      setImagePreview(null);
                      setScanFields(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors backdrop-blur-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                type="file" ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            form="edu-fee-form"
            type="submit"
            disabled={loading || scanning}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl flex items-center justify-center gap-2 text-lg font-bold shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-[0.98] disabled:transform-none"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : scanning ? (
              <><ScanLine className="h-5 w-5 animate-pulse" /> Scanning receipt…</>
            ) : (
              <><ShieldCheck className="h-6 w-6" /> {recordToEdit ? 'Update Details' : `Save to ${prefilledCategory}`}</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
