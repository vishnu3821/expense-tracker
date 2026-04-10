import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, User, Lock, Mail, ShieldCheck } from 'lucide-react';
import PinModal from '../components/PinModal';

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

  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState('setup'); // 'setup' | 'reset' | 'verify'

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  React.useEffect(() => {
    if (user) checkPinStatus();
  }, [user]);

  const checkPinStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('transaction_pin')
        .eq('id', user.id)
        .single();
      
      if (data?.transaction_pin) {
        setHasPin(true);
      }
    } catch (err) {
      console.error('Error checking PIN status:', err);
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

      {/* Transaction Security Card */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">Transaction Security</h3>
            <p className="text-xs text-slate-500">Enable or change your 4-digit transaction PIN.</p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${hasPin ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">4-Digit UPI-style PIN</p>
                <p className="text-xs text-slate-500">{hasPin ? 'Secureely set and protection active' : 'Not setup yet'}</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {hasPin ? (
                <>
                  <button 
                    onClick={() => { setPinMode('verify'); setShowPinModal(true); }}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-white transition-colors"
                  >
                    Change
                  </button>
                  <button 
                    onClick={() => { setPinMode('reset'); setShowPinModal(true); }}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Forgot?
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => { setPinMode('setup'); setShowPinModal(true); }}
                  className="w-full sm:w-auto btn-primary px-8"
                >
                  Setup PIN
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <PinModal 
        isOpen={showPinModal}
        mode={pinMode}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          if (pinMode === 'verify') {
             // If verified, allow change
             setPinMode('setup');
             setShowPinModal(true);
          } else {
            setHasPin(true);
            setSuccess(true);
            checkPinStatus();
            setTimeout(() => setSuccess(false), 3000);
          }
        }}
      />
    </div>
  );
}
