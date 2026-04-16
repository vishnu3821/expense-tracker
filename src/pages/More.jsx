import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Calendar, UserCircle, Download, 
  Loader2, 
  LogOut, 
  Moon, 
  Sun, 
  Bell, 
  BellOff, 
  FileText, 
  Mail, 
  Wallet, 
  Megaphone,
  CheckCircle,
  X,
  Send,
  Shield,
  Search,
  ArrowLeft,
  CheckSquare,
  Square,
  Users,
  GraduationCap
} from 'lucide-react';
import { requestNotificationPermission } from '../lib/firebase';

export default function More() {
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [customMessage, setCustomMessage] = useState('');
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState('idle'); // idle, processing, success, error
  const [broadcastStep, setBroadcastStep] = useState(0);
  const [broadcastResult, setBroadcastResult] = useState(null);

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

  const openBroadcastDashboard = async () => {
    setShowBroadcastModal(true);
    setIsFetchingUsers(true);
    try {
      // 🕵️ Aggressive User Discovery (Multi-Source)
      const userMap = {};

      // Source 1: The Secure Admin View (Best source for emails)
      const { data: viewData } = await supabase.from('admin_user_emails').select('*');
      if (viewData) {
        viewData.forEach(v => {
          userMap[v.id] = { id: v.id, email: v.email };
        });
      }

      // Source 2: The Expenses Table (Discovery via usage)
      const { data: usageData } = await supabase.from('expenses').select('user_id');
      if (usageData) {
        usageData.forEach(exp => {
          if (!userMap[exp.user_id]) {
            userMap[exp.user_id] = { id: exp.user_id, email: 'User (Found via Expense)' };
          }
        });
      }

      // Source 3: Yourself
      if (user && !userMap[user.id]) {
        userMap[user.id] = { id: user.id, email: user.email + ' (You)' };
      }

      const discoveryResults = Object.values(userMap);
      if (discoveryResults.length > 0) {
        setAllUsers(discoveryResults);
        setSelectedUserIds(discoveryResults.map(u => u.id));
      } else {
        // Source 4: Final API fallback
        const response = await fetch('/api/announcement');
        const apiData = await response.json();
        if (apiData.users && apiData.users.length > 0) {
          setAllUsers(apiData.users);
          setSelectedUserIds(apiData.users.map(u => u.id));
        }
      }
    } catch (err) {
      console.error('Aggressive Discovery Error:', err);
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === allUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(allUsers.map(u => u.id));
    }
  };

  const handleBroadcastAnnouncement = async () => {
    if (selectedUserIds.length === 0) {
      alert('Please select at least one user.');
      return;
    }

    const confirmMessage = `🚀 This will send a professional update email to ${selectedUserIds.length} users. Are you sure you want to broadcast now?`;
    if (!window.confirm(confirmMessage)) return;

    setIsBroadcasting(true);
    setBroadcastStatus('processing');
    setBroadcastStep(1);

    try {
      // Animation Sequence
      await new Promise(r => setTimeout(r, 800));
      setBroadcastStep(2);
      await new Promise(r => setTimeout(r, 1200));
      setBroadcastStep(3);

      const response = await fetch('/api/announcement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedUserIds,
          customMessage
        })
      });

      const data = await response.json();

      if (data.success) {
        setBroadcastStep(4);
        setBroadcastResult(data);
        setBroadcastStatus('success');
        setCustomMessage('');
      } else {
        setBroadcastStatus('error');
        setBroadcastResult({ error: data.error || 'Batch delivery failed' });
      }
    } catch (err) {
      console.error('Broadcast Error:', err);
      setBroadcastStatus('error');
      setBroadcastResult({ 
        error: 'CONNECTION ERROR: Could not reach the broadcast server. Locally, you MUST run "vercel dev" (not npm run dev) to enable the API.' 
      });
    } finally {
      setIsBroadcasting(false);
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
      alert('❌ CONNECTION ERROR: Could not reach diagnostic server.\n\nNOTE: You MUST run "vercel dev" (not npm run dev) to test notifications locally.');
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
            icon: '/app_logo.png',
            badge: '/app_logo.png',
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
            to="/more/savings" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your Savings</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track balances across all your banks</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
          </Link>

          <Link 
            to="/more/education-fees" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Educational Fees</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage receipts for academic payments</p>
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

      {user?.email === 'p.vishnuprabhakar@gmail.com' && (
        <div className="card overflow-hidden">
          <div className="p-2 space-y-1">
            <Link 
              to="/more/admin-breakdown"
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payment Breakdown</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Audit transactions across all platform users</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
            </Link>

            <button 
              onClick={openBroadcastDashboard}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left border-t border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Broadcast Management</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select users and send custom announcements</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
            </button>
          </div>
        </div>
      )}

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
      {/* Broadcast Dashboard Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 px-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Broadcast Dashboard</h3>
                  <p className="text-xs text-slate-500">Reach your users directly</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Step 1: Write Message */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px]">1</div>
                  Custom Announcement Text
                </div>
                <textarea
                  placeholder="Tell your users something exciting... (e.g. Happy Holidays! Checkout the new Savings feature.)"
                  className="w-full h-32 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all resize-none shadow-sm"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>

              {/* Step 2: Select Recipients */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px]">2</div>
                    Recipients ({selectedUserIds.length})
                  </div>
                  <button 
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline px-2 py-1"
                  >
                    {selectedUserIds.length === allUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {isFetchingUsers ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => toggleUserSelection(u.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          selectedUserIds.includes(u.id)
                            ? 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800'
                            : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800'
                        }`}
                      >
                        <div className={`shrink-0 h-5 w-5 rounded flex items-center justify-center transition-colors ${
                          selectedUserIds.includes(u.id)
                            ? 'bg-teal-600 text-white'
                            : 'border-2 border-slate-200 dark:border-slate-700'
                        }`}>
                          {selectedUserIds.includes(u.id) && <CheckSquare className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${
                            selectedUserIds.includes(u.id) ? 'text-teal-900 dark:text-teal-100' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {u.email}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{u.id.substring(0, 8)}...</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 px-8">
              <button
                onClick={handleBroadcastAnnouncement}
                disabled={isBroadcasting || selectedUserIds.length === 0}
                className="w-full btn-primary h-14 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-xl shadow-teal-500/20 disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send Broadcast Now
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-slate-400 mt-4">
                Emails will be sent individually via Resend to ensure high delivery rates.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 🎭 Broadcast Animation Overlay */}
      {(broadcastStatus !== 'idle') && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm mx-4 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            
            {/* Animation Core */}
            <div className="p-8 pb-4 flex flex-col items-center">
              <div className="relative flex items-center justify-between w-64 mx-auto h-32 mb-8">
                {/* Digital Bridge */}
                <div className="absolute top-1/2 left-8 right-8 h-px bg-slate-100 dark:bg-slate-800 -translate-y-1/2 overflow-hidden">
                   {broadcastStatus === 'processing' && (
                     <div className="absolute inset-0 bg-teal-500 animate-money-flow" />
                   )}
                </div>

                {/* Source: Admin/Megaphone */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                   <div className={`h-16 w-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all duration-500 ${broadcastStep >= 2 ? 'ring-4 ring-teal-500/20 scale-110 shadow-lg' : 'shadow-sm'}`}>
                      <Megaphone className={`h-8 w-8 ${broadcastStep >= 2 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                   </div>
                   <div className="absolute -bottom-6 flex flex-col items-center w-32">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Admin</span>
                   </div>
                </div>

                {/* Destination: Users */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                   <div className={`h-16 w-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all duration-500 ${broadcastStep >= 4 ? 'bg-teal-50 dark:bg-teal-900/30' : 'shadow-sm'}`}>
                      {broadcastStatus === 'success' ? (
                        <CheckCircle className="h-8 w-8 text-teal-600 animate-in zoom-in" />
                      ) : (
                        <Users className={`h-8 w-8 ${broadcastStep >= 3 ? 'text-teal-600 dark:text-teal-400 animate-pulse' : 'text-slate-400'}`} />
                      )}
                   </div>
                   <div className="absolute -bottom-6 flex flex-col items-center w-24">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Users</span>
                   </div>
                </div>
              </div>

              {/* Status Text & Progress */}
              <div className="w-full space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 min-h-[100px] flex flex-col items-center justify-center text-center">
                   {broadcastStatus === 'processing' ? (
                     <div className="animate-in fade-in slide-in-from-bottom-2">
                        <Loader2 className="h-5 w-5 text-teal-600 animate-spin mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {broadcastStep === 1 && "Initiating Broadcast..."}
                          {broadcastStep === 2 && `Preparing message for ${selectedUserIds.length} users...`}
                          {broadcastStep === 3 && "Broadcasting via Resend Batch..."}
                        </p>
                     </div>
                   ) : broadcastStatus === 'success' ? (
                     <div className="animate-in zoom-in duration-300">
                        <div className="h-10 w-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Send className="h-5 w-5 text-teal-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Sent to all users!</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 px-2">
                          {broadcastResult?.message || `Successfully sent to ${selectedUserIds.length} users.`}
                        </p>
                     </div>
                   ) : (
                     <div className="animate-in shake duration-300">
                        <div className="h-10 w-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <X className="h-5 w-5 text-rose-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Broadcast Failed</p>
                        <p className="text-[10px] text-rose-500 font-medium px-2 truncate">
                          {broadcastResult?.error || 'Unknown error occurred'}
                        </p>
                     </div>
                   )}
                </div>

                {broadcastStatus === 'success' ? (
                  <button 
                    onClick={() => {
                      setBroadcastStatus('idle');
                      setShowBroadcastModal(false);
                      setBroadcastResult(null);
                    }}
                    className="w-full h-14 bg-teal-600 text-white font-bold rounded-2xl shadow-xl shadow-teal-500/20 hover:bg-teal-700 transition-all active:scale-95"
                  >
                    Great!
                  </button>
                ) : broadcastStatus === 'error' && (
                  <button 
                    onClick={() => setBroadcastStatus('idle')}
                    className="w-full h-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-2xl shadow-sm transition-all"
                  >
                    Close & Retry
                  </button>
                ) }
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center gap-2">
                 <Shield className="h-3 w-3 text-slate-400" />
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Secure Ledger Protocol 2.0</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
