import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Mic, PlusCircle, Users, Menu, 
  ArrowRight, ArrowLeft, X, Sparkles, Volume2, VolumeX, CheckCircle,
  Compass, History as HistoryIcon, User, MessageSquarePlus, RefreshCw
} from 'lucide-react';

const TOUR_BUTTONS = [
  {
    id: 1,
    selector: '#tour-voice-btn',
    mobileSelector: '#tour-voice-btn',
    icon: Mic,
    title: 'Voice AI & "Hey Expense"',
    subtitle: '100% Hands-Free Logger',
    description: 'This is your Voice AI button! Tap to log any expense by speaking step-by-step. Use the ON/OFF toggle switch anytime to enable or disable background "Hey Expense" listening.',
    voiceText: 'This is Voice AI and Hey Expense. Tap here to speak an expense step-by-step, or toggle the switch to turn background Hey Expense wake word ON or OFF.',
    placement: 'bottom',
    route: '/'
  },
  {
    id: 2,
    selector: '#tour-nav-dashboard',
    mobileSelector: '#tour-nav-dashboard-m',
    icon: LayoutDashboard,
    title: 'Dashboard & Command Center',
    subtitle: 'Real-Time Financial Snapshot',
    description: 'Takes you to your financial command center. View today\'s live cash flow, monthly spending limits, budget gauges, and interactive expense trend charts.',
    voiceText: 'This is your Dashboard. It shows today\'s cash flow, remaining monthly budget, and visual charts of where your money goes.',
    placement: 'right',
    route: '/'
  },
  {
    id: 3,
    selector: '#tour-nav-add',
    mobileSelector: '#tour-nav-add-m',
    icon: PlusCircle,
    title: 'Add Expense & AI OCR',
    subtitle: 'Receipt Scanner & SMS Auto-Fill',
    description: 'Tap here to log expenses quickly. You can type manually, snap a photo of paper receipts with the AI camera for instant text extraction, or paste bank SMS for 1-tap auto-fill.',
    voiceText: 'This is Add Expense. You can log manually, take a photo of paper receipts with AI camera, or paste bank transaction SMS to auto-detect amount and merchant.',
    placement: 'right',
    route: '/add'
  },
  {
    id: 4,
    selector: '#tour-nav-history',
    mobileSelector: '#tour-nav-history-m',
    icon: HistoryIcon,
    title: 'Expense History & Statements',
    subtitle: 'Search, Filter & Export PDF',
    description: 'Explore all past transactions. Filter by month or year, run automatic duplicate cleanup, and export clean bank-grade PDF or Excel statements with 1 click.',
    voiceText: 'This is Expense History. Search any record, filter by month, find duplicate expenses, and export PDF statements.',
    placement: 'right',
    route: '/history'
  },
  {
    id: 5,
    selector: '#tour-nav-splits',
    mobileSelector: '#tour-nav-splits',
    icon: Users,
    title: 'Splits & WhatsApp UPI',
    subtitle: 'Instant Debt Recovery',
    description: 'Split restaurant bills, rent, and trips with friends. Tap "WhatsApp Remind" on any split to send an instant pre-filled UPI payment link (GPay/PhonePe) directly to your friend!',
    voiceText: 'This is Splits. Split bills with friends and send instant WhatsApp reminders with pre-filled GPay or PhonePe payment links.',
    placement: 'right',
    route: '/splits'
  },
  {
    id: 6,
    selector: '#tour-nav-more',
    mobileSelector: '#tour-nav-more-m',
    icon: Menu,
    title: 'More Features, Vault & Goals',
    subtitle: 'Biometric Security & Jars',
    description: 'Unlocks advanced modules: your TouchID/FaceID-protected Biometric Savings Vault, virtual Goal Jars with confetti, Payment QRs, and Dark Mode settings.',
    voiceText: 'This is the More menu. Access your TouchID protected savings vault, goal savings jars, Payment QRs, and Dark Mode settings.',
    placement: 'right',
    route: '/more'
  },
  {
    id: 7,
    selector: '#tour-topbar-tour',
    mobileSelector: '#tour-topbar-tour',
    icon: Compass,
    title: 'Quick Tour Button',
    subtitle: 'Replay This Walkthrough Anytime',
    description: 'Whenever you want a reminder of what any button does, tap this Tour button anytime to replay this interactive spotlight guide.',
    voiceText: 'This is the Tour button. You can tap it anytime whenever you want to replay this interactive button guide.',
    placement: 'bottom',
    route: '/'
  },
  {
    id: 8,
    selector: '#tour-topbar-feedback',
    mobileSelector: '#tour-topbar-profile',
    icon: MessageSquarePlus,
    title: 'Feedback & Profile Controls',
    subtitle: 'Direct Developer Channel & Profile',
    description: 'Have a suggestion or spotted a bug? Tap Feedback to message the developer directly. Tap your profile avatar to view account details. You\'re all set to master your finances!',
    voiceText: 'And this is Feedback and Profile. Send suggestions directly to the developer, and manage your account. You are all set to track your expenses effortlessly!',
    placement: 'bottom',
    route: '/'
  }
];

export default function AppModuleTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isVoiceNarrating, setIsVoiceNarrating] = useState(true);

  const step = TOUR_BUTTONS[currentStepIndex];
  const resizeTimerRef = useRef(null);

  // Cleanup flag on unmount
  useEffect(() => {
    return () => {
      window.__isTourActive = false;
      sessionStorage.removeItem('is_tour_active');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-play for first-time new users
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('app_tour_completed');
    if (!hasCompletedTour) {
      const timer = setTimeout(() => {
        window.__isTourActive = true;
        sessionStorage.setItem('is_tour_active', 'true');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        setIsActive(true);
        setCurrentStepIndex(0);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for manual trigger from Topbar or More page
  useEffect(() => {
    const handleStartTour = () => {
      window.__isTourActive = true;
      sessionStorage.setItem('is_tour_active', 'true');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setCurrentStepIndex(0);
      setIsActive(true);
    };

    window.addEventListener('start-app-tour', handleStartTour);
    return () => window.removeEventListener('start-app-tour', handleStartTour);
  }, []);

  // Speak voice explanation aloud ("telling what is what")
  const speakCurrentStep = useCallback((stepObj) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!stepObj) return;

    const utterance = new SpeechSynthesisUtterance(stepObj.voiceText || stepObj.description);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Pick Indian female or clear voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.includes('en-IN') || 
      v.name.toLowerCase().includes('veena') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('victoria')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  // Measure target element position
  const updateTargetPosition = useCallback(() => {
    if (!step) return;

    const isMobile = window.innerWidth < 768;
    const selector = isMobile && step.mobileSelector ? step.mobileSelector : step.selector;
    const el = document.querySelector(selector);

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Update target rect on step change without shifting page routes
  useEffect(() => {
    if (!isActive || !step) return;

    // Stop any existing speech before moving to the next button
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Measure target element position
    const timer = setTimeout(() => {
      updateTargetPosition();
      if (isVoiceNarrating) {
        speakCurrentStep(step);
      }
    }, 150);

    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(updateTargetPosition, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, currentStepIndex, step, updateTargetPosition, isVoiceNarrating, speakCurrentStep]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_BUTTONS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setIsActive(false);
    window.__isTourActive = false;
    sessionStorage.removeItem('is_tour_active');
    localStorage.setItem('app_tour_completed', 'true');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  if (!isActive || !step) return null;

  const Icon = step.icon;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_BUTTONS.length - 1;

  // Calculate tooltip placement styles relative to targetRect
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  let tooltipStyle = {};
  let arrowPlacement = 'top';

  if (targetRect) {
    const cardWidth = Math.min(380, windowWidth - 32);

    if (step.placement === 'bottom' || isMobile) {
      // Position below element (or at bottom of screen on mobile)
      arrowPlacement = 'top';
      const idealLeft = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
      const clampedLeft = Math.max(16, Math.min(windowWidth - cardWidth - 16, idealLeft));
      const topPos = Math.min(windowHeight - 280, targetRect.bottom + 18);

      tooltipStyle = {
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${Math.max(16, topPos)}px`,
        width: `${cardWidth}px`,
        zIndex: 10001
      };
    } else if (step.placement === 'right' && !isMobile) {
      // Position to the right of sidebar button
      arrowPlacement = 'left';
      const idealTop = targetRect.top + (targetRect.height / 2) - 120;
      const clampedTop = Math.max(16, Math.min(windowHeight - 300, idealTop));

      tooltipStyle = {
        position: 'fixed',
        left: `${targetRect.right + 20}px`,
        top: `${clampedTop}px`,
        width: `${cardWidth}px`,
        zIndex: 10001
      };
    }
  } else {
    // Fallback centered
    tooltipStyle = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      maxWidth: '380px',
      zIndex: 10001
    };
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9990 pointer-events-auto">
        {/* 1. SVG Cutout Spotlight Backdrop */}
        <svg 
          className="fixed inset-0 w-full h-full pointer-events-auto"
          onClick={handleClose}
        >
          <defs>
            <mask id="app-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 6}
                  y={targetRect.top - 6}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx="14"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(3, 7, 18, 0.78)"
            mask="url(#app-spotlight-mask)"
          />
        </svg>

        {/* 2. Pulsating Neon Beacon & Ring around Target Button */}
        {targetRect && (
          <div
            style={{
              position: 'fixed',
              left: `${targetRect.left - 6}px`,
              top: `${targetRect.top - 6}px`,
              width: `${targetRect.width + 12}px`,
              height: `${targetRect.height + 12}px`,
              borderRadius: '14px',
              zIndex: 9999,
              pointerEvents: 'none',
              border: '2px solid #14b8a6',
              boxShadow: '0 0 25px rgba(20, 184, 166, 0.7), inset 0 0 15px rgba(20, 184, 166, 0.3)'
            }}
            className="animate-pulse"
          >
            {/* Animated Beacon Ping */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-90" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-md" />
            </span>
          </div>
        )}

        {/* 3. Floating Interactive Tooltip / Callout Card */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          style={tooltipStyle}
          className="bg-slate-900/98 dark:bg-[#070c18]/98 border-2 border-teal-500/50 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(20,184,166,0.25)] text-white backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-teal-400 via-emerald-400 to-teal-400 rounded-t-3xl" />

          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/30">
                <Icon className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  Button {currentStepIndex + 1} of {TOUR_BUTTONS.length}
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight mt-0.5">
                  {step.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Voice Speech Toggle */}
              <button
                onClick={() => {
                  const nextVoice = !isVoiceNarrating;
                  setIsVoiceNarrating(nextVoice);
                  if (nextVoice) {
                    speakCurrentStep(step);
                  } else if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all ${
                  isVoiceNarrating 
                    ? 'border-teal-400 bg-teal-500/20 text-teal-300' 
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
                title={isVoiceNarrating ? 'Mute voice guide' : 'Listen with voice guide'}
              >
                {isVoiceNarrating ? <Volume2 className="w-4 h-4 text-teal-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Exit Tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subtitle & Explanation */}
          <div className="space-y-1.5 mb-4">
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              {step.description}
            </p>
          </div>

          {/* Progress Indicators & Navigation Actions */}
          <div className="space-y-3 pt-2.5 border-t border-slate-800/90">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_BUTTONS.map((b, idx) => (
                <button
                  key={b.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 flex-1 cursor-pointer ${
                    idx === currentStepIndex
                      ? 'bg-linear-to-r from-teal-400 to-emerald-400 shadow-xs shadow-teal-400/50'
                      : idx < currentStepIndex
                      ? 'bg-emerald-500/60'
                      : 'bg-slate-800'
                  }`}
                  title={b.title}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={handlePrev}
                disabled={isFirst}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <button
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2"
              >
                Skip
              </button>

              <button
                onClick={handleNext}
                className={`px-4 py-2 rounded-xl text-slate-950 font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                  isLast
                    ? 'bg-linear-to-r from-emerald-400 to-teal-400 shadow-emerald-500/20'
                    : 'bg-linear-to-r from-teal-400 to-emerald-400 shadow-teal-500/20 hover:from-teal-300 hover:to-emerald-300'
                }`}
              >
                <span>{isLast ? "Done! Finish" : "Next Button"}</span>
                {isLast ? <CheckCircle className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
