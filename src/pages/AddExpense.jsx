import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Loader2, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AddExpense() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    image: null
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let image_url = null;

      if (formData.image) {
        const fileExt = formData.image.name.split('.').pop();
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
            image_url
          }
        ]);

      if (dbError) throw dbError;

      setFormData({
        name: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        image: null
      });
      
      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while adding the expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Expense</h2>
        <p className="text-slate-500 text-sm mt-1">Record a new transaction and keep track of your spending.</p>
      </div>

      <div className="card pt-1 shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {success && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-center gap-3 text-teal-800">
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
              <p className="text-sm font-medium">Expense added successfully!</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Expense Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Groceries at Whole Foods"
                className="input-field"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium text-slate-700">Amount (₹)</label>
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Receipt Image (Optional)</label>
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
                <p className="text-xs leading-5 text-slate-500 mt-1">PNG, JPG, GIF up to 10MB</p>
                {formData.image && (
                  <p className="mt-3 text-sm font-medium text-teal-700 bg-teal-50 inline-block px-3 py-1 rounded-full border border-teal-100">
                    Selected: {formData.image.name}
                  </p>
                )}
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
    </div>
  );
}
