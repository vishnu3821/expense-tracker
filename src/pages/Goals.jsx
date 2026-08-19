import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePageGreeting } from '../hooks/usePageGreeting';
import confetti from 'canvas-confetti';
import { Plus, Target, X, PlusCircle, CheckCircle, Flame, Trophy, Trash2, ArrowLeft, IndianRupee, Pencil, Clock, History, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Link } from 'react-router-dom';

const SPRITE_POSITIONS = [
  '9.3% 1.5%',      // Top Left (2000)
  '90.6% 1.5%',     // Top Right (500)
  '9.3% 30.3%',     // Mid Left (200)
  '90.6% 30.3%',    // Mid Right (100)
  '9.3% 59.2%',     // Bottom Left (50)
  '90.6% 59.2%',    // Bottom Right (20)
  '50% 88.0%'       // Bottom Center (10)
];

const JAR_THEMES = {
  slate: { lid: 'from-slate-200 to-slate-400 dark:from-slate-600 dark:to-slate-800', glow: 'bg-slate-500/20', hex: '#64748b' },
  teal: { lid: 'from-teal-400 to-teal-600 dark:from-teal-600 dark:to-teal-800', glow: 'bg-teal-500/30', hex: '#14b8a6' },
  emerald: { lid: 'from-emerald-400 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800', glow: 'bg-emerald-500/30', hex: '#10b981' },
  blue: { lid: 'from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-800', glow: 'bg-blue-500/30', hex: '#3b82f6' },
  purple: { lid: 'from-purple-400 to-purple-600 dark:from-purple-600 dark:to-purple-800', glow: 'bg-purple-500/30', hex: '#8b5cf6' },
  red: { lid: 'from-rose-400 to-rose-600 dark:from-rose-600 dark:to-rose-800', glow: 'bg-rose-500/30', hex: '#f43f5e' },
  gold: { lid: 'from-amber-400 to-amber-600 dark:from-amber-600 dark:to-amber-800', glow: 'bg-amber-500/30', hex: '#f59e0b' }
};

const STATIC_NOTES = Array.from({ length: 60 }).map((_, i) => {
  return {
    id: i,
    left: Math.random() * 40 + 2, // 2% to 42%
    bottom: (i / 60) * 85 + Math.random() * 5,
    rotate: Math.random() * 80 - 40,
    bgPosition: SPRITE_POSITIONS[Math.floor(Math.random() * SPRITE_POSITIONS.length)],
    zIndex: i,
    delay: Math.random() * 0.3
  };
});

const RealIndianNote = ({ bgPosition }) => (
  <div 
    className="w-16 h-7 rounded-xs shadow-sm overflow-hidden border border-black/10"
    style={{
      backgroundImage: "url('/notes.jpg')",
      backgroundSize: "260% 750%", // Tightly crops the note, removing beige background
      backgroundPosition: bgPosition,
      backgroundRepeat: "no-repeat"
    }}
  />
);

export default function Goals() {
  usePageGreeting("Set your goals and watch your savings grow.");
  const { user } = useAuth();
  
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [droppingCoins, setDroppingCoins] = useState([]);
  const [withdrawingCoins, setWithdrawingCoins] = useState([]);
  const [jarTransactions, setJarTransactions] = useState([]);
  
  // Forms
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalLocation, setNewGoalLocation] = useState('');
  const [newGoalTheme, setNewGoalTheme] = useState('slate');
  const [contributeAmount, setContributeAmount] = useState('');
  const [transactionType, setTransactionType] = useState('deposit'); // 'deposit' or 'withdraw'
  
  // Edit State
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editGoalId, setEditGoalId] = useState(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalLocation, setEditGoalLocation] = useState('');
  const [editGoalTheme, setEditGoalTheme] = useState('slate');
  
  const fetchGoals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error("Error fetching goals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user, fetchGoals]);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget) return;
    
    try {
      const { error } = await supabase
        .from('user_goals')
        .insert([{
          user_id: user.id,
          name: newGoalName,
          target_amount: parseFloat(newGoalTarget),
          current_amount: 0,
          saved_in: newGoalLocation || 'Cash',
          color_theme: newGoalTheme
        }]);
        
      if (error) throw error;
      
      setNewGoalName('');
      setNewGoalTarget('');
      setNewGoalLocation('');
      setNewGoalTheme('slate');
      setShowAddGoal(false);
      fetchGoals();
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error("Error adding goal:", err);
      alert("Failed to add goal.");
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!selectedGoal || !contributeAmount) return;
    
    const amount = parseFloat(contributeAmount);
    if (amount <= 0) return;

    let newAmount = selectedGoal.current_amount;
    if (transactionType === 'deposit') {
      newAmount += amount;
    } else {
      newAmount -= amount;
      if (newAmount < 0) newAmount = 0; // Prevent negative balance
    }
    
    const isCompleted = newAmount >= selectedGoal.target_amount;
    const oldPercent = calculatePercentage(selectedGoal.current_amount, selectedGoal.target_amount);
    const newPercent = calculatePercentage(newAmount, selectedGoal.target_amount);
    
    try {
      // 1. Update the goal amount
      const { error: goalError } = await supabase
        .from('user_goals')
        .update({ current_amount: newAmount })
        .eq('id', selectedGoal.id);
        
      if (goalError) throw goalError;
      
      // 2. Insert transaction record
      const { error: txError } = await supabase
        .from('goal_transactions')
        .insert([{
          goal_id: selectedGoal.id,
          user_id: user.id,
          type: transactionType,
          amount: amount
        }]);

      if (txError) throw txError;
      
      if (transactionType === 'deposit') {
        // Drop a coin animation
        const coinId = Date.now();
        setDroppingCoins(prev => [...prev, { id: coinId, jarId: selectedGoal.id }]);
        setTimeout(() => {
          setDroppingCoins(prev => prev.filter(c => c.id !== coinId));
        }, 1200);

        // Milestone Celebrations
        if (isCompleted) {
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#10B981', '#3B82F6', '#F59E0B']
          });
        } else {
          const milestones = [25, 50, 75];
          for (let ms of milestones) {
            if (oldPercent < ms && newPercent >= ms) {
              confetti({
                particleCount: 100,
                spread: 60,
                origin: { y: 0.6 },
                colors: [JAR_THEMES[selectedGoal.color_theme || 'slate'].hex, '#ffffff']
              });
              break;
            }
          }
        }
      } else {
        // Reverse animation for withdraw
        const coinId = Date.now();
        setWithdrawingCoins(prev => [...prev, { id: coinId, jarId: selectedGoal.id }]);
        setTimeout(() => {
          setWithdrawingCoins(prev => prev.filter(c => c.id !== coinId));
        }, 1200);
      }
      
      setContributeAmount('');
      setShowContribute(false);
      setSelectedGoal(null);
      fetchGoals();
    } catch (err) {
      console.error("Error managing funds:", err);
      alert("Failed to update funds. Did you run the SQL script?");
    }
  };

  const handleShowHistory = async (goal, e) => {
    e.stopPropagation();
    setSelectedGoal(goal);
    setShowHistory(true);
    setJarTransactions([]);
    try {
      const { data, error } = await supabase
        .from('goal_transactions')
        .select('*')
        .eq('goal_id', goal.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setJarTransactions(data || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleEditGoal = async (e) => {
    e.preventDefault();
    if (!editGoalName || !editGoalTarget || !editGoalId) return;
    
    try {
      const { error } = await supabase
        .from('user_goals')
        .update({
          name: editGoalName,
          target_amount: parseFloat(editGoalTarget),
          saved_in: editGoalLocation || 'Cash',
          color_theme: editGoalTheme
        })
        .eq('id', editGoalId);
        
      if (error) throw error;
      
      setShowEditGoal(false);
      fetchGoals();
    } catch (err) {
      console.error("Error editing goal:", err);
      alert("Failed to edit goal.");
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    
    try {
      await supabase.from('user_goals').delete().eq('id', id);
      fetchGoals();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const calculatePercentage = (current, target) => {
    if (!target || target === 0) return 0;
    const percent = Math.round((current / target) * 100);
    return Math.min(Math.max(percent, 0), 100);
  };

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/more" className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Savings Jars <Trophy className="h-6 w-6 text-amber-500" />
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Visualize and track your financial goals.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddGoal(true)}
          className="h-10 px-4 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Goal</span>
        </button>
      </div>

      {/* Grid of Jars */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="h-48 w-32 bg-slate-200 dark:bg-slate-800 rounded-4xl" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No active goals</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs mx-auto">Set a goal like a new laptop, a trip, or an emergency fund to start tracking!</p>
          <button 
            onClick={() => setShowAddGoal(true)}
            className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl transition-transform active:scale-95"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {goals.map((goal) => {
            const percent = calculatePercentage(goal.current_amount, goal.target_amount);
            const isDone = percent === 100;
            
            return (
              <div 
                key={goal.id} 
                onClick={() => {
                  if (!isDone) {
                    setSelectedGoal(goal);
                    setShowContribute(true);
                  }
                }}
                className={`relative group bg-white dark:bg-[#080d1a] border border-slate-100 dark:border-slate-800/80 rounded-4xl p-6 flex flex-col items-center justify-between gap-6 transition-all duration-300 ${!isDone ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.02)] hover:border-slate-300 dark:hover:border-slate-600' : 'opacity-90'}`}
              >
                
                {/* Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-40">
                  <button 
                    onClick={(e) => handleShowHistory(goal, e)}
                    className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditGoalId(goal.id);
                      setEditGoalName(goal.name);
                      setEditGoalTarget(goal.target_amount);
                      setEditGoalLocation(goal.saved_in || 'Cash');
                      setEditGoalTheme(goal.color_theme || 'slate');
                      setShowEditGoal(true);
                    }}
                    className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-full text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(goal.id, e)}
                    className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 3D Glass Jar Animation */}
                <div className="relative w-28 h-40 mt-4">
                  {/* Dropping Notes */}
                  <AnimatePresence>
                    {droppingCoins.filter(c => c.jarId === goal.id).map(coin => (
                      <motion.div
                        key={coin.id}
                        initial={{ y: -60, opacity: 0, scale: 0.5, rotate: -20 }}
                        animate={{ y: 80, opacity: 1, scale: 1, rotate: 10 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
                        className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
                      >
                        <RealIndianNote bgPosition="90.6% 1.5%" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <AnimatePresence>
                    {withdrawingCoins.filter(c => c.jarId === goal.id).map(coin => (
                      <motion.div
                        key={coin.id}
                        initial={{ y: 0, opacity: 1, scale: 1, rotate: 10 }}
                        animate={{ y: -120, opacity: 0, scale: 0.5, rotate: -20 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                        className="absolute left-1/2 -translate-x-1/2 bottom-20 z-30 flex items-center justify-center filter sepia hue-rotate-[-50deg] saturate-200"
                      >
                        <RealIndianNote bgPosition="50% 88.0%" />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Jar Lid */}
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-linear-to-b ${JAR_THEMES[goal.color_theme || 'slate'].lid} rounded-t-md z-20 border-b border-slate-300 dark:border-slate-900 shadow-sm`} />
                  
                  {/* Glass Jar Body */}
                  <div className="absolute inset-0 bg-linear-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-transparent border-2 border-white/60 dark:border-white/20 rounded-4xl shadow-[inset_0_0_20px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-sm z-10 overflow-hidden flex items-end">
                    
                    {/* Note Pile Level */}
                    <div className="w-full h-full relative">
                      {/* Container for the pile of notes. */}
                      <div className="absolute bottom-0 left-0 w-full h-40">
                        <AnimatePresence>
                          {STATIC_NOTES.filter(note => note.bottom <= percent).map(note => (
                            <motion.div 
                              key={note.id}
                              initial={{ y: -150, opacity: 0, rotate: note.rotate - 45 }}
                              animate={{ y: 0, opacity: 1, rotate: note.rotate }}
                              transition={{ type: 'spring', bounce: 0.3, duration: 0.8, delay: note.delay }}
                              className="absolute"
                              style={{
                                left: `${note.left}%`,
                                bottom: `${note.bottom}%`,
                                zIndex: note.zIndex
                              }}
                            >
                              <RealIndianNote bgPosition={note.bgPosition} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Glass Reflections */}
                    <div className="absolute top-2 bottom-2 left-2 w-2 bg-linear-to-r from-white/60 to-transparent rounded-full blur-[1px]" />
                    <div className="absolute top-6 bottom-6 right-3 w-1 bg-linear-to-l from-white/30 to-transparent rounded-full blur-[1px]" />
                  </div>
                  
                  {/* Glow under the jar */}
                  <div className={`absolute -bottom-2 left-4 right-4 h-4 ${JAR_THEMES[goal.color_theme || 'slate'].glow} blur-xl z-0 rounded-full`} />
                </div>

                {/* Details */}
                <div className="text-center w-full relative z-20">
                  <h4 className="font-bold text-slate-900 dark:text-white truncate">{goal.name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5 truncate uppercase">
                    Saved in: <span className="text-slate-700 dark:text-slate-300">{goal.saved_in || 'Cash'}</span>
                  </p>
                  <div className="flex items-center justify-between w-full mt-3 text-xs font-semibold text-slate-500">
                    <span>₹{goal.current_amount}</span>
                    <span>₹{goal.target_amount}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-teal-500'}`}
                    />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${isDone ? 'text-emerald-500' : 'text-teal-600'}`}>
                    {isDone ? 'Goal Reached!' : `${percent}% Completed`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ position: 'fixed' }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowAddGoal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-teal-500" /> New Goal
            </h3>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Goal Name</label>
                <input 
                  type="text" 
                  required
                  value={newGoalName}
                  onChange={e => setNewGoalName(e.target.value)}
                  placeholder="e.g. PlayStation 5" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Target Amount (₹)</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newGoalTarget}
                  onChange={e => setNewGoalTarget(e.target.value)}
                  placeholder="e.g. 45000" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Location / Bank</label>
                <input 
                  type="text" 
                  value={newGoalLocation}
                  onChange={e => setNewGoalLocation(e.target.value)}
                  placeholder="e.g. HDFC Bank, Safe Box" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Jar Theme</label>
                <div className="flex gap-2 mt-2 ml-1">
                  {Object.entries(JAR_THEMES).map(([themeKey, themeData]) => (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setNewGoalTheme(themeKey)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${newGoalTheme === themeKey ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: themeData.hex }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-4 mt-2 bg-teal-500 hover:bg-teal-600 text-white font-black rounded-2xl transition-transform active:scale-[0.98] shadow-lg shadow-teal-500/20"
              >
                Create Goal Jar
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Goal Modal */}
      {showEditGoal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ position: 'fixed' }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowEditGoal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Pencil className="h-6 w-6 text-teal-500" /> Edit Goal
            </h3>
            <form onSubmit={handleEditGoal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Goal Name</label>
                <input 
                  type="text" 
                  required
                  value={editGoalName}
                  onChange={e => setEditGoalName(e.target.value)}
                  placeholder="e.g. PlayStation 5" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Target Amount (₹)</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={editGoalTarget}
                  onChange={e => setEditGoalTarget(e.target.value)}
                  placeholder="e.g. 45000" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Location / Bank</label>
                <input 
                  type="text" 
                  value={editGoalLocation}
                  onChange={e => setEditGoalLocation(e.target.value)}
                  placeholder="e.g. HDFC Bank, Safe Box" 
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Jar Theme</label>
                <div className="flex gap-2 mt-2 ml-1">
                  {Object.entries(JAR_THEMES).map(([themeKey, themeData]) => (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setEditGoalTheme(themeKey)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${editGoalTheme === themeKey ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: themeData.hex }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full py-4 mt-2 bg-teal-500 hover:bg-teal-600 text-white font-black rounded-2xl transition-transform active:scale-[0.98] shadow-lg shadow-teal-500/20"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Funds Modal */}
      {showContribute && selectedGoal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ position: 'fixed' }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative overflow-hidden">
            <button 
              onClick={() => setShowContribute(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center mt-2">
              Manage Funds
            </h3>
            <p className="text-center text-sm font-semibold text-slate-500 mb-6">{selectedGoal.name}</p>
            
            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setTransactionType('deposit')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${transactionType === 'deposit' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Add Funds
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('withdraw')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${transactionType === 'withdraw' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Withdraw
              </button>
            </div>

            <form onSubmit={handleContribute} className="space-y-4">
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
                <input 
                  type="number" 
                  required
                  min="1"
                  max={transactionType === 'deposit' ? selectedGoal.target_amount - selectedGoal.current_amount : selectedGoal.current_amount}
                  value={contributeAmount}
                  onChange={e => setContributeAmount(e.target.value)}
                  placeholder="0" 
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-4xl pl-14 pr-6 py-6 text-4xl text-slate-900 dark:text-white font-black focus:ring-2 focus:ring-teal-500 text-center" 
                />
              </div>
              <button 
                type="submit" 
                className={`w-full py-4 mt-2 font-black rounded-2xl transition-transform active:scale-[0.98] shadow-xl flex items-center justify-center gap-2 ${transactionType === 'deposit' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-rose-500 text-white shadow-rose-500/20'}`}
              >
                {transactionType === 'deposit' ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
                {transactionType === 'deposit' ? 'Drop it in' : 'Take it out'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Transaction History Modal */}
      {showHistory && selectedGoal && createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ position: 'fixed' }}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative max-h-[80vh] flex flex-col">
            <button 
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <History className="h-6 w-6 text-blue-500" /> History
            </h3>
            <p className="text-sm font-semibold text-slate-500 mb-6">{selectedGoal.name}</p>
            
            <div className="overflow-y-auto pr-2 space-y-3 flex-1 min-h-[200px]">
              {jarTransactions.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No transactions yet.</p>
                </div>
              ) : (
                jarTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${tx.type === 'deposit' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                        {tx.type === 'deposit' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{tx.type}</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {new Date(tx.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-black ${tx.type === 'deposit' ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes liquid-flow {
          0% { background-position: 0 0; }
          100% { background-position: 20px 20px; }
        }
      `}</style>
    </div>
  );
}
