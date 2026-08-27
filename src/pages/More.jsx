import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageGreeting } from '../hooks/usePageGreeting';
import { getExpenseNameWithEmoji } from '../lib/emojiUtils';
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
  GraduationCap,
  HandCoins,
  MessageSquarePlus,
  Trophy,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { requestNotificationPermission } from '../lib/firebase';

export default function More() {
  usePageGreeting("Welcome to More options.");
  const { user, session, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [customMessage, setCustomMessage] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState('idle'); // idle, processing, success, error
  const [broadcastStep, setBroadcastStep] = useState(0);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Deduplication state
  const [showDedupeModal, setShowDedupeModal] = useState(false);
  const [dedupeGroups, setDedupeGroups] = useState([]);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [includeProfilePicInPdf, setIncludeProfilePicInPdf] = useState(true);

  const [isScanningDupes, setIsScanningDupes] = useState(false);
  const [mergingGroups, setMergingGroups] = useState({});
  const [isMergingAll, setIsMergingAll] = useState(false);
  const [expandedDedupeGroup, setExpandedDedupeGroup] = useState(null);
  const [showConfirmMergeAll, setShowConfirmMergeAll] = useState(false);

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
      const res = await fetch(`/api/admin?action=listUsers`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await res.json();
      
      if (data.users && data.users.length > 0) {
        setAllUsers(data.users);
        setSelectedUserIds(data.users.map(u => u.id));
      } else {
        // Fallback to yourself if absolutely no users are found
        setAllUsers([{ id: user.id, email: user.email }]);
        setSelectedUserIds([user.id]);
      }
    } catch (err) {
      console.error('API User Fetch Error:', err);
      // Fallback
      setAllUsers([{ id: user.id, email: user.email }]);
      setSelectedUserIds([user.id]);
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
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          selectedUserIds,
          customMessage,
          subject: broadcastSubject || 'Important Update from Expense Monitor'
        })
      });

      const data = await response.json();

      if (data.success) {
        setBroadcastStep(4);
        setBroadcastResult(data);
        setBroadcastStatus('success');
        setCustomMessage('');
        // Speak the success message with a natural voice
        if ('speechSynthesis' in window) {
          const msg = new SpeechSynthesisUtterance(`Broadcast message sent successfully to ${selectedUserIds.length} users`);
          
          // Try to find a premium, natural sounding voice
          const voices = window.speechSynthesis.getVoices();
          const naturalVoice = voices.find(v => 
            v.name.includes('Samantha') || // Mac premium female
            v.name.includes('Daniel') || // Mac premium male
            v.name.includes('Google US English') || // Google premium
            v.name.includes('Google UK English Female') // Google premium
          );
          
          if (naturalVoice) {
            msg.voice = naturalVoice;
          }
          
          msg.rate = 0.95; // Slightly slower for a more human feel
          msg.pitch = 1.0;
          window.speechSynthesis.speak(msg);
        }
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
          'Authorization': `Bearer ${session?.access_token}`
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
        setIsTogglingNotifications(false);
    }
  };

  const handleScanDuplicates = async () => {
    setShowDedupeModal(true);
    setIsScanningDupes(true);
    try {
      let allExpenses = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .not('transaction_id', 'is', null)
          .neq('transaction_id', '')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allExpenses = [...allExpenses, ...data];
          page++;
          if (data.length < pageSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      const grouped = {};
      allExpenses.forEach(exp => {
        if (!grouped[exp.transaction_id]) grouped[exp.transaction_id] = [];
        grouped[exp.transaction_id].push(exp);
      });

      const duplicates = Object.values(grouped).filter(g => g.length > 1);
      duplicates.sort((a, b) => new Date(b[0].date) - new Date(a[0].date));
      setDedupeGroups(duplicates);
    } catch (error) {
      console.error('Error scanning duplicates:', error);
      alert('Failed to scan duplicates');
    } finally {
      setIsScanningDupes(false);
    }
  };

  const handleMergeGroup = async (group) => {
    const txnId = group[0].transaction_id;
    setMergingGroups(prev => ({ ...prev, [txnId]: true }));
    try {
      const sortedGroup = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const deleteIds = sortedGroup.slice(1).map(r => r.id);

      const { error } = await supabase
        .from('expenses')
        .delete()
        .in('id', deleteIds);
        
      if (error) throw error;

      setDedupeGroups(prev => prev.filter(g => g[0].transaction_id !== txnId));
    } catch (error) {
      console.error('Error merging:', error);
      alert('Failed to merge records');
    } finally {
      setMergingGroups(prev => ({ ...prev, [txnId]: false }));
    }
  };

  const executeMergeAll = async () => {
    setShowConfirmMergeAll(false);
    setIsMergingAll(true);
    try {
      let allDeleteIds = [];
      dedupeGroups.forEach(group => {
        const sortedGroup = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const deleteIds = sortedGroup.slice(1).map(r => r.id);
        allDeleteIds = [...allDeleteIds, ...deleteIds];
      });

      if (allDeleteIds.length > 0) {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .in('id', allDeleteIds);
          
        if (error) throw error;
      }

      setDedupeGroups([]);
    } catch (error) {
      console.error('Error merging all:', error);
      alert('Failed to merge all records');
    } finally {
      setIsMergingAll(false);
    }
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
      let allData = [];
      let from = 0;
      let step = 1000;
      let fetchMore = true;
      while (fetchMore) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .range(from, from + step - 1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < step) {
            fetchMore = false;
          } else {
            from += step;
          }
        } else {
          fetchMore = false;
        }
      }
      
      const data = allData;

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

      // Fetch and crop avatar to a circle
      let base64Avatar = null;
      if (includeProfilePicInPdf && user?.user_metadata?.avatar_url) {
        try {
           const res = await fetch(user.user_metadata.avatar_url);
           const blob = await res.blob();
           base64Avatar = await new Promise((resolve) => {
             const img = new Image();
             const url = URL.createObjectURL(blob);
             img.onload = () => {
               const canvas = document.createElement('canvas');
               canvas.width = 64;
               canvas.height = 64;
               const ctx = canvas.getContext('2d');
               ctx.beginPath();
               ctx.arc(32, 32, 32, 0, Math.PI * 2, true);
               ctx.closePath();
               ctx.clip();
               ctx.drawImage(img, 0, 0, 64, 64);
               resolve(canvas.toDataURL('image/png'));
               URL.revokeObjectURL(url);
             };
             img.src = url;
           });
        } catch (e) {
           console.error("Failed to load avatar for PDF", e);
        }
      }

      // ── Header Banner ──────────────────────────────────────────────
      const headerHeight = base64Avatar ? 52 : 38;
      doc.setFillColor(13, 148, 136); // teal-600
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      
      let headerY = 16;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Expense Summary Report', pageWidth / 2, headerY, { align: 'center' });
      
      headerY += 8;
      
      const displayName = user?.user_metadata?.username || user?.email;
      
      if (base64Avatar) {
         doc.addImage(base64Avatar, 'PNG', pageWidth / 2 - 5, headerY, 10, 10);
         headerY += 15;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(displayName, pageWidth / 2, headerY, { align: 'center' });
      
      headerY += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (user?.user_metadata?.username) {
        doc.text(user.email, pageWidth / 2, headerY, { align: 'center' });
        headerY += 4;
      }
      doc.text(`Generated on: ${generatedOn}`, pageWidth / 2, headerY, { align: 'center' });

      // ── Compute Totals ─────────────────────────────────────────────
      const totalAll = data.reduce((s, e) => s + Number(e.amount), 0);
      const categoryMap = {};
      data.forEach(e => {
        const cat = e.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount);
      });
      const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];

      // ── Summary Cards ──────────────────────────────────────────────
      const cardY = headerHeight + 8;
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
          `Expense Monitor  •  Page ${i} of ${pageCount}  •  ${generatedOn}`,
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
            to="/more/goals" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-colors group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Goal Savings Jars</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visualize your financial targets</p>
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
            to="/splits" 
            className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 transition-colors group-hover:bg-orange-100 dark:group-hover:bg-orange-900/50">
                <HandCoins className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Friends & Splits</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track money you are owed and settle debts</p>
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

          <div className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
            <button 
              onClick={handleExportPDF}
              disabled={isPdfExporting}
              className="flex-1 flex items-center gap-4 text-left disabled:opacity-50"
            >
              <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 transition-colors group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50">
                {isPdfExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Export PDF Report</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Beautiful summary with totals & breakdown</p>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIncludeProfilePicInPdf(!includeProfilePicInPdf); }}
              className="ml-4 flex items-center gap-2 p-2 text-slate-400 hover:text-emerald-500 transition-colors"
              title="Toggle Profile Picture in PDF"
            >
              <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${includeProfilePicInPdf ? 'text-emerald-500' : 'text-slate-400'}`}>
                {includeProfilePicInPdf ? 'With Pic' : 'Without Pic'}
              </span>
              {includeProfilePicInPdf ? (
                <ToggleRight className="h-6 w-6 text-emerald-500" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-slate-400" />
              )}
            </button>
          </div>

          <button 
            onClick={handleScanDuplicates}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Find & Merge Duplicates</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clean up double-logged expenses</p>
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
      {showBroadcastModal && createPortal(
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
                  Email Subject & Message
                </div>
                
                <input
                  type="text"
                  placeholder="Subject (e.g. Exciting New Features!)"
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all shadow-sm font-semibold"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                />

                <textarea
                  placeholder="Tell your users something exciting..."
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
        </div>,
        document.body
      )}
      {/* 🎭 Broadcast Animation Overlay */}
      {(broadcastStatus !== 'idle') && createPortal(
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
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 min-h-25 flex flex-col items-center justify-center text-center">
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
        </div>,
        document.body
      )}
      {/* Deduplication Modal */}
      {showDedupeModal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center">
                  <Search className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Duplicate Records</h3>
                  <p className="text-xs text-slate-500">
                    {isScanningDupes 
                      ? 'Scanning your database for duplicates...' 
                      : `Found ${dedupeGroups.length} matching transaction groups`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDedupeModal(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 flex-1">
              {isScanningDupes ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Loader2 className="h-10 w-10 animate-spin text-teal-500 mb-4" />
                  <p>Searching for matching Transaction IDs...</p>
                </div>
              ) : dedupeGroups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-teal-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Duplicates Found</h3>
                  <p className="text-slate-500">Your records are perfectly clean! We didn't find any double-logged expenses.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-900/50 gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong>Note:</strong> Merging will keep the most complete record and delete the extra accidental copies from your database.
                    </p>
                    <button
                      onClick={() => setShowConfirmMergeAll(true)}
                      disabled={isMergingAll}
                      className="shrink-0 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {isMergingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Merge All {dedupeGroups.length} Groups
                    </button>
                  </div>
                  
                  {dedupeGroups.map((group, idx) => {
                    const txnId = group[0].transaction_id;
                    const isMerging = mergingGroups[txnId];
                    const isExpanded = expandedDedupeGroup === idx;
                    
                    return (
                      <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div 
                          className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                          onClick={() => setExpandedDedupeGroup(isExpanded ? null : idx)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaction ID</span>
                            <code className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                              {txnId}
                            </code>
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold ml-2">
                              {group.length} duplicates
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMergeGroup(group); }}
                              disabled={isMerging}
                              className="text-xs font-bold bg-teal-500 hover:bg-teal-600 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {isMerging ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                              Merge into one
                            </button>
                            <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {group.map((exp) => (
                            <div key={exp.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white">{getExpenseNameWithEmoji(exp.name || 'Unnamed')}</h4>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  <span>{format(new Date(exp.date), 'dd MMM yyyy, h:mm a')}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                  <span>{exp.category}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900 dark:text-white">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Merge All Confirmation Modal */}
      {showConfirmMergeAll && createPortal(
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center text-center">
            <div className="h-14 w-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-amber-600 dark:text-amber-500" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">Merge All Duplicates?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              Are you sure you want to merge all {dedupeGroups.length} duplicate groups? This action will permanently delete the extra copies from your database.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowConfirmMergeAll(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeMergeAll}
                className="flex-1 py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-teal-500/30"
              >
                Yes, Merge All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
