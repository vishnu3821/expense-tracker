import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History, X, UserCircle } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
  { name: 'Add Expense', path: '/add', icon: PlusCircle, end: false },
  { name: 'History', path: '/history', icon: History, end: false },
  { name: 'Profile', path: '/profile', icon: UserCircle, end: false },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center shrink-0">
            <img src="/logo.png" alt="Expense Tracker" className="h-24 w-auto object-contain -ml-4" />
          </div>
          <button onClick={onClose} className="md:hidden text-slate-500 hover:text-slate-900 p-2 -mr-2 rounded-lg hover:bg-slate-50" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 h-full bg-white">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onClose}
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
    </>
  );
}
