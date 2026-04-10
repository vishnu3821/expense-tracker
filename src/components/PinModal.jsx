import React, { useState, useEffect } from 'react';
import { X, Delete, ShieldCheck, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PinModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  mode = 'verify', // 'verify' | 'setup' | 'reset'
  title = 'Enter Transaction PIN' 
}) {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(mode === 'reset' ? 'auth' : 'pin'); // 'auth' | 'pin' | 'confirm'
  const [tempPin, setTempPin] = useState('');
  const [password, setPassword] = useState('');

  // Reset state when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setLoading(false);
      setStep(mode === 'reset' ? 'auth' : 'pin');
      setTempPin('');
      setPassword('');
    }
  }, [isOpen, mode]);

  const handleKeyPress = (val) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (step === 'pin') {
        if (mode === 'verify') {
          handleVerify();
        } else if (mode === 'setup' || mode === 'reset') {
          setTempPin(pin);
          setPin('');
          setStep('confirm');
        }
      } else if (step === 'confirm') {
        if (pin === tempPin) {
          handleSavePin();
        } else {
          setError('PINs do not match. Try again.');
          setPin('');
          setStep('pin');
        }
      }
    }
  }, [pin]);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('transaction_pin')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data.transaction_pin === pin) {
        onSuccess?.();
        onClose();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (err) {
      console.error('PIN Verification Error:', err);
      setError('Failed to verify PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ 
          id: user.id, 
          transaction_pin: pin,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Save PIN Error:', err);
      setError('Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (error) throw error;
      
      setStep('pin');
      setLoading(false);
    } catch (err) {
      setError('Invalid password. Authentication failed.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="p-6 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {step === 'auth' ? 'Verify Identity' : 
               step === 'confirm' ? 'Confirm PIN' : 
               mode === 'setup' ? 'Set New PIN' : title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {step === 'auth' ? (
            <form onSubmit={handleAuthVerify} className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-4">
                  Please enter your account password to reset your transaction PIN.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Account Password</label>
                <input 
                  type="password"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !password}
                className="btn-primary w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base shadow-xl shadow-teal-500/20"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
              </button>
            </form>
          ) : (
            <>
              {/* PIN Display */}
              <div className="flex flex-col items-center gap-6">
                <div className="flex gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div 
                      key={i}
                      className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                        pin.length > i 
                          ? 'bg-teal-600 border-teal-600 scale-125 shadow-lg shadow-teal-500/40' 
                          : 'bg-transparent border-slate-200 dark:border-slate-800'
                      }`}
                    />
                  ))}
                </div>
                {error && (
                  <p className="text-xs font-bold text-red-500 animate-in fade-in zoom-in-95 leading-tight text-center px-4">
                    {error}
                  </p>
                )}
                {step === 'confirm' && !error && (
                  <p className="text-xs font-bold text-teal-600 animate-in fade-in slide-in-from-top-2">
                    Enter it again to confirm.
                  </p>
                )}
              </div>

              {/* Numeric Pad */}
              <div className="grid grid-cols-3 gap-4 pb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num.toString())}
                    className="h-16 w-16 mx-auto rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-xl font-bold text-slate-800 dark:text-white hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-600 dark:hover:text-teal-400 transition-all active:scale-90"
                  >
                    {num}
                  </button>
                ))}
                <div className="flex items-center justify-center">
                  {mode === 'verify' && (
                    <button 
                      onClick={() => setStep('auth')}
                      className="text-[10px] font-bold text-slate-400 hover:text-teal-600 uppercase tracking-widest transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="h-16 w-16 mx-auto rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-xl font-bold text-slate-800 dark:text-white hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-600 dark:hover:text-teal-400 transition-all active:scale-90"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 w-16 mx-auto rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                >
                  <Delete className="h-6 w-6" />
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Footer Info */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border-t border-slate-100 dark:border-slate-800">
           <div className="flex items-center gap-2">
             <Lock className="h-3 w-3 text-slate-400" />
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secure End-to-End Encryption</p>
           </div>
        </div>
      </div>
    </div>
  );
}
