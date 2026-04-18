import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User, Lock, Mail, ShieldCheck, BadgeCheck, Zap, Shield } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Titanium Member</p>
                   </div>
                   <h3 className="text-2xl font-black tracking-tight mt-2">EXPENSE MONITOR</h3>
                </div>
                {/* Holographic Badge */}
                <div className="relative h-14 w-14 rounded-full bg-linear-to-br from-emerald-400 via-teal-200 to-emerald-600 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse">
                   <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center">
                      <BadgeCheck className="h-8 w-8 text-emerald-400" />
                   </div>
                   <div className="absolute inset-0 rounded-full bg-linear-to-tr from-transparent via-white/40 to-transparent opacity-50" />
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Digital Identifier</p>
                   <p className="text-lg font-black tracking-tight truncate max-w-[280px]">{user?.email}</p>
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

      <div className="grid gap-8">
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
      </div>
    </div>
  );
}
