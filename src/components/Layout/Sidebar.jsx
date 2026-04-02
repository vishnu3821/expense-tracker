import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add Expense', path: '/add', icon: PlusCircle, end: false },
  { name: 'History', path: '/history', icon: History, end: false },
];

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-teal-600 tracking-tight flex items-center gap-2">
          {/* A minimalistic icon for logo */}
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          Tracker
        </h1>
      </div>
      <nav className="flex-1 py-6 px-4 space-y-1.5 h-full bg-white">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
