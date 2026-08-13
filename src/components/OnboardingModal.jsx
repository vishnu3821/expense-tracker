import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronRight, ChevronLeft, Sparkles, LayoutDashboard, PlusCircle, 
  History, Menu, Calendar, PiggyBank, BookOpen, Users, UserCircle, 
  FileText, FileSpreadsheet, Activity 
} from 'lucide-react';

const slides = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: "Welcome to Expense Monitor",
    subtitle: "Your Ultimate Financial Command Center",
    description: "We've completely reimagined how you track your money. Let's take a tour of all our powerful features.",
    color: "from-teal-500 to-emerald-500"
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: "Smart Dashboard",
    subtitle: "Real-time insights",
    description: "Track your spending habits instantly. View interactive Donut Charts and quickly filter your expenses by This Week or This Month.",
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: 'add-expense',
    icon: PlusCircle,
    title: "Add Expense",
    subtitle: "Quick & Easy Logging",
    description: "Log your daily spending in seconds using a beautiful icon grid. You can even attach receipt photos directly to your records!",
    color: "from-pink-500 to-rose-500"
  },
  {
    id: 'history',
    icon: History,
    title: "Transaction History",
    subtitle: "Apple Wallet Style",
    description: "Scroll through your beautifully designed, glowing transaction cards. Instantly search, edit, or delete any past transaction.",
    color: "from-purple-500 to-fuchsia-500"
  },
  {
    id: 'splits',
    icon: Users,
    title: "Friends & Splits",
    subtitle: "No more awkward math",
    description: "Went out for dinner? Instantly split the bill with friends, track exactly who owes you, and hit 'Settle Up' when they pay.",
    color: "from-amber-500 to-orange-500"
  },
  {
    id: 'savings',
    icon: PiggyBank,
    title: "Virtual Savings",
    subtitle: "Watch your money grow",
    description: "Keep a manual, virtual record of your savings. You can enter money and bank names yourself to track net worth (no real bank connections!).",
    color: "from-emerald-400 to-green-600"
  },
  {
    id: 'education',
    icon: BookOpen,
    title: "Educational Fees",
    subtitle: "Manage tuition & courses",
    description: "We have a dedicated feature just to track your school, college, or online course fees so they don't mess up your daily budgets.",
    color: "from-cyan-500 to-blue-600"
  },
  {
    id: 'year-breakdown',
    icon: Calendar,
    title: "Year Breakdown",
    subtitle: "The big picture",
    description: "Zoom out and see your financial health across the entire year with beautiful monthly bar charts and trend lines.",
    color: "from-indigo-500 to-violet-600"
  },
  {
    id: 'daily-summaries',
    icon: Activity,
    title: "Daily Summaries",
    subtitle: "Stay on track every day",
    description: "Get detailed day-by-day breakdowns of exactly how much money left your pocket to keep you accountable.",
    color: "from-rose-400 to-red-600"
  },
  {
    id: 'more',
    icon: Menu,
    title: "The 'More' Hub",
    subtitle: "Everything else you need",
    description: "Access advanced tools, view your profile settings, and reach out for support—all neatly organized in the More tab.",
    color: "from-slate-600 to-slate-800"
  },
  {
    id: 'profile',
    icon: UserCircle,
    title: "Profile Settings",
    subtitle: "Customize your experience",
    description: "Manage your account, update your display picture, and customize exactly how you want your Expense Monitor to look and feel.",
    color: "from-teal-600 to-cyan-700"
  },
  {
    id: 'export',
    icon: FileText,
    title: "Export to PDF & Excel",
    subtitle: "Take your data anywhere",
    description: "Need to do your taxes or share reports? Instantly generate beautiful PDF reports or download all your data directly to Excel (CSV)!",
    color: "from-green-500 to-emerald-700"
  }
];

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeen = localStorage.getItem('hasSeenOnboarding_v3');
    if (!hasSeen) {
      // Small delay to let the app load first
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenOnboarding_v3', 'true');
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
        
        {/* Click outside to close (optional, maybe we force them to click through) */}
        <div className="absolute inset-0" onClick={handleClose} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-[#030712] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-white backdrop-blur-md hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Hero Header */}
          <motion.div 
            key={slide.id + '-header'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`h-48 bg-linear-to-br ${slide.color} relative overflow-hidden flex flex-col items-center justify-center text-white`}
          >
            {/* Background design elements */}
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-black/10 blur-xl" />
            
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="h-20 w-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center shadow-lg border border-white/30"
            >
              <Icon className="h-10 w-10 text-white" />
            </motion.div>
          </motion.div>

          {/* Content Body */}
          <div className="p-8 text-center bg-white dark:bg-[#030712] relative z-10">
            <motion.div
              key={slide.id + '-content'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                {slide.subtitle}
              </h3>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                {slide.title}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                {slide.description}
              </p>
            </motion.div>

            {/* Pagination Dots */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {slides.map((s, i) => (
                <div 
                  key={s.id} 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentSlide 
                      ? `w-6 bg-linear-to-r ${slide.color}` 
                      : 'w-2 bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3">
              {currentSlide > 0 && (
                <button 
                  onClick={prevSlide}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              
              <button 
                onClick={nextSlide}
                className={`flex-1 py-4 rounded-2xl bg-linear-to-r ${slide.color} text-white font-bold shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
              >
                {currentSlide === slides.length - 1 ? (
                  "Get Started"
                ) : (
                  <>Next <ChevronRight className="h-5 w-5" /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
