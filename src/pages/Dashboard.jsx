import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { startOfDay, startOfMonth, startOfYear, format, parseISO, getDaysInMonth, getDay, isSameMonth, isToday } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, TrendingUp, Calendar, CreditCard, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

import { requestNotificationPermission } from '../lib/firebase';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, month: 0, year: 0 });
  const [recent, setRecent] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [calendarData, setCalendarData] = useState({}); // { 'YYYY-MM-DD': amount }
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      if ('Notification' in window && Notification.permission === 'default') {
        setShowNotificationPrompt(true);
      }
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    if (!user) return;
    const token = await requestNotificationPermission(user.id);
    if (token) {
      alert("Daily updates enabled successfully!");
    } else {
      alert("Could not enable notifications. Please check your browser settings.");
    }
    setShowNotificationPrompt(false);
  };

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const today = startOfDay(now);
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      let todayTotal = 0;
      let monthTotal = 0;
      let yearTotal = 0;
      const monthlyData = {};
      const dailyMap = {};

      data.forEach(expense => {
        const expenseDate = parseISO(expense.date);
        const amount = Number(expense.amount);
        const dateKey = format(expenseDate, 'yyyy-MM-dd');

        // 🔥 CRITICAL: Exclude internal transfers from actual spending totals
        if (expense.category !== 'Transfer') {
          if (expenseDate >= today) todayTotal += amount;
          if (expenseDate >= monthStart) monthTotal += amount;
          if (expenseDate >= yearStart) yearTotal += amount;

          // Group by month for trend chart
          const monthKey = format(expenseDate, 'MMM yyyy');
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
        }

        // Group by day for calendar (always show activity regardless of category)
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + amount;
      });

      const formattedChartData = Object.entries(monthlyData)
        .map(([name, total]) => ({ name, total }))
        .reverse()
        .slice(-6);

      setStats({ today: todayTotal, month: monthTotal, year: yearTotal });
      setRecent(data.slice(0, 5));
      setChartData(formattedChartData);
      setCalendarData(dailyMap);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar helpers
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDayOfMonth = getDay(new Date(year, month, 1)); // 0=Sun
    const weeks = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get max daily spend for intensity scaling
    const monthValues = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = format(new Date(year, month, d), 'yyyy-MM-dd');
      if (calendarData[key]) monthValues.push(calendarData[key]);
    }
    const maxSpend = Math.max(...monthValues, 1);

    const cells = [];
    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = format(date, 'yyyy-MM-dd');
      const amount = calendarData[key] || 0;
      const intensity = amount > 0 ? Math.min(amount / maxSpend, 1) : 0;
      const isCurrentDay = isToday(date);

      // Color from light teal to deep teal based on intensity
      const bg = amount > 0
        ? `rgba(13, 148, 136, ${0.15 + intensity * 0.75})`
        : 'transparent';

      cells.push(
        <div
          key={d}
          title={amount > 0 ? `₹${amount.toFixed(0)}` : 'No expenses'}
          className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all cursor-default relative
            ${isCurrentDay ? 'ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-slate-900 font-bold' : ''}
            ${amount > 0 ? 'text-white' : 'text-slate-400 dark:text-slate-600'}
          `}
          style={{ backgroundColor: bg }}
        >
          <span className={`text-[11px] font-semibold ${isCurrentDay && !amount ? 'text-teal-600 dark:text-teal-400' : ''}`}>{d}</span>
          {amount > 0 && (
            <span className="text-[9px] opacity-90 font-medium">₹{amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0)}</span>
          )}
        </div>
      );
    }

    return (
      <div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {weeks.map(w => (
            <div key={w} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1">{w}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const StatCard = ({ title, amount, icon: Icon, colorClass }) => (
    <div className="card p-6 flex flex-col gap-4 hover:-translate-y-1 transition-transform duration-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className={`p-2.5 rounded-xl ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{amount.toFixed(2)}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-500">
      {showNotificationPrompt && (
        <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top">
          <div>
            <h3 className="font-bold text-teal-800 dark:text-teal-400">Get Daily Summaries!</h3>
            <p className="text-sm text-teal-600 dark:text-teal-500 mt-0.5">Let us notify you every day at 9 PM with your total daily spend.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowNotificationPrompt(false)}
              className="px-4 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-800/50 rounded-xl transition-colors flex-1 sm:flex-none"
            >
              Later
            </button>
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex-1 sm:flex-none"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Overview of your expenses and financial activity.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Today's Total" amount={stats.today} icon={IndianRupee} colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50" />
        <StatCard title="Monthly Total" amount={stats.month} icon={Calendar} colorClass="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50" />
        <StatCard title="Yearly Total" amount={stats.year} icon={TrendingUp} colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Expense Calendar */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Expense Calendar</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-28 text-center">
                {format(calendarMonth, 'MMMM yyyy')}
              </span>
              <button
                onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                disabled={isSameMonth(calendarMonth, new Date())}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {renderCalendar()}
          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Less</span>
            {[0.15, 0.35, 0.55, 0.75, 0.90].map(op => (
              <div key={op} className="w-4 h-4 rounded" style={{ backgroundColor: `rgba(13,148,136,${op})` }} />
            ))}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">More</span>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Transactions</h3>
          </div>
          <div className="flex-1 p-6 pt-4 space-y-5">
            {recent.length > 0 ? (
              recent.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/30 transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate pr-2">{expense.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {format(parseISO(expense.date), 'MMM dd, yyyy')} • {(expense.created_at ? new Date(expense.created_at) : parseISO(expense.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    ₹{Number(expense.amount).toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-8">
                No recent transactions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
