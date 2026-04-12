import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';

export default function Layout() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 z-100 bg-amber-500 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top-full shadow-md">
          <WifiOff className="h-3.5 w-3.5" />
          <span>You are offline. Showing cached data.</span>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        {/* Extra bottom padding on mobile so content isn't behind the bottom nav */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 pb-32 md:pb-8 scroll-smooth overscroll-none">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
