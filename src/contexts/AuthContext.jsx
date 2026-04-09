import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety timeout: Ensure loading is set to false after 3 seconds max
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user || null)
      setLoading(false)
      clearTimeout(timeout);
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user || null)
    })

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    }
  }, [])

  const value = {
    session,
    user,
    signOut: () => supabase.auth.signOut(),
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-950 z-[9999] overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.08)_0%,transparent_70%)] animate-pulse" />
        
        <div className="relative flex flex-col items-center">
          {/* Main Logo with High-Impact Animation */}
          <div className="relative z-10 p-10">
            {/* The Outer Glow Ring */}
            <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-3xl" />
            
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/logo.png"
              className="h-64 w-64 object-contain relative z-20 drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]"
            >
              <source src="/Logo-animation.mp4" type="video/mp4" />
              <img src="/logo.png" alt="Logo" className="h-40 w-40" />
            </video>
          </div>

          {/* Minimal Brand Footer at bottom center */}
          <div className="fixed bottom-16 left-0 right-0 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-[1500ms]">
            <h2 className="text-sm font-bold tracking-[0.4em] text-slate-400 uppercase">Expense Tracker</h2>
            <div className="h-[3px] w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 animate-[loading-bar_2.5s_infinite]" style={{ width: '100%', transformOrigin: 'left' }} />
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
