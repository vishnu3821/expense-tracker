import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { startOfDay, startOfMonth, startOfYear, format, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, TrendingUp, Calendar, CreditCard, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, month: 0, year: 0 });
  const [recent, setRecent] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const today = startOfDay(now);
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      let todayTotal = 0;
      let monthTotal = 0;
      let yearTotal = 0;
      
      const monthlyData = {};

      data.forEach(expense => {
        // Parse the database date as local to avoid off-by-one errors with timezone
        // Assuming date is in YYYY-MM-DD format
        const expenseDate = parseISO(expense.date);
        const amount = Number(expense.amount);

        if (expenseDate >= today) todayTotal += amount;
        if (expenseDate >= monthStart) monthTotal += amount;
        if (expenseDate >= yearStart) yearTotal += amount;

        // Group by month for chart
        const monthKey = format(expenseDate, 'MMM yyyy');
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + amount;
      });

      const formattedChartData = Object.entries(monthlyData)
        .map(([name, total]) => ({ name, total }))
        .reverse()
        .slice(-6); // Last 6 months

      setStats({ today: todayTotal, month: monthTotal, year: yearTotal });
      setRecent(data.slice(0, 5));
      setChartData(formattedChartData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const StatCard = ({ title, amount, icon: Icon, colorClass }) => (
    <div className="card p-6 flex flex-col gap-4 bg-white hover:-translate-y-1 transition-transform duration-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <div className={`p-2.5 rounded-xl ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900">₹{amount.toFixed(2)}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">Overview of your expenses and financial activity.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard title="Today's Total" amount={stats.today} icon={IndianRupee} colorClass="bg-blue-50 text-blue-600 border border-blue-100" />
        <StatCard title="Monthly Total" amount={stats.month} icon={Calendar} colorClass="bg-teal-50 text-teal-600 border border-teal-100" />
        <StatCard title="Yearly Total" amount={stats.year} icon={TrendingUp} colorClass="bg-purple-50 text-purple-600 border border-purple-100" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Expense Trends</h3>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₹${value}`, 'Total']}
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#0d9488" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#0f766e' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No expense data available for trends
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
          </div>
          <div className="flex-1 p-6 pt-4 space-y-5">
            {recent.length > 0 ? (
              recent.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 group-hover:bg-teal-50 transition-colors flex items-center justify-center text-slate-500 group-hover:text-teal-600">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate pr-2">{expense.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{format(parseISO(expense.date), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900 whitespace-nowrap">
                    ₹{Number(expense.amount).toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 text-sm py-8">
                No recent transactions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
