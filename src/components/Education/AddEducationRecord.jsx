import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, X, ShieldCheck, FileText, Camera, ScanLine, CheckCircle2, Sparkles } from 'lucide-react';

// ── Universal OCR Extractor ──────────────────────────────────────────────────

/**
 * Universal receipt field extractor.
 * Works on ANY payment receipt by matching a wide set of field label synonyms,
 * then falling back to smart pattern matching (currency, dates, long ref numbers).
 */
const extractFromOCRText = (rawText) => {
  const extracted = {};

  // Normalise text: collapse whitespace, remove stray pipe chars used as separators
  const clean = rawText.replace(/\r/g, '').replace(/[ \t]{2,}/g, ' ').replace(/^[|\s\-=]+$/gm, '').trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = lines.join(' ');

  // ── Label → Value helper ────────────────────────────────────────────────────
  // Finds the value that follows a label (same line after separator, or next line)
  const findByLabels = (labelPatterns) => {
    for (const pat of labelPatterns) {
      const re = new RegExp(`(?:^|\\s)${pat}\\s*[:\\-|]?\\s*(.+?)\\s*(?:$|\n)`, 'im');
      const m = clean.match(re);
      if (m && m[1] && m[1].trim().length > 0 && !/^[:\-|]+$/.test(m[1].trim())) {
        return m[1].trim();
      }
      // Two-line: label on one line, value on next
      for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^${pat}\\s*[:\-|]?\\s*$`, 'i').test(lines[i]) && lines[i + 1]) {
          const candidate = lines[i + 1].trim();
          if (candidate.length > 0 && !/^[:\-=]+$/.test(candidate)) return candidate;
        }
      }
    }
    return null;
  };

  // ── 1. Receipt / Reference Number ──────────────────────────────────────────
  const receiptRaw = findByLabels([
    'Receipt\\s*(?:Num(?:ber)?|No\\.?|#|ID)',
    'Ref(?:erence)?\\s*(?:Num(?:ber)?|No\\.?|#|ID)',
    'Transaction\\s*(?:ID|No\\.?|Num(?:ber)?|Ref)',
    'Txn\\s*(?:ID|No\\.?|Num(?:ber)?)',
    'Payment\\s*(?:ID|No\\.?|Num(?:ber)?|Ref)',
    'Invoice\\s*(?:No\\.?|Num(?:ber)?|#)',
    'Voucher\\s*(?:No\\.?|Num(?:ber)?)',
    'Acknowledgement\\s*(?:No\\.?|Num(?:ber)?)',
    'Booking\\s*(?:ID|No\\.?)',
  ]);
  if (receiptRaw) extracted.receipt_no = receiptRaw.replace(/[^\w\-:/]/g, '').slice(0, 60);

  // ── 2. Order Number ─────────────────────────────────────────────────────────
  const orderRaw = findByLabels([
    'Order\\s*(?:Num(?:ber)?|No\\.?|ID|#)',
    'Merchant\\s*(?:Order|Ref)',
    'Purchase\\s*(?:Order|ID)',
    'PO\\s*(?:Num(?:ber)?|No\\.?)',
  ]);
  if (orderRaw) extracted.order_number = orderRaw.trim().slice(0, 100);

  // ── 3. Gateway Reference Number ─────────────────────────────────────────────
  const gatewayRefRaw = findByLabels([
    'Gateway\\s*Ref(?:erence)?\\s*(?:Num(?:ber)?|No\\.?|ID)?',
    'PG\\s*Ref(?:erence)?',
    'Payment\\s*Ref(?:erence)?\\s*(?:Num(?:ber)?|No\\.?)',
    'Auth(?:orization)?\\s*(?:Code|No\\.?|ID)',
    'Approval\\s*(?:Code|No\\.?)',
    'RRN',
    'Retrieval\\s*Ref(?:erence)?',
    'ARN',
  ]);
  if (gatewayRefRaw) extracted.gateway_reference_no = gatewayRefRaw.replace(/[^\w\-:/]/g, '').slice(0, 100);

  // ── 4. Bank Reference / UTR ─────────────────────────────────────────────────
  const bankRefRaw = findByLabels([
    'Bank\\s*Ref(?:erence)?\\s*(?:Num(?:ber)?|No\\.?|ID)?',
    'UTR\\s*(?:Num(?:ber)?|No\\.?)?',
    'NEFT\\s*(?:Ref|UTR)',
    'IMPS\\s*(?:Ref|No\\.?)',
    'UPI\\s*(?:Ref|TXN|ID)',
    'RTGS\\s*(?:Ref|No\\.?)',
    'IFSC\\s*(?:Ref|Code)',
    'Cheque\\s*(?:No\\.?|Num(?:ber)?)',
    'DD\\s*(?:No\\.?|Num(?:ber)?)',
  ]);
  if (bankRefRaw) extracted.bank_reference_no = bankRefRaw.replace(/[^\w\-:/]/g, '').slice(0, 100);

  // ── 5. Payment Gateway / Instrument ─────────────────────────────────────────
  const gatewayRaw = findByLabels([
    'Payment\\s*Gateway\\s*(?:Source|Name)?',
    'Gateway\\s*(?:Source|Name|Provider)?',
    'Payment\\s*(?:Mode|Method|Via|Through|Instrument|Source)',
    'Paid\\s*(?:Via|Through|By|Using)',
    'Mode\\s*of\\s*Payment',
    'Bank\\s*Name',
    'Issuer\\s*(?:Name|Bank)?',
    'Card\\s*(?:Type|Network)',
    'Wallet\\s*(?:Name|Provider)?',
  ]);
  if (gatewayRaw) {
    // Strip common noise words, keep the meaningful name
    const gClean = gatewayRaw.replace(/\b(?:payment|gateway|mode|via|through|by|using)\b/gi, '').trim();
    extracted.payment_gateway = gClean.slice(0, 60);
  }

  // ── 6. Remarks / Description / Product ──────────────────────────────────────
  const remarksRaw = findByLabels([
    'Product\\s*(?:Info(?:rmation)?|Name|Details?|Description)',
    'Description\\s*(?:of\\s*(?:Transaction|Payment|Service))?',
    'Particulars?',
    'Narration',
    'Remarks?',
    'Purpose\\s*(?:of\\s*(?:Payment|Transfer))?',
    'Merchant\\s*(?:Name|Description)',
    'Service\\s*(?:Name|Description)',
    'Fee\\s*(?:Type|Description|Category)',
    'Item\\s*(?:Description|Name)',
  ]);
  if (remarksRaw) extracted.amount_info = remarksRaw.trim().slice(0, 200);

  // ── 7. Amount ────────────────────────────────────────────────────────────────
  // Try labelled first
  const amountRaw = findByLabels([
    'Total\\s*(?:Amount\\s*)?(?:Paid|Due|Charged|Deducted)',
    'Amount\\s*(?:Paid|Charged|Debited|Deducted|Received)',
    'Net\\s*Amount',
    'Fee\\s*Amount',
    '^Amount$',
  ]);
  if (amountRaw) {
    const amtMatch = amountRaw.match(/[\d,]+(?:\.\d{1,2})?/);
    if (amtMatch) extracted.amount = amtMatch[0].replace(/,/g, '');
  }
  // Fallback: scan ALL lines for Number that is prefixed by ₹/Rs./INR or is a standalone amount pattern
  if (!extracted.amount) {
    // Check each line for "Amount label + number" broadly
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // Standalone amount line: just starts with ₹, Rs or has a number after currency symbol
      const currencyHit = l.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/);
      if (currencyHit) { extracted.amount = currencyHit[1].replace(/,/g, ''); break; }
      // Line with "Amount" (but not "Amount Reflected", "Amount Info", etc.)
      if (/^(?:total\s+)?amount\s*(?:[:|]|$)/i.test(l) && !/amount\s+(?:reflected|info|words)/i.test(l)) {
        const numNext = (lines[i + 1] || '').match(/^[\d,]+(?:\.\d{1,2})?$/);
        const numSame = l.match(/amount\s*[:|]?\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (numSame) { extracted.amount = numSame[1].replace(/,/g, ''); break; }
        if (numNext) { extracted.amount = numNext[0].replace(/,/g, ''); break; }
      }
    }
  }

  // ── 8. Date ──────────────────────────────────────────────────────────────────
  const dateRaw = findByLabels([
    'Last\\s*Updated',
    'Transaction\\s*Date(?:\\s*&?\\s*Time)?',
    'Payment\\s*Date(?:\\s*&?\\s*Time)?',
    'Date\\s*(?:of\\s*(?:Payment|Transaction|Transfer|Credit|Debit))?',
    'Processed\\s*(?:On|Date)',
    'Completed\\s*(?:On|Date|At)',
    'Booked\\s*(?:On|Date)',
    'Timestamp',
    'Addedon',
  ]);

  const tryParseDate = (raw) => {
    if (!raw) return null;
    // YYYY-MM-DD (possibly with time)
    let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // DD/MM/YYYY or DD-MM-YYYY
    m = raw.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // DD Mon YYYY or DD Month YYYY
    m = raw.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (m) {
      const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
      const mo = months[m[2].toLowerCase().slice(0, 3)];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }
    return null;
  };

  const parsedDate = tryParseDate(dateRaw);
  if (parsedDate) {
    extracted.date = parsedDate;
  } else {
    // Fallback: scan all lines for ANY date pattern
    for (const line of lines) {
      const d = tryParseDate(line);
      if (d) { extracted.date = d; break; }
    }
  }

  // ── 9. Pattern-based fallbacks (no label required) ──────────────────────────
  // If we still don't have amount, try finding largest standalone number
  if (!extracted.amount) {
    const amounts = [];
    for (const line of lines) {
      const m = line.match(/\b(\d{2,8}(?:\.\d{1,2})?)\b/);
      if (m && !isNaN(parseFloat(m[1]))) amounts.push(parseFloat(m[1]));
    }
    if (amounts.length > 0) {
      // Use the most common / median value rather than max to avoid huge IDs
      amounts.sort((a, b) => a - b);
      extracted.amount = String(amounts[Math.floor(amounts.length / 2)]);
    }
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
  const [scanning, setScanning] = useState(false);
  const [scanFields, setScanFields] = useState(null);
  const [dupWarning, setDupWarning] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const canvasRef = useRef(null);
  const confettiRaf = useRef(null);
  
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

  // ── Confetti animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!showConfetti || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#10b981','#34d399','#6ee7b7','#fbbf24','#f59e0b','#818cf8','#60a5fa','#f472b6','#fb7185'];
    const particles = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 8,
      size: Math.random() * 10 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let start = performance.now();
    const DURATION = 1300;

    const draw = (now) => {
      const elapsed = now - start;
      if (elapsed > DURATION) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const progress = elapsed / DURATION;
      particles.forEach(p => {
        p.x += p.vx * 0.8;
        p.y += p.vy * 0.8;
        p.vy += 0.4; // gravity
        p.rotation += p.rotSpeed;
        p.opacity = Math.max(0, 1 - progress * 1.2);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      confettiRaf.current = requestAnimationFrame(draw);
    };
    confettiRaf.current = requestAnimationFrame(draw);
    return () => { if (confettiRaf.current) cancelAnimationFrame(confettiRaf.current); };
  }, [showConfetti]);

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
        setError('Could not extract any data from this image. Try a clearer screenshot with visible labels and values.');
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
  const doSave = async (isoDate, skipDupCheck = false) => {
    setLoading(true);
    setError(null);
    setDupWarning(null);
    try {
      // Duplicate check — only on new records
      if (!recordToEdit && !skipDupCheck) {
        const amount = Math.round(parseFloat(formData.amount) * 100) / 100;
        const { data: dups } = await supabase
          .from('education_fees')
          .select('id, amount_info, receipt_no')
          .eq('user_id', user.id)
          .eq('year', prefilledYear)
          .eq('semester', prefilledSemester)
          .eq('category', prefilledCategory)
          .eq('date', isoDate)
          .eq('amount', amount);
        if (dups && dups.length > 0) {
          setDupWarning({ existing: dups[0], isoDate });
          setLoading(false);
          return;
        }
      }

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
      // 🎉 Confetti burst then call onSuccess
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        onSuccess();
      }, 1300);
    } catch (err) {
      console.error('Error saving education fee:', err);
      setError(err.message || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!prefilledYear || !prefilledSemester || !prefilledCategory) {
      setError('System Error: Component lost navigation context.');
      return;
    }
    const isoDate = parseDisplayDate(formData.manualDate);
    if (!isoDate) { setError('Please enter a valid date in DD/MM/YYYY format.'); return; }
    await doSave(isoDate, false);
  };

  // ── Field highlight helper ───────────────────────────────────────────────────
  const autoFilled = (field) =>
    scanFields?.has(field)
      ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 ring-1 ring-emerald-400/30'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900';

  const inputBase = 'w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all';

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Confetti canvas — full screen, pointer-events-none */}
      {showConfetti && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 z-[1000] pointer-events-none"
        />
      )}

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

          {/* Duplicate warning banner */}
          {dupWarning && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-amber-800 dark:text-amber-300">Possible Duplicate Detected</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-0.5 font-medium">
                    A record with the same date and amount already exists in this folder:
                    <span className="block font-bold mt-1 italic">"{dupWarning.existing.amount_info || dupWarning.existing.receipt_no || 'Fee Record'}"</span>
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => doSave(dupWarning.isoDate, true)}
                      disabled={loading}
                      className="h-8 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Save Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => setDupWarning(null)}
                      className="h-8 px-4 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-black hover:bg-amber-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
    </>
  );
}
