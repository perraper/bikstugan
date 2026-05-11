import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Initiera synkront baserat på URL: om hash:en innehåller type=recovery
  // är vi i reset-flödet redan vid första render — ingen flicker av kalendern.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    return hash.includes('type=recovery')
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    // Skriv inte över befintlig profil med null. Vid signup hinner auth-state
    // skicka SIGNED_IN innan vi insertar users-raden — då får fetchProfile
    // tomt svar, men signUp() sätter profilen direkt efter insert.
    if (data) setProfile(data)
    setLoading(false)
  }

  async function signUp({ email, password, name, phone }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    const { data: inserted, error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        name,
        phone,
        role: 'member',
        approved: false,
      })
      .select('*')
      .single()
    if (profileError) return { error: profileError }

    const autoApproved = !!inserted?.approved

    // Mejla bara admins om kontot kräver manuellt godkännande
    if (!autoApproved) {
      supabase.functions.invoke('send-email', {
        body: { type: 'new_account', userId: data.user.id },
      })
    }

    if (autoApproved) {
      // Auto-godkänd: behåll session så användaren går direkt till kalendern.
      setProfile(inserted)
    } else {
      // Inte godkänd än: logga ut så LoginPage kan visa "Konto skapat — väntar på godkännande".
      await supabase.auth.signOut()
    }

    return { data, autoApproved }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signUp, signIn, signOut,
      isPasswordRecovery,
      clearPasswordRecovery: () => setIsPasswordRecovery(false),
      refreshProfile: () => user && fetchProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
