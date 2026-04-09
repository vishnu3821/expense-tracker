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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-950 z-[9999] animate-in fade-in duration-500">
        <div className="relative">
          {/* Outer glow effect */}
          <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
          
          {/* Logo container with pulse */}
          <div className="relative logo-pulse flex flex-col items-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-24 w-24 object-contain"
            />
            <div className="mt-8 flex flex-col items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Expense Tracker</h1>
              <div className="h-1 w-12 bg-teal-500 rounded-full overflow-hidden">
                <div className="h-full bg-teal-400 animate-[loading-bar_1.5s_infinite]" style={{ width: '100%', transformOrigin: 'left' }} />
              </div>
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
