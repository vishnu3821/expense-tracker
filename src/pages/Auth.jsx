import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';

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

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="w-full max-w-md card p-8 mx-auto">
        <div className="text-center mb-8 flex flex-col items-center relative overflow-hidden">
          <img src="/logo.png" alt="Expense Tracker" className="h-32 w-auto object-contain -my-8" />
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight pt-4 relative z-10">
            {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome back' : 'Create an account')}
          </h2>
          <p className="text-slate-500 mt-2 text-sm">
            {isForgotPassword ? 'Enter your email to receive a secure reset link.' : (isLogin ? 'Enter your details to sign in.' : 'Sign up to start tracking expenses.')}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 border border-red-100 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4.5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Email address</label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {!isForgotPassword && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(null); }}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up'))}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500">
          {isForgotPassword ? (
            <button
              onClick={() => { setIsForgotPassword(false); setError(null); }}
              className="font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center w-full gap-2"
            >
              <span>←</span> Back to login
            </button>
          ) : (
            <>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="font-semibold text-teal-600 hover:text-teal-700 underline-offset-4 hover:underline transition-all"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
