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
      <div className="mx-3 mb-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.10)] px-1 py-1.5">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => {
                if (item.isPrimary) return 'flex flex-col items-center gap-0.5';
                return `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`;
              }}
            >
              {({ isActive }) =>
                item.isPrimary ? (
                  <>
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-md transition-all duration-200 ${
                      isActive ? 'bg-teal-700 scale-105' : 'bg-teal-600'
                    }`}>
                      <item.icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-teal-700' : 'text-slate-500'}`}>
                      {item.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                      isActive ? 'bg-teal-50' : 'bg-transparent'
                    }`}>
                      <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
                    </div>
                    <span className={`text-[10px] font-medium transition-colors ${
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
