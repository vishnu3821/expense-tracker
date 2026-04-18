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
  
  const activeIndex = navItems.findIndex(item => {
    if (item.end) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });

  return (
    <>
      {/* Liquid Gooey Filter */}
      <svg className="hidden">
        <defs>
          <filter id="liquid">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="liquid" />
            <feComposite in="SourceGraphic" in2="liquid" operator="atop" />
          </filter>
        </defs>
      </svg>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[90%] max-w-sm pointer-events-none">
        <div className="relative bg-white/10 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-4xl px-4 py-2 flex items-center justify-between gap-1 shadow-[0_20px_50px_rgba(0,0,0,0.3)] pointer-events-auto overflow-hidden">
          
          {/* Liquid Indicator Layer */}
          <div className="absolute inset-0 filter-url-[#liquid] pointer-events-none">
             <div 
              className="absolute top-1/2 -translate-y-1/2 h-10 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) bg-emerald-500/20 dark:bg-emerald-500/10 rounded-2xl"
              style={{
                width: `${100 / navItems.length}%`,
                left: `${(activeIndex === -1 ? 0 : activeIndex) * (100 / navItems.length)}%`,
                opacity: activeIndex === -1 ? 0 : 1
              }}
            >
              <div className="absolute inset-2 bg-emerald-500/80 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
            </div>
          </div>
          
          <div className="relative h-full flex items-center justify-around px-2">
            {navItems.map((item, idx) => {
              const isActive = activeIndex === idx;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className="flex-1 group"
                >
                  <div className="relative flex flex-col items-center justify-center py-2 transition-all duration-500">
                    <div className={`relative transition-all duration-500 transform ${isActive ? '-translate-y-1 scale-110' : 'group-active:scale-90'}`}>
                      <item.icon 
                        className={`h-6 w-6 transition-all duration-500 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} 
                        strokeWidth={isActive ? 2.5 : 2} 
                      />
                      {isActive && (
                        <div className="absolute -inset-1 bg-emerald-400/20 blur-md rounded-full animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest mt-1 transition-all duration-500 ${
                      isActive ? 'text-emerald-400 opacity-100' : 'text-slate-600 opacity-0 -translate-y-1'
                    }`}>
                      {item.name}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
      
      <style>{`
        .filter-url-[#liquid] {
          filter: url(#liquid);
        }
      `}</style>
    </>
  );
}
