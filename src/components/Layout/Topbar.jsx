import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Topbar({ onMenuClick }) {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 flex-shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/" className="md:hidden font-bold text-lg text-teal-600 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-teal-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          Expenser
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-slate-600 hidden sm:block">
          {user?.email}
        </div>
        <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold border border-teal-200 shadow-sm uppercase select-none">
          {user?.email?.[0] || 'U'}
        </div>
        <button
          onClick={signOut}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
