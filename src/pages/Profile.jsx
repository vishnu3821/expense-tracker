import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, User, Lock, Mail } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Your Profile</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your account settings and credentials.</p>
      </div>

      {/* Account Info Card */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">Account Information</h3>
            <p className="text-xs text-slate-500">Currently securely authenticated account details.</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <Mail className="h-5 w-5 text-slate-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-500">Registered Email</p>
              <p className="text-base truncate font-medium">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Card */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">Security</h3>
            <p className="text-xs text-slate-500">Update your password to keep your account safe.</p>
          </div>
        </div>
        
        <form onSubmit={handleUpdatePassword} className="p-6 space-y-6">
          {success && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-center gap-3 text-teal-800">
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
              <p className="text-sm font-medium">Password successfully updated!</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">New Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !formData.password}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
