import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function YearBreakdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  
  // Available years let's generate from 3 years ago to current year
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [yearTotal, setYearTotal] = useState(0);
  const [monthlyTotals, setMonthlyTotals] = useState(Array(12).fill(0));

  useEffect(() => {
    if (user) fetchYearData(selectedYear);
  }, [user, selectedYear]);

  const fetchYearData = async (year) => {
    setLoading(true);
    try {
      const startDate = new Date(Date.UTC(year, 0, 1)).toISOString();
      const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Group by month
      const totals = Array(12).fill(0);
      let yTotal = 0;

      if (data) {
        data.forEach(exp => {
          const amt = Number(exp.amount) || 0;
          // Parse date properly (handling YYYY-MM-DD from DB)
          const dateObj = new Date(exp.date);
          const mIndex = dateObj.getMonth();
          if (mIndex >= 0 && mIndex < 12) {
            totals[mIndex] += amt;
            yTotal += amt;
          }
        });
      }

      setMonthlyTotals(totals);
      setYearTotal(yTotal);
    } catch (err) {
      console.error('Error fetching year data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto pb-6">
      {/* Header and Year Selector */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/more')}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Year Breakdown</h2>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-sm rounded-xl py-2 pl-4 pr-10 outline-none transition-colors"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Calendar className="h-4 w-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {/* Main Hero Card with Dynamic Intensity Glow */}
          <div className={`rounded-4xl p-8 text-white relative overflow-hidden shadow-2xl transition-all duration-700 ${
            yearTotal > 100000 ? 'bg-linear-to-br from-indigo-900 via-purple-900 to-fuchsia-900' : 
            yearTotal > 50000 ? 'bg-linear-to-br from-indigo-700 to-indigo-900' :
            'bg-linear-to-br from-teal-600 to-emerald-800'
          }`}>
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-[60px] animate-pulse" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
            
            <div className="relative z-10 flex flex-col justify-between min-h-[120px]">
               <div className="flex items-center gap-2 mb-1">
                 <div className="h-1.5 w-6 bg-white/40 rounded-full" />
                 <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">Annual Outflow Protocol</p>
               </div>
               
               <div className="space-y-1">
                 <p className="text-5xl font-black tracking-tighter">₹{yearTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}<span className="text-xl opacity-40 ml-1">.{(yearTotal % 1).toFixed(2).split('.')[1]}</span></p>
                 <div className="flex items-center gap-3">
                   <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">Certified Yearly Aggregate</p>
                 </div>
               </div>
            </div>
          </div>

          {/* Monthly Breakdown List */}
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-slate-900 dark:text-white px-1">Monthly Summary</h3>
            
            <div className="grid gap-3">
              {MONTH_NAMES.map((monthName, index) => {
                const total = monthlyTotals[index];
                const isCurrentMonth = selectedYear === currentYear && index === currentMonthIndex;
                const hasData = total > 0;

                return (
                  <Link
                    key={monthName}
                    to={`/more/year/${selectedYear}/${index}`}
                    className={`card p-4 flex items-center justify-between transition-all duration-200 ring-1 ${
                      isCurrentMonth ? 'ring-teal-500/50 bg-teal-50/30 dark:bg-teal-900/20' : 'ring-transparent hover:ring-slate-200 dark:hover:ring-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
                        isCurrentMonth 
                          ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' 
                          : hasData 
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}>
                        {monthName.substring(0, 3)}
                      </div>
                      <div>
                        <p className={`font-semibold ${isCurrentMonth ? 'text-teal-900 dark:text-teal-100' : 'text-slate-900 dark:text-slate-100'}`}>{monthName}</p>
                        {isCurrentMonth && <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">Current Month</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <p className={`font-bold ${hasData ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
                        ₹{total.toFixed(2)}
                      </p>
                      <ChevronRight className={`h-5 w-5 ${hasData ? 'text-slate-300 dark:text-slate-600' : 'text-slate-200 dark:text-slate-700'}`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
