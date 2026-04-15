import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, History, Menu } from 'lucide-react';

const navItems = [
  { name: 'Home', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add', path: '/add', icon: Plus, end: false },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'More', path: '/more', icon: Menu, end: false },
];

export default function BottomNav() {
  const location = useLocation();
  
  // Calculate active index for the sliding indicator
  const activeIndex = navItems.findIndex(item => {
    if (item.end) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-transparent pointer-events-none pb-6 px-4">
      <div className="rounded-full bg-white/75 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/50 dark:border-slate-700/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] shadow-teal-500/10 px-2 py-2 pointer-events-auto max-w-md mx-auto relative overflow-hidden">
        {/* Subtle inner highlight */}
        <div className="absolute inset-0 rounded-full border border-white/20 dark:border-white/5 pointer-events-none" />
        
        <div className="relative flex items-center justify-around isolate">
          {/* Sliding Indicator Pill */}
          <div 
            className="absolute inset-y-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-emerald-50 dark:bg-emerald-900/40 rounded-full z-[-1]"
            style={{
              width: `${100 / navItems.length}%`,
              left: `${(activeIndex === -1 ? 0 : activeIndex) * (100 / navItems.length)}%`,
              opacity: activeIndex === -1 ? 0 : 1
            }}
          >
            {/* Soft glow under the active item */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-emerald-400/40 blur-md rounded-full" />
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className="flex-1"
            >
              {({ isActive }) => (
                <div className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-300 ${
                  isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  <item.icon 
                    className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`} 
                    strokeWidth={isActive ? 2.5 : 1.8} 
                  />
                  <span className={`text-[10px] tracking-tight transition-all duration-300 ${
                    isActive ? 'font-bold opacity-100' : 'font-medium opacity-70'
                  }`}>
                    {item.name}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
