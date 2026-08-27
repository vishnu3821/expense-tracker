import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User, Lock, Mail, ShieldCheck, BadgeCheck, Zap, Shield, Activity, Wallet, BookOpen, Landmark, Laptop, Monitor, Smartphone, HardDrive, Bell, ToggleRight, ToggleLeft, AtSign, Camera } from 'lucide-react';
import { usePageGreeting } from '../hooks/usePageGreeting';

export default function Profile() {
  usePageGreeting("Welcome to your profile .");
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [usernameMessage, setUsernameMessage] = useState('');

  useEffect(() => {
    if (user?.user_metadata?.username) {
      setUsernameInput(user.user_metadata.username.replace('@', ''));
    }
  }, [user]);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file);
      const fileName = `${Date.now()}-avatar.jpg`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, compressedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload profile photo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalExpenses: 0,
    academicRecords: 0,
    savingsAccounts: 0
  });

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [expensesRes, eduRes, savingsRes] = await Promise.all([
        supabase.from('expenses').select('amount', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('education_fees').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('user_savings').select('id', { count: 'exact' }).eq('user_id', user.id),
      ]);
      
      const totalAmt = (expensesRes.data || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      setStats({
        totalTransactions: expensesRes.count || 0,
        totalExpenses: totalAmt,
        academicRecords: eduRes.count || 0,
        savingsAccounts: savingsRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    const formatted = usernameInput.startsWith('@') ? usernameInput.trim() : '@' + usernameInput.trim();
    if (formatted === user?.user_metadata?.username) return;
    
    setUsernameStatus('checking');
    setUsernameMessage('');
    
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(formatted)}`);
      const data = await res.json();
      
      if (data.taken && formatted.toLowerCase() !== user?.user_metadata?.username?.toLowerCase()) {
        setUsernameStatus('taken');
        setUsernameMessage('This username is already taken.');
        return;
      }
      
      const { error } = await supabase.auth.updateUser({
        data: { username: formatted }
      });
      
      if (error) throw error;
      
      setUsernameStatus('saved');
      setUsernameInput(formatted.replace('@', ''));
      setUsernameMessage('Username successfully claimed!');
      setTimeout(() => setUsernameStatus('idle'), 3000);
      
    } catch (err) {
      setUsernameStatus('error');
      setUsernameMessage(err.message);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) throw error;

      setSuccess(true);
      setFormData({ password: '', confirmPassword: '' });
      setTimeout(() => setSuccess(false), 5000);
      
    } catch (err) {
      setError(err.message || 'An error occurred while updating the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-10 animate-in fade-in duration-500">
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center animate-out fade-out duration-500 delay-1000">
           <div className="relative">
              <div className="h-32 w-32 rounded-3xl border-2 border-emerald-500/30 flex items-center justify-center relative overflow-hidden">
                 <Shield className="h-16 w-16 text-emerald-500 animate-pulse" />
                 <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#10b981] animate-scan-line" />
              </div>
              <div className="absolute -inset-4 border border-white/10 rounded-[2.5rem] animate-ping duration-1000 opacity-20" />
           </div>
           <div className="mt-8 text-center">
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Security Protocol</p>
              <h3 className="text-white text-lg font-bold tracking-tight">Verifying Identity...</h3>
           </div>
        </div>
      )}

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(128px); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Your Identity</h2>
        <p className="text-slate-500 text-sm font-medium">Manage your elite financial credentials.</p>
      </div>

      <div className="relative group perspective-1000">
        <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/10 transition-all duration-700 hover:rotate-y-2">
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
          
          <div className="relative z-10 flex flex-col justify-between h-56">
             <div className="flex justify-between items-start">
                <div className="space-y-1">
                   <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Verified Member</p>
                   </div>
                   <h3 className="text-2xl font-black tracking-tight mt-2">EXPENSE MONITOR</h3>
                </div>
                {/* Holographic Badge / Avatar */}
                <div className="relative h-14 w-14 group">
                   <input
                     type="file"
                     ref={fileInputRef}
                     onChange={handleAvatarUpload}
                     accept="image/*"
                     className="hidden"
                   />
                   <div 
                     onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                     className={`relative h-14 w-14 rounded-full bg-linear-to-br from-emerald-400 via-teal-200 to-emerald-600 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer hover:scale-105 transition-transform ${isUploading ? 'animate-pulse' : ''}`}
                   >
                      <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden relative">
                        {isUploading ? (
                          <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
                        ) : user?.user_metadata?.avatar_url ? (
                          <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <BadgeCheck className="h-8 w-8 text-emerald-400" />
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-full bg-linear-to-tr from-transparent via-white/40 to-transparent opacity-50 pointer-events-none" />
                   </div>
                   
                   {/* Popout Menu */}
                   {showAvatarMenu && (
                     <>
                       <div className="fixed inset-0 z-40" onClick={() => setShowAvatarMenu(false)} />
                       <div className="absolute right-16 top-1/2 -translate-y-1/2 w-48 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
                         <button 
                           onClick={() => { fileInputRef.current?.click(); setShowAvatarMenu(false); }}
                           className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-colors text-left"
                         >
                           <Camera className="h-4 w-4 text-emerald-400" />
                           Update Picture
                         </button>
                         {user?.user_metadata?.avatar_url && (
                           <button 
                             onClick={async () => {
                               setShowAvatarMenu(false);
                               setIsUploading(true);
                               await supabase.auth.updateUser({ data: { avatar_url: null } });
                               setIsUploading(false);
                             }}
                             className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:bg-white/5 transition-colors text-left"
                           >
                             <AlertCircle className="h-4 w-4" />
                             Remove Picture
                           </button>
                         )}
                       </div>
                     </>
                   )}
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Digital Identifier</p>
                   <p className="text-lg font-black tracking-tight truncate max-w-70">{user?.user_metadata?.username || user?.email}</p>
                   {user?.user_metadata?.username && <p className="text-xs font-medium text-slate-400 mt-1">{user.email}</p>}
                </div>
                <div className="flex justify-between items-end">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Member Since</p>
                      <p className="text-xs font-bold tracking-widest">EST. {user?.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Network Status</p>
                      <div className="flex items-center gap-2 justify-end mt-1">
                         <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                         <span className="text-[10px] font-black uppercase">Encrypted</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Background Patterns */}
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-40 w-40 bg-teal-500/5 blur-[60px] rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Account Statistics */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-4xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
               <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transactions</p>
               <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{stats.totalTransactions}</p>
            </div>
         </div>
         <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-4xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
               <Wallet className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
               <p className="text-lg font-black text-slate-900 dark:text-white mt-1">₹{stats.totalExpenses.toLocaleString('en-IN')}</p>
            </div>
         </div>
         <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-4xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
               <BookOpen className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Records</p>
               <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{stats.academicRecords}</p>
            </div>
         </div>
         <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-4xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
               <Landmark className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Savings Accounts</p>
               <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{stats.savingsAccounts}</p>
            </div>
         </div>
      </div>

      <div className="grid gap-8">
        {/* Username Card */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 group">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <AtSign className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Identity Tag</h3>
              <p className="text-xs text-slate-500 font-medium">Claim your unique public identifier.</p>
            </div>
          </div>
          
          <form onSubmit={handleUpdateUsername} className="space-y-6">
            {usernameStatus === 'saved' && (
              <div className="rounded-2xl bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 border border-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <CheckCircle className="h-5 w-5" />
                <p>{usernameMessage}</p>
              </div>
            )}

            {(usernameStatus === 'error' || usernameStatus === 'taken') && (
              <div className="rounded-2xl bg-red-500/10 p-4 text-xs font-bold text-red-400 border border-red-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{usernameMessage}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                <User className="h-3 w-3" />
                New Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-10 text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                  placeholder="vishnu1720"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    if (usernameStatus !== 'idle') setUsernameStatus('idle');
                  }}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={usernameStatus === 'checking' || (usernameInput && '@' + usernameInput === user?.user_metadata?.username)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] h-14 rounded-2xl shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {usernameStatus === 'checking' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                {usernameStatus === 'checking' ? 'Verifying...' : 'Claim Username'}
              </button>
            </div>
          </form>
        </div>

        {/* Security / Update Card */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 group">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Lock className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Security Protocol</h3>
              <p className="text-xs text-slate-500 font-medium">Update your encrypted access credentials.</p>
            </div>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            {success && (
              <div className="rounded-2xl bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 border border-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <CheckCircle className="h-5 w-5" />
                <p>Credential sequence updated successfully.</p>
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-500/10 p-4 text-xs font-bold text-red-400 border border-red-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 focus:border-emerald-500/50 outline-none transition-all shadow-sm"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 focus:border-emerald-500/50 outline-none transition-all shadow-sm"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !formData.password}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Update Access
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Device Management */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 group">
          <div className="flex items-center gap-4 mb-8">
             <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                <Laptop className="h-6 w-6 text-emerald-400" />
             </div>
             <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Device Management</h3>
                <p className="text-xs text-slate-500 font-medium">Active sessions across your devices.</p>
             </div>
          </div>
          
          <div className="space-y-4">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 gap-4">
                <div className="flex items-center gap-4">
                   <Monitor className="h-8 w-8 text-slate-400 shrink-0" />
                   <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">MacBook Air M4</h4>
                      <p className="text-[10px] font-bold text-slate-500">Firefox <span className="text-emerald-500 ml-1">• Active now</span></p>
                   </div>
                </div>
                <button className="text-[10px] font-bold text-red-500 uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors sm:ml-auto border border-red-500/20">Logout this device</button>
             </div>
             
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 gap-4">
                <div className="flex items-center gap-4">
                   <Smartphone className="h-8 w-8 text-slate-400 shrink-0" />
                   <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Poco F6</h4>
                      <p className="text-[10px] font-bold text-slate-500">PWA Installed <span className="ml-1">• Last Active 2 minutes ago</span></p>
                   </div>
                </div>
                <button className="text-[10px] font-bold text-red-500 uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-xl transition-colors sm:ml-auto border border-red-500/20">Logout this device</button>
             </div>
          </div>
          
          <div className="mt-6">
             <button className="w-full py-4 rounded-2xl border-2 border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">Logout all devices</button>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 group">
          <div className="flex items-center gap-4 mb-6">
             <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                <HardDrive className="h-6 w-6 text-emerald-400" />
             </div>
             <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Storage Usage</h3>
                <p className="text-xs text-slate-500 font-medium">Receipts and documents allocation.</p>
             </div>
          </div>
          <div className="space-y-3">
             <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-900 dark:text-white">4.3 GB Used</span>
                <span className="text-slate-500">50 GB Available</span>
             </div>
             <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[8.6%] rounded-full shadow-[0_0_10px_#10b981]" />
             </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8 group">
          <div className="flex items-center gap-4 mb-8">
             <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                <Bell className="h-6 w-6 text-emerald-400" />
             </div>
             <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Notification Settings</h3>
                <p className="text-xs text-slate-500 font-medium">Manage your alerting preferences.</p>
             </div>
          </div>
          
          <div className="space-y-4">
             {[{label: 'Daily Summary', state: true}, {label: 'Budget Alerts', state: true}, {label: 'Fee Reminders', state: true}, {label: 'Educational Alerts', state: false}].map((item, idx) => (
               <div key={idx} className="flex items-center justify-between p-5 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-emerald-500/30 transition-colors">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span>
                  {item.state ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-slate-400" />}
               </div>
             ))}
          </div>
        </div>

      </div>
    </div>
  );
}
