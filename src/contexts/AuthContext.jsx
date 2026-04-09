import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user || null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user,
    signOut: () => supabase.auth.signOut(),
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 z-[9999] overflow-hidden">
        {/* Decorative background elements for a premium feel */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
        
        <div className="relative flex flex-col items-center">
          {/* Animated Logo Container */}
          <div className="relative z-10 animate-in zoom-in-50 duration-1000 slide-in-from-bottom-10">
            <div className="relative p-8">
              {/* Dynamic Aura */}
              <div className="absolute inset-0 bg-teal-500/10 blur-2xl rounded-full logo-pulse" />
              <img 
                src="/logo.png" 
                alt="Expense Tracker" 
                className="h-32 w-32 object-contain relative z-20 drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Minimal Brand Footer */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
            <span className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Expense Tracker</span>
            <div className="h-[2px] w-8 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 animate-[loading-bar_2s_infinite]" style={{ width: '100%', transformOrigin: 'left' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth() {
  return useContext(AuthContext)
}
