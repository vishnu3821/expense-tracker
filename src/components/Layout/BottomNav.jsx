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
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[90%] max-w-sm">
      <div className="relative h-16 rounded-4xl bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
        
        {/* Simple Professional Indicator */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 h-10 transition-all duration-500 ease-out bg-white/10 rounded-2xl border border-white/5"
          style={{
            width: `${100 / navItems.length}%`,
            left: `${(activeIndex === -1 ? 0 : activeIndex) * (100 / navItems.length)}%`,
            opacity: activeIndex === -1 ? 0 : 1
          }}
        />
        
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
                <div className="relative flex flex-col items-center justify-center py-2 transition-all duration-300">
                  <div className={`transition-all duration-300 ${isActive ? '-translate-y-0.5 scale-110' : ''}`}>
                    <item.icon 
                      className={`h-5 w-5 transition-colors duration-300 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} 
                      strokeWidth={isActive ? 2.5 : 2} 
                    />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 transition-all duration-300 ${
                    isActive ? 'text-emerald-400 opacity-100' : 'text-slate-500 opacity-0'
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
    </>
  );
}
