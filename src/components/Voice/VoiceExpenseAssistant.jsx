import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Volume2, VolumeX, X, ArrowRight, ArrowLeft, 
  Check, Sparkles, RefreshCw, Calendar, Tag, IndianRupee, 
  FileText, CheckCircle2, AlertCircle, Radio, Clock, CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  extractAmountFromVoice, 
  CATEGORY_DEFINITIONS, 
  parseVoiceCategory, 
  inferCategoryFromName, 
  parseVoiceDate, 
  cleanExpenseName 
} from '../../utils/voiceParser';

const STEPS = [
  { id: 1, key: 'name', label: 'Name', question: 'What did you spend on?' },
  { id: 2, key: 'amount', label: 'Amount', question: 'How much was it?' },
  { id: 3, key: 'category', label: 'Category', question: 'Which category fits this expense?' },
  { id: 4, key: 'date', label: 'Date', question: 'When did this expense happen?' },
  { id: 5, key: 'review', label: 'Review & Save', question: 'Here is your expense. Looks good?' }
];

const SUGGESTED_NAMES = ['Dinner with Friends', 'Swiggy Food', 'Petrol / Fuel', 'Groceries', 'Uber Ride', 'Coffee & Snacks'];
const QUICK_AMOUNTS = [100, 250, 490, 500, 1000, 2000];

// Subtle Web Audio Chime
const playChime = (type = 'step') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'step') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    }
  } catch {
    // Ignore audio context restrictions
  }
};

export default function VoiceExpenseAssistant() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pendingAdvanceStep, setPendingAdvanceStep] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'Food & Dining',
    note: '',
    date: new Date().toISOString().split('T')[0]
  });

  // State refs to prevent stale closures in continuous recognition
  const currentStepRef = useRef(1);
  const formDataRef = useRef(formData);
  const isOpenRef = useRef(false);
  const isSavingRef = useRef(false);
  const saveSuccessRef = useRef(false);
  const recognitionRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const speechDebounceTimerRef = useRef(null);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);
  useEffect(() => { saveSuccessRef.current = saveSuccess; }, [saveSuccess]);

  // Reset form and step on open
  const resetAssistant = useCallback(() => {
    setCurrentStep(1);
    currentStepRef.current = 1;
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
    setIsSaving(false);
    setSaveSuccess(false);
    setPendingAdvanceStep(null);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);

    const initialForm = {
      name: '',
      amount: '',
      category: 'Food & Dining',
      note: '',
      date: new Date().toISOString().split('T')[0]
    };
    setFormData(initialForm);
    formDataRef.current = initialForm;
  }, []);

  // Soft text-to-speech prompt
  const speakPrompt = useCallback((text) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }, [isMuted]);

  // Immediate step transition
  const executeAdvanceStep = useCallback((nextStep) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setPendingAdvanceStep(null);
    playChime('step');
    setCurrentStep(nextStep);
    currentStepRef.current = nextStep;
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);

    if (nextStep === 2) {
      speakPrompt('How much was it?');
    } else if (nextStep === 3) {
      speakPrompt(`Category? ${formDataRef.current.category}?`);
    } else if (nextStep === 4) {
      speakPrompt('When did this happen?');
    } else if (nextStep === 5) {
      speakPrompt('Looks good? Say save it.');
    }
  }, [speakPrompt]);

  // Schedule auto-advance with 1.2s buffer so user can see what was captured
  const scheduleAdvanceStep = useCallback((nextStep) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setPendingAdvanceStep(nextStep);

    advanceTimerRef.current = setTimeout(() => {
      executeAdvanceStep(nextStep);
    }, 1200);
  }, [executeAdvanceStep]);

  // Save Expense to Supabase
  const handleSaveExpense = useCallback(async () => {
    const currentData = formDataRef.current;
    if (!user || !currentData.name || !currentData.amount || isSavingRef.current) return;

    setIsSaving(true);
    isSavingRef.current = true;
    setErrorMessage(null);

    try {
      const now = new Date();
      const expenseDate = new Date(currentData.date);
      expenseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      // Include spoken note in name if present
      const finalName = currentData.note 
        ? `${currentData.name.trim()} • ${currentData.note.trim()}`
        : currentData.name.trim();

      // STRICT SCHEMA: Verified columns matching AddExpense
      const { error } = await supabase.from('expenses').insert([
        {
          user_id: user.id,
          name: finalName,
          amount: parseFloat(currentData.amount),
          category: currentData.category,
          date: expenseDate.toISOString(),
          payment_mode: 'UPI'
        }
      ]);

      if (error) throw error;

      // Confetti & Haptic celebration
      playChime('success');
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 }
      });
      if ('vibrate' in navigator) {
        navigator.vibrate([40, 60, 40]);
      }

      setSaveSuccess(true);
      saveSuccessRef.current = true;
      speakPrompt('Expense saved!');

      // Notify dashboard & lists to refresh immediately
      window.dispatchEvent(new CustomEvent('expense-added'));

      // Automatically close after 1.8 seconds
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      console.error('Error saving voice expense:', err);
      setErrorMessage('Failed to save expense: ' + (err.message || 'Unknown database error'));
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [user, speakPrompt]);

  // Process FINAL, COMPLETE spoken phrase (never interim syllables)
  const processFinalSpeech = useCallback((fullSpokenText) => {
    const trimmed = fullSpokenText.trim();
    if (!trimmed) return;

    const step = currentStepRef.current;
    const currentForm = formDataRef.current;

    if (step === 1) {
      // Step 1: Expense Name
      const cleanName = cleanExpenseName(trimmed);
      if (cleanName && cleanName.length >= 2) {
        const predictedCategory = inferCategoryFromName(cleanName);
        const updated = {
          ...currentForm,
          name: cleanName,
          category: predictedCategory !== 'Other' ? predictedCategory : currentForm.category
        };
        setFormData(updated);
        formDataRef.current = updated;
        if ('vibrate' in navigator) navigator.vibrate(30);
        scheduleAdvanceStep(2);
      } else {
        setErrorMessage(`Couldn't catch an expense name from "${trimmed}". Try saying "Petrol" or "Dinner".`);
      }
    } else if (step === 2) {
      // Step 2: Amount (Handled with enhanced parser)
      const parsedAmount = extractAmountFromVoice(trimmed);
      if (parsedAmount && parsedAmount > 0) {
        const updated = { ...currentForm, amount: parsedAmount };
        setFormData(updated);
        formDataRef.current = updated;
        if ('vibrate' in navigator) navigator.vibrate(30);
        scheduleAdvanceStep(3);
      } else {
        setErrorMessage(`Could not extract amount from "${trimmed}". Say e.g. "490" or "two fifty".`);
      }
    } else if (step === 3) {
      // Step 3: Category & Optional Note
      const lower = trimmed.toLowerCase();
      if (lower.includes('yes') || lower.includes('correct') || lower.includes('next') || lower.includes('same') || lower.includes('yeah')) {
        scheduleAdvanceStep(4);
        return;
      }

      // Extract spoken category and optional note (e.g. "Wellness note yoga class")
      let categoryPart = trimmed;
      let notePart = '';

      // Match patterns like: "Wellness note yoga class", "Food with note dinner with John", "note team lunch"
      const notePattern = /^(?:(.*?)\s+)?(?:with\s+)?(?:note|notes|memo|detail|details|remark|remarks|desc|description)\s*[:\-]?\s*(.+)$/i;
      const noteMatch = trimmed.match(notePattern);
      if (noteMatch) {
        if (noteMatch[1] && noteMatch[1].trim()) {
          categoryPart = noteMatch[1].trim();
        } else {
          categoryPart = currentForm.category || 'Other';
        }
        notePart = noteMatch[2]?.trim() || '';
      }

      // Check standard categories first (only canonical names or explicit standard aliases)
      const standardCanonical = {
        'food': 'Food & Dining',
        'food and dining': 'Food & Dining',
        'food & dining': 'Food & Dining',
        'dining': 'Food & Dining',
        'transport': 'Transport',
        'travel': 'Transport',
        'shopping': 'Shopping',
        'entertainment': 'Entertainment',
        'utilities': 'Utilities',
        'utility': 'Utilities',
        'bills': 'Utilities',
        'health': 'Health',
        'medical': 'Health',
        'housing': 'Housing',
        'rent': 'Housing',
        'other': 'Other',
        'misc': 'Other'
      };

      const normalizedCatPart = categoryPart.toLowerCase().trim();
      let resolvedCategory = standardCanonical[normalizedCatPart];

      // If user specified ANY new custom category (e.g. "Wellness", "Donation", "Books", "Gym"): GO WITH IT!
      if (!resolvedCategory) {
        resolvedCategory = categoryPart
          .split(/\s+/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }

      const cleanNote = notePart ? (notePart.charAt(0).toUpperCase() + notePart.slice(1)) : (currentForm.note || '');
      const updated = { ...currentForm, category: resolvedCategory, note: cleanNote };
      setFormData(updated);
      formDataRef.current = updated;
      if ('vibrate' in navigator) navigator.vibrate(30);
      scheduleAdvanceStep(4);
    } else if (step === 4) {
      // Step 4: Date
      const lower = trimmed.toLowerCase();
      if (lower.includes('today') || lower.includes('yesterday') || lower.includes('kal') || lower.includes('yes') || lower.includes('next') || lower.includes('now')) {
        const parsedDate = parseVoiceDate(trimmed);
        const updated = { ...currentForm, date: parsedDate };
        setFormData(updated);
        formDataRef.current = updated;
        if ('vibrate' in navigator) navigator.vibrate(30);
        scheduleAdvanceStep(5);
      }
    } else if (step === 5) {
      // Step 5: Save confirmation (Matches: "save", "save it", "yeah save it", "yes", "sure", etc.)
      const lower = trimmed.toLowerCase();
      const isAffirmative = 
        lower.includes('save') ||
        lower.includes('yeah') ||
        lower.includes('yes') ||
        lower.includes('yep') ||
        lower.includes('yup') ||
        lower.includes('confirm') ||
        lower.includes('sure') ||
        lower.includes('done') ||
        lower.includes('good') ||
        lower.includes('ok') ||
        lower.includes('correct') ||
        lower.includes('proceed');

      if (isAffirmative && !isSavingRef.current && !saveSuccessRef.current) {
        handleSaveExpense();
      }
    }
  }, [scheduleAdvanceStep, handleSaveExpense]);

  // Start continuous speech recognition with strict isFinal / pause isolation
  const startContinuousListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. You can still tap through!');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 2;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript;
          } else {
            interimChunk += res[0].transcript;
          }
        }

        // Live interim display for real-time visual feedback
        if (interimChunk) {
          setInterimTranscript(interimChunk);
        }

        // When a completed final phrase is delivered
        if (finalChunk) {
          const cleanFinal = finalChunk.trim();
          setTranscript(cleanFinal);
          setInterimTranscript('');
          processFinalSpeech(cleanFinal);
        } else if (interimChunk) {
          // Debounce: if the user paused for 900ms after speaking interim words, process it as complete phrase
          if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
          speechDebounceTimerRef.current = setTimeout(() => {
            const debouncedText = interimChunk.trim();
            if (debouncedText.length >= 2) {
              setTranscript(debouncedText);
              setInterimTranscript('');
              processFinalSpeech(debouncedText);
            }
          }, 950);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setIsListening(false);
          setErrorMessage('Microphone access was denied. Please allow microphone permission.');
        } else if (event.error !== 'no-speech') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        // Auto-reconnect if modal is still open
        if (isOpenRef.current && !saveSuccessRef.current && !isSavingRef.current) {
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Error starting continuous recognition:', err);
      setIsListening(false);
    }
  }, [processFinalSpeech]);

  // Open modal handler
  useEffect(() => {
    const handleOpen = (e) => {
      resetAssistant();
      setIsOpen(true);
      isOpenRef.current = true;
      window.dispatchEvent(new CustomEvent('voice-modal-opened'));

      const isFromWakeWord = Boolean(e?.detail?.wakeWord);
      setTimeout(() => {
        startContinuousListening();
        speakPrompt(isFromWakeWord ? 'Hey! What did you spend on?' : 'What did you spend on?');
      }, 100);
    };

    window.addEventListener('open-voice-assistant', handleOpen);
    return () => window.removeEventListener('open-voice-assistant', handleOpen);
  }, [resetAssistant, startContinuousListening, speakPrompt]);

  // Stop everything
  const handleClose = useCallback(() => {
    isOpenRef.current = false;
    window.dispatchEvent(new CustomEvent('voice-modal-closed'));

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsListening(false);
    setIsOpen(false);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-slate-900 border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-teal-500/10 text-white overflow-hidden"
        >
          {/* Ambient Glowing Background Effect */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header Controls */}
          <div className="flex items-center justify-between relative z-10 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide uppercase text-teal-400">Voice Assistant</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Continuous Mic Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isMuted) window.speechSynthesis?.cancel();
                  setIsMuted(!isMuted);
                }}
                className={`p-2 rounded-xl border transition-all ${
                  isMuted 
                    ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white' 
                    : 'border-teal-500/30 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
                }`}
                title={isMuted ? 'Unmute Voice Prompts' : 'Mute Voice Prompts'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step Progress Indicators */}
          <div className="flex items-center justify-between gap-1.5 mb-6 relative z-10">
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-400'
                        : isCurrent
                        ? 'bg-linear-to-r from-teal-400 to-emerald-400 shadow-sm shadow-teal-400/50'
                        : 'bg-slate-800'
                    }`}
                  />
                  <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
                    isCurrent ? 'text-teal-400 font-bold' : isCompleted ? 'text-emerald-400' : 'text-slate-600'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Success Screen */}
          {saveSuccess ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-10 flex flex-col items-center text-center relative z-10"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-1">Expense Logged!</h4>
              <p className="text-sm text-slate-300">
                ₹{formData.amount} for <span className="text-teal-400 font-semibold">{formData.name}</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">Closing automatically...</p>
            </motion.div>
          ) : (
            <div className="relative z-10">
              {/* Question Banner */}
              <div className="text-center mb-5">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 mb-2">
                  Step {currentStep} of 5 • {STEPS[currentStep - 1]?.label}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {STEPS[currentStep - 1]?.question}
                </h2>
              </div>

              {/* Pulsating Wave & Continuous Listening Visualizer */}
              <div className="flex flex-col items-center justify-center my-4">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <>
                      <div className="absolute w-28 h-28 rounded-full bg-teal-500/20 animate-ping" />
                      <div className="absolute w-24 h-24 rounded-full bg-teal-500/30 animate-pulse" />
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (isListening) {
                        if (recognitionRef.current) {
                          try { recognitionRef.current.stop(); } catch { /* ignore */ }
                        }
                        setIsListening(false);
                      } else {
                        startContinuousListening();
                      }
                    }}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-90 ${
                      isListening
                        ? 'bg-linear-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-teal-500/50 ring-4 ring-teal-400/30'
                        : 'bg-slate-800 text-slate-400 hover:text-teal-400 hover:bg-slate-750 border border-slate-700'
                    }`}
                    title={isListening ? 'Microphone is active. Tap to pause.' : 'Tap to resume microphone.'}
                  >
                    {isListening ? (
                      <Mic className="w-9 h-9 animate-pulse" />
                    ) : (
                      <MicOff className="w-9 h-9 text-slate-500" />
                    )}
                  </button>
                </div>

                {/* Animated Waveform Bars */}
                {isListening ? (
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="w-1 h-5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-8 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-10 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="w-1 h-7 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                    <span className="w-1 h-4 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
                  </div>
                ) : (
                  <span className="text-xs text-amber-400 mt-3 font-semibold">Microphone paused. Tap to resume.</span>
                )}

                {/* Audio Status Label */}
                <p className="text-xs font-semibold mt-2 tracking-wide flex items-center gap-1.5 text-slate-400">
                  {isListening ? (
                    <span className="text-teal-400 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Speak clearly into your mic...
                    </span>
                  ) : null}
                </p>

                {/* Live Speech Recognition Transcript */}
                {(transcript || interimTranscript) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 px-4 py-2 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-200 text-sm max-w-sm text-center font-medium shadow-inner"
                  >
                    "{transcript || interimTranscript}"
                  </motion.div>
                )}

                {/* Auto-Advance Feedback Bar */}
                {pendingAdvanceStep && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-sm animate-pulse"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>Captured! Moving to next step...</span>
                    <button
                      onClick={() => executeAdvanceStep(pendingAdvanceStep)}
                      className="underline text-white font-extrabold ml-1 hover:text-emerald-200"
                    >
                      Next ➔
                    </button>
                  </motion.div>
                )}

                {errorMessage && (
                  <div className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs max-w-md text-center flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Step Interactive Body */}
              <div className="mt-2">
                {/* STEP 1: NAME */}
                {currentStep === 1 && (
                  <div className="space-y-3">
                    {formData.name && (
                      <div className="p-3 bg-teal-500/15 border border-teal-500/30 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Detected Name</span>
                          <h4 className="text-base font-bold text-white">{formData.name}</h4>
                        </div>
                        <button
                          onClick={() => executeAdvanceStep(2)}
                          className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Confirm</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, name: val }));
                            formDataRef.current.name = val;
                          }}
                          placeholder="Or type expense name here..."
                          className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (formData.name.trim()) {
                            const inferred = inferCategoryFromName(formData.name);
                            if (inferred !== 'Other') {
                              setFormData(prev => ({ ...prev, category: inferred }));
                              formDataRef.current.category = inferred;
                            }
                            executeAdvanceStep(2);
                          }
                        }}
                        disabled={!formData.name.trim()}
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>

                    <div className="pt-1">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">Or Tap Quick Suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_NAMES.map((name) => (
                          <button
                            key={name}
                            onClick={() => {
                              const inferred = inferCategoryFromName(name);
                              const updated = { 
                                ...formDataRef.current, 
                                name, 
                                category: inferred !== 'Other' ? inferred : formDataRef.current.category 
                              };
                              setFormData(updated);
                              formDataRef.current = updated;
                              executeAdvanceStep(2);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-teal-500/20 border border-slate-700 hover:border-teal-500/40 text-slate-300 hover:text-teal-300 transition-all active:scale-95 cursor-pointer"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: AMOUNT */}
                {currentStep === 2 && (
                  <div className="space-y-3">
                    {formData.amount && (
                      <div className="p-3 bg-teal-500/15 border border-teal-500/30 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Detected Amount</span>
                          <h4 className="text-xl font-bold text-teal-300">
                            ₹{Number(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </h4>
                        </div>
                        <button
                          onClick={() => executeAdvanceStep(3)}
                          className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Confirm</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="any"
                          value={formData.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, amount: val }));
                            formDataRef.current.amount = val;
                          }}
                          placeholder="Say or type amount..."
                          className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 rounded-xl pl-9 pr-4 py-2.5 text-base font-bold text-white placeholder-slate-500 outline-none transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (parseFloat(formData.amount) > 0) executeAdvanceStep(3);
                        }}
                        disabled={!formData.amount || parseFloat(formData.amount) <= 0}
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer"
                      >
                        Next
                      </button>
                    </div>

                    <div className="pt-1">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-2 font-semibold">Quick Amount Pills:</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {QUICK_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => {
                              const updated = { ...formDataRef.current, amount: amt };
                              setFormData(updated);
                              formDataRef.current = updated;
                              executeAdvanceStep(3);
                            }}
                            className="px-2 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-teal-500/20 border border-slate-700 hover:border-teal-500/40 text-slate-200 hover:text-teal-300 transition-all active:scale-95 text-center cursor-pointer"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: CATEGORY & NOTE */}
                {currentStep === 3 && (
                  <div className="space-y-3">
                    {/* Active Selected Category Pill Card */}
                    {formData.category && (
                      <div className="p-3 bg-teal-500/15 border border-teal-500/30 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Category</span>
                          <h4 className="text-base font-bold text-teal-300 flex items-center gap-1.5">
                            <Tag className="w-4 h-4 text-teal-400" />
                            {formData.category}
                          </h4>
                          {formData.note && (
                            <p className="text-xs text-teal-200 mt-0.5 flex items-center gap-1 font-medium">
                              <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
                              <span>Note: {formData.note}</span>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => executeAdvanceStep(4)}
                          className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Confirm</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Custom Category & Note Inputs */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, category: val }));
                            formDataRef.current.category = val;
                          }}
                          placeholder="Say or type any category (e.g. Wellness)..."
                          className="w-full bg-slate-800/80 border border-slate-700 focus:border-teal-400 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (formData.category.trim()) executeAdvanceStep(4);
                          }}
                          disabled={!formData.category.trim()}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shrink-0"
                        >
                          Next
                        </button>
                      </div>

                      <input
                        type="text"
                        value={formData.note || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, note: val }));
                          formDataRef.current.note = val;
                        }}
                        placeholder="Optional note / memo (e.g. Morning yoga, with friends)..."
                        className="w-full bg-slate-800/50 border border-slate-800 focus:border-teal-400/60 rounded-xl px-4 py-2 text-xs text-slate-300 placeholder-slate-500 outline-none transition-colors"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 uppercase tracking-wider pt-1 font-semibold">
                      Or Tap Standard Category:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                      {CATEGORY_DEFINITIONS.map((cat) => {
                        const isSelected = formData.category?.toLowerCase() === cat.name.toLowerCase();
                        return (
                          <button
                            key={cat.name}
                            onClick={() => {
                              const updated = { ...formDataRef.current, category: cat.name };
                              setFormData(updated);
                              formDataRef.current = updated;
                              executeAdvanceStep(4);
                            }}
                            className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all active:scale-95 cursor-pointer ${
                              isSelected
                                ? 'border-teal-400 bg-teal-500/20 text-white shadow-md shadow-teal-500/20'
                                : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span className="text-xs font-semibold">{cat.name}</span>
                            {isSelected && <span className="text-[10px] text-teal-400 mt-1 font-bold">Selected ✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 4: DATE */}
                {currentStep === 4 && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                      Say "Today", "Yesterday", or tap below:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          const updated = { ...formDataRef.current, date: today };
                          setFormData(updated);
                          formDataRef.current = updated;
                          executeAdvanceStep(5);
                        }}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          formData.date === new Date().toISOString().split('T')[0]
                            ? 'border-teal-400 bg-teal-500/20 text-white font-bold'
                            : 'border-slate-800 bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        📅 Today
                      </button>

                      <button
                        onClick={() => {
                          const y = new Date();
                          y.setDate(y.getDate() - 1);
                          const yStr = y.toISOString().split('T')[0];
                          const updated = { ...formDataRef.current, date: yStr };
                          setFormData(updated);
                          formDataRef.current = updated;
                          executeAdvanceStep(5);
                        }}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium text-center transition-all cursor-pointer"
                      >
                        ⏪ Yesterday
                      </button>
                    </div>

                    <div className="pt-1">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Or Custom Date:</p>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, date: val }));
                          formDataRef.current.date = val;
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-teal-400"
                      />
                    </div>

                    <button
                      onClick={() => executeAdvanceStep(5)}
                      className="w-full mt-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer"
                    >
                      Continue to Review
                    </button>
                  </div>
                )}

                {/* STEP 5: REVIEW & CONFIRM */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <p className="text-xs text-center text-teal-400 font-semibold flex items-center justify-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Say "Save it" or "Yes" into your mic, or tap below:
                    </p>

                    <div className="bg-slate-800/70 border border-teal-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-teal-400" /> Expense Name
                        </span>
                        <span className="text-sm font-semibold text-white">{formData.name}</span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 text-teal-400" /> Amount
                        </span>
                        <span className="text-lg font-bold text-teal-400">
                          ₹{Number(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-teal-400" /> Category
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                          {formData.category}
                        </span>
                      </div>

                      {formData.note && (
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Note / Details
                          </span>
                          <span className="text-xs font-medium text-teal-300">{formData.note}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-teal-400" /> Date
                        </span>
                        <span className="text-xs text-slate-300">{formData.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => executeAdvanceStep(1)}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-semibold transition-all cursor-pointer"
                        title="Start over"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={handleSaveExpense}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Saving Expense...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5 stroke-3" />
                            <span>Confirm & Save Expense</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer (Back / Next) */}
              {currentStep < 5 && (
                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      if (currentStep > 1) executeAdvanceStep(currentStep - 1);
                    }}
                    disabled={currentStep === 1}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Hands-Free Mic Active</span>
                  </div>

                  <button
                    onClick={() => {
                      if (currentStep < 5) executeAdvanceStep(currentStep + 1);
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Skip</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
