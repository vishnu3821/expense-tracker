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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-6">
      {/* Floating Glass Container */}
      <div
        className="mx-4 rounded-[28px] border border-white/20 dark:border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden relative"
        style={{
          background: 'rgba(255, 255, 255, 0.45)', // Lighter for better blur effect
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        {/* Dark mode glass overlay */}
        <div
          className="dark:block hidden absolute inset-0 rounded-[28px]"
          style={{
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        />

        <div ref={navRef} className="relative flex items-center justify-around px-2 py-2">
          {/* Sliding pill indicator - More subtle and floating */}
          <div
            className="absolute top-2 bottom-2 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] z-0"
            style={{
              left: pillStyle.left,
              width: pillStyle.width,
              opacity: pillStyle.opacity,
              background: 'rgba(13, 148, 136, 0.15)', // Very subtle teal highlight
              boxShadow: 'inset 0 0 0 1px rgba(13, 148, 136, 0.1)',
            }}
          />

          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className="flex flex-col items-center flex-1 relative z-10 py-1.5"
              ref={(el) => (itemRefs.current[index] = el)}
            >
              {({ isActive }) =>
                item.isPrimary ? (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'bg-teal-600 shadow-[0_0_15px_rgba(13,148,136,0.5)] scale-110'
                          : 'bg-teal-500 shadow-lg scale-100'
                      }`}
                    >
                      <item.icon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span
                      className={`text-[10px] font-bold transition-all duration-300 ${
                        isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col items-center gap-1 px-2 transition-all duration-300 ${
                      isActive
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-slate-500 dark:text-slate-500'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive ? 'font-bold' : 'font-medium'}`}>
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
