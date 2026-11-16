import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Sparkles, Radio, Check, X, Volume2 } from 'lucide-react';

// Futuristic 2-tone Wake Up Chime (A4 -> E5 -> A5)
const playWakeChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First tone (523Hz - C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.19);

    // Second chime (880Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.28);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignore audio restriction
  }
};

/**
 * Robust phonetic & fuzzy wake phrase matcher.
 * Handles Apple/Google STT variations ("hey expense", "hey expensive", "add expense", etc.)
 */
function isWakePhraseMatch(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const t = rawText.toLowerCase().trim();

  // 1. Direct matches & common variations
  const directPhrases = [
    'hey expense', 'hey expenses', 'hi expense', 'hi expenses', 
    'ok expense', 'okay expense', 'hello expense', 'a expense', 
    'the expense', 'hay expense', 'add expense', 'new expense', 
    'open expense', 'log expense', 'track expense'
  ];

  if (directPhrases.some(phrase => t.includes(phrase))) {
    return true;
  }

  // 2. Common Apple/Google speech recognition mishearings for "Hey Expense"
  const phoneticMishearings = [
    'hey expensive', 'hey expand', 'hey express', 'hey expander', 
    'high expense', 'bye expense', 'pay expense', 'say expense',
    'the expensive', 'my expense', 'a expensive'
  ];

  if (phoneticMishearings.some(phrase => t.includes(phrase))) {
    return true;
  }

  // 3. Keyword co-occurrence: Trigger word + Expense word
  const hasTriggerWord = /\b(hey|hi|hello|ok|okay|add|open|new|log|record)\b/i.test(t);
  const hasExpenseWord = /\b(expense|expenses|expensive)\b/i.test(t);
  if (hasTriggerWord && hasExpenseWord) {
    return true;
  }

  // 4. Standalone clear "expense" / "expenses" utterance
  if (/^(hey|hi|ok)?\s*(expense|expenses)!?$/i.test(t)) {
    return true;
  }

  return false;
}

export default function WakeWordListener() {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('hey_expense_wake_word') === 'true';
  });
  const [isAwake, setIsAwake] = useState(false);
  const [isModalActive, setIsModalActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [needsGestureActivation, setNeedsGestureActivation] = useState(false);
  const [recentHeard, setRecentHeard] = useState('');

  const recognitionRef = useRef(null);
  const isEnabledRef = useRef(isEnabled);
  const isModalActiveRef = useRef(false);
  const restartTimerRef = useRef(null);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
    localStorage.setItem('hey_expense_wake_word', isEnabled ? 'true' : 'false');
  }, [isEnabled]);

  useEffect(() => {
    isModalActiveRef.current = isModalActive;
  }, [isModalActive]);

  // Handle modal state changes to pause background wake listener during active modal session
  useEffect(() => {
    const handleModalOpen = () => {
      setIsModalActive(true);
      isModalActiveRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      setIsListening(false);
    };

    const handleModalClose = () => {
      setIsModalActive(false);
      isModalActiveRef.current = false;
      setTimeout(() => {
        if (isEnabledRef.current && !isModalActiveRef.current) {
          startWakeListening();
        }
      }, 500);
    };

    window.addEventListener('voice-modal-opened', handleModalOpen);
    window.addEventListener('voice-modal-closed', handleModalClose);

    return () => {
      window.removeEventListener('voice-modal-opened', handleModalOpen);
      window.removeEventListener('voice-modal-closed', handleModalClose);
    };
  }, []);

  // Trigger assistant wake up
  const triggerWakeUp = useCallback(() => {
    if (!isEnabledRef.current || isModalActiveRef.current) return;
    playWakeChime();
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 80]);

    setIsAwake(true);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      setIsListening(false);
    }

    // Dispatch event to open Voice Assistant
    window.dispatchEvent(new CustomEvent('open-voice-assistant', { detail: { wakeWord: true } }));

    setTimeout(() => {
      setIsAwake(false);
    }, 2800);
  }, []);

  // Start background continuous recognition
  const startWakeListening = useCallback(async () => {
    if (!isEnabledRef.current || isModalActiveRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3; // Check multiple hypotheses

      recognition.onstart = () => {
        setIsListening(true);
        setNeedsGestureActivation(false);
      };

      recognition.onresult = (event) => {
        if (!isEnabledRef.current || isModalActiveRef.current) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          // Check all alternative hypotheses provided by browser STT
          for (let alt = 0; alt < event.results[i].length; alt++) {
            const transcript = event.results[i][alt]?.transcript;
            if (transcript) {
              setRecentHeard(transcript);

              if (isWakePhraseMatch(transcript)) {
                triggerWakeUp();
                return;
              }
            }
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setIsListening(false);
          setNeedsGestureActivation(true);
        } else if (event.error !== 'no-speech') {
          console.debug('Wake listener notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Automatically restart if still enabled and modal is not open
        if (isEnabledRef.current && !isModalActiveRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (isEnabledRef.current && !isModalActiveRef.current) {
              try {
                recognition.start();
                setIsListening(true);
              } catch {
                // ignore
              }
            }
          }, 600);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setNeedsGestureActivation(false);
    } catch (err) {
      console.debug('Wake recognition start prevented without gesture:', err);
      setNeedsGestureActivation(true);
      setIsListening(false);
    }
  }, [triggerWakeUp]);

  // Request browser microphone permission via direct user gesture
  const handleExplicitActivation = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release stream and start continuous listener
        stream.getTracks().forEach(track => track.stop());
      }
      setNeedsGestureActivation(false);
      setIsEnabled(true);
      startWakeListening();
      playWakeChime();
    } catch (err) {
      console.error('Microphone permission request error:', err);
      alert('Please allow microphone permissions in Safari / Chrome settings to use "Hey Expense".');
    }
  };

  // Initial mount: try to start listening
  useEffect(() => {
    if (isEnabled) {
      startWakeListening();
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      setIsListening(false);
    };
  }, [isEnabled, startWakeListening]);

  // Handle global activate request from Topbar or user interaction
  useEffect(() => {
    const handleGlobalWakeRequest = () => {
      if (isEnabledRef.current && !isListening) {
        startWakeListening();
      }
    };

    const handleToggle = (e) => {
      const next = e?.detail?.enabled !== undefined ? e.detail.enabled : !isEnabledRef.current;
      setIsEnabled(next);
      isEnabledRef.current = next;
      localStorage.setItem('hey_expense_wake_word', next ? 'true' : 'false');

      if (!next) {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch { /* ignore */ }
          recognitionRef.current = null;
        }
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        setIsListening(false);
      } else {
        setTimeout(() => startWakeListening(), 200);
      }
    };

    window.addEventListener('activate-wake-word', handleGlobalWakeRequest);
    window.addEventListener('toggle-wake-word', handleToggle);

    return () => {
      window.removeEventListener('activate-wake-word', handleGlobalWakeRequest);
      window.removeEventListener('toggle-wake-word', handleToggle);
    };
  }, [isListening, startWakeListening]);

  return (
    <>
      {/* 1-Tap Wake Word Activation Pill (If Safari / browser requires initial user click) */}
      <AnimatePresence>
        {needsGestureActivation && isEnabled && !isModalActive && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 right-4 z-40"
          >
            <button
              onClick={handleExplicitActivation}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 border border-teal-400/50 hover:border-teal-400 text-white rounded-2xl shadow-xl shadow-teal-500/20 text-xs font-bold transition-all active:scale-95 group cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors">
                <Mic className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <p className="text-[11px] text-teal-400 font-extrabold">Tap to Activate</p>
                <p className="text-[10px] text-slate-300">"Hey Expense" Voice Wake</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating HUD banner when "Hey Expense" wakes up */}
      <AnimatePresence>
        {isAwake && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-900/95 border border-teal-400/60 rounded-full shadow-2xl shadow-teal-500/30 text-white backdrop-blur-xl">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
              <Sparkles className="w-4 h-4 text-teal-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-xs font-bold tracking-wide">
                "Hey Expense" Detected! Waking up...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
