import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, CheckCircle2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isAppInstalled } from '../../utils/pwaInstall';

export default function PendingSplitToast() {
  const { user } = useAuth();
  const [split, setSplit] = useState(null);
  const [visible, setVisible] = useState(false);
  const [reminded, setReminded] = useState(false);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const fetchPendingSplit = async () => {
      try {
        const { data, error } = await supabase
          .from('splits')
          .select('id, friend_name, amount, created_at, expenses(name)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[PendingSplitToast] Error:', error);
          return;
        }

        if (isMounted && data && data.length > 0) {
          const topSplit = data[0];
          // Check if user already dismissed this specific split in this session
          const isDismissed = sessionStorage.getItem(`pending_split_dismissed_${topSplit.id}`);
          if (!isDismissed) {
            setSplit(topSplit);
            // Slight delay so dashboard animation settles smoothly
            setTimeout(() => {
              if (isMounted) setVisible(true);
            }, 800);
          }
        }
      } catch (err) {
        console.warn('[PendingSplitToast] Exception:', err);
      }
    };

    fetchPendingSplit();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleDismiss = () => {
    setVisible(false);
    if (split) {
      sessionStorage.setItem(`pending_split_dismissed_${split.id}`, 'true');
    }
  };

  const handleWhatsAppRemind = () => {
    if (!split) return;

    let upiId = user?.user_metadata?.upi_id || localStorage.getItem('user_upi_id') || '';
    if (!upiId) {
      upiId = prompt('Enter your UPI ID to attach 1-tap payment link (e.g. 9876543210@paytm or yourname@okhdfcbank):') || '';
      if (upiId.trim()) {
        localStorage.setItem('user_upi_id', upiId.trim());
      }
    }

    const cleanAmount = Number(split.amount).toFixed(2);
    const payeeName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Friend';
    const expenseName = split.expenses?.name || 'our shared expense';

    // Standard NPCI UPI URI
    const upiLink = upiId.trim()
      ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payeeName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(`Split for ${expenseName}`)}`
      : '';

    let text = `Hey *${split.friend_name}*! 👋\n\nQuick reminder from Expense Monitor for *${expenseName}*:\n💰 *Amount to settle:* ₹${Number(split.amount).toLocaleString('en-IN')}`;

    if (upiLink) {
      text += `\n\n⚡ *1-Tap Pay via UPI (GPay / PhonePe / Paytm):*\n${upiLink}\n\n_UPI ID: ${upiId.trim()}_`;
    }

    text += `\n\nTracked securely on Expense Monitor 🚀`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');

    setReminded(true);

    // Update notified_at in database
    supabase
      .from('splits')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', split.id)
      .then(() => {
        setTimeout(() => {
          setVisible(false);
          sessionStorage.setItem(`pending_split_dismissed_${split.id}`, 'true');
        }, 1800);
      });
  };

  if (!split || !visible) {
    return null;
  }

  // Adjust positioning if Install Banner is also currently showing
  const isInstallBannerShowing = !isAppInstalled() && !sessionStorage.getItem('pwa_banner_dismissed_session');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className={`fixed z-50 pointer-events-auto ${
            isInstallBannerShowing
              ? 'bottom-44 md:bottom-28 left-1/2 -translate-x-1/2 w-[92%] max-w-sm sm:max-w-md md:w-auto md:min-w-96 md:max-w-md'
              : 'bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm sm:max-w-md md:w-auto md:min-w-96 md:max-w-md'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950/95 dark:bg-[#070b14]/95 backdrop-blur-2xl border-2 border-emerald-500/80 p-3 sm:p-3.5 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(16,185,129,0.2)]">
            {/* Subtle top highlight glow */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-emerald-400 to-transparent opacity-80" />

            <div className="flex items-center justify-between gap-3">
              {/* Left: Friend Avatar initial */}
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 shrink-0 text-base shadow-inner">
                {split.friend_name ? split.friend_name.charAt(0).toUpperCase() : <User className="w-5 h-5 text-emerald-400" />}
              </div>

              {/* Center: Details */}
              <div className="flex-1 min-w-0 pr-1 text-left">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-tight truncate">
                  {reminded ? 'Reminder Sent! 🚀' : `${split.friend_name} owes ₹${Number(split.amount).toLocaleString('en-IN')}`}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate mt-0.5">
                  {reminded ? 'WhatsApp opened with UPI link' : `For: ${split.expenses?.name || 'Shared Expense'}`}
                </p>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {reminded ? (
                  <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sent</span>
                  </div>
                ) : (
                  <button
                    onClick={handleWhatsAppRemind}
                    className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
                    title="Send WhatsApp reminder with 1-tap UPI link"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}

                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
