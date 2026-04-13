import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, X, ShieldCheck, FileText, Camera } from 'lucide-react';

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
      if (recordToEdit.image_url) {
        setImagePreview(recordToEdit.image_url);
      }
    }
  }, [recordToEdit]);

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

  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'manualDate') {
      // Simple mask for DD/MM/YYYY
      let v = value.replace(/\D/g, '').slice(0, 8);
      if (v.length >= 5) {
        v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
      } else if (v.length >= 3) {
        v = `${v.slice(0, 2)}/${v.slice(2)}`;
      }
      
      setFormData(prev => ({ 
        ...prev, 
        manualDate: v,
        date: v.length === 10 ? parseDisplayDate(v) : prev.date
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const processFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image must be less than 5MB');
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setError(null);
  };

  const handleImageChange = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Hard verification that the folder hierarchy context is pure
    if (!prefilledYear || !prefilledSemester || !prefilledCategory) {
       setError("System Error: Component lost navigation context. Cannot attach record without Folder structure.");
       setLoading(false);
       return;
    }

    const isoDate = parseDisplayDate(formData.manualDate);
    if (!isoDate) {
      setError("Please enter a valid date in DD/MM/YYYY format.");
      setLoading(false);
      return;
    }

    try {
      let image_url = recordToEdit?.image_url || null;

      // 1. Upload Image to Supabase Storage if a NEW one is provided
      if (formData.image) {
        const fileExt = formData.image.name.split('.').pop() || 'png';
        const fileName = `${user.id}/${Date.now()}_edu_receipt.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, formData.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        image_url = publicUrl;
      }

      // 2. Insert or Update Record
      if (recordToEdit) {
        const { error: updateError } = await supabase
          .from('education_fees')
          .update({
            date: isoDate,
            receipt_no: formData.receipt_no || null,
            order_number: formData.order_number || null,
            payment_gateway: formData.payment_gateway || null,
            bank_reference_no: formData.bank_reference_no || null,
            gateway_reference_no: formData.gateway_reference_no || null,
            amount: parseFloat(formData.amount),
            amount_info: formData.amount_info || null,
            image_url: image_url
          })
          .eq('id', recordToEdit.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('education_fees')
          .insert({
            user_id: user.id,
            year: prefilledYear,
            semester: prefilledSemester,
            category: prefilledCategory,
            date: isoDate,
            receipt_no: formData.receipt_no || null,
            order_number: formData.order_number || null,
            payment_gateway: formData.payment_gateway || null,
            bank_reference_no: formData.bank_reference_no || null,
            gateway_reference_no: formData.gateway_reference_no || null,
            amount: parseFloat(formData.amount),
            amount_info: formData.amount_info || null,
            image_url: image_url
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
                {recordToEdit ? `Modifying: ${formatDisplayDate(recordToEdit.date)}` : `Into: ${prefilledYear} > ${prefilledSemester} > ${prefilledCategory}`}
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
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form id="edu-fee-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Core Info */}
            <div className="space-y-4">
               <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.amount}
                  onChange={handleChange}
                />
              </div>

               <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date of Payment *</label>
                <input
                  type="text"
                  name="manualDate"
                  required
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.manualDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Optional Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Receipt / Ref Number</label>
                <input
                  type="text"
                  name="receipt_no"
                  placeholder="e.g. REC-12345"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.receipt_no}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Number</label>
                <input
                  type="text"
                  name="order_number"
                  placeholder="e.g. ORD-9988"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.order_number}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Gateway</label>
                <input
                  type="text"
                  name="payment_gateway"
                  placeholder="e.g. Razorpay, BillDesk"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.payment_gateway}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank Ref / UTR</label>
                <input
                  type="text"
                  name="bank_reference_no"
                  placeholder="e.g. UTR123456789"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.bank_reference_no}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount Info (Remarks)</label>
              <textarea
                name="amount_info"
                rows="2"
                placeholder="Any additional notes..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all resize-none"
                value={formData.amount_info}
                onChange={handleChange}
              />
            </div>

            {/* Receipt Image Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Receipt Snapshot</label>
              
              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-32 rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 transition-all group ${
                    isDragging 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full shadow-sm flex items-center justify-center transition-all ${
                    isDragging ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 scale-110' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover:text-emerald-500 group-hover:scale-110'
                  }`}>
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className={`text-sm font-medium ${isDragging ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {isDragging ? 'Drop receipt here' : 'Tap or drag receipt here'}
                  </span>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group bg-black/5">
                  <img src={imagePreview} alt="Receipt preview" className="w-full max-h-48 object-contain" />
                  <button 
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, image: null }));
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors backdrop-blur-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            form="edu-fee-form"
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl flex items-center justify-center gap-2 text-lg font-bold shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1 active:scale-[0.98] disabled:transform-none"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="h-6 w-6" />
                {recordToEdit ? 'Update Details' : `Save to ${prefilledCategory}`}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
