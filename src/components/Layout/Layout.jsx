import React from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';

export default function Layout() {

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">

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
