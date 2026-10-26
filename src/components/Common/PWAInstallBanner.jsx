import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { 
  isAppInstalled, 
  triggerInstall, 
  subscribeToInstallPrompt,
  getDeferredPrompt 
} from '../../utils/pwaInstall';

export default function PWAInstallBanner() {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Requirement: Visible strictly in the dashboard only
  const isDashboard = location.pathname === '/';

  useEffect(() => {
    // 1. If not on Dashboard or already running as installed app, hide immediately
    if (!isDashboard || isAppInstalled()) {
      setIsVisible(false);
      return;
    }

    // 2. Check if user dismissed it in this browser session
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed_session');
    if (isDismissed) {
      setIsVisible(false);
      return;
    }

    // 3. Keep visible down at the bottom until user installs
    setIsVisible(true);

    // Subscribe to install prompt when available
    const unsubscribe = subscribeToInstallPrompt((prompt) => {
      if (prompt && !isAppInstalled() && !sessionStorage.getItem('pwa_banner_dismissed_session')) {
        setIsVisible(true);
      }
    });

    // Support manual trigger from other menus (e.g. More page)
    const handleOpenPrompt = () => {
      sessionStorage.removeItem('pwa_banner_dismissed_session');
      setIsVisible(true);
      const prompt = getDeferredPrompt();
      if (prompt) {
        triggerInstall().then((res) => {
          if (res?.success && res?.outcome === 'accepted') {
            setInstalledSuccess(true);
            setTimeout(() => setIsVisible(false), 2000);
          }
        });
      }
    };

    window.addEventListener('pwa-open-install-prompt', handleOpenPrompt);

    return () => {
      unsubscribe();
      window.removeEventListener('pwa-open-install-prompt', handleOpenPrompt);
    };
  }, [isDashboard]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed_session', 'true');
  };

  const handleInstallClick = async () => {
    const prompt = getDeferredPrompt();
    if (prompt) {
      const res = await triggerInstall();
      if (res?.success && res?.outcome === 'accepted') {
        setInstalledSuccess(true);
        try {
          localStorage.setItem('pwa_installed', 'true');
        } catch {
          // ignore storage error
        }
        setTimeout(() => {
          setIsVisible(false);
        }, 2000);
      }
    } else {
      // In Safari Mac or browsers without beforeinstallprompt
      const isSafariMac = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafariMac) {
        alert('To install as an app on Mac Safari: Click the Share button (or File menu) and select "Add to Dock".');
      } else {
        const res = await triggerInstall();
        if (res?.success && res?.outcome === 'accepted') {
          setInstalledSuccess(true);
          setTimeout(() => setIsVisible(false), 2000);
        }
      }
    }
  };

  // Only render on the Dashboard and when app is not already installed
  if (!isDashboard || isAppInstalled() || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="fixed z-50 pointer-events-auto bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm sm:max-w-md md:max-w-lg"
        >
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950/95 dark:bg-[#070b14]/95 backdrop-blur-2xl border-2 border-amber-500/80 p-3 sm:p-3.5 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(245,158,11,0.2)]">
            {/* Subtle top amber highlight glow */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-amber-400 to-transparent opacity-80" />

            <div className="flex items-center justify-between gap-3">
              {/* Left: App Logo */}
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
                <img
                  src="/app_logo.png"
                  alt="Expense Monitor"
                  className="w-full h-full object-contain rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <Smartphone className="w-5 h-5 text-amber-400 absolute" style={{ display: 'none' }} />
              </div>

              {/* Center: Title & Subtitle */}
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-tight truncate">
                  {installedSuccess ? 'App Installed!' : 'Install Expense Monitor'}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate mt-0.5">
                  {installedSuccess ? 'Added to your home screen' : 'Add to Home screen for 1-tap access'}
                </p>
              </div>

              {/* Right: Install & Close Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {installedSuccess ? (
                  <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Installed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleInstallClick}
                    className="bg-linear-to-r from-amber-400 via-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs shadow-md shadow-amber-400/25 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Install</span>
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
