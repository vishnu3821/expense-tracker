import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Upload, X, ShieldCheck, FileText, Image as ImageIcon, Camera, Building2, Calendar, CreditCard, ChevronDown } from 'lucide-react';

export default function AddEducationRecord({ 
  onClose, 
  onSuccess,
  prefilledYear = '',
  prefilledSemester = '',
  prefilledCategory = ''
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    year: prefilledYear || new Date().getFullYear().toString(),
    semester: prefilledSemester || '',
    category: prefilledCategory || '',
    date: new Date().toISOString().split('T')[0],
    receipt_no: '',
    order_number: '',
    payment_gateway: '',
    bank_reference_no: '',
    gateway_reference_no: '',
    amount: '',
    amount_info: '',
    image: null
  });

  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Default suggestions
  const commonCategories = ['Semester Fee', 'Hostel Fee', 'Mess Fee', 'Exam Fee', 'Library Penalty'];
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image must be less than 5MB');
      return;
    }

    setFormData(prev => ({ ...prev, image: file }));
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let image_url = null;

      // 1. Upload Image to Supabase Storage if provided
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

      // 2. Insert Record
      const { error: insertError } = await supabase
        .from('education_fees')
        .insert({
          user_id: user.id,
          year: formData.year.toString(),
          semester: formData.semester,
          category: formData.category,
          date: formData.date,
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

      onSuccess();
    } catch (err) {
      console.error('Error saving education fee:', err);
      setError(err.message || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Record</h2>
              <p className="text-xs text-slate-500">Capture your academic payment</p>
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
            
            {/* Folder Location Group */}
            <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Folder Location</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Academic Year *</label>
                  <input
                    type="text"
                    name="year"
                    required
                    placeholder="e.g. 2026"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                    value={formData.year}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Semester *</label>
                  <input
                    type="text"
                    name="semester"
                    required
                    placeholder="e.g. Sem 1"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                    value={formData.semester}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category *</label>
                <div className="relative">
                  <input
                    type="text"
                    name="category"
                    required
                    placeholder="e.g. Semester Fee"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                    value={formData.category}
                    onChange={handleChange}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {showCategoryDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                    {commonCategories.map(cat => (
                      <div 
                        key={cat}
                        className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        onMouseDown={() => {
                          setFormData(prev => ({ ...prev, category: cat }));
                          setShowCategoryDropdown(false);
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                  type="date"
                  name="date"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white outline-none transition-all"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Optional Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-2 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className="text-sm text-slate-500 font-medium">Tap to upload receipt copy</span>
                </button>
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
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
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
                Save Securely
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
