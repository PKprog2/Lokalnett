import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './AuthContext'
import DirectMessageModal from '../components/DirectMessageModal'

const DirectMessageContext = createContext(null)

export function DirectMessageProvider({ children }) {
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [initialTarget, setInitialTarget] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }
    try {
      const { count, error } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null)

      if (error) throw error
      setUnreadCount(count ?? 0)
    } catch (err) {
      console.error('Error refreshing unread count:', err)
      setUnreadCount((prev) => prev)
    }
  }, [user?.id])

  useEffect(() => {
    refreshUnreadCount()
  }, [refreshUnreadCount])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`direct-messages-unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshUnreadCount, user?.id])

  const openConversationWithUser = useCallback((targetUser) => {
    if (!targetUser?.id) return
    setInitialTarget(targetUser)
    setModalOpen(true)
  }, [])

  const openInbox = useCallback(() => {
    setInitialTarget(null)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  const contextValue = useMemo(
    () => ({
      openConversationWithUser,
      openInbox,
      unreadCount,
      refreshUnreadCount,
    }),
    [openConversationWithUser, openInbox, refreshUnreadCount, unreadCount]
  )

  return (
    <DirectMessageContext.Provider value={contextValue}>
      {children}
      <DirectMessageModal
        open={modalOpen}
        onClose={closeModal}
        initialTarget={initialTarget}
        clearInitialTarget={() => setInitialTarget(null)}
        refreshUnreadCount={refreshUnreadCount}
      />
    </DirectMessageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirectMessaging() {
  return useContext(DirectMessageContext)
}
