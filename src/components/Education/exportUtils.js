import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

export const fmtIN = (val) => {
  const n = parseFloat(String(val || 0).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const numVal = (val) => parseFloat(String(val || 0).replace(/[^0-9.]/g, '')) || 0;

export const safeDate = (d) => { try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d || '—'; } };

export const numWords = (n) => {
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

const boldHash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

// ── PDF Generator ─────────────────────────────────────────────────────────────

/**
 * @param {Array}  fees         - array of fee records
 * @param {string} studentName  - optional
 * @param {string} studentId    - optional
 * @param {string} titleOverride - optional, e.g. "Hostel Fee Statement"
 * @param {string} filePrefix    - optional, e.g. "Hostel_Fee"
 */
export const generatePDF = (fees, studentName = '', studentId = '', titleOverride = '', filePrefix = 'Fee_Statement') => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const now = format(new Date(), 'dd MMM yyyy, hh:mm a');
  const title = titleOverride || 'Educational Fee Statement';

  // Header band
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, M, 15);
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
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.2, textColor: [30, 41, 59], font: 'helvetica' },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 4 },
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
    doc.text('Generated by Expense Monitor • expensemonitor.tech', M, H - 7);
    doc.text(`Page ${p} of ${total}`, W - M, H - 7, { align: 'right' });
  }

  const safeName = studentName ? '_' + studentName.replace(/\s+/g, '_') : '';
  doc.save(`${filePrefix}${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// ── Excel Generator ───────────────────────────────────────────────────────────

export const generateExcel = (fees, studentName = '', studentId = '', filePrefix = 'Fee_Statement') => {
  const years = [...new Set(fees.map(f => f.year))].sort((a, b) => b.localeCompare(a));
  const grand = fees.reduce((s, f) => s + numVal(f.amount), 0);
  const now = format(new Date(), 'dd MMM yyyy, hh:mm a');
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const STYLES = {
    hdr:     { id: 'hdr',     fill: '#10B981', color: '#FFFFFF', bold: true,  align: 'Center', size: 10 },
    data:    { id: 'data',    fill: '#FFFFFF', color: '#1E293B', bold: false, align: 'Left',   size: 10 },
    dataAlt: { id: 'dataAlt', fill: '#F8FAFC', color: '#1E293B', bold: false, align: 'Left',   size: 10 },
    amt:     { id: 'amt',     fill: '#FFFFFF', color: '#1E293B', bold: true,  align: 'Right',  size: 10 },
    amtAlt:  { id: 'amtAlt',  fill: '#F8FAFC', color: '#1E293B', bold: true,  align: 'Right',  size: 10 },
    total:   { id: 'total',   fill: '#ECFDF5', color: '#065F46', bold: true,  align: 'Left',   size: 10 },
    totalAmt:{ id: 'totalAmt',fill: '#ECFDF5', color: '#065F46', bold: true,  align: 'Right',  size: 10 },
    grand:   { id: 'grand',   fill: '#10B981', color: '#FFFFFF', bold: true,  align: 'Left',   size: 11 },
    grandAmt:{ id: 'grandAmt',fill: '#10B981', color: '#FFFFFF', bold: true,  align: 'Right',  size: 11 },
    meta:    { id: 'meta',    fill: '#F1F5F9', color: '#475569', bold: false, align: 'Left',   size: 10 },
    metaKey: { id: 'metaKey', fill: '#F1F5F9', color: '#0F172A', bold: true,  align: 'Left',   size: 10 },
    words:   { id: 'words',   fill: '#FFFFFF', color: '#64748B', bold: false, align: 'Left',   size: 9, italic: true },
    title:   { id: 'title',   fill: '#0F172A', color: '#FFFFFF', bold: true,  align: 'Left',   size: 14 },
    blank:   { id: 'blank',   fill: '#FFFFFF', color: '#FFFFFF', bold: false, align: 'Left',   size: 10 },
  };

  const borderDef = (w = '#CBD5E1', weight = 1) =>
    `<Borders>
      <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="${weight}" ss:Color="${w}"/>
      <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="${weight}" ss:Color="${w}"/>
      <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="${weight}" ss:Color="${w}"/>
      <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="${weight}" ss:Color="${w}"/>
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
      <Font ss:Bold="${s.bold ? '1' : '0'}" ss:Color="${s.color}" ss:Size="${s.size}" ss:FontName="Calibri" ${s.italic ? 'ss:Italic="1"' : ''}/>
      <Interior ss:Color="${s.fill}" ss:Pattern="Solid"/>
      ${s.id === 'total' || s.id === 'totalAmt' ? thickBorderTop : borderDef()}
    </Style>`).join('');

  const c = (val, styleId, type = 'String') =>
    `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${esc(val)}</Data></Cell>`;

  const rowH = (cells, height = 20) => `<Row ss:Height="${height}">${cells}</Row>`;

  const COLS = [
    { id: 'Date', width: 80 }, { id: 'Semester', width: 100 }, { id: 'Category', width: 110 },
    { id: 'Description / Remarks', width: 200 }, { id: 'Receipt No.', width: 90 },
    { id: 'Order No.', width: 90 }, { id: 'Payment Method', width: 100 },
    { id: 'Bank Reference', width: 120 }, { id: 'Amount (₹)', width: 90 },
  ];
  const colDefs = COLS.map(col => `<Column ss:Width="${col.width}"/>`).join('');

  const yearSheets = years.map(year => {
    const yFees = fees.filter(f => f.year === year).sort((a, b) => new Date(a.date) - new Date(b.date));
    const yTotal = yFees.reduce((s, f) => s + numVal(f.amount), 0);

    const hdrRow = rowH(`<Cell ss:StyleID="meta" ss:MergeAcross="8"><Data ss:Type="String">Academic Year: ${esc(year)} | Student: ${esc(studentName || '—')} | ID: ${esc(studentId || '—')}</Data></Cell>`, 24);
    const colHdrRow = rowH(COLS.map(col => c(col.id, 'hdr')).join(''), 22);
    const dataRows = yFees.map((f, i) => {
      const ds = i % 2 === 1 ? 'dataAlt' : 'data';
      const as = i % 2 === 1 ? 'amtAlt' : 'amt';
      return rowH([c(safeDate(f.date), ds), c(f.semester || '', ds), c(f.category || '', ds), c(f.amount_info || '', ds), c(f.receipt_no || '', ds), c(f.order_number || '', ds), c(f.payment_gateway || '', ds), c(f.bank_reference_no || '', ds), c(numVal(f.amount).toFixed(2), as, 'Number')].join(''), 18);
    }).join('');
    const totalRow = rowH([`<Cell ss:StyleID="total" ss:MergeAcross="7"><Data ss:Type="String">TOTAL FOR ${esc(year)}</Data></Cell>`, c(yTotal.toFixed(2), 'totalAmt', 'Number')].join(''), 22);
    const wordsRow = rowH(`<Cell ss:StyleID="words" ss:MergeAcross="8"><Data ss:Type="String">${esc(numWords(yTotal))}</Data></Cell>`, 16);

    return `
    <Worksheet ss:Name="${esc(year.substring(0, 31))}">
      <Table>${colDefs}${hdrRow}${colHdrRow}${dataRows}${totalRow}${wordsRow}</Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal><TopRowBottomPane>2</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>
    </Worksheet>`;
  });

  const summaryRows = years.map((year, i) => {
    const yFees = fees.filter(f => f.year === year);
    const yTotal = yFees.reduce((s, f) => s + numVal(f.amount), 0);
    const ds = i % 2 === 1 ? 'dataAlt' : 'data';
    const as = i % 2 === 1 ? 'amtAlt' : 'amt';
    return rowH([c(year, ds), c(String(yFees.length), ds, 'Number'), c(yTotal.toFixed(2), as, 'Number')].join(''), 18);
  }).join('');

  const summarySheet = `
  <Worksheet ss:Name="Summary">
    <Table>
      <Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="120"/>
      ${rowH(`<Cell ss:StyleID="title" ss:MergeAcross="2"><Data ss:Type="String">Fee Statement — ${esc(studentName || 'Student')}</Data></Cell>`, 28)}
      ${rowH([c('Generated', 'metaKey'), c(esc(now), 'meta'), c('', 'blank')].join(''), 18)}
      ${rowH([c('Student Name', 'metaKey'), c(studentName || '—', 'meta'), c('', 'blank')].join(''), 18)}
      ${rowH([c('Student ID', 'metaKey'), c(studentId || '—', 'meta'), c('', 'blank')].join(''), 18)}
      ${rowH(`<Cell ss:StyleID="blank" ss:MergeAcross="2"><Data ss:Type="String"></Data></Cell>`, 8)}
      ${rowH([c('Academic Year', 'hdr'), c('Records', 'hdr'), c('Total Amount (₹)', 'hdr')].join(''), 22)}
      ${summaryRows}
      ${rowH([`<Cell ss:StyleID="grand" ss:MergeAcross="1"><Data ss:Type="String">GRAND TOTAL</Data></Cell>`, c(grand.toFixed(2), 'grandAmt', 'Number')].join(''), 24)}
      ${rowH(`<Cell ss:StyleID="words" ss:MergeAcross="2"><Data ss:Type="String">${esc(numWords(grand))}</Data></Cell>`, 16)}
    </Table>
  </Worksheet>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Fee Statement</Title><Author>${esc(studentName || 'Expense Monitor')}</Author><Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>${styleDefs}</Styles>
  ${summarySheet}
  ${yearSheets.join('')}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filePrefix}_${format(new Date(), 'yyyy-MM-dd')}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};
