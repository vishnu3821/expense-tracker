import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Calendar, UserCircle, Download, Loader2, LogOut, Moon, Sun, Bell, BellOff, FileText } from 'lucide-react';
import { requestNotificationPermission } from '../lib/firebase';

export default function More() {
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isMonthlyReporting, setIsMonthlyReporting] = useState(false);

  React.useEffect(() => {
    if (user) checkNotificationStatus();
  }, [user]);

  const checkNotificationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setNotificationsEnabled(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const handleSendMonthlyReport = async () => {
    setIsMonthlyReporting(true);
    try {
      const response = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ SUCCESS: Your monthly PDF report has been generated and sent to your email!');
      } else {
        alert('❌ FAILED: ' + (data.error || 'Check your Resend API setup.'));
      }
    } catch (err) {
      console.error('Monthly Report Error:', err);
      alert('❌ ERROR: Could not trigger report generation.');
    } finally {
      setIsMonthlyReporting(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ SUCCESS: ' + data.message);
      } else {
        alert('❌ FAILED: ' + (data.error || 'Unknown error occurred'));
      }
    } catch (err) {
      console.error('Test Notification Error:', err);
      alert('❌ ERROR: Could not connect to diagnostic service.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleNotifications = async () => {
    setIsTogglingNotifications(true);
    if (notificationsEnabled) {
      await supabase.from('user_fcm_tokens').delete().eq('user_id', user.id);
      setNotificationsEnabled(false);
    } else {
      // Step-by-step diagnostic
      try {
        // Step 1: Check browser support
        if (!('Notification' in window)) {
          alert('❌ Step 1 Failed: Browser does not support notifications');
          return;
        }
        if (!('serviceWorker' in navigator)) {
          alert('❌ Step 1 Failed: Browser does not support service workers');
          return;
        }

        // Step 2: Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert(`❌ Step 2 Failed: Permission was "${permission}". Please allow notifications for this site in your browser/Android settings.`);
          return;
        }

        // Step 3: Check SW
        let swReg;
        try {
          swReg = await navigator.serviceWorker.ready;
        } catch (e) {
          alert('❌ Step 3 Failed: Service worker error: ' + e.message);
          return;
        }

        // Step 4: Get FCM token
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          alert('❌ Step 4 Failed: VAPID key missing from build. Contact developer.');
          return;
        }

        let token;
        try {
          const { getToken } = await import('firebase/messaging');
          const { messaging } = await import('../lib/firebase');
          token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        } catch (e) {
          alert('❌ Step 4 Failed: FCM getToken error: ' + e.message);
          return;
        }

        if (!token) {
          alert('❌ Step 4 Failed: FCM returned no token. Check Firebase project settings.');
          return;
        }

        // Step 5: Save token
        const { error: dbError } = await supabase
          .from('user_fcm_tokens')
          .upsert({ user_id: user.id, fcm_token: token }, { onConflict: 'user_id' });

        if (dbError) {
          alert('❌ Step 5 Failed: Database error: ' + dbError.message);
          return;
        }

        setNotificationsEnabled(true);

        // Fire a real confirmation notification in the notification centre
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('🔔 Notifications Enabled!', {
            body: 'You\'ll receive daily expense summaries every evening. Great choice!',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'notifications-enabled',
          });
        } catch (notifErr) {
          console.warn('Could not show confirmation notification:', notifErr);
        }
      } finally {
        // always runs
      }
    }
    setIsTogglingNotifications(false);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert("No expenses found to export.");
        return;
      }

      const headers = ['Date,Name,Category,Amount,Transaction ID'];
      const rows = data.map(exp => {
        const date = format(parseISO(exp.date), 'yyyy-MM-dd');
        const name = `"${(exp.name || '').replace(/"/g, '""')}"`;
        const category = `"${(exp.category || 'Other').replace(/"/g, '""')}"`;
        const amount = exp.amount;
        const txn = `"${(exp.transaction_id || '').replace(/"/g, '""')}"`;
        return `${date},${name},${category},${amount},${txn}`;
      });

      const csvContent = headers.concat(rows).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `all_expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsPdfExporting(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('No expenses found to export.');
        return;
      }

      // Dynamic import to keep bundle size light
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date();
      const generatedOn = format(now, 'dd MMM yyyy, hh:mm a');

      // ── Header Banner ──────────────────────────────────────────────
      doc.setFillColor(13, 148, 136); // teal-600
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Expense Summary Report', pageWidth / 2, 16, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Prepared for: ${user.email}`, pageWidth / 2, 24, { align: 'center' });
      doc.text(`Generated on: ${generatedOn}`, pageWidth / 2, 30, { align: 'center' });

      // ── Compute Totals ─────────────────────────────────────────────
      const totalAll = data.reduce((s, e) => s + Number(e.amount), 0);
      const categoryMap = {};
      data.forEach(e => {
        const cat = e.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount);
      });
      const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];

      // ── Summary Cards ──────────────────────────────────────────────
      const cardY = 46;
      const cardH = 22;
      const cards = [
        { label: 'Total Expenses', value: `Rs. ${totalAll.toFixed(2)}` },
        { label: 'Total Transactions', value: `${data.length}` },
        { label: 'Top Category', value: topCategory ? topCategory[0] : '—' },
      ];
      const cardW = (pageWidth - 30) / 3;
      cards.forEach((card, i) => {
        const x = 10 + i * (cardW + 5);
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'F');
        doc.setDrawColor(13, 148, 136);
        doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'S');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(card.label.toUpperCase(), x + cardW / 2, cardY + 7, { align: 'center' });
        doc.setTextColor(15, 118, 110);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(card.value, x + cardW / 2, cardY + 16, { align: 'center' });
      });

      // ── Category Breakdown ─────────────────────────────────────────
      let cursorY = cardY + cardH + 10;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Category Breakdown', 10, cursorY);
      cursorY += 4;

      const catRows = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => [
          cat,
          `Rs. ${amt.toFixed(2)}`,
          `${((amt / totalAll) * 100).toFixed(1)}%`,
        ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Category', 'Amount', 'Share']],
        body: catRows,
        theme: 'grid',
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 10, right: 10 },
      });

      // ── All Transactions ───────────────────────────────────────────
      cursorY = doc.lastAutoTable.finalY + 10;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('All Transactions', 10, cursorY);
      cursorY += 4;

      const txnRows = data.map(exp => [
        format(parseISO(exp.date), 'dd MMM yyyy'),
        exp.name || '—',
        exp.category || 'Other',
        `Rs. ${Number(exp.amount).toFixed(2)}`,
        exp.transaction_id || '—',
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Category', 'Amount', 'Txn ID']],
        body: txnRows,
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 3: { halign: 'right' }, 4: { cellWidth: 30 } },
        margin: { left: 10, right: 10 },
      });

      // ── Footer ─────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Expense Tracker  •  Page ${i} of ${pageCount}  •  ${generatedOn}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      }

      doc.save(`expense_report_${format(now, 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF.');
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      try {
        await signOut();
      } catch (error) {
        console.error("Error signing out", error);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">More Options</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your data and account.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="p-2 space-y-1">
          <Link 
            to="/more/year" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Year Breakdown</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">View your spending month by month</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
          </Link>

          <Link 
            to="/profile" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile Settings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your account information</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
          </Link>

          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 transition-colors group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50">
                {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Export All Data</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Download your expenses as a CSV</p>
              </div>
            </div>
          </button>

          <button 
            onClick={handleExportPDF}
            disabled={isPdfExporting}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 transition-colors group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50">
                {isPdfExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Export PDF Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Beautiful summary with totals & breakdown</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-2 space-y-1">
          <button 
            onClick={handleToggleNotifications}
            disabled={isTogglingNotifications}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 transition-colors group-hover:bg-orange-100 dark:group-hover:bg-orange-900/50">
                {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daily Summaries</h3>
                <p className="text-xs text-slate-500 mt-0.5">{notificationsEnabled ? 'Notifications are ON' : 'Notifications are OFF'}</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 shadow-inner ${notificationsEnabled ? 'bg-teal-500 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
          </button>
 
          {notificationsEnabled && (
            <button 
              onClick={handleSendTestNotification}
              disabled={isTesting}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left disabled:opacity-50 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50">
                  {isTesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Send Test Notification</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Verify your setup works instantly</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
            </button>
          )}

          {notificationsEnabled && (
            <button 
              onClick={handleSendMonthlyReport}
              disabled={isMonthlyReporting}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left disabled:opacity-50 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                  {isMonthlyReporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Send Monthly PDF Report</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Email last month's PDF summary to yourself</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
            </button>
          )}

          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dark Mode</h3>
                <p className="text-xs text-slate-500 mt-0.5">{isDarkMode ? 'Dark theme active' : 'Light theme active'}</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 shadow-inner ${isDarkMode ? 'bg-teal-500 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-2">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors group text-left"
          >
            <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors group-hover:bg-red-100 dark:group-hover:bg-red-900/40">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Sign Out</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current session</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
