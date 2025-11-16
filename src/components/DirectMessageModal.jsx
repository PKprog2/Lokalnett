import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const emptyArray = []

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'nå'
  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}t`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default function DirectMessageModal({ open, onClose, initialTarget, clearInitialTarget }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [composerValue, setComposerValue] = useState('')
  const [sending, setSending] = useState(false)
  const [errorText, setErrorText] = useState('')
  const scrollRef = useRef(null)

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchProfiles = useCallback(async (userIds) => {
    if (userIds.length === 0) return {}
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    if (error) throw error
    return (data || []).reduce((acc, profile) => {
      acc[profile.id] = profile
      return acc
    }, {})
  }, [])

  const fetchLatestMessages = useCallback(async (conversationIds) => {
    if (conversationIds.length === 0) return {}
    const { data, error } = await supabase
      .from('direct_messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    if (error) throw error
    const latestMap = {}
    for (const entry of data || []) {
      if (!latestMap[entry.conversation_id]) {
        latestMap[entry.conversation_id] = entry
      }
    }
    return latestMap
  }, [])

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    setLoadingConversations(true)
    setErrorText('')
    try {
      const { data, error } = await supabase
        .from('direct_conversations')
        .select('id, participant_a, participant_b, created_at, last_message_at')
        .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      const rows = data || []
      const partnerIds = Array.from(
        new Set(
          rows.map((row) => (row.participant_a === user.id ? row.participant_b : row.participant_a))
        )
      )

      const [profileMap, latestMessageMap] = await Promise.all([
        fetchProfiles(partnerIds),
        fetchLatestMessages(rows.map((row) => row.id)),
      ])

      const formatted = rows.map((row) => {
        const partnerId = row.participant_a === user.id ? row.participant_b : row.participant_a
        const partnerProfile = profileMap[partnerId] || { display_name: 'Ukjent bruker' }
        const latest = latestMessageMap[row.id]
        return {
          ...row,
          partnerId,
          partnerProfile,
          latestMessage: latest || null,
        }
      })

      setConversations(formatted)
      if (formatted.length === 0) {
        setSelectedConversationId(null)
      } else if (!formatted.some((conv) => conv.id === selectedConversationId)) {
        setSelectedConversationId(formatted[0].id)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
      setErrorText('Kunne ikke laste innboksen. Prøv igjen senere.')
    } finally {
      setLoadingConversations(false)
    }
  }, [fetchLatestMessages, fetchProfiles, selectedConversationId, user?.id])

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages(emptyArray)
      return
    }
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])

      await supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('conversation_id', conversationId)
        .eq('recipient_id', user.id)
    } catch (error) {
      console.error('Error loading messages:', error)
      setErrorText('Kunne ikke laste meldinger.')
    } finally {
      setLoadingMessages(false)
    }
  }, [user?.id])

  const ensureConversation = useCallback(async (targetUser) => {
    if (!user?.id || !targetUser?.id || targetUser.id === user.id) return null
    const sorted = [user.id, targetUser.id].sort()
    try {
      const { data, error } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('participant_a', sorted[0])
        .eq('participant_b', sorted[1])
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      if (data) return data

      const insertPayload = {
        participant_a: sorted[0],
        participant_b: sorted[1],
      }
      const { data: inserted, error: insertError } = await supabase
        .from('direct_conversations')
        .insert([insertPayload])
        .select('*')
        .single()

      if (insertError) throw insertError
      return inserted
    } catch (err) {
      console.error('Error ensuring conversation:', err)
      setErrorText('Kunne ikke opprette samtalen. Prøv igjen senere.')
      return null
    }
  }, [user?.id])

  const handleSendMessage = useCallback(async () => {
    if (!composerValue.trim() || !user?.id || !activeConversation) return
    const partnerId = activeConversation.partnerId
    setSending(true)
    setErrorText('')
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert([
          {
            conversation_id: activeConversation.id,
            sender_id: user.id,
            recipient_id: partnerId,
            content: composerValue.trim(),
          },
        ])
        .select('*')
        .single()

      if (error) throw error

      await supabase
        .from('direct_conversations')
        .update({ last_message_at: data.created_at })
        .eq('id', activeConversation.id)

      setComposerValue('')
      await Promise.all([loadMessages(activeConversation.id), fetchConversations()])
    } catch (err) {
      console.error('Error sending direct message:', err)
      setErrorText('Kunne ikke sende meldingen.')
    } finally {
      setSending(false)
    }
  }, [activeConversation, composerValue, fetchConversations, loadMessages, user?.id])

  useEffect(() => {
    if (!open) return
    fetchConversations()
  }, [fetchConversations, open])

  useEffect(() => {
    if (!open || !initialTarget) return
    const run = async () => {
      const conversation = await ensureConversation(initialTarget)
      if (conversation) {
        setSelectedConversationId(conversation.id)
        await fetchConversations()
      }
      clearInitialTarget()
    }
    run()
  }, [clearInitialTarget, ensureConversation, fetchConversations, initialTarget, open])

  useEffect(() => {
    if (open && selectedConversationId) {
      loadMessages(selectedConversationId)
    }
  }, [loadMessages, open, selectedConversationId])

  useEffect(() => {
    if (!open) {
      setSelectedConversationId(null)
      setMessages(emptyArray)
      setComposerValue('')
      setErrorText('')
    }
  }, [open])

  if (!open || !user) {
    return null
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Direktemeldinger</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.conversationList}>
            {loadingConversations ? (
              <p style={styles.placeholder}>Laster samtaler…</p>
            ) : conversations.length === 0 ? (
              <p style={styles.placeholder}>Ingen meldinger ennå. Start en fra feeden!</p>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === selectedConversationId
                return (
                  <button
                    key={conv.id}
                    type="button"
                    style={{
                      ...styles.conversationItem,
                      backgroundColor: isActive ? '#dfece2' : 'transparent',
                    }}
                    onClick={() => setSelectedConversationId(conv.id)}
                  >
                    <div style={styles.conversationName}>{conv.partnerProfile.display_name}</div>
                    {conv.latestMessage && (
                      <div style={styles.conversationSnippet}>
                        <span>{conv.latestMessage.content.slice(0, 60)}</span>
                        <span style={styles.conversationTime}>{formatRelativeTime(conv.latestMessage.created_at)}</span>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
          <div style={styles.threadPane}>
            {activeConversation ? (
              <>
                <div style={styles.threadHeader}>
                  <div>
                    <p style={styles.threadPartner}>{activeConversation.partnerProfile.display_name}</p>
                    <p style={styles.threadHint}>Samtalen er privat mellom dere to.</p>
                  </div>
                  <button style={styles.closeSmall} onClick={onClose}>
                    Lukk
                  </button>
                </div>
                <div style={styles.messagesArea} ref={scrollRef}>
                  {loadingMessages ? (
                    <p style={styles.placeholder}>Laster meldinger…</p>
                  ) : messages.length === 0 ? (
                    <p style={styles.placeholder}>Ingen meldinger ennå. Si hei!</p>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.sender_id === user.id
                      return (
                        <div
                          key={message.id}
                          style={{
                            ...styles.messageBubble,
                            alignSelf: isMine ? 'flex-end' : 'flex-start',
                            backgroundColor: isMine ? '#2c5f2d' : '#f0f2f5',
                            color: isMine ? 'white' : '#111',
                          }}
                        >
                          <p style={styles.messageText}>{message.content}</p>
                          <span style={styles.messageTime}>{formatRelativeTime(message.created_at)}</span>
                        </div>
                      )
                    })
                  )}
                </div>
                <div style={styles.composer}>
                  <textarea
                    rows={2}
                    value={composerValue}
                    onChange={(e) => setComposerValue(e.target.value)}
                    placeholder="Skriv en melding…"
                    style={styles.composerInput}
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sending || !composerValue.trim()}
                    style={styles.sendButton}
                  >
                    {sending ? 'Sender…' : 'Send'}
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.emptyThreadState}>
                <p>Velg en samtale fra listen for å komme i gang.</p>
              </div>
            )}
            {errorText && <p style={styles.errorText}>{errorText}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '16px',
  },
  modal: {
    width: 'min(1100px, 100%)',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e4e6eb',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
  },
  closeButton: {
    border: 'none',
    background: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  modalBody: {
    display: 'flex',
    minHeight: '420px',
    flex: 1,
  },
  conversationList: {
    width: '32%',
    borderRight: '1px solid #e4e6eb',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
  },
  conversationItem: {
    border: 'none',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  conversationName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#1f1f1f',
  },
  conversationSnippet: {
    fontSize: '12px',
    color: '#666',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  conversationTime: {
    flexShrink: 0,
  },
  placeholder: {
    fontSize: '13px',
    color: '#777',
  },
  threadPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  threadHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #e4e6eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadPartner: {
    margin: 0,
    fontWeight: 600,
    fontSize: '16px',
  },
  threadHint: {
    margin: 0,
    fontSize: '12px',
    color: '#666',
  },
  closeSmall: {
    border: '1px solid #d3d6db',
    borderRadius: '20px',
    padding: '6px 12px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontWeight: 600,
  },
  messagesArea: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: '16px',
    padding: '10px 14px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  messageText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  messageTime: {
    fontSize: '11px',
    opacity: 0.8,
    display: 'block',
    marginTop: '4px',
  },
  composer: {
    padding: '12px 16px',
    borderTop: '1px solid #e4e6eb',
    display: 'flex',
    gap: '8px',
  },
  composerInput: {
    flex: 1,
    borderRadius: '12px',
    border: '1px solid #d3d6db',
    padding: '10px 12px',
    fontSize: '14px',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendButton: {
    border: 'none',
    backgroundColor: '#2c5f2d',
    color: 'white',
    borderRadius: '10px',
    padding: '0 20px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  emptyThreadState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#c33',
    fontSize: '13px',
    padding: '0 16px 12px',
  },
}
