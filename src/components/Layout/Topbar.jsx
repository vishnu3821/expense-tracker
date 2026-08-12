import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Menu, RefreshCw, Cloud, Zap, ArrowRightCircle, MessageSquarePlus, X, Send, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Topbar() {
  const { user, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Hold for 1.5 seconds to show the premium animation
    await new Promise(r => setTimeout(r, 1500));
    window.location.reload();
  };

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('Dashboard');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const feedbackCategories = [
    'Dashboard', 'Add Expense', 'History', 'Splits', 'More', 'Year Breakdown', 'Other'
  ];

  const handleFeedbackSubmit = async () => {
    if (!feedbackMessage.trim() || !user) return;
    
    setIsSubmittingFeedback(true);
    try {
      const fullMessage = `[${feedbackCategory}] ${feedbackMessage.trim()}`;
      
      const { error } = await supabase.from('feedbacks').insert([{
        user_id: user.id,
        user_email: user.email,
        message: fullMessage,
        status: 'unread'
      }]);
      
      if (error) throw error;
      
      alert('Thank you! Your feedback has been sent directly to the developer.');
      setFeedbackMessage('');
      setFeedbackCategory('Dashboard');
      setShowFeedbackModal(false);
    } catch (err) {
      console.error('Feedback error:', err);
      alert('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <>
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 transition-colors duration-300">
        <div className="flex items-center gap-4">
          {/* Logo shown on mobile since there's no sidebar */}
          <Link to="/" className="md:hidden flex items-center overflow-hidden h-8">
            <img src="/website_logo.png" alt="Expense Monitor" className="h-16 w-auto object-contain -ml-2 select-none pointer-events-none" />
          </Link>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:block">
            {user?.email}
          </div>

          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-xs font-bold"
            title="Submit Feedback"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90"
            title="Refresh App"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="h-9 w-9 shrink-0 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-semibold border border-teal-200 dark:border-teal-800/50 shadow-sm uppercase select-none">
            {user?.email?.[0] || 'U'}
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 🔮 Premium Refresh Overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="text-center space-y-8 max-w-xs w-full px-6">
            <div className="flex justify-between items-center relative py-12">
              {/* Cloud Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm animate-pulse">
                <div className="absolute inset-0 rounded-3xl bg-teal-500/20 animate-ping" />
                <Cloud className="h-10 w-10 text-teal-400" />
              </div>

              {/* Digital Pulse Animation */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-12 overflow-hidden">
                <div className="h-1 w-full bg-white/5 rounded-full relative">
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow" />
                  <div className="absolute top-0 h-full w-12 bg-linear-to-r from-transparent via-teal-400 to-transparent animate-money-flow [animation-delay:0.5s]" />
                </div>
              </div>

              {/* App Meta Icon */}
              <div className="relative z-10 h-20 w-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                <Zap className="h-10 w-10 text-white animate-bounce" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse">Syncing App</h3>
              <p className="text-slate-400 text-sm font-medium tracking-wide">Fetching latest configurations...</p>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 text-center p-8">
            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-sm">
              <LogOut className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Secure Logout</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Are you sure you want to end your session?</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={signOut}
                className="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xl shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-120 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFeedbackModal(false)} />
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-md relative z-10 border border-slate-100 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-6 right-6 h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="mb-6">
              <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                <MessageSquarePlus className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Submit Feedback</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Found a bug? Have a feature request? Let the admin know directly!
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Which area?</label>
              <div className="flex flex-wrap gap-2">
                {feedbackCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFeedbackCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      feedbackCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Describe your issue or suggestion in detail..."
              className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm"
            />

            <button
              onClick={handleFeedbackSubmit}
              disabled={isSubmittingFeedback || !feedbackMessage.trim()}
              className="mt-6 w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
