import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Plus, History, Menu } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add', path: '/add', icon: Plus, end: false, isPrimary: true },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'More', path: '/more', icon: Menu, end: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-2 mb-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg px-1 py-1">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className="flex flex-col items-center"
            >
              {({ isActive }) =>
                item.isPrimary ? (
                  <div className="flex flex-col items-center gap-0.5 -mt-0.5">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow transition-colors ${
                      isActive ? 'bg-teal-700' : 'bg-teal-600'
                    }`}>
                      <item.icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>
                      {item.name}
                    </span>
                  </div>
                ) : (
                  <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${
                    isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
                    <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
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
