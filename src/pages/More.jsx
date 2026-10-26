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
  ToggleRight,
  CreditCard,
  Sparkles,
  Trash2,
  Camera,
  Landmark,
  Smartphone
} from 'lucide-react';
import { requestNotificationPermission } from '../lib/firebase';
import { isAppInstalled } from '../utils/pwaInstall';

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
  const [customMessage, setCustomMessage] = useState(`Hey there! 👋

We've been working hard to make Expense Monitor even better. Here are the latest powerful features we just rolled out:

🗑️ Bulk Delete & Advanced Filters
Filter your Expense History by month/year, and delete multiple expenses at once with our new Bulk Delete mode.

🤝 Smarter Split Reminders
Send payment reminders to friends using just their username or email. They'll receive a beautifully formatted email with exactly what they owe.

📱 Scan to Pay (Custom QRs)
You can now upload your Bank/UPI QR codes (like GPay or HDFC) from the More page and give them custom labels! When you send a split reminder, you can attach any of your QRs so your friends can scan and pay you instantly.

🔐 Complete Account Control
You now have the option to securely schedule your account for deletion directly from the More page.

Dive in and try them out today!

— The Expense Monitor Team`);
  const [broadcastSubject, setBroadcastSubject] = useState("What's New: Payment QRs, Bulk Delete & More! 🚀");
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
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  // Friends state
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsList, setFriendsList] = useState([]);         // accepted
  const [pendingRequests, setPendingRequests] = useState([]);  // incoming pending
  const [sentRequests, setSentRequests] = useState([]);        // my outgoing pending
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [activeNetworkTab, setActiveNetworkTab] = useState('friends'); // 'friends' | 'requests' | 'search'
  const [networkTabKey, setNetworkTabKey] = useState(0);

  // QR Logic
  const [paymentQrs, setPaymentQrs] = React.useState([]);
  const [isUploadingQr, setIsUploadingQr] = React.useState(false);
  const [showQrNameModal, setShowQrNameModal] = useState(false);
  const [pendingQrFile, setPendingQrFile] = useState(null);
  const [qrNameInput, setQrNameInput] = useState('');
  const qrInputRef = React.useRef(null);

  React.useEffect(() => {
    if (user?.user_metadata?.payment_qrs) {
      setPaymentQrs(user.user_metadata.payment_qrs);
    }
  }, [user]);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingQrFile(file);
    setQrNameInput(`Bank QR ${paymentQrs.length + 1}`);
    setShowQrNameModal(true);
  };

  const executeQrUpload = async () => {
    if (!pendingQrFile || !qrNameInput.trim()) return;

    setShowQrNameModal(false);
    setIsUploadingQr(true);
    try {
      const compressedBlob = await compressImage(pendingQrFile);
      const fileName = `${Date.now()}-qr.jpg`;
      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, compressedBlob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
      const newQr = { id: Date.now().toString(), url: publicUrl, name: qrNameInput.trim() };
      const updatedQrs = [...paymentQrs, newQr];
      const { error: updateError } = await supabase.auth.updateUser({ data: { payment_qrs: updatedQrs } });
      if (updateError) throw updateError;
      setPaymentQrs(updatedQrs);
    } catch (error) {
      alert('Failed to upload QR code.');
    } finally {
      setIsUploadingQr(false);
      setPendingQrFile(null);
      setQrNameInput('');
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const cancelQrUpload = () => {
    setShowQrNameModal(false);
    setPendingQrFile(null);
    setQrNameInput('');
    if (qrInputRef.current) qrInputRef.current.value = '';
  };

  const handleDeleteQr = async (qrId) => {
    if (!window.confirm("Delete this QR code?")) return;
    try {
      const updatedQrs = paymentQrs.filter(qr => qr.id !== qrId);
      const { error } = await supabase.auth.updateUser({ data: { payment_qrs: updatedQrs } });
      if (error) throw error;
      setPaymentQrs(updatedQrs);
    } catch (err) {
      alert("Failed to delete QR.");
    }
  };


  const switchNetworkTab = (id) => { setActiveNetworkTab(id); setNetworkTabKey(k => k + 1); };

  // Load pending count on mount for badge
  React.useEffect(() => {
    if (user) {
      supabase.from('friends').select('id').eq('friend_id', user.id).eq('status', 'pending')
        .then(({ data }) => { if (data) setPendingRequests(data); });

      // Realtime: update pending requests badge live
      const channel = supabase.channel('friend-requests-more')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `friend_id=eq.${user.id}` }, () => {
          supabase.from('friends').select('*').eq('friend_id', user.id).eq('status', 'pending')
            .then(({ data }) => { if (data) setPendingRequests(data); });
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

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

  const loadFriends = async () => {
    setIsFriendsLoading(true);
    try {
      const [{ data: accepted }, { data: incoming }, { data: outgoing }] = await Promise.all([
        supabase.from('friends').select('*').eq('user_id', user.id).eq('status', 'accepted').order('created_at', { ascending: false }),
        supabase.from('friends').select('*').eq('friend_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('friends').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
      ]);
      setFriendsList(accepted || []);
      setPendingRequests(incoming || []);
      setSentRequests(outgoing || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFriendsLoading(false);
    }
  };

  const openFriendsModal = () => {
    setShowFriendsModal(true);
    loadFriends();
  };

  const searchFriends = async (e) => {
    e.preventDefault();
    if (!friendSearchQuery || friendSearchQuery.length < 3) return;
    setIsSearchingFriends(true);
    try {
      const res = await fetch(`/api/search-users?query=${encodeURIComponent(friendSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      setFriendSearchResults(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingFriends(false);
    }
  };

  const sendFriendRequest = async (friendUser) => {
    try {
      const { error } = await supabase.from('friends').insert({
        user_id: user.id,
        friend_id: friendUser.id,
        friend_username: friendUser.username || friendUser.email.split('@')[0],
        friend_email: friendUser.email,
        user_username: user.user_metadata?.username || user.email.split('@')[0],
        user_email: user.email,
        status: 'pending'
      });
      if (error) {
        if (error.code === '23505') alert('Request already sent!');
        else throw error;
      } else {
        setFriendSearchResults(prev => prev.filter(u => u.id !== friendUser.id));
        loadFriends();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send request');
    }
  };

  const acceptRequest = async (req) => {
    try {
      // Mark incoming request as accepted
      await supabase.from('friends').update({ status: 'accepted' }).eq('id', req.id);
      // Create reverse connection so I can also see them in my friends list
      await supabase.from('friends').upsert({
        user_id: user.id,
        friend_id: req.user_id,
        friend_username: (req.user_username || req.user_email?.split('@')[0] || 'Unknown').replace(/^@+/, ''),
        friend_email: req.user_email || '',
        user_username: user.user_metadata?.username || user.email.split('@')[0],
        user_email: user.email,
        status: 'accepted'
      }, { onConflict: 'user_id,friend_id' });
      loadFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const declineRequest = async (reqId) => {
    try {
      await supabase.from('friends').update({ status: 'declined' }).eq('id', reqId);
      loadFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const cancelRequest = async (reqId) => {
    try {
      await supabase.from('friends').delete().eq('id', reqId);
      loadFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      // Remove both directions
      await supabase.from('friends').delete().eq('id', friendId);
      loadFriends();
    } catch (err) {
      console.error(err);
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

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // Mark account for deletion in user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          delete_requested_at: new Date().toISOString()
        }
      });
      if (error) throw error;
      
      await signOut();
    } catch (err) {
      console.error('Error requesting account deletion:', err);
      alert('Failed to process request. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountModal(false);
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

          <button 
            onClick={openFriendsModal}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left border-t border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="relative h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50">
                <Users className="h-5 w-5" />
                {pendingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Friends & Network</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pendingRequests.length > 0 ? `${pendingRequests.length} pending request${pendingRequests.length > 1 ? 's' : ''}!` : 'Add friends to split bills easily'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
          </button>

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

          <button 
            onClick={() => {
              if (isAppInstalled()) {
                alert('Expense Monitor is already installed and running on your device! 🎉');
              } else {
                window.dispatchEvent(new CustomEvent('pwa-open-install-prompt'));
              }
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left border-t border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-colors group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Install App</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAppInstalled() ? 'App is installed on this device' : 'Add to home screen for 1-tap offline access'}
                </p>
              </div>
            </div>
            {isAppInstalled() ? (
              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                Installed
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                Install
              </span>
            )}
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

      {/* Payment QRs Section */}
      <div className="card overflow-hidden mt-6 mb-6" id="qr-section">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-fuchsia-600 dark:text-fuchsia-400" />
             </div>
             <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Payment QRs</h3>
                <p className="text-[10px] text-slate-500 font-medium">Attach QRs to your split reminders</p>
             </div>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {paymentQrs.map((qr) => (
              <div key={qr.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-4/3 bg-white dark:bg-slate-800">
                <img src={qr.url} alt={qr.name} className="w-full h-full object-contain p-2" />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                  <p className="text-white font-bold text-[10px] mb-2 text-center line-clamp-1">{qr.name}</p>
                  <button onClick={() => handleDeleteQr(qr.id)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => qrInputRef.current?.click()}
              disabled={isUploadingQr}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 transition-all aspect-4/3"
            >
              <input type="file" ref={qrInputRef} className="hidden" accept="image/*" onChange={handleQrUpload} />
              {isUploadingQr ? (
                <Loader2 className="h-6 w-6 text-fuchsia-500 animate-spin" />
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Camera className="h-4 w-4 text-slate-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Upload QR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-2 space-y-1">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group text-left"
          >
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-colors group-hover:bg-slate-200 dark:group-hover:bg-slate-800">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sign Out</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current session</p>
            </div>
          </button>
          
          <button 
            onClick={() => setShowDeleteAccountModal(true)}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors group text-left"
          >
            <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors group-hover:bg-red-100 dark:group-hover:bg-red-900/40">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Delete Account</h3>
              <p className="text-xs text-red-500/70 dark:text-red-400/70 mt-0.5">Permanently remove your data</p>
            </div>
          </button>
        </div>
      </div>
      
      {/* Friends Modal — Full-screen Network Dashboard */}
      {showFriendsModal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div
            className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #0d1b3e 0%, #0a0f2e 50%, #0d1b3e 100%)' }}
          >
            {/* Close button — always on top */}
            <button
              onClick={() => { setShowFriendsModal(false); setFriendSearchQuery(''); setFriendSearchResults([]); }}
              className="absolute top-5 right-5 z-20 h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <X className="h-4 w-4 text-white" />
            </button>

            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)' }} />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />
            </div>

            {/* HERO HEADER */}
            <div className="relative px-8 pt-8 pb-6 border-b border-white/5">
              <div className="flex items-start justify-between pr-12">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-indigo-500/40 text-indigo-400 bg-indigo-500/10">PEOPLE</span>
                  </div>
                  <h2 className="text-4xl font-black tracking-tight mb-1">
                    <span className="text-white">Your </span>
                    <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Network</span>
                  </h2>
                  <p className="text-slate-400 text-sm font-medium">Connect with friends and manage shared expenses.</p>
                </div>
                <div className="hidden sm:block text-right border border-white/10 rounded-2xl px-5 py-4 bg-white/5 backdrop-blur-sm">
                  <p className="text-white font-black text-lg leading-tight">Share.</p>
                  <p className="text-white font-black text-lg leading-tight">Split.</p>
                  <p className="leading-tight"><span className="font-black text-lg" style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Save Together.</span></p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[{ icon: Users, label: 'Connected Friends', value: friendsList.length }, { icon: CreditCard, label: 'Shared Expenses', value: '–' }, { icon: FileText, label: 'Active Splits', value: '–' }].map(({ icon: Icon, label, value }, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.2)' }}>
                      <Icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
                      <p className="text-xl font-black text-white">{value}</p>
                    </div>
                    <span className="text-slate-600">→</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TAB NAV — pill style */}
            <div className="flex items-center gap-2 px-6 py-4 relative z-10">
              {[
                { id: 'friends', label: 'Friends', count: friendsList.length },
                { id: 'requests', label: 'Requests', count: pendingRequests.length + sentRequests.length },
                { id: 'search', label: 'Search', count: null },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => switchNetworkTab(tab.id)}
                  className="relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-200"
                  style={activeNetworkTab === tab.id ? {
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.35) 100%)',
                    border: '1px solid rgba(99,102,241,0.5)',
                    color: '#fff',
                    boxShadow: '0 0 12px rgba(99,102,241,0.25)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#64748b',
                  }}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-4.5 text-center"
                      style={{
                        background: tab.id === 'requests' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)',
                        color: tab.id === 'requests' ? '#f87171' : '#a5b4fc',
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div
              className="flex-1 overflow-y-auto border-t"
              style={{ borderColor: 'rgba(99,102,241,0.15)' }}
            >
              {/* ── FRIENDS TAB ── */}
              {activeNetworkTab === 'friends' && (
                <div key={networkTabKey} className="px-6 py-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-400" />
                      <span className="text-white font-black text-sm">Your Connections</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">{friendsList.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-slate-500 font-medium">Live</span>
                    </div>
                  </div>

                  {isFriendsLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
                  ) : friendsList.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
                      <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-indigo-500/40" />
                      </div>
                      <p className="text-slate-400 font-bold">No connections yet</p>
                      <p className="text-slate-600 text-sm mt-1">Go to Search tab to find friends!</p>
                      <button
                        onClick={() => switchNetworkTab('search')}
                        className="mt-4 px-5 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                      >
                        Find Friends →
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {friendsList.map((f, i) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 p-4 rounded-2xl transition-all animate-in fade-in slide-in-from-bottom-2"
                          style={{
                            animationDelay: `${i * 50}ms`,
                            animationFillMode: 'both',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.border = '1px solid rgba(99,102,241,0.4)'}
                          onMouseLeave={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'}
                        >
                          <div
                            className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}
                          >
                            {f.friend_username.replace(/^@+/, '').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">@{f.friend_username.replace(/^@+/, '')}</p>
                            <p className="text-slate-500 text-xs truncate">{f.friend_email}</p>
                          </div>
                          <button
                            onClick={() => removeFriend(f.id)}
                            className="h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                          >
                            <X className="h-3.5 w-3.5 text-rose-400" />
                          </button>
                        </div>
                      ))}
                      {/* Add more friends CTA */}
                      <button
                        onClick={() => switchNetworkTab('search')}
                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all"
                        style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'transparent' }}
                        onMouseEnter={e => { e.currentTarget.style.border = '1px dashed rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.border = '1px dashed rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                          <Users className="h-5 w-5 text-slate-500" />
                        </div>
                        <p className="text-slate-500 text-xs font-bold">Add more friends</p>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── REQUESTS TAB ── */}
              {activeNetworkTab === 'requests' && (
                <div key={networkTabKey} className="px-6 py-5 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Incoming */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Incoming ({pendingRequests.length})
                      </h4>
                    </div>
                    {pendingRequests.length === 0 ? (
                      <p className="text-slate-600 text-sm py-4 text-center rounded-xl border border-dashed border-white/5">No incoming requests</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingRequests.map(req => (
                          <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 rounded-full flex items-center justify-center font-black text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                {(req.user_username || 'U').replace(/^@+/, '').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-bold text-sm">@{req.user_username?.replace(/^@+/, '')}</p>
                                <p className="text-slate-500 text-xs">{req.user_email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => acceptRequest(req)} className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>Accept</button>
                              <button onClick={() => declineRequest(req.id)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10">Decline</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sent */}
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                      Sent ({sentRequests.length})
                    </h4>
                    {sentRequests.length === 0 ? (
                      <p className="text-slate-600 text-sm py-4 text-center rounded-xl border border-dashed border-white/5">No sent requests</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {sentRequests.map(req => (
                          <div key={req.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5">
                            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-indigo-400 bg-indigo-500/20">
                              {req.friend_username?.replace(/^@+/, '').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-300">@{req.friend_username?.replace(/^@+/, '')}</span>
                            <button onClick={() => cancelRequest(req.id)} className="h-4 w-4 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SEARCH TAB ── */}
              {activeNetworkTab === 'search' && (
                <div key={networkTabKey} className="px-6 py-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-5" style={{ background: 'rgba(30,41,80,0.5)', borderRadius: '16px', padding: '14px 16px' }}>
                    <div className="h-9 w-9 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
                      <Search className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Find people in your network</p>
                      <p className="text-slate-500 text-xs">Search by username, email or phone to connect and start sharing expenses.</p>
                    </div>
                  </div>

                  <form onSubmit={searchFriends} className="flex items-center gap-2 mb-5">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Find friends by username, email or phone..."
                        value={friendSearchQuery}
                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingFriends || friendSearchQuery.length < 3}
                      className="px-6 py-3.5 rounded-2xl font-bold text-sm text-white disabled:opacity-50 transition-all flex items-center justify-center min-w-22.5"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    >
                      {isSearchingFriends ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                    </button>
                  </form>

                  {friendSearchResults.length === 0 && !isSearchingFriends && (
                    <div className="text-center py-10 rounded-2xl border border-dashed border-white/5">
                      <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">Type a username and press Search</p>
                    </div>
                  )}

                  {friendSearchResults.length > 0 && (
                    <div className="space-y-2">
                      {friendSearchResults.map(fu => {
                        const isFriend = friendsList.some(f => f.friend_id === fu.id);
                        const hasSent = sentRequests.some(r => r.friend_id === fu.id);
                        const hasReceived = pendingRequests.some(r => r.user_id === fu.id);
                        return (
                          <div key={fu.id} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/8 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-sm text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                {fu.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-bold text-sm">@{fu.username}</p>
                                <p className="text-slate-500 text-xs truncate max-w-45">{fu.email}</p>
                              </div>
                            </div>
                            {isFriend
                              ? <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Connected</span>
                              : hasSent
                              ? <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20">Sent</span>
                              : hasReceived
                              ? <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20 animate-pulse">Respond ↓</span>
                              : <button onClick={() => sendFriendRequest(fu)} className="px-4 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>Connect</button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}

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

      {/* Delete Account Modal */}
      {showDeleteAccountModal && createPortal(
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0b1120] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-8 text-center relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-red-500 via-rose-500 to-red-500" />
              <div className="h-20 w-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-red-500/20 animate-ping rounded-full" />
                <Trash2 className="h-10 w-10 text-red-600 dark:text-red-500 relative z-10" />
              </div>
              <h3 className="font-black text-2xl text-slate-900 dark:text-white mb-4 tracking-tight">
                Delete Account Request
              </h3>
              
              <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 mb-8 text-left border border-red-100 dark:border-red-900/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-400 leading-relaxed text-center">
                  If you delete your account, <strong className="font-black uppercase">all data will be lost</strong> and is not recoverable at any cost. Your account will be permanently deleted in 3 days.
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowDeleteAccountModal(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeletingAccount ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {isDeletingAccount ? 'Processing...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* QR Name Modal */}
      {showQrNameModal && createPortal(
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Name your QR Code</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Give it a label like "GPay", "SBI", or "HDFC" to easily identify it later.
            </p>
            <input
              autoFocus
              type="text"
              value={qrNameInput}
              onChange={(e) => setQrNameInput(e.target.value)}
              placeholder="e.g. GPay"
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white mb-6 focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
            />
            <div className="flex gap-3 w-full">
              <button 
                onClick={cancelQrUpload}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={executeQrUpload}
                disabled={!qrNameInput.trim()}
                className="flex-1 py-3 px-4 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-fuchsia-500/30 text-sm disabled:opacity-50"
              >
                Upload QR
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
