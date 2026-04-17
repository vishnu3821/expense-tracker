import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Fingerprint, ShieldCheck, Lock } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/profile',
        });
        if (error) throw error;
        alert('Check your email for the password reset link!');
        setIsForgotPassword(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the login link! Or if auto-confirm is enabled, you can now sign in.');
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Explicitly target the root origin to trigger PWA scope
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      
      if (error) throw error;

      // Force a clean replacement to help the OS intercept the navigation
      if (data?.url) {
        window.location.replace(data.url);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 font-sans overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute top-0 right-0 h-[500px] w-[500px] bg-emerald-600/10 blur-[120px] rounded-full -mr-48 -mt-48 animate-pulse" />
      <div className="absolute bottom-0 left-0 h-[500px] w-[500px] bg-teal-600/10 blur-[120px] rounded-full -ml-48 -mb-48" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className={`w-full bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl p-8 mx-auto transition-all duration-500 ${loading ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
          {/* Biometric Scanning Overlay */}
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] animate-in fade-in duration-300">
              <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-emerald-500/20 flex items-center justify-center">
                  <Fingerprint className="h-12 w-12 text-emerald-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 h-24 w-24 rounded-full border-t-4 border-emerald-500 animate-spin" />
              </div>
              <p className="mt-6 text-sm font-black text-emerald-400 uppercase tracking-[0.3em] animate-pulse">Biometric Verification</p>
              <p className="mt-1 text-[10px] text-white/40 font-bold uppercase tracking-widest">Securing Session...</p>
            </div>
          )}

          <div className="text-center mb-10">
            <div className="relative inline-block mb-6 group">
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full group-hover:bg-emerald-500/40 transition-all duration-500" />
              <img src="/website_logo.png" alt="Expense Monitor" className="h-24 w-auto object-contain relative z-10" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter leading-none">
              {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-white/40 mt-3 text-xs font-bold uppercase tracking-widest">
              {isForgotPassword ? 'Enter your email to reset' : (isLogin ? 'Sign in to your account' : 'Join the platform')}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl bg-red-500/10 p-4 text-xs font-bold text-red-400 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">
                <ShieldCheck className="h-3 w-3" />
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-bold placeholder:text-white/20 focus:bg-white/10 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                    <Lock className="h-3 w-3" />
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); }}
                      className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-bold placeholder:text-white/20 focus:bg-white/10 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] h-14 rounded-2xl shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isForgotPassword ? 'Send Link' : (isLogin ? 'Sign In' : 'Sign Up')}
              </button>
            </div>
          </form>

          {!isForgotPassword && (
            <>
              <div className="relative mt-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[10px]">
                  <span className="bg-[#0f172a] px-4 font-black text-white/20 uppercase tracking-[0.3em]">Or continue with</span>
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#10b981"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#059669"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#34d399"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#047857"
                    />
                  </svg>
                  Google
                </button>
              </div>
            </>
          )}

          <div className="mt-10 text-center">
            {isForgotPassword ? (
              <button
                onClick={() => { setIsForgotPassword(false); setError(null); }}
                className="font-black text-[10px] text-white/40 hover:text-white uppercase tracking-[0.3em] transition-all flex items-center justify-center w-full gap-3"
              >
                <span>←</span> Back to login
              </button>
            ) : (
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(null); }}
                  className="text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center space-y-2">
           <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Secure Ledger v4.0.2</p>
           <div className="flex justify-center gap-4 opacity-10">
              <div className="h-1 w-8 bg-white rounded-full" />
              <div className="h-1 w-4 bg-white rounded-full" />
              <div className="h-1 w-12 bg-white rounded-full" />
           </div>
        </div>
      </div>
    </div>
  );
}
