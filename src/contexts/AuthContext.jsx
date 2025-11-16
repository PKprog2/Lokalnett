import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'

const AuthContext = createContext({})

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext)
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const syncProfileRecord = useCallback(async (targetUser) => {
    if (!targetUser?.id) return

    const displayName = targetUser.user_metadata?.display_name
      || targetUser.user_metadata?.full_name
      || targetUser.email?.split('@')[0]
      || 'Uten navn'

    const avatarUrl = targetUser.user_metadata?.avatar_url
      || targetUser.user_metadata?.picture
      || null

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: targetUser.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      console.error('Kunne ikke synkronisere profilrad:', error)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const applySession = (sessionUser) => {
      if (!isMounted) return
      setUser(sessionUser ?? null)
      setLoading(false)
      syncProfileRecord(sessionUser)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [syncProfileRecord])

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        }
      }
    })

    if (!error && data?.user) {
      await syncProfileRecord(data.user)
    }

    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const updateDisplayName = async (newDisplayName) => {
    const trimmed = newDisplayName?.trim()
    if (!trimmed) {
      return { data: null, error: new Error('Visningsnavn kan ikke være tomt') }
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        display_name: trimmed,
      },
    })

    if (!error && data?.user) {
      setUser(data.user)
      await syncProfileRecord(data.user)
    }

    return { data, error }
  }

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (!error) {
      setUser(data?.user ?? null)
      if (data?.user) {
        await syncProfileRecord(data.user)
      }
    }
    return { data, error }
  }

  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_user_account')
    if (error) {
      return { error }
    }

    await signOut()
    return { error: null }
  }

  const signOutEverywhere = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (!error) {
      setUser(null)
    }
    return { error }
  }

  const value = {
    user,
    signUp,
    signIn,
    signOut,
    updateDisplayName,
    deleteAccount,
    refreshUser,
    signOutEverywhere,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
