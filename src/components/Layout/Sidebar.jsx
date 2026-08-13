import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History, X, Menu, HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add Expense', path: '/add', icon: PlusCircle, end: false },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'Splits', path: '/splits', icon: HandCoins, end: false },
  { name: 'More', path: '/more', icon: Menu, end: false },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#030712] border-r border-slate-200 dark:border-slate-800/50 flex flex-col transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#030712] overflow-hidden">
          <div className="flex items-center shrink-0">
            <img src="/website_logo.png" alt="Expense Monitor" className="h-24 w-auto object-contain -ml-4" />
          </div>
          <button onClick={onClose} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 -mr-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2 h-full bg-white dark:bg-[#030712] relative">
          {navItems.map((item) => {
            // Determine if the current item is active
            const isActive = item.end 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={onClose}
                className="relative flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-colors z-10 group"
              >
                {/* 🌊 Liquid Background Pill */}
                {isActive && (
                  <motion.div
                    layoutId="liquid-pill"
                    className="absolute inset-0 bg-teal-50 dark:bg-teal-500/10 dark:border dark:border-teal-500/20 rounded-xl z-0 shadow-[0_0_15px_rgba(20,184,166,0)] dark:shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                <div className={`relative z-10 flex items-center gap-3 w-full ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                }`}>
                  <item.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="tracking-wide">{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
