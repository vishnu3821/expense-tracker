import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  ChevronRight, 
  ArrowLeft, 
  Search, 
  Loader2, 
  FileText, 
  ArrowUpRight, 
  ArrowDownLeft,
  ArrowRight,
  Calendar,
  Wallet,
  MoreVertical,
  Download,
  Filter,
  ToggleLeft,
  ToggleRight,
  Send
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userExpenses, setUserExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [payEnabled, setPayEnabled] = useState(null);
  const [togglingPay, setTogglingPay] = useState(false);
  const [toggleMsg, setToggleMsg] = useState('');

  const isAdmin = user?.email === 'p.vishnuprabhakar@gmail.com';

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      // Load pay feature flag
      supabase
        .from('feature_flags')
        .select('value')
        .eq('key', 'sim_pay_enabled')
        .maybeSingle()
        .then(({ data }) => setPayEnabled(data?.value === true));
    }
  }, [isAdmin]);

  const handleTogglePay = async () => {
    if (togglingPay || payEnabled === null) return;
    setTogglingPay(true);
    const newVal = !payEnabled;
    const { error } = await supabase
      .from('feature_flags')
      .update({ value: newVal, updated_by: user.email, updated_at: new Date().toISOString() })
      .eq('key', 'sim_pay_enabled');
    if (!error) {
      setPayEnabled(newVal);
      setToggleMsg(newVal ? '✅ Sim Pay enabled for all users' : '🔒 Sim Pay disabled');
      setTimeout(() => setToggleMsg(''), 3000);
    }
    setTogglingPay(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 🕵️ Query unique users from the expenses table directly
      // This works if you have the Admin RLS policy enabled
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select('user_id, amount');

      if (error) throw error;

      // Group by user_id to find all users who have logged expenses
      const userMap = {};
      
      // Always include the current admin in the list
      userMap[user.id] = {
        id: user.id,
        email: user.email,
        transaction_count: 0,
        total_spend: 0,
        created_at: new Date().toISOString()
      };

      if (expenses) {
        expenses.forEach(e => {
          if (!userMap[e.user_id]) {
            userMap[e.user_id] = { 
              id: e.user_id, 
              transaction_count: 0, 
              total_spend: 0,
              email: 'Unknown User',
              created_at: new Date().toISOString() // Fallback
            };
          }
          userMap[e.user_id].transaction_count++;
          userMap[e.user_id].total_spend += Number(e.amount);
        });
      }

      // To get real emails and join dates directly from the Auth system via our new secure view
      const { data: userData, error: userError } = await supabase
        .from('admin_user_emails')
        .select('*');

      if (userData) {
        userData.forEach(v => {
          if (!userMap[v.id]) {
            // Include users even if they haven't logged any expenses yet
            userMap[v.id] = {
              id: v.id,
              email: v.email,
              transaction_count: 0,
              total_spend: 0,
              created_at: v.created_at
            };
          } else {
            // Update existing user from expense mapping
            userMap[v.id].email = v.email;
            if (v.created_at) userMap[v.id].created_at = v.created_at;
          }
        });
      }

      setUsers(Object.values(userMap));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserExpenses = async (targetUser) => {
    setLoadingExpenses(true);
    // Don't set selected user until we're sure we have the data or at least the state is safe
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', targetUser.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setUserExpenses(data || []);
      setSelectedUser(targetUser); // Change view only after data is loaded for smoothness
    } catch (err) {
      console.error('Error fetching user expenses:', err);
      setSelectedUser(targetUser); // Still show the view so they can see "Empty" state
      setUserExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.id.includes(searchTerm)
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="h-20 w-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 mb-6">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Access Only</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          This area is restricted to authorized administrative accounts only.
        </p>
      </div>
    );
  }

  if (loading && !selectedUser) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const handleExportUserPDF = async () => {
    if (!userExpenses || userExpenses.length === 0) return;
    setIsGeneratingPdf(true);
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const now = new Date();
      const generatedOn = format(now, 'dd MMM yyyy, hh:mm a');

      // Header Banner
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('User Audit Report', pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Account: ${selectedUser?.email || 'Unknown'}`, pageWidth / 2, 26, { align: 'center' });
      doc.text(`Generated by Admin: ${user.email}`, pageWidth / 2, 32, { align: 'center' });

      // Compute Totals
      const totalAll = userExpenses.reduce((s, e) => s + Number(e?.amount || 0), 0);
      const categoryMap = {};
      userExpenses.forEach(e => {
        const cat = e.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount || 0);
      });
      const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];

      // Summary Cards
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(10, 48, pageWidth - 20, 24, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(10, 48, pageWidth - 20, 24, 3, 3, 'S');

      const cardW = (pageWidth - 40) / 3;
      const cardY = 48;
      const stats = [
        { label: 'Total Spend', value: `Rs. ${totalAll.toLocaleString()}` },
        { label: 'Txn Count', value: `${userExpenses.length}` },
        { label: 'Top Usage', value: topCategory ? topCategory[0] : '—' }
      ];

      stats.forEach((stat, i) => {
        const x = 15 + i * (cardW + 5);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(stat.label.toUpperCase(), x + cardW / 2, cardY + 8, { align: 'center' });
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(stat.value, x + cardW / 2, cardY + 16, { align: 'center' });
      });

      // Transactions Table
      autoTable(doc, {
        startY: 80,
        head: [['Date', 'Description', 'Category', 'Mode', 'Txn ID', 'Amount']],
        body: userExpenses.map(exp => [
          exp?.date ? format(parseISO(exp.date), 'dd MMM yyyy') : '--',
          exp?.name || '—',
          exp?.category || 'Other',
          exp?.payment_mode || 'UPI',
          exp?.transaction_id || '—',
          `Rs. ${Number(exp?.amount || 0).toLocaleString()}`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 10, right: 10 }
      });

      doc.save(`audit_${selectedUser?.email || 'user'}_${format(now, 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF Error:', err);
      alert('Failed to generate PDF Report.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportUserCSV = () => {
    if (!userExpenses || userExpenses.length === 0) return;
    
    const headers = ['Date,Name,Category,Amount,Payment Mode,Transaction ID'];
    const rows = userExpenses.map(exp => {
      const date = format(parseISO(exp.date), 'yyyy-MM-dd');
      const name = `"${(exp.name || '').replace(/"/g, '""')}"`;
      const category = `"${(exp.category || 'Other').replace(/"/g, '""')}"`;
      const amount = exp.amount;
      const mode = exp.payment_mode || 'UPI';
      const txn = `"${(exp.transaction_id || '').replace(/"/g, '""')}"`;
      return `${date},${name},${category},${amount},${mode},${txn}`;
    });

    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_${selectedUser.email}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             {selectedUser ? (
               <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
               >
                 <ArrowLeft className="h-6 w-6" />
               </button>
             ) : (
               <div className="h-12 w-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
                 <Users className="h-6 w-6" />
               </div>
             )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {selectedUser ? 'User Breakdown' : 'Admin Dashboard'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedUser ? `Viewing transactions for ${selectedUser.email}` : 'Manage and monitor all platform users'}
              </p>
            </div>
          </div>
        </div>

        {!selectedUser && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by email or ID..."
              className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm w-full md:w-80 shadow-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {!selectedUser ? (
        /* USER LIST VIEW */
        <div className="space-y-6">

          {/* ─── Feature Controls ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Feature Controls</h3>
                <p className="text-xs text-slate-500">Manage which features are visible to users</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">💸 Sim Pay</p>
                <p className="text-xs text-slate-500 mt-0.5">Allow users to send virtual money via UPI ID</p>
              </div>
              <button
                onClick={handleTogglePay}
                disabled={togglingPay || payEnabled === null}
                className="relative shrink-0 transition-all active:scale-95 disabled:opacity-50"
                title={payEnabled ? 'Click to disable' : 'Click to enable'}
              >
                {payEnabled === null ? (
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                ) : payEnabled ? (
                  <ToggleRight className="h-10 w-10 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-400" />
                )}
              </button>
            </div>

            {toggleMsg && (
              <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl">{toggleMsg}</p>
            )}
          </div>

          {/* ─── User Grid ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.length > 0 ? (
            filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => fetchUserExpenses(u)}
                className="card p-6 text-left group hover:scale-[1.02] active:scale-95 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white transition-all duration-500">
                    <span className="text-lg font-bold uppercase">{u.email?.[0] || 'U'}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md uppercase tracking-wider">
                    {u.id.substring(0, 8)}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate pr-4">
                    {u.email}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    Joined {format(parseISO(u.created_at), 'MMM yyyy')}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Transactions</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {u.transaction_count}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-300 group-hover:text-teal-600 group-hover:border-teal-200 dark:group-hover:border-teal-800 transition-all">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
              <Users className="h-12 w-12 mx-auto text-slate-200 dark:text-slate-800 mb-4" />
              <p className="text-slate-500">No users found matching your search.</p>
            </div>
          )}
        </div>
        </div>
      ) : (
        /* USER DETAIL VIEW (DRILL-DOWN TABLE) */
        <div className="space-y-6">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Total Spend</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{userExpenses.reduce((acc, exp) => acc + Number(exp?.amount || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Transaction Count</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {userExpenses.length}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Latest Activity</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                {(userExpenses.length > 0 && userExpenses[0]?.date) ? format(parseISO(userExpenses[0].date), 'dd MMM yyyy') : 'No activity'}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Avg Transaction</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{userExpenses.length > 0 ? Math.round(userExpenses.reduce((acc, exp) => acc + Number(exp?.amount || 0), 0) / userExpenses.length).toLocaleString() : 0}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">Full Transaction Audit</h3>
              </div>
              <div className="flex gap-3">
                 <button 
                  onClick={handleExportUserPDF}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
                 >
                   {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                   {isGeneratingPdf ? 'Generating...' : 'PDF Report'}
                 </button>
                 <button 
                  onClick={handleExportUserCSV}
                  className="p-2 text-slate-400 hover:text-teal-600 transition-colors border border-slate-100 dark:border-slate-800 rounded-xl"
                  title="Export to CSV"
                 >
                   <Download className="h-4 w-4" />
                 </button>
                 <button className="p-2 text-slate-400 hover:text-teal-600 transition-colors">
                   <Filter className="h-5 w-5" />
                 </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loadingExpenses ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                  <p className="text-sm text-slate-500 mt-4">Retrieving ledger data...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Date</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Details</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Category</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Mode</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">ID</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {userExpenses.map((exp) => (
                      <tr key={exp.id || Math.random()} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 text-[10px] font-bold">
                              {exp?.date ? format(parseISO(exp.date), 'dd') : '--'}
                            </div>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-300">
                              {exp?.date ? format(parseISO(exp.date), 'MMM yyyy') : 'Invalid Date'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                            {exp?.name || 'Untitled Entry'}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full uppercase tracking-tighter">
                            {exp?.category || 'Other'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            {exp?.payment_mode === 'Cash' ? (
                              <Wallet className="h-3 w-3 text-orange-500" />
                            ) : (
                              <ArrowRight className="h-3 w-3 text-teal-500" />
                            )}
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{exp?.payment_mode || 'UPI'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-[80px]">
                            {exp?.transaction_id || '—'}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-sm font-black ${exp?.category === 'Transfer' ? 'text-indigo-600' : 'text-slate-900 dark:text-white'}`}>
                            ₹{Number(exp?.amount || 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {!loadingExpenses && userExpenses.length === 0 && (
              <div className="py-20 text-center">
                <FileText className="h-10 w-10 mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                <p className="text-slate-500">This user has no recorded transactions yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
