import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        {/* Extra bottom padding on mobile so content isn't behind the bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
