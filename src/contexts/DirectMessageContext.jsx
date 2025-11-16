import { createContext, useCallback, useContext, useState } from 'react'
import DirectMessageModal from '../components/DirectMessageModal'

const DirectMessageContext = createContext(null)

export function DirectMessageProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [initialTarget, setInitialTarget] = useState(null)

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

  return (
    <DirectMessageContext.Provider value={{ openConversationWithUser, openInbox }}>
      {children}
      <DirectMessageModal
        open={modalOpen}
        onClose={closeModal}
        initialTarget={initialTarget}
        clearInitialTarget={() => setInitialTarget(null)}
      />
    </DirectMessageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirectMessaging() {
  return useContext(DirectMessageContext)
}
