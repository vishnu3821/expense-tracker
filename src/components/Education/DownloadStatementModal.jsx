import React, { useState } from 'react';
import { X, FileText, Table, Download, Loader2, UserCircle, Hash, ChevronRight, CheckCircle2 } from 'lucide-react';
function boldHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── Modal UI ──────────────────────────────────────────────────────────────────

export default function DownloadStatementModal({ fees, onClose }) {
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const yearCount = [...new Set(fees.map(f => f.year))].length;
  const totalAmount = fees.reduce((s, f) => s + numVal(f.amount), 0);
  const receiptCount = fees.filter(f => f.image_url).length;

  const handleDownload = () => {
    if (!selectedFormat) return;
    setLoading(true);
    setError(null);
    try {
      if (selectedFormat === 'pdf') generatePDF(fees, studentName, studentId);
      else generateExcel(fees, studentName, studentId);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Download failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-linear-to-br from-emerald-600 to-teal-500 p-6">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-5 w-5 text-emerald-100" />
                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Export Statement</p>
              </div>
              <h2 className="text-2xl font-black text-white">Download Statement</h2>
              <p className="text-sm text-emerald-100/80 mt-1 font-medium">
                {yearCount} year{yearCount !== 1 ? 's' : ''} • {fees.length} records • {receiptCount} receipts
              </p>
            </div>
            <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Downloaded!</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Your {selectedFormat === 'pdf' ? 'PDF' : 'Excel'} statement has been saved.
                </p>
              </div>
              <button onClick={onClose} className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Student Identity */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Student Details <span className="text-slate-300 normal-case font-medium">(optional — appears on document)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="Full Name" value={studentName} onChange={e => setStudentName(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition" />
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="Student ID" value={studentId} onChange={e => setStudentId(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition" />
                  </div>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Choose Format</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* PDF */}
                  <button onClick={() => setSelectedFormat('pdf')}
                    className={`relative p-5 rounded-3xl border-2 text-left transition-all ${selectedFormat === 'pdf' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}>
                    {selectedFormat === 'pdf' && <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"><ChevronRight className="h-3 w-3 text-white" /></div>}
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                      <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm">PDF</h4>
                    <ul className="mt-2 space-y-1">
                      {['All years, 1 file', 'Print-ready layout', 'Borders + totals', 'Amount in words'].map(t => (
                        <li key={t} className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> {t}
                        </li>
                      ))}
                    </ul>
                  </button>

                  {/* Excel */}
                  <button onClick={() => setSelectedFormat('excel')}
                    className={`relative p-5 rounded-3xl border-2 text-left transition-all ${selectedFormat === 'excel' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}>
                    {selectedFormat === 'excel' && <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center"><ChevronRight className="h-3 w-3 text-white" /></div>}
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                      <Table className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm">Excel</h4>
                    <ul className="mt-2 space-y-1">
                      {['Sheet per year', 'Full borders + colors', 'Frozen header row', 'Receipt links sheet'].map(t => (
                        <li key={t} className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> {t}
                        </li>
                      ))}
                    </ul>
                  </button>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{fees.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Years</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{yearCount}</p>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 text-red-600 text-sm font-medium">{error}</div>
              )}

              {/* Download Button */}
              <button onClick={handleDownload} disabled={!selectedFormat || loading}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-500/20">
                {loading
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating...</>
                  : <><Download className="h-5 w-5" /> Download {selectedFormat === 'pdf' ? 'PDF' : selectedFormat === 'excel' ? 'Excel' : 'Statement'}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
