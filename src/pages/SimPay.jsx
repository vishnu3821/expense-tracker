import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Search, Loader2, AlertTriangle,
  CheckCircle2, Wallet, ArrowRight, X, Send
} from 'lucide-react';

const BANK_COLORS = {
  SBI: '#2563eb', HDFC: '#dc2626', ICICI: '#f97316',
  Axis: '#7c3aed', Kotak: '#ca8a04', PNB: '#16a34a',
  Cash: '#64748b', Default: '#6d28d9',
};
const bankColor = (name = '') => {
  const key = Object.keys(BANK_COLORS).find(k => name.toUpperCase().includes(k.toUpperCase()));
  return BANK_COLORS[key] || BANK_COLORS.Default;
};

// ── Processing overlay ──────────────────────────────────────────────────────
function ProcessingOverlay({ step }) {
  const steps = [
    { label: 'Initiating transfer…', icon: '🔄' },
    { label: 'Connecting to bank…',  icon: '🏦' },
    { label: 'Crediting account…',   icon: '💳' },
  ];
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-10 animate-in fade-in duration-300">
      {/* Ripple ring */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-28 w-28 rounded-full bg-violet-500/20 animate-ping" />
        <span className="absolute h-20 w-20 rounded-full bg-violet-500/30 animate-ping" style={{ animationDelay: '0.2s' }} />
        <div className="relative h-16 w-16 rounded-full bg-violet-600 flex items-center justify-center shadow-2xl shadow-violet-500/50">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      </div>
      <div className="space-y-4 w-72">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-500 ${
            i < step ? 'bg-emerald-500/20 text-emerald-400' :
            i === step ? 'bg-white/10 text-white' :
            'opacity-30 text-slate-500'
          }`}>
            <span className="text-xl">{i < step ? '✅' : s.icon}</span>
            <span className="font-semibold text-sm">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Success screen ──────────────────────────────────────────────────────────
function SuccessScreen({ data, onDone, onViewSavings }) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-8 px-6 animate-in fade-in zoom-in-95 duration-400">
      {/* Pulsing green ring */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-40 w-40 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
        <span className="absolute h-28 w-28 rounded-full bg-emerald-500/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
        <div className="relative h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-4xl font-black text-slate-900 dark:text-white">
          ₹{Number(data.amount).toLocaleString('en-IN')}
        </p>
        <p className="text-lg font-semibold text-emerald-600">Sent successfully!</p>
      </div>

      <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 space-y-3 border border-slate-100 dark:border-slate-800">
        {[
          { label: 'To',   value: `${data.toEmail} · ${data.toBank}` },
          { label: 'From', value: `${data.fromBank}` },
          { label: 'UPI ID', value: data.upiId },
          { label: 'Ref',  value: data.ref },
          { label: 'Time', value: data.time },
        ].map(r => (
          <div key={r.label} className="flex justify-between items-start gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">{r.label}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-right break-all">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={onViewSavings}
          className="flex-1 h-12 rounded-2xl border-2 border-violet-500 text-violet-600 font-bold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all">
          View Savings
        </button>
        <button onClick={onDone}
          className="flex-1 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-xl shadow-violet-500/30">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main SimPay page ─────────────────────────────────────────────────────────
export default function SimPay() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Feature flag guard
  const [featureEnabled, setFeatureEnabled] = useState(null);

  // UPI search
  const [digits, setDigits] = useState(['', '', '', '']);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recipient, setRecipient] = useState(null); // { email, bankName, savingsId, userId }

  // Payment form
  const [myAccounts, setMyAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [payError, setPayError] = useState('');

  // Animation
  const [processingStep, setProcessingStep] = useState(-1);
  const [successData, setSuccessData] = useState(null);

  const digitRefs = [useRef(), useRef(), useRef(), useRef()];

  // Check feature flag + load sender's accounts
  useEffect(() => {
    const init = async () => {
      const { data: flag } = await supabase
        .from('feature_flags')
        .select('value')
        .eq('key', 'sim_pay_enabled')
        .maybeSingle();
      setFeatureEnabled(flag?.value !== false);

      if (user) {
        const { data: accs } = await supabase
          .from('user_savings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setMyAccounts(accs || []);
        if (accs?.length) setFromAccountId(accs[0].id);
      }
    };
    init();
  }, [user]);

  // ── UPI Search ─────────────────────────────────────────────────────────
  const handleDigitChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setSearchError('');
    setRecipient(null);
    if (d && i < 3) digitRefs[i + 1].current?.focus();
  };
  const handleDigitKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) digitRefs[i - 1].current?.focus();
  };

  const handleSearch = async () => {
    const id = digits.join('');
    if (id.length < 4) { setSearchError('Enter all 4 digits'); return; }
    setSearching(true);
    setSearchError('');
    setRecipient(null);
    try {
      // Query the user_savings table for a matching upi_id owned by another user
      const { data, error } = await supabase
        .from('user_savings')
        .select('id, bank_name, user_id, upi_id')
        .eq('upi_id', id)
        .maybeSingle();

      if (error || !data) {
        setSearchError(`No account linked to UPI ID "${id}". Ask them to set it in Savings.`);
        return;
      }

      // Get recipeient email from admin_user_emails view
      const { data: emailData } = await supabase
        .from('admin_user_emails')
        .select('email')
        .eq('id', data.user_id)
        .maybeSingle();

      setRecipient({
        savingsId: data.id,
        userId: data.user_id,
        bankName: data.bank_name,
        upiId: data.upi_id,
        email: emailData?.email || 'Unknown User',
      });
    } catch (err) {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  };

  // ── Payment ─────────────────────────────────────────────────────────────
  const handlePay = async () => {
    setPayError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount'); return; }
    if (!fromAccountId) { setPayError('Select an account to pay from'); return; }

    const fromAcc = myAccounts.find(a => a.id === fromAccountId);
    if (!fromAcc) { setPayError('Account not found'); return; }
    if (fromAcc.balance < amt) {
      setPayError(`Insufficient balance in ${fromAcc.bank_name}. Available: ₹${Number(fromAcc.balance).toLocaleString('en-IN')}`);
      return;
    }

    // Self-payment check
    if (recipient.userId === user.id) {
      setPayError('You cannot send money to yourself.');
      return;
    }

    try {
      setProcessingStep(0);
      await new Promise(r => setTimeout(r, 900));
      setProcessingStep(1);

      // 1. Debit sender
      const { error: e1 } = await supabase
        .from('user_savings')
        .update({ balance: fromAcc.balance - amt })
        .eq('id', fromAccountId);
      if (e1) throw e1;

      await new Promise(r => setTimeout(r, 900));
      setProcessingStep(2);

      // 2. Credit receiver (fetch current balance first)
      const { data: recvAcc, error: e2 } = await supabase
        .from('user_savings')
        .select('balance')
        .eq('id', recipient.savingsId)
        .single();
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from('user_savings')
        .update({ balance: recvAcc.balance + amt })
        .eq('id', recipient.savingsId);
      if (e3) throw e3;

      // 3. Log transaction ref
      const ref = 'SIM' + Math.random().toString(36).substring(2, 12).toUpperCase();
      const now = new Date();
      const timestamp = now.toISOString();
      const timeStr = now.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });

      await supabase.from('expenses').insert([
        {
          user_id: user.id,
          name: `UPI Pay to ${recipient.email} · ${recipient.bankName}${note ? ' — ' + note : ''}`,
          amount: amt,
          category: 'UPI Transfer',
          date: timestamp,
          transaction_id: ref,
          payment_mode: 'Sim UPI',
          savings_account_id: fromAccountId,
        },
        {
          user_id: recipient.userId,
          name: `UPI Received from ${user.email} · ${fromAcc.bank_name}${note ? ' — ' + note : ''}`,
          amount: amt,
          category: 'UPI Transfer',
          date: timestamp,
          transaction_id: ref,
          payment_mode: 'Sim UPI',
          savings_account_id: recipient.savingsId,
        },
      ]);

      await new Promise(r => setTimeout(r, 700));
      setProcessingStep(-1);

      setSuccessData({
        amount: amt,
        toEmail: recipient.email,
        toBank: recipient.bankName,
        upiId: recipient.upiId,
        fromBank: fromAcc.bank_name,
        ref,
        time: timeStr,
      });
    } catch (err) {
      console.error(err);
      setProcessingStep(-1);
      setPayError('Payment failed. Please try again.');
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────
  if (featureEnabled === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (featureEnabled === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-4">
        <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl">🔒</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Sim Pay is currently disabled</h2>
        <p className="text-sm text-slate-500">The admin has turned off this feature. Check back later.</p>
        <button onClick={() => navigate('/more')} className="mt-2 px-6 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm">
          Back to More
        </button>
      </div>
    );
  }

  if (successData) {
    return (
      <SuccessScreen
        data={successData}
        onDone={() => navigate('/more')}
        onViewSavings={() => navigate('/more/savings')}
      />
    );
  }

  if (processingStep >= 0) {
    return <ProcessingOverlay step={processingStep} />;
  }

  const upiEntered = digits.join('').length === 4;
  const fromAcc = myAccounts.find(a => a.id === fromAccountId);
  const bcColor = recipient ? bankColor(recipient.bankName) : '#6d28d9';

  return (
    <div className="max-w-md mx-auto pb-32 animate-in fade-in duration-400">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-[2.5rem] mb-6 bg-gradient-to-br from-violet-700 to-indigo-800 px-6 pt-8 pb-10">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative flex items-center gap-4">
          <button onClick={() => navigate('/more')}
            className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-black text-violet-200 uppercase tracking-widest">More</p>
            <h1 className="text-2xl font-black text-white">Sim Pay</h1>
          </div>
        </div>
        <p className="relative mt-3 text-sm text-violet-200 font-medium">
          Send virtual money using a 4-digit UPI ID
        </p>
      </div>

      <div className="px-4 space-y-5">

        {/* No savings account warning */}
        {myAccounts.length === 0 && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">No savings accounts found</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Add a bank account in Savings first to use Sim Pay.
              </p>
              <button onClick={() => navigate('/more/savings')}
                className="mt-2 text-xs font-bold text-amber-700 underline underline-offset-2">
                Go to Savings →
              </button>
            </div>
          </div>
        )}

        {/* Search UPI ID */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Enter UPI ID</p>
          <div className="flex gap-3 justify-center">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={digitRefs[i]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleDigitKey(i, e)}
                className="w-16 h-16 text-center text-3xl font-black rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-violet-700 dark:text-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
              />
            ))}
          </div>

          {searchError && (
            <p className="text-xs text-red-500 font-medium text-center">{searchError}</p>
          )}

          {!recipient && (
            <button onClick={handleSearch} disabled={!upiEntered || searching}
              className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-violet-500/20">
              {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              {searching ? 'Searching…' : 'Find Account'}
            </button>
          )}
        </div>

        {/* Recipient card */}
        {recipient && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sending to</p>
                <button onClick={() => { setRecipient(null); setDigits(['','','','']); }}
                  className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0"
                  style={{ background: bcColor }}>
                  {recipient.bankName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-sm">{recipient.email}</p>
                  <p className="text-xs text-slate-500 font-semibold">{recipient.bankName}</p>
                  <p className="text-xs font-mono text-violet-500 mt-0.5">UPI: {recipient.upiId}</p>
                </div>
              </div>

              {/* Caution banner */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                  <strong>⚠️ Simulated transfer only.</strong> This is NOT a real UPI transaction. No actual money is moved. For manual tracking purposes only.
                </p>
              </div>
            </div>

            {/* Payment form */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Payment Details</p>

              {/* From account */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pay from</label>
                <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition">
                  {myAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} — ₹{Number(a.balance).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
                {fromAcc && (
                  <p className="text-xs text-slate-400 pl-1">
                    Available: <span className="font-bold text-slate-600 dark:text-slate-300">₹{Number(fromAcc.balance).toLocaleString('en-IN')}</span>
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</span>
                  <input type="number" min="1" step="1" placeholder="0"
                    value={amount} onChange={e => { setAmount(e.target.value); setPayError(''); }}
                    className="w-full h-14 pl-9 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xl font-black text-violet-700 dark:text-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition" />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Note <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. Hostel rent share"
                  value={note} onChange={e => setNote(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition" />
              </div>

              {payError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100">
                  <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{payError}</p>
                </div>
              )}

              <button onClick={handlePay}
                disabled={!amount || !fromAccountId || myAccounts.length === 0}
                className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-violet-500/30">
                <Send className="h-5 w-5" />
                Pay {amount ? `₹${Number(amount).toLocaleString('en-IN')}` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
