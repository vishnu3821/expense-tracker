import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SavingsBiometricLock({ onUnlock }) {
  const navigate = useNavigate();
  
  // Check if PIN has already been configured
  const existingPin = localStorage.getItem('savings_vault_pin');
  const isFirstTimeSetup = !existingPin;

  // Setup state: 'create' | 'confirm' | 'biometric_prompt'
  const [setupStep, setSetupStep] = useState(isFirstTimeSetup ? 'create' : 'unlock');
  const [tempPin, setTempPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Vault Unlocked!');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [showPinPadInUnlock, setShowPinPadInUnlock] = useState(false);

  useEffect(() => {
    // Detect if device supports biometrics (TouchID, FaceID, Android Fingerprint, Windows Hello)
    if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setHasBiometrics(!!available))
        .catch(() => setHasBiometrics(false));
    }

    // If already configured and not first-time setup, auto-trigger biometric prompt
    if (!isFirstTimeSetup) {
      const timer = setTimeout(() => {
        triggerBiometricAuth();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isFirstTimeSetup]);

  const triggerBiometricAuth = async () => {
    setError('');
    setIsAuthenticating(true);

    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // Native WebAuthn prompt for TouchID / FaceID / Device PIN
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "Expense Monitor Savings" },
            user: {
              id: new Uint8Array(16),
              name: "savings_owner",
              displayName: "Savings Owner"
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" },
              { alg: -257, type: "public-key" }
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            },
            timeout: 60000
          }
        });

        if (credential) {
          localStorage.setItem('savings_biometrics_registered', 'true');
          handleFinalUnlock("Vault Unlocked with Biometrics! 🔓");
          return;
        }
      }
      setShowPinPadInUnlock(true);
    } catch (err) {
      console.warn('[Biometrics] Dismissed or unsupported:', err?.name);
      setShowPinPadInUnlock(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFinalUnlock = (message = "Vault Unlocked!") => {
    setIsSuccess(true);
    setSuccessMessage(message);
    sessionStorage.setItem('savings_vault_unlocked', 'true');
    setTimeout(() => {
      onUnlock();
    }, 700);
  };

  const handleDigitPress = (digit) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError('');

    if (nextPin.length === 4) {
      // ── Scenario A: First time setup - Step 1: Create PIN ──
      if (setupStep === 'create') {
        setTempPin(nextPin);
        setPin('');
        setSetupStep('confirm');
        return;
      }

      // ── Scenario B: First time setup - Step 2: Confirm PIN ──
      if (setupStep === 'confirm') {
        if (nextPin === tempPin) {
          localStorage.setItem('savings_vault_pin', nextPin);
          if (hasBiometrics) {
            setSetupStep('biometric_prompt');
          } else {
            handleFinalUnlock("Vault Secured with PIN! 🛡️");
          }
        } else {
          setError('PINs did not match. Please start over.');
          setTimeout(() => {
            setPin('');
            setTempPin('');
            setSetupStep('create');
          }, 800);
        }
        return;
      }

      // ── Scenario C: Standard Unlock Mode ──
      if (setupStep === 'unlock') {
        const storedPin = localStorage.getItem('savings_vault_pin');
        if (nextPin === storedPin) {
          handleFinalUnlock("PIN Verified! 🔓");
        } else {
          setError('Incorrect PIN. Please try again.');
          setTimeout(() => setPin(''), 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811] text-slate-100 overflow-hidden">
      {/* Background cyber ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-teal-500/10 blur-[110px] rounded-full pointer-events-none" />

      {/* Top back button */}
      <button
        onClick={() => navigate('/more')}
        className="absolute top-6 left-6 p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-[2.5rem] bg-slate-900/90 border border-emerald-500/30 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-2xl text-center relative"
      >
        {/* Subtle cyber top border accent */}
        <div className="absolute top-0 left-12 right-12 h-0.5 bg-linear-to-r from-transparent via-emerald-400 to-transparent opacity-80" />

        {/* ── 1. SUCCESS STATE ── */}
        {isSuccess ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-10 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{successMessage}</h3>
            <p className="text-xs text-emerald-400 font-medium">Opening your private savings accounts...</p>
          </motion.div>
        ) : setupStep === 'biometric_prompt' ? (
          /* ── 2. PROMPT TO ENABLE BIOMETRICS AFTER PIN SETUP ── */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-4 space-y-6 flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <Fingerprint className="w-9 h-9 stroke-[1.75]" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-wide uppercase mb-2">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>PIN Created Successfully</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Enable TouchID / FaceID?</h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Unlock your savings instantly with your fingerprint or face without typing your PIN every time.
              </p>
            </div>

            <div className="w-full space-y-2.5 pt-2">
              <button
                onClick={triggerBiometricAuth}
                disabled={isAuthenticating}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{isAuthenticating ? 'Scanning...' : 'Enable TouchID / FaceID'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinalUnlock("Savings Vault Protected! 🛡️")}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all cursor-pointer"
              >
                Skip, Use PIN Only
              </button>
            </div>
          </motion.div>
        ) : setupStep === 'unlock' && !showPinPadInUnlock ? (
          /* ── 3. STANDARD UNLOCK - BIOMETRICS VIEW ── */
          <div className="py-4 space-y-6 flex flex-col items-center">
            {/* Pulsing Biometric Sensor Circle */}
            <div className="relative my-2">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl"
              />
              <button
                onClick={triggerBiometricAuth}
                disabled={isAuthenticating}
                className="relative w-24 h-24 rounded-full bg-linear-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/50 hover:border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-all cursor-pointer group active:scale-95 disabled:opacity-50"
              >
                <Fingerprint className="w-12 h-12 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
                {isAuthenticating && (
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                )}
              </button>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-wide uppercase mb-2">
                <Lock className="w-3 h-3" />
                <span>Savings Vault Protected</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Biometric Security</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Scan your TouchID, FaceID or device biometrics to view your savings accounts.
              </p>
            </div>

            <div className="w-full space-y-3 pt-2">
              <button
                onClick={triggerBiometricAuth}
                disabled={isAuthenticating}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{isAuthenticating ? 'Scanning...' : 'Unlock with TouchID / FaceID'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPinPadInUnlock(true)}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Enter 4-Digit Security PIN</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── 4. PIN KEYPAD VIEW (Used for Create PIN, Confirm PIN, or PIN Unlock) ── */
          <div className="py-2 space-y-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto">
              {setupStep === 'create' || setupStep === 'confirm' ? (
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              ) : (
                <KeyRound className="w-6 h-6" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {setupStep === 'create'
                  ? 'Set Savings Vault PIN'
                  : setupStep === 'confirm'
                  ? 'Confirm Your PIN'
                  : 'Enter Vault PIN'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {setupStep === 'create'
                  ? 'Choose a 4-digit code to protect your savings'
                  : setupStep === 'confirm'
                  ? 'Re-enter the 4-digit code to confirm'
                  : 'Enter your 4-digit PIN to unlock'}
              </p>
            </div>

            {/* PIN Dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    pin.length > idx
                      ? 'bg-emerald-400 scale-125 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                      : 'bg-slate-700 border border-slate-600'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-rose-400 text-xs font-semibold flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-60 mx-auto pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigitPress(num.toString())}
                  className="w-16 h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 text-white font-bold text-lg border border-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  {num}
                </button>
              ))}
              {setupStep === 'unlock' ? (
                <button
                  type="button"
                  onClick={() => setShowPinPadInUnlock(false)}
                  className="w-16 h-12 rounded-2xl text-[11px] font-bold text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  Biometric
                </button>
              ) : (
                <div className="w-16 h-12" />
              )}
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="w-16 h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 text-white font-bold text-lg border border-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="w-16 h-12 rounded-2xl text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ⌫
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
