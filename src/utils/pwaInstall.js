// PWA Installation Utility & Event Manager

let deferredPrompt = null;
const listeners = new Set();

/**
 * Initializes the beforeinstallprompt and appinstalled event listeners.
 * Should be called as early as possible in main.jsx.
 */
export const initPWAInstallListener = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser mini-infobar on mobile Chrome
    e.preventDefault();
    deferredPrompt = e;
    // Notify all active listeners
    listeners.forEach((callback) => {
      try {
        callback(e);
      } catch (err) {
        console.error('[PWA] Error in prompt listener:', err);
      }
    });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try {
      localStorage.setItem('pwa_installed', 'true');
    } catch {
      // ignore storage errors
    }
    listeners.forEach((callback) => {
      try {
        callback(null);
      } catch (err) {
        console.error('[PWA] Error in installed listener:', err);
      }
    });
  });
};

/**
 * Get current cached deferredPrompt
 */
export const getDeferredPrompt = () => deferredPrompt;

/**
 * Subscribe to changes in the deferred prompt
 */
export const subscribeToInstallPrompt = (callback) => {
  listeners.add(callback);
  if (deferredPrompt) {
    callback(deferredPrompt);
  }
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Checks if the current app is running in standalone (installed) mode.
 */
export const isAppInstalled = () => {
  if (typeof window === 'undefined') return false;
  
  // Check display-mode media queries
  const isStandaloneMQ = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreenMQ = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUIMQ = window.matchMedia('(display-mode: minimal-ui)').matches;
  
  // iOS Safari standalone property
  const isNavStandalone = window.navigator.standalone === true;
  
  // TWA (Trusted Web Activity) / Android Intent referrer
  const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');

  return isStandaloneMQ || isFullscreenMQ || isMinimalUIMQ || isNavStandalone || isAndroidApp;
};

/**
 * Detects if the current device is running iOS (Safari/WebKit)
 */
export const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
};

/**
 * Prompts the user to install the PWA if native prompt is available.
 * Returns an object with the result.
 */
export const triggerInstall = async () => {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        try {
          localStorage.setItem('pwa_installed', 'true');
        } catch {
          // ignore
        }
        deferredPrompt = null;
        listeners.forEach((cb) => cb(null));
        return { success: true, outcome: 'accepted' };
      }
      return { success: false, outcome: choice?.outcome || 'dismissed' };
    } catch (err) {
      console.error('[PWA] Prompt error:', err);
      return { success: false, error: err };
    }
  }
  return { success: false, reason: 'no-prompt' };
};
