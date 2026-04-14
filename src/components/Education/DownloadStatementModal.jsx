import React, { useState } from 'react';
import { X, FileText, Table, Download, Loader2, UserCircle, Hash, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtIN = (val) => {
  const n = parseFloat(String(val || 0).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const numVal = (val) => parseFloat(String(val || 0).replace(/[^0-9.]/g, '')) || 0;

const safeDate = (d) => { try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d || '—'; } };

const numWords = (n) => {
  const num = parseFloat(n || 0);
  if (!num) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const w = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + w(n % 100) : '');
  };
  let words = '';
  if (Math.floor(num / 10000000)) words += w(Math.floor(num / 10000000)) + ' Crore ';
  if (Math.floor((num % 10000000) / 100000)) words += w(Math.floor((num % 10000000) / 100000)) + ' Lakh ';
  if (Math.floor((num % 100000) / 1000)) words += w(Math.floor((num % 100000) / 1000)) + ' Thousand ';
  if (Math.floor(num % 1000)) words += w(Math.floor(num % 1000));
  const p = Math.round((num % 1) * 100);
  return words.trim() + (p ? ` Rupees and ${w(p)} Paise Only` : ' Rupees Only');
};

// ── PDF Generator ─────────────────────────────────────────────────────────────

const generatePDF = (fees, studentName, studentId) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const now = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // Header band
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Educational Fee Statement', M, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('All amounts in Indian Rupees (INR)', M, 22);
  if (studentName || studentId) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Student: ${studentName || '—'}`, M, 30);
    doc.text(`ID: ${studentId || '—'}`, M + 80, 30);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 255, 230);
  doc.text(`Generated: ${now}`, W - M, 37, { align: 'right' });

  let y = 50;
  const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a));

  years.forEach((year) => {
    const yFees = fees.filter(f => f.year === year);
    const yTotal = yFees.reduce((s, f) => s + numVal(f.amount), 0);

    if (y + 14 > H - 24) { doc.addPage(); y = M; }

    // Year heading band
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'S');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Academic Year: ${year}`, M + 4, y + 7);
    y += 13;

    // Data table
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Date', 'Semester', 'Category', 'Description / Remarks', 'Payment', 'Amount (₹)']],
      body: yFees.map(f => [
        safeDate(f.date),
        f.semester || '—',
        f.category || '—',
        f.amount_info || f.receipt_no || '—',
        f.payment_gateway || '—',
        fmtIN(f.amount),
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle',
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [30, 41, 59],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 21, halign: 'left' },
        1: { cellWidth: 22, halign: 'left' },
        2: { cellWidth: 28, halign: 'left' },
        3: { cellWidth: 52, halign: 'left' },
        4: { cellWidth: 26, halign: 'left' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [203, 213, 225],
      tableLineWidth: 0.3,
    });

    y = doc.lastAutoTable.finalY + 2;

    // Year total row
    if (y + 16 > H - 24) { doc.addPage(); y = M; }
    doc.setFillColor(236, 253, 245);
    doc.rect(M, y, W - M * 2, 10, 'F');
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.rect(M, y, W - M * 2, 10, 'S');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL FOR ${year}`, M + 3, y + 7);
    doc.text(fmtIN(yTotal), W - M - 2, y + 7, { align: 'right' });
    y += 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(numWords(yTotal), M + 3, y + 3);
    y += 8;

    // Receipt links
    const withImg = yFees.filter(f => f.image_url);
    if (withImg.length) {
      if (y + 8 > H - 28) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Attached Receipts:', M, y + 4);
      y += 7;
      withImg.forEach(f => {
        if (y + 5 > H - 20) { doc.addPage(); y = M; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(99, 102, 241);
        doc.textWithLink(`• ${safeDate(f.date)} — ${f.category || ''} — ${fmtIN(f.amount)}`, M + 2, y + 3, { url: f.image_url });
        y += 5.5;
      });
    }
    y += 10;
  });

  // Grand total
  const grand = fees.reduce((s, f) => s + numVal(f.amount), 0);
  if (y + 20 > H - 20) { doc.addPage(); y = M; }
  doc.setFillColor(16, 185, 129);
  doc.rect(M, y, W - M * 2, 13, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GRAND TOTAL', M + 4, y + 9);
  doc.text(fmtIN(grand), W - M - 3, y + 9, { align: 'right' });
  y += 15;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(numWords(grand), M + 2, y + 3);

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Expense Tracker • expensemonitor.tech', M, H - 7);
    doc.text(`Page ${p} of ${total}`, W - M, H - 7, { align: 'right' });
  }

  doc.save(`Fee_Statement${studentName ? '_' + studentName.replace(/\s+/g, '_') : ''}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ── Excel Generator (Pure XML — no library needed) ────────────────────────────

const generateExcel = (fees, studentName, studentId) => {
  const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a));
  const grand = fees.reduce((s, f) => s + numVal(f.amount), 0);
  const now = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // XML escape helper
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build a styled cell
  const cell = (value, { bold = false, bg = null, align = 'Left', type = 'String', border = true, italic = false, wrap = false } = {}) => {
    const styles = [
      `Vertical:Center`,
      `Horizontal:${align}`,
      wrap ? 'WrapText:1' : '',
    ].filter(Boolean);
    const font = bold ? `<Font ss:Bold="1" ss:Size="10" ss:FontName="Calibri"/>` : `<Font ss:Size="10" ss:FontName="Calibri" ${italic ? 'ss:Italic="1"' : ''}/>`;
    const interior = bg ? `<Interior ss:Color="${bg}" ss:Pattern="Solid"/>` : '';
    const borderXml = border ? `<Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    </Borders>` : '';
    const align2 = `<Alignment ss:Horizontal="${align}" ss:Vertical="Center" ${wrap ? 'ss:WrapText="1"' : ''}/>`;
    const styleBlock = `<Style ss:ID="s_${boldHash(`${bold}${bg}${align}${italic}${type}`)}"><Alignment ss:Horizontal="${align}" ss:Vertical="Center" ${wrap ? 'ss:WrapText="1"' : ''}/>${font}${interior}${borderXml}</Style>`;
    return { value, type, bold, bg, align, italic, wrap, border };
  };

  // Because SpreadsheetML needs styles in a <Styles> block, we collect all unique styles then reference them.
  // Simpler: Use inline ss:StyleID approach.
  // We pre-define styles by creating unique IDs.

  const STYLES = {
    hdr:   { id: 'hdr',  fill: '#10B981', color: '#FFFFFF', bold: true,  align: 'Center', size: 10 },
    data:  { id: 'data', fill: '#FFFFFF', color: '#1E293B', bold: false, align: 'Left',   size: 10 },
    dataAlt: { id: 'dataAlt', fill: '#F8FAFC', color: '#1E293B', bold: false, align: 'Left', size: 10 },
    amt:   { id: 'amt',  fill: '#FFFFFF', color: '#1E293B', bold: true,  align: 'Right',  size: 10 },
    amtAlt:{ id: 'amtAlt', fill: '#F8FAFC', color: '#1E293B', bold: true, align: 'Right', size: 10 },
    total: { id: 'total', fill: '#ECFDF5', color: '#065F46', bold: true, align: 'Left',   size: 10 },
    totalAmt: { id: 'totalAmt', fill: '#ECFDF5', color: '#065F46', bold: true, align: 'Right', size: 10 },
    grand: { id: 'grand', fill: '#10B981', color: '#FFFFFF', bold: true, align: 'Left',  size: 11 },
    grandAmt:{ id: 'grandAmt', fill: '#10B981', color: '#FFFFFF', bold: true, align: 'Right', size: 11 },
    meta:  { id: 'meta', fill: '#F1F5F9', color: '#475569', bold: false, align: 'Left',  size: 10 },
    metaKey:{ id: 'metaKey', fill: '#F1F5F9', color: '#0F172A', bold: true, align: 'Left', size: 10 },
    words: { id: 'words', fill: '#FFFFFF', color: '#64748B', bold: false, align: 'Left',  size: 9, italic: true },
    title: { id: 'title', fill: '#0F172A', color: '#FFFFFF', bold: true,  align: 'Left',  size: 14 },
    blank: { id: 'blank', fill: '#FFFFFF', color: '#FFFFFF', bold: false, align: 'Left',  size: 10 },
  };

  const borderDef = (top = 1, w = '#CBD5E1') =>
    `<Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="${top}" ss:Color="${w}"/>
      <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="${top}" ss:Color="${w}"/>
      <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="${top}" ss:Color="${w}"/>
      <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="${top}" ss:Color="${w}"/>
    </Borders>`;

  const thickBorderTop = `<Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#10B981"/>
    <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#10B981"/>
    <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#10B981"/>
    <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#10B981"/>
  </Borders>`;

  const styleDefs = Object.values(STYLES).map(s => `
    <Style ss:ID="${s.id}">
      <Alignment ss:Horizontal="${s.align}" ss:Vertical="Center" ${s.id === 'words' ? 'ss:WrapText="1"' : ''}/>
      <Font ss:Bold="${s.bold ? '1' : '0'}" ss:Color="${s.color}" ss:Size="${s.size}" ss:FontName="Calibri" ${(s.italic) ? 'ss:Italic="1"' : ''}/>
      <Interior ss:Color="${s.fill}" ss:Pattern="Solid"/>
      ${s.id === 'total' || s.id === 'totalAmt' ? thickBorderTop : borderDef(1)}
    </Style>`).join('');

  // Add grand row styles with medium borders
  const extraStyles = `
    <Style ss:ID="grand"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11" ss:FontName="Calibri"/><Interior ss:Color="#10B981" ss:Pattern="Solid"/>${borderDef(2, '#065F46')}</Style>
    <Style ss:ID="grandAmt"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11" ss:FontName="Calibri"/><Interior ss:Color="#10B981" ss:Pattern="Solid"/>${borderDef(2, '#065F46')}</Style>
  `;

  const c = (val, styleId, type = 'String') =>
    `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${esc(val)}</Data></Cell>`;

  const rowH = (cells, height = 20) =>
    `<Row ss:Height="${height}">${cells}</Row>`;

  const COLS = [
    { id: 'Date', width: 80 },
    { id: 'Semester', width: 100 },
    { id: 'Category', width: 110 },
    { id: 'Description / Remarks', width: 200 },
    { id: 'Receipt No.', width: 90 },
    { id: 'Order No.', width: 90 },
    { id: 'Payment Method', width: 100 },
    { id: 'Bank Reference', width: 120 },
    { id: 'Amount (₹)', width: 90 },
  ];

  const colDefs = COLS.map(col => `<Column ss:Width="${col.width}"/>`).join('');

  // Build per-year sheets
  const yearSheets = years.map(year => {
    const yFees = fees.filter(f => f.year === year)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const yTotal = yFees.reduce((s, f) => s + numVal(f.amount), 0);

    const hdrRow = rowH(
      `<Cell ss:StyleID="meta" ss:MergeAcross="8"><Data ss:Type="String">Academic Year: ${esc(year)} | Student: ${esc(studentName || '—')} | ID: ${esc(studentId || '—')}</Data></Cell>`,
      24
    );

    const colHdrRow = rowH(
      COLS.map(col => c(col.id, 'hdr')).join(''),
      22
    );

    const dataRows = yFees.map((f, i) => {
      const isAlt = i % 2 === 1;
      const ds = isAlt ? 'dataAlt' : 'data';
      const as = isAlt ? 'amtAlt' : 'amt';
      return rowH([
        c(safeDate(f.date), ds),
        c(f.semester || '', ds),
        c(f.category || '', ds),
        c(f.amount_info || '', ds),
        c(f.receipt_no || '', ds),
        c(f.order_number || '', ds),
        c(f.payment_gateway || '', ds),
        c(f.bank_reference_no || '', ds),
        c(numVal(f.amount).toFixed(2), as, 'Number'),
      ].join(''), 18);
    }).join('');

    const totalRow = rowH([
      `<Cell ss:StyleID="total" ss:MergeAcross="7"><Data ss:Type="String">TOTAL FOR ${esc(year)}</Data></Cell>`,
      c(yTotal.toFixed(2), 'totalAmt', 'Number'),
    ].join(''), 22);

    const wordsRow = rowH(
      `<Cell ss:StyleID="words" ss:MergeAcross="8"><Data ss:Type="String">${esc(numWords(yTotal))}</Data></Cell>`,
      16
    );

    const sheetName = year.substring(0, 31);
    return `
    <Worksheet ss:Name="${esc(sheetName)}">
      <Table>
        ${colDefs}
        ${hdrRow}
        ${colHdrRow}
        ${dataRows}
        ${totalRow}
        ${wordsRow}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>2</SplitHorizontal>
        <TopRowBottomPane>2</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>`;
  });

  // Summary sheet
  const summaryRows = years.map((year, i) => {
    const yFees = fees.filter(f => f.year === year);
    const yTotal = yFees.reduce((s, f) => s + numVal(f.amount), 0);
    const isAlt = i % 2 === 1;
    const ds = isAlt ? 'dataAlt' : 'data';
    const as = isAlt ? 'amtAlt' : 'amt';
    return rowH([
      c(year, ds),
      c(String(yFees.length), ds, 'Number'),
      c(yTotal.toFixed(2), as, 'Number'),
    ].join(''), 18);
  }).join('');

  const summarySheet = `
  <Worksheet ss:Name="Summary">
    <Table>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="120"/>
      ${rowH(`<Cell ss:StyleID="title" ss:MergeAcross="2"><Data ss:Type="String">Fee Statement — ${esc(studentName || 'Student')}</Data></Cell>`, 28)}
      ${rowH([
        c('Generated', 'metaKey'), c(esc(now), 'meta'), c('', 'blank'),
      ].join(''), 18)}
      ${rowH([
        c('Student Name', 'metaKey'), c(studentName || '—', 'meta'), c('', 'blank'),
      ].join(''), 18)}
      ${rowH([
        c('Student ID', 'metaKey'), c(studentId || '—', 'meta'), c('', 'blank'),
      ].join(''), 18)}
      ${rowH(`<Cell ss:StyleID="blank" ss:MergeAcross="2"><Data ss:Type="String"></Data></Cell>`, 8)}
      ${rowH([c('Academic Year', 'hdr'), c('Records', 'hdr'), c('Total Amount (₹)', 'hdr')].join(''), 22)}
      ${summaryRows}
      ${rowH([
        `<Cell ss:StyleID="grand" ss:MergeAcross="1"><Data ss:Type="String">GRAND TOTAL</Data></Cell>`,
        c(grand.toFixed(2), 'grandAmt', 'Number'),
      ].join(''), 24)}
      ${rowH(`<Cell ss:StyleID="words" ss:MergeAcross="2"><Data ss:Type="String">${esc(numWords(grand))}</Data></Cell>`, 16)}
    </Table>
  </Worksheet>`;

  // Receipt sheets (per year, only if images exist)
  const receiptSheets = years.map(year => {
    const yFees = fees.filter(f => f.year === year && f.image_url);
    if (!yFees.length) return '';
    const recColDefs = `<Column ss:Width="80"/><Column ss:Width="120"/><Column ss:Width="160"/><Column ss:Width="90"/><Column ss:Width="260"/>`;
    const recHdr = rowH([
      c('Date', 'hdr'), c('Category', 'hdr'), c('Description', 'hdr'), c('Amount (₹)', 'hdr'), c('Receipt Link (URL)', 'hdr')
    ].join(''), 22);
    const recRows = yFees.map((f, i) => {
      const ds = i % 2 === 1 ? 'dataAlt' : 'data';
      const as = i % 2 === 1 ? 'amtAlt' : 'amt';
      return rowH([
        c(safeDate(f.date), ds),
        c(f.category || '', ds),
        c(f.amount_info || '', ds),
        c(numVal(f.amount).toFixed(2), as, 'Number'),
        c(f.image_url || '', ds),
      ].join(''), 18);
    }).join('');
    return `
    <Worksheet ss:Name="${esc(year.substring(0, 20))} Receipts">
      <Table>${recColDefs}${recHdr}${recRows}</Table>
    </Worksheet>`;
  }).join('');

  // Full XMLSS workbook
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Fee Statement</Title>
    <Author>${esc(studentName || 'Expense Tracker')}</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    ${styleDefs}
  </Styles>
  ${summarySheet}
  ${yearSheets.join('')}
  ${receiptSheets}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Fee_Statement${studentName ? '_' + studentName.replace(/\s+/g, '_') : ''}_${format(new Date(), 'yyyy-MM-dd')}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

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
