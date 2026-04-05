import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Plus, History, UserCircle } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add', path: '/add', icon: Plus, end: false, isPrimary: true },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'Profile', path: '/profile', icon: UserCircle, end: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Frosted glass container */}
      <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-2 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => {
                if (item.isPrimary) {
                  return 'flex flex-col items-center gap-1';
                }
                return `flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-teal-700' : 'text-slate-400 hover:text-slate-600'
                }`;
              }}
            >
              {({ isActive }) =>
                item.isPrimary ? (
                  <>
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-teal-700 scale-105 shadow-teal-300'
                        : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'
                    }`}>
                      <item.icon className="h-7 w-7 text-white" strokeWidth={2.5} />
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>
                      {item.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className={`p-2 rounded-xl transition-all duration-200 ${
                      isActive ? 'bg-teal-50' : 'bg-transparent'
                    }`}>
                      <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.8} />
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                      isActive ? 'text-teal-700 font-semibold' : 'text-slate-400'
                    }`}>
                      {item.name}
                    </span>
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
