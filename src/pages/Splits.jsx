import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePageGreeting } from '../hooks/usePageGreeting';
import { Loader2, ArrowRightLeft, CheckCircle, HandCoins } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import confetti from 'canvas-confetti';

export default function Splits() {
  usePageGreeting("Here is the money your friends have to pay you.");
  const { user } = useAuth();
  const [splits, setSplits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);

  useEffect(() => {
    if (user) {
      fetchSplits();
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_savings')
        .select('id, bank_name, balance')
        .eq('user_id', user.id);
      if (!error) setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchSplits = async () => {
    try {
      const { data, error } = await supabase
        .from('splits')
        .select(`
          id, friend_name, amount, status, created_at,
          expenses ( name )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSplits(data || []);
    } catch (err) {
      console.error('Error fetching splits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (split) => {
    if (accounts.length === 0) {
       alert("You need a Savings Account to settle debts. Please add one in the Savings page.");
       return;
    }
    
    // We will just add the money to the primary/first savings account for simplicity
    const primaryAccount = accounts[0];
    setSettlingId(split.id);

    try {
      // 1. Mark as settled
      const { error: updateError } = await supabase
        .from('splits')
        .update({ status: 'settled' })
        .eq('id', split.id);
      
      if (updateError) throw updateError;

      // 2. Add money back to savings account
      const newBalance = Number(primaryAccount.balance) + Number(split.amount);
      const { error: accError } = await supabase
        .from('user_savings')
        .update({ balance: newBalance })
        .eq('id', primaryAccount.id);

      if (accError) throw accError;

      fetchSplits();
      fetchAccounts();
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']
      });
      
      try {
        window.speechSynthesis.cancel();
        const text = `Debt settled. ${split.amount} rupees added back to your account.`;
        const utterance = new SpeechSynthesisUtterance(text);
        
        let voices = window.speechSynthesis.getVoices();
        
        const setVoiceAndSpeak = (voicesList) => {
          let selectedVoice = voicesList.find(voice => 
            voice.lang.includes('en-IN') && 
            (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('veena'))
          );
          
          if (!selectedVoice) {
            selectedVoice = voicesList.find(voice => 
              voice.name.toLowerCase().includes('female') || 
              voice.name.toLowerCase().includes('samantha') || 
              voice.name.toLowerCase().includes('victoria') || 
              voice.name.toLowerCase().includes('karen') ||
              voice.name.toLowerCase().includes('zira') ||
              voice.name.toLowerCase().includes('moira') ||
              voice.name.toLowerCase().includes('google uk english female')
            );
          }
          
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
          
          utterance.pitch = 1.1; 
          utterance.rate = 1.0; 
          
          window._currentUtterance = utterance;
          window.speechSynthesis.speak(utterance);
        };

        if (voices.length === 0) {
          const onVoicesChanged = () => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              setVoiceAndSpeak(voices);
              window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        } else {
          setVoiceAndSpeak(voices);
        }
      } catch (e) {
        console.error('Speech playback failed:', e);
      }

    } catch (err) {
      console.error("Error settling split", err);
      alert("Failed to settle debt.");
    } finally {
      setSettlingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const pendingSplits = splits.filter(s => s.status === 'pending');
  const settledSplits = splits.filter(s => s.status === 'settled');
  
  const totalOwed = pendingSplits.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <HandCoins className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          Friends & Splits
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Track money to get back from friends and settle balances.</p>
      </div>

      <div className="card p-6 bg-linear-to-br from-teal-500 to-emerald-600 text-white border-0 shadow-lg shadow-teal-500/20">
        <p className="text-sm font-medium text-teal-50 mb-1 uppercase tracking-wider">Total Money to Get Back</p>
        <h3 className="text-4xl font-black">₹{totalOwed.toLocaleString('en-IN')}</h3>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white">Pending Debts</h3>
        {pendingSplits.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
            Nobody has to pay you back! 🎉
          </div>
        ) : (
          pendingSplits.map(split => (
            <div key={split.id} className="card p-5 flex items-center justify-between border-l-4 border-l-orange-500">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg">
                  {split.friend_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{split.friend_name} has to pay you</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    For {split.expenses?.name || 'an expense'} • {format(parseISO(split.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  ₹{Number(split.amount).toFixed(2)}
                </span>
                <button
                  onClick={() => handleSettle(split)}
                  disabled={settlingId === split.id}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {settlingId === split.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Settle Up
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {settledSplits.length > 0 && (
        <div className="space-y-4 mt-8 opacity-60">
          <h3 className="font-bold text-slate-900 dark:text-white">Settled History</h3>
          {settledSplits.map(split => (
            <div key={split.id} className="card p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Settled with {split.friend_name}
                  </p>
                  <p className="text-[10px] text-slate-500">For {split.expenses?.name || 'expense'}</p>
                </div>
              </div>
              <span className="font-medium text-slate-500 dark:text-slate-400 text-sm">
                ₹{Number(split.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
