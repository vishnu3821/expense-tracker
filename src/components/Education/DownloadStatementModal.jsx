import React, { useState } from 'react';
import { X, FileText, Table, Download, Loader2, UserCircle, Hash, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrencyIN = (val) => {
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.]/g, '')) : parseFloat(val || 0);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const numberToWords = (n) => {
  const num = parseFloat(n || 0);
  if (isNaN(num) || num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const makeWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + makeWords(n % 100) : '');
    return '';
  };
  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const remaining = Math.floor(num % 1000);
  let words = '';
  if (crores) words += makeWords(crores) + ' Crore ';
  if (lakhs) words += makeWords(lakhs) + ' Lakh ';
  if (thousands) words += makeWords(thousands) + ' Thousand ';
  if (remaining) words += makeWords(remaining);
  const paise = Math.round((num % 1) * 100);
  return words.trim() + (paise ? ` Rupees and ${makeWords(paise)} Paise Only` : ' Rupees Only');
};

const safeDate = (dateStr) => {
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); }
  catch { return dateStr || '—'; }
};

// ── PDF Generator ────────────────────────────────────────────────────────────

const generatePDF = (fees, studentName, studentId) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const generatedAt = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // ── Header ──
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Educational Fee Statement', margin, 16);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('All amounts are in Indian Rupees (INR)', margin, 22);

  // Student info block
  if (studentName || studentId) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Student: ${studentName || '—'}`, margin, 29);
    doc.text(`ID: ${studentId || '—'}`, margin + 80, 29);
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${generatedAt}`, pageW - margin, 34, { align: 'right' });

  let y = 46;

  // ── Group by Year ──
  const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a));

  years.forEach((year, yi) => {
    const yearFees = fees.filter(f => f.year === year);
    const yearTotal = yearFees.reduce((s, f) => s + parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0, 0);

    // Year heading
    if (y + 12 > pageH - 24) { doc.addPage(); y = margin; }
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, 'F');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Academic Year: ${year}`, margin + 3, y + 6.5);
    y += 14;

    // Table
    const tableBody = yearFees.map(f => [
      safeDate(f.date),
      f.semester || '—',
      f.category || '—',
      f.amount_info || f.receipt_no || '—',
      f.payment_gateway || '—',
      formatCurrencyIN(f.amount),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Semester', 'Category', 'Description', 'Payment Method', 'Amount']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 26 },
        2: { cellWidth: 30 },
        3: { cellWidth: 46 },
        4: { cellWidth: 28 },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.2,
    });

    y = doc.lastAutoTable.finalY + 3;

    // Year Total row
    if (y + 14 > pageH - 24) { doc.addPage(); y = margin; }
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.rect(margin, y, pageW - margin * 2, 10, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Total for ${year}:`, margin + 3, y + 6.5);
    doc.text(formatCurrencyIN(yearTotal), pageW - margin - 2, y + 6.5, { align: 'right' });
    y += 11;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(numberToWords(yearTotal), margin + 3, y + 3);
    y += 8;

    // Receipt thumbnails (if any)
    const withImages = yearFees.filter(f => f.image_url);
    if (withImages.length > 0) {
      if (y + 10 > pageH - 30) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Attached Receipts:', margin, y + 4);
      y += 7;
      withImages.forEach((f) => {
        if (y + 6 > pageH - 20) { doc.addPage(); y = margin; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(99, 102, 241);
        doc.textWithLink(`• Receipt — ${safeDate(f.date)} — ${formatCurrencyIN(f.amount)}`, margin + 2, y + 3, { url: f.image_url });
        y += 6;
      });
      y += 4;
    }

    // Spacing between years
    y += 8;
  });

  // ── Grand Total ──
  const grandTotal = fees.reduce((s, f) => s + (parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0), 0);
  if (y + 20 > pageH - 20) { doc.addPage(); y = margin; }
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y, pageW - margin * 2, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL', margin + 4, y + 8);
  doc.text(formatCurrencyIN(grandTotal), pageW - margin - 2, y + 8, { align: 'right' });
  y += 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(numberToWords(grandTotal), margin + 2, y + 3);

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Expense Tracker • expensemonitor.tech', margin, pageH - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const fileName = `Fee_Statement_${studentName ? studentName.replace(/\s+/g, '_') + '_' : ''}${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};

// ── Excel Generator ──────────────────────────────────────────────────────────

const generateExcel = async (fees, studentName, studentId) => {
  // Dynamic import so build doesn't break if xlsx hasn't been installed yet
  const XLSX = await import('xlsx');

  const wbp = XLSX.utils.book_new();
  const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a));

  // Summary sheet
  const summaryRows = [
    ['Fee Statement', '', '', '', '', ''],
    ['Student Name', studentName || '—', '', 'Student ID', studentId || '—', ''],
    ['Generated', format(new Date(), 'dd MMM yyyy, hh:mm a'), '', '', '', ''],
    [],
    ['Academic Year', 'Total Records', 'Total Amount (₹)'],
  ];
  let grandTotal = 0;
  years.forEach(year => {
    const yFees = fees.filter(f => f.year === year);
    const yTotal = yFees.reduce((s, f) => s + (parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0), 0);
    grandTotal += yTotal;
    summaryRows.push([year, yFees.length, yTotal]);
  });
  summaryRows.push([]);
  summaryRows.push(['Grand Total', fees.length, grandTotal]);

  const sumWs = XLSX.utils.aoa_to_sheet(summaryRows);
  sumWs['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wbp, sumWs, 'Summary');

  // Per-year sheets
  years.forEach(year => {
    const yFees = fees.filter(f => f.year === year).sort((a, b) => new Date(a.date) - new Date(b.date));
    const yTotal = yFees.reduce((s, f) => s + (parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0), 0);

    const header = ['Date', 'Semester', 'Category', 'Description / Remarks', 'Receipt No.', 'Order No.', 'Payment Method', 'Bank Reference', 'Amount (₹)'];
    const rows = yFees.map(f => [
      safeDate(f.date),
      f.semester || '',
      f.category || '',
      f.amount_info || '',
      f.receipt_no || '',
      f.order_number || '',
      f.payment_gateway || '',
      f.bank_reference_no || '',
      parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0,
    ]);
    rows.push(['', '', '', '', '', '', 'TOTAL', '', yTotal]);
    rows.push(['', '', '', '', '', '', '', '', numberToWords(yTotal)]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [
      { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }
    ];
    // Trim sheet name to 31 chars (Excel limit)
    XLSX.utils.book_append_sheet(wbp, ws, year.substring(0, 31));

    // Receipts sheet (only if images exist for this year)
    const hasReceipts = yFees.some(f => f.image_url);
    if (hasReceipts) {
      const recHeader = ['Date', 'Category', 'Description', 'Amount (₹)', 'Receipt Link'];
      const recRows = yFees
        .filter(f => f.image_url)
        .map(f => [safeDate(f.date), f.category || '', f.amount_info || '', parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0, f.image_url]);

      const recWs = XLSX.utils.aoa_to_sheet([recHeader, ...recRows]);
      recWs['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wbp, recWs, `${year.substring(0, 24)} Receipts`);
    }
  });

  const fileName = `Fee_Statement_${studentName ? studentName.replace(/\s+/g, '_') + '_' : ''}${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wbp, fileName);
};

// ── Modal Component ──────────────────────────────────────────────────────────

export default function DownloadStatementModal({ fees, onClose }) {
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(null); // 'pdf' | 'excel'
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    if (!selectedFormat) return;
    setLoading(true);
    setError(null);
    try {
      if (selectedFormat === 'pdf') {
        generatePDF(fees, studentName, studentId);
      } else {
        await generateExcel(fees, studentName, studentId);
      }
      setDone(true);
    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed. If you chose Excel, please run `npm install xlsx` first.');
    } finally {
      setLoading(false);
    }
  };

  const yearCount = [...new Set(fees.map(f => f.year))].length;
  const totalAmount = fees.reduce((s, f) => s + (parseFloat(String(f.amount || 0).replace(/[^0-9.]/g, '')) || 0), 0);
  const receiptCount = fees.filter(f => f.image_url).length;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-linear-to-br from-emerald-600 to-teal-500 p-6">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-5 w-5 text-emerald-100" />
                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Export</p>
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
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Downloaded!</h3>
                <p className="text-sm text-slate-500 mt-1">Your statement has been saved.</p>
              </div>
              <button onClick={onClose} className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Student Identity */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slateald-400 dark:text-slate-400 uppercase tracking-widest pl-1">Student Details (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Student ID"
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Choose Format</p>
                <div className="grid grid-cols-2 gap-4">

                  {/* PDF Card */}
                  <button
                    onClick={() => setSelectedFormat('pdf')}
                    className={`relative p-5 rounded-3xl border-2 text-left transition-all ${selectedFormat === 'pdf' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'}`}
                  >
                    {selectedFormat === 'pdf' && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <ChevronRight className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                      <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm">PDF</h4>
                    <ul className="mt-2 space-y-1">
                      {['All years in 1 file', 'Print-ready layout', 'Receipt thumbnails', 'Amount in words'].map(t => (
                        <li key={t} className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> {t}
                        </li>
                      ))}
                    </ul>
                  </button>

                  {/* Excel Card */}
                  <button
                    onClick={() => setSelectedFormat('excel')}
                    className={`relative p-5 rounded-3xl border-2 text-left transition-all ${selectedFormat === 'excel' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'}`}
                  >
                    {selectedFormat === 'excel' && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <ChevronRight className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                      <Table className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm">Excel</h4>
                    <ul className="mt-2 space-y-1">
                      {['Separate sheet per year', 'Bold headers + totals', 'Receipt links sheet', 'Full data export'].map(t => (
                        <li key={t} className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> {t}
                        </li>
                      ))}
                    </ul>
                  </button>
                </div>
              </div>

              {/* Summary strip */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{fees.length}</p>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium">
                  {error}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleDownload}
                disabled={!selectedFormat || loading}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-500/20"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Generating...</>
                ) : (
                  <><Download className="h-5 w-5" /> Download {selectedFormat === 'pdf' ? 'PDF' : selectedFormat === 'excel' ? 'Excel' : 'Statement'}</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
