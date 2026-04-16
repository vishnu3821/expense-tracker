import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Menu, RefreshCw, Cloud, Zap, ArrowRightCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Topbar() {
  const { user, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Hold for 1.5 seconds to show the premium animation
    await new Promise(r => setTimeout(r, 1500));
    window.location.reload();
  };

  return (
    <>
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 transition-colors duration-300">
        <div className="flex items-center gap-4">
          {/* Logo shown on mobile since there's no sidebar */}
          <Link to="/" className="md:hidden flex items-center overflow-hidden h-8">
            <img src="/website_logo.png" alt="Expense Monitor" className="h-16 w-auto object-contain -ml-2 select-none pointer-events-none" />
          </Link>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:block truncate max-w-[150px]">
            {user?.email}
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90"
            title="Refresh App"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="h-9 w-9 shrink-0 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-semibold border border-teal-200 dark:border-teal-800/50 shadow-sm uppercase select-none">
            {user?.email?.[0] || 'U'}
          </div>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 🔮 Premium Refresh Overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="text-center space-y-8 max-w-xs w-full px-6">
            <div className="flex justify-between items-center relative py-12">
              {/* Cloud Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm animate-pulse">
                <div className="absolute inset-0 rounded-3xl bg-teal-500/20 animate-ping" />
                <Cloud className="h-10 w-10 text-teal-400" />
              </div>

              {/* Digital Pulse Animation */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-12 overflow-hidden">
                <div className="h-1 w-full bg-white/5 rounded-full relative">
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow" />
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow [animation-delay:0.5s]" />
                </div>
              </div>

              {/* App Meta Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <Zap className="h-10 w-10 text-white animate-bounce" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse">Syncing App</h3>
              <p className="text-slate-400 text-sm font-medium tracking-wide">Fetching latest configurations...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
