import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePageGreeting } from '../hooks/usePageGreeting';
import {
  Loader2, CheckCircle, HandCoins, Bell, BellDot, Send,
  X, Mail, ChevronDown, ChevronUp, Zap, Users, Clock
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import confetti from 'canvas-confetti';

/* ─── Cinematic Settle-Up Animation ─── */
function SettleAnimation({ split, onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let frame = 0;
    let raf;

    const particles = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        r: 2 + Math.random() * 4,
        color: ['#34ffb4', '#00d4aa', '#fbbf24', '#f472b6'][Math.floor(Math.random() * 4)]
      };
    });

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ring
      const progress = Math.min(frame / 40, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, 48 * progress, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = '#34ffb4';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#34ffb4';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Check mark
      if (frame > 30) {
        const t = Math.min((frame - 30) / 20, 1);
        ctx.beginPath();
        ctx.moveTo(cx - 18 * t, cy);
        ctx.lineTo(cx - 4, cy + 14 * t);
        ctx.lineTo(cx + 20 * t, cy - 16 * t);
        ctx.strokeStyle = '#34ffb4';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Particles
      if (frame > 20) {
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12;
          p.alpha *= 0.96;
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      frame++;
      if (frame < 120) {
        raf = requestAnimationFrame(draw);
      } else {
        onDone?.();
      }
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6">
        <canvas ref={canvasRef} className="w-48 h-48" />
        <div className="text-center">
          <p className="text-2xl font-black text-white">Settled! 🎉</p>
          <p className="text-emerald-400 font-semibold mt-1">
            ₹{Number(split.amount).toLocaleString('en-IN')} received from {split.friend_name}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Notify Modal ─── */
function NotifyModal({ split, session, ownerName, onClose, onNotified }) {
  const [email, setEmail] = useState(split.friend_email || '');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/split-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          splitId: split.id,
          friendEmail: email.trim(),
          friendName: split.friend_name,
          amount: split.amount,
          expenseName: split.expenses?.name,
          ownerName: ownerName
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to notify');
      setDone(true);
      onNotified(split.id, email.trim(), data.inApp);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {done ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Notification Sent! 🚀</h3>
            <p className="text-slate-400 text-sm">
              <strong className="text-emerald-400">{split.friend_name}</strong> has been emailed about the ₹{Number(split.amount).toLocaleString('en-IN')} they owe you.
            </p>
            <button onClick={onClose}
              className="mt-6 w-full py-3 rounded-2xl bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Notify {split.friend_name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">Send them an email reminder</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Amount preview */}
            <div className="mb-5 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">Amount owed</p>
                <p className="text-white font-black text-2xl">₹{Number(split.amount).toLocaleString('en-IN')}</p>
                <p className="text-slate-400 text-xs mt-0.5">For: {split.expenses?.name || 'shared expense'}</p>
              </div>
              <div className="text-4xl">🤝</div>
            </div>

            <label className="block mb-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Mail className="h-3 w-3" /> {split.friend_name}'s email address
              </span>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="friend@example.com"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </label>

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 text-black font-black text-sm uppercase tracking-wider hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending...' : 'Send Notification Email'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── In-App Notification Toast ─── */
function NotificationToast({ notif, onSettle, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 350);
  };

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 transition-all duration-350 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      <div className="bg-slate-900 border border-orange-500/30 rounded-2xl p-4 shadow-2xl shadow-orange-500/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">🤝</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">{notif.sender_name} split with you!</p>
            <p className="text-slate-400 text-xs mt-0.5 truncate">
              ₹{Number(notif.amount).toLocaleString('en-IN')} for {notif.expense_name || 'an expense'}
            </p>
          </div>
          <button onClick={dismiss} className="text-slate-600 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { onSettle(notif); dismiss(); }}
            className="flex-1 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs hover:bg-emerald-500/30 transition-colors border border-emerald-500/20"
          >
            ✅ Settle Up
          </button>
          <button
            onClick={dismiss}
            className="py-2 px-3 rounded-xl bg-white/5 text-slate-400 font-bold text-xs hover:bg-white/10 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Splits() {
  usePageGreeting("Here is the money your friends have to pay you.");
  const { user, session } = useAuth();

  const [splits, setSplits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [settleAnimation, setSettleAnimation] = useState(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const [toastNotif, setToastNotif] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const ownerName = user?.user_metadata?.username || user?.email;

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [splitsRes, accountsRes, notifsRes] = await Promise.all([
        supabase
          .from('splits')
          .select('id, friend_name, friend_email, notified_at, amount, status, created_at, expenses(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_savings')
          .select('id, bank_name, balance')
          .eq('user_id', user.id),
        supabase
          .from('split_notifications')
          .select('*')
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (splitsRes.data) setSplits(splitsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (notifsRes.data) {
        setNotifications(notifsRes.data);
        // Show toast for newest unread
        const newest = notifsRes.data.find(n => n.status === 'unread');
        if (newest) setToastNotif(newest);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`split_notifs_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'split_notifications',
        filter: `recipient_user_id=eq.${user.id}`
      }, payload => {
        setNotifications(prev => [payload.new, ...prev]);
        setToastNotif(payload.new);
      })
      .subscribe();

    // Also listen for splits settling (so notifier sees real-time settle)
    const splitsChannel = supabase
      .channel(`splits_updates_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'splits',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(splitsChannel);
    };
  }, [user, fetchAll]);

  const handleSettle = async (split) => {
    if (accounts.length === 0) {
      alert('You need a Savings Account to settle debts. Please add one in the Savings page.');
      return;
    }
    const primaryAccount = accounts[0];
    setSettlingId(split.id);

    try {
      const [updateRes, balRes] = await Promise.all([
        supabase.from('splits').update({ status: 'settled' }).eq('id', split.id),
        supabase.from('user_savings').update({
          balance: Number(primaryAccount.balance) + Number(split.amount)
        }).eq('id', primaryAccount.id)
      ]);

      if (updateRes.error) throw updateRes.error;
      if (balRes.error) throw balRes.error;

      setSettleAnimation(split);

      confetti({
        particleCount: 180,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#34ffb4', '#10B981', '#fbbf24', '#f472b6', '#818cf8']
      });

      // Voice feedback
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          `Settled! ${Number(split.amount).toLocaleString('en-IN')} rupees received from ${split.friend_name}.`
        );
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
      } catch {}
    } catch (err) {
      console.error('Settle error:', err);
      alert('Failed to settle. Please try again.');
    } finally {
      setSettlingId(null);
    }
  };

  // Settling from incoming notification
  const handleSettleFromNotif = async (notif) => {
    // Mark notification as settled
    await supabase
      .from('split_notifications')
      .update({ status: 'settled' })
      .eq('id', notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'settled' } : n));
    fetchAll();
  };

  const markNotifsRead = async () => {
    const unread = notifications.filter(n => n.status === 'unread').map(n => n.id);
    if (unread.length === 0) return;
    await supabase.from('split_notifications').update({ status: 'read' }).in('id', unread);
    setNotifications(prev => prev.map(n => unread.includes(n.id) ? { ...n, status: 'read' } : n));
  };

  const handleNotified = (splitId, email, inApp) => {
    setSplits(prev => prev.map(s =>
      s.id === splitId ? { ...s, friend_email: email, notified_at: new Date().toISOString() } : s
    ));
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;
  const pendingSplits = splits.filter(s => s.status === 'pending');
  const settledSplits = splits.filter(s => s.status === 'settled');
  const totalOwed = pendingSplits.reduce((acc, s) => acc + Number(s.amount), 0);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Settle animation overlay */}
      {settleAnimation && (
        <SettleAnimation
          split={settleAnimation}
          onDone={() => { setSettleAnimation(null); fetchAll(); }}
        />
      )}

      {/* Notify modal */}
      {notifyModal && (
        <NotifyModal
          split={notifyModal}
          session={session}
          ownerName={ownerName}
          onClose={() => setNotifyModal(null)}
          onNotified={handleNotified}
        />
      )}

      {/* Incoming notification toast */}
      {toastNotif && (
        <NotificationToast
          notif={toastNotif}
          onSettle={handleSettleFromNotif}
          onDismiss={() => setToastNotif(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <HandCoins className="h-7 w-7 text-emerald-500" />
            Friends &amp; Splits
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track, notify, and settle shared expenses in real-time.
          </p>
        </div>

        {/* Notification Bell */}
        <button
          onClick={() => { setShowNotifPanel(p => !p); if (!showNotifPanel) markNotifsRead(); }}
          className="relative p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {unreadCount > 0 ? (
            <BellDot className="h-5 w-5 text-orange-500" />
          ) : (
            <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Notification Panel ── */}
      {showNotifPanel && (
        <div className="card p-0 overflow-hidden border border-orange-500/20 animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Incoming Split Requests
            </h3>
            <span className="text-xs text-slate-400">{notifications.length} total</span>
          </div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No incoming split requests yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {notifications.map(notif => (
                <div key={notif.id} className={`p-4 flex items-center gap-3 transition-colors ${notif.status === 'unread' ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xl shrink-0">
                    🤝
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      <span className="text-orange-600 dark:text-orange-400">{notif.sender_name}</span> split ₹{Number(notif.amount).toLocaleString('en-IN')} with you
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {notif.expense_name} • {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {notif.status !== 'settled' && (
                    <button
                      onClick={() => handleSettleFromNotif(notif)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      Settle
                    </button>
                  )}
                  {notif.status === 'settled' && (
                    <span className="shrink-0 text-xs font-bold text-emerald-500 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Total Owed Banner ── */}
      <div className="rounded-3xl p-6 bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white -translate-x-10 translate-y-10" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-50 text-xs font-bold uppercase tracking-widest mb-1">Total to get back</p>
              <h3 className="text-5xl font-black">₹{totalOwed.toLocaleString('en-IN')}</h3>
              <p className="text-emerald-100 text-sm mt-2">{pendingSplits.length} pending split{pendingSplits.length !== 1 ? 's' : ''}</p>
            </div>
            <Users className="h-16 w-16 text-white/20" />
          </div>
        </div>
      </div>

      {/* ── Pending Splits ── */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          Pending Debts
        </h3>

        {pendingSplits.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-3xl mb-3">🎉</p>
            <p className="font-bold text-slate-700 dark:text-slate-300">All settled up!</p>
            <p className="text-slate-400 text-sm mt-1">Nobody owes you anything right now.</p>
          </div>
        ) : (
          pendingSplits.map(split => (
            <div key={split.id}
              className="card p-5 border-l-4 border-l-orange-500 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-black text-lg shrink-0">
                    {split.friend_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      {split.friend_name}
                      <span className="text-slate-400 font-normal"> owes you</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {split.expenses?.name || 'an expense'} • {format(parseISO(split.created_at), 'MMM dd, yyyy')}
                    </p>
                    {split.notified_at && (
                      <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Notified {formatDistanceToNow(parseISO(split.notified_at), { addSuffix: true })}
                        {split.friend_email && ` · ${split.friend_email}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    ₹{Number(split.amount).toLocaleString('en-IN')}
                  </span>

                  {/* Notify Button */}
                  <button
                    onClick={() => setNotifyModal(split)}
                    title="Send reminder email"
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                  >
                    <Send className="h-4 w-4" />
                  </button>

                  {/* Settle Button */}
                  <button
                    onClick={() => handleSettle(split)}
                    disabled={settlingId === split.id}
                    className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    {settlingId === split.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <CheckCircle className="h-4 w-4" />}
                    Settle Up
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Settled History ── */}
      {settledSplits.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowSettled(p => !p)}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {showSettled ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Settled History ({settledSplits.length})
          </button>

          {showSettled && (
            <div className="space-y-2 animate-in fade-in duration-200">
              {settledSplits.map(split => (
                <div key={split.id}
                  className="card p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Settled with {split.friend_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {split.expenses?.name || 'expense'} · {format(parseISO(split.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-400 text-sm">
                    ₹{Number(split.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
