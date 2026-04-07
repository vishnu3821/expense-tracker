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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-transparent pointer-events-none">
      <div className="mx-4 mb-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 shadow-2xl px-1.5 py-1.5 pointer-events-auto max-w-sm mx-auto">
        <div className="relative flex items-center justify-around isolate">
          {/* Sliding Indicator Pill */}
          <div 
            className="absolute inset-y-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-teal-600/10 dark:bg-teal-500/10 rounded-xl z-[-1]"
            style={{
              width: `${100 / navItems.length}%`,
              left: `${(activeIndex === -1 ? 0 : activeIndex) * (100 / navItems.length)}%`,
              opacity: activeIndex === -1 ? 0 : 1
            }}
          >
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-teal-600 dark:bg-teal-400 rounded-full blur-[0.5px] opacity-80" />
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
                  isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
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
