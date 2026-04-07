import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, History, Menu } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add', path: '/add', icon: Plus, end: false, isPrimary: true },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'More', path: '/more', icon: Menu, end: false },
];

export default function BottomNav() {
  const location = useLocation();
  const navRef = useRef(null);
  const itemRefs = useRef([]);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });

  // Compute which tab is active
  const activeIndex = navItems.findIndex((item) =>
    item.end
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path)
  );

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    const nav = navRef.current;
    if (!el || !nav) return;

    const navRect = nav.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();

    setPillStyle({
      left: itemRect.left - navRect.left,
      width: itemRect.width,
      opacity: 1,
    });
  }, [activeIndex, location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glass container */}
      <div
        className="mx-2 mb-2 rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        {/* Dark mode glass overlay */}
        <div
          className="dark:block hidden absolute inset-0 rounded-2xl"
          style={{
            background: 'rgba(15,23,42,0.60)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        />

        <div ref={navRef} className="relative flex items-center justify-around px-1 py-1">
          {/* Sliding pill indicator */}
          <div
            className="absolute top-0 bottom-0 my-1 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
            style={{
              left: pillStyle.left,
              width: pillStyle.width,
              opacity: pillStyle.opacity,
              background: 'rgba(13,148,136,0.15)',
              backdropFilter: 'blur(8px)',
            }}
          />

          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className="flex flex-col items-center flex-1 relative z-10"
              ref={(el) => (itemRefs.current[index] = el)}
            >
              {({ isActive }) =>
                item.isPrimary ? (
                  <div className="flex flex-col items-center gap-0.5 -mt-0.5 py-1">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-teal-600 shadow-teal-500/40 scale-105'
                          : 'bg-teal-500 shadow-teal-400/30'
                      }`}
                      style={{
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <item.icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span
                      className={`text-[10px] font-semibold transition-colors duration-200 ${
                        isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl w-full transition-all duration-200 ${
                      isActive
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 transition-all duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <span className={`text-[10px] transition-all duration-200 ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {item.name}
                    </span>
                  </div>
                )
              }
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
