import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Topbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 transition-colors duration-300">
      <div className="flex items-center gap-4">
        {/* Logo shown on mobile since there's no sidebar */}
        <Link to="/" className="md:hidden flex items-center overflow-hidden h-8">
          <img src="/logo.png" alt="Expense Tracker" className="h-16 w-auto object-contain -ml-2 select-none pointer-events-none" />
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:block">
          {user?.email}
        </div>
        <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-semibold border border-teal-200 dark:border-teal-800/50 shadow-sm uppercase select-none">
          {user?.email?.[0] || 'U'}
        </div>
        <button
          onClick={signOut}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-1"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
