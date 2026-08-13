import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import OnboardingModal from '../OnboardingModal';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 dark:bg-[#000000] relative selection:bg-teal-500/30">

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0 bg-slate-50 dark:bg-[#000000]">
        <Topbar />
        
        {/* Extra bottom padding on mobile so content isn't behind the bottom nav */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 pb-32 md:pb-8 scroll-smooth overscroll-none relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
      <OnboardingModal />
    </div>
  );
}
