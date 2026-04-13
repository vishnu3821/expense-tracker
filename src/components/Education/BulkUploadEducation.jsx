import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, 
  Upload, 
  FileText, 
  Table as TableIcon, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ClipboardPaste,
  Info
} from 'lucide-react';
import { format, parse } from 'date-fns';

export default function BulkUploadEducation({ 
  onClose, 
  onSuccess,
  year,
  semester,
  category
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [view, setView] = useState('input'); // 'input' | 'preview'

  const handlePaste = (e) => {
    // We let the textarea handle the paste, then process on request
  };

  const parseData = () => {
    setError(null);
    if (!rawText.trim()) {
      setError("Please paste some data from your Excel sheet.");
      return;
    }

    try {
      // Split by lines, then by tabs (standard Excel copy-paste format)
      const lines = rawText.trim().split('\n');
      const data = lines.map(line => {
        const cols = line.split('\t');
        // Expected Order: Date, Amount, Receipt No, Order No, Gateway, Bank Ref, Remarks
        // Flexible parsing: We'll try to find Amount and Date at least
        return {
          date: cols[0]?.trim() || '',
          amount: cols[1]?.trim() || '',
          receipt_no: cols[2]?.trim() || '',
          order_number: cols[3]?.trim() || '',
          payment_gateway: cols[4]?.trim() || '',
          bank_reference_no: cols[5]?.trim() || '',
          amount_info: cols[6]?.trim() || ''
        };
      }).filter(row => row.date && row.amount); // Must have at least date and amount

      if (data.length === 0) {
        throw new Error("No valid data found. Ensure you have Date and Amount columns.");
      }

      setParsedData(data);
      setView('preview');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const recordsToInsert = parsedData.map(row => {
        // Robust Date Parsing
        let finalDate = row.date;
        try {
           // Handle common formats: DD/MM/YYYY, YYYY-MM-DD
           if (finalDate.includes('/')) {
              const parts = finalDate.split('/');
              if (parts[2].length === 4) {
                 finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
           }
        } catch(e) {}

        return {
          user_id: user.id,
          year,
          semester,
          category,
          date: finalDate,
          amount: parseFloat(row.amount.replace(/[^0-9.]/g, '')),
          receipt_no: row.receipt_no || null,
          order_number: row.order_number || null,
          payment_gateway: row.payment_gateway || null,
          bank_reference_no: row.bank_reference_no || null,
          amount_info: row.amount_info || null,
          image_url: null // Photos added later via Edit
        };
      });

      const { error: insertError } = await supabase
        .from('education_fees')
        .insert(recordsToInsert);

      if (insertError) throw insertError;

      onSuccess();
    } catch (err) {
      console.error("Bulk Upload Error:", err);
      setError(err.message || "Failed to upload records.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ClipboardPaste className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Bulk Import</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Into: {year} &bull; {semester} &bull; {category}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 border border-slate-100 dark:border-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold border border-red-100 dark:border-red-900/30 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {view === 'input' ? (
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                 <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                 <div className="text-xs text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                   <strong>Quick Guide:</strong> Copy rows from your Excel/Google Sheet and paste them below. 
                   Ensure your columns are in this order: 
                   <span className="block mt-1 font-bold opacity-80">Date | Amount | Receipt ID | Order ID | Gateway | Bank Ref | Remarks</span>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Paste Data Here</label>
                <textarea
                  className="w-full h-64 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-mono focus:border-indigo-500 outline-none transition-all shadow-inner dark:text-white"
                  placeholder="13/04/2026&#9;25000&#9;REC-001&#9;ORD-99&#9;Razorpay&#9;UTR123..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
                <span className="text-[10px] font-black text-slate-300 uppercase italic">Or choose a file</span>
                <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
              </div>

              <label className="block w-full h-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                 <Upload className="h-5 w-5 text-slate-400" />
                 <span className="text-sm font-bold text-slate-500">Upload .csv or .txt</span>
                 <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                     <CheckCircle2 className="h-5 w-5" />
                     {parsedData.length} records parsed successfully
                  </div>
                  <button onClick={() => setView('input')} className="text-xs font-black text-indigo-600 underline">Start Over</button>
               </div>

               <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Receipt ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {parsedData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="dark:text-slate-300">
                          <td className="px-4 py-3 font-bold">{row.date}</td>
                          <td className="px-4 py-3 text-right font-black">₹{row.amount}</td>
                          <td className="px-4 py-3 text-slate-400">{row.receipt_no || '--'}</td>
                        </tr>
                      ))}
                      {parsedData.length > 5 && (
                        <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                           <td colSpan="3" className="px-4 py-2 text-center text-slate-400 font-bold italic">
                              + {parsedData.length - 5} more records...
                           </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/10">
          {view === 'input' ? (
            <button
              onClick={parseData}
              disabled={!rawText.trim()}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98]"
            >
              Preview Import
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Save {parsedData.length} Records to {category}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
