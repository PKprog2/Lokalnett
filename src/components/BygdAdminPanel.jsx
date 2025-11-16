import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'

const roleLabels = {
  owner: 'Eier',
  moderator: 'Moderator',
  member: 'Medlem',
}

const roleColors = {
  owner: '#9a3412',
  moderator: '#1d4ed8',
  member: '#374151',
}

export default function BygdAdminPanel({
  open,
  onClose,
  bygdId,
  bygd,
  userRole,
  currentUserId,
  onMembersChanged,
}) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyMap, setBusyMap] = useState({})

  const canModerate = userRole === 'owner' || userRole === 'moderator'
  const isOwner = userRole === 'owner'

  const fetchMembers = useCallback(async () => {
    if (!bygdId || !canModerate) return
    setLoading(true)
    setError('')

    try {
      const { data: memberRows, error: memberError } = await supabase
        .from('bygd_members')
        .select('user_id, joined_at')
        .eq('bygd_id', bygdId)
        .order('joined_at', { ascending: true })

      if (memberError) throw memberError

      const userIds = (memberRows || []).map((row) => row.user_id)
      let profileMap = new Map()

      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds)

        if (profileError) throw profileError
        profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))
      }

      let roleMap = new Map()
      try {
        const { data: roleRows } = await supabase
          .from('bygd_roles')
          .select('user_id, role')
          .eq('bygd_id', bygdId)

        roleMap = new Map((roleRows || []).map((row) => [row.user_id, row.role]))
      } catch (roleError) {
        console.warn('Could not load bygd roles', roleError)
      }

      const enriched = (memberRows || []).map((member) => {
        let role = roleMap.get(member.user_id) || 'member'
        if (member.user_id === bygd?.created_by) {
          role = 'owner'
        }
        return {
          ...member,
          role,
          profile: profileMap.get(member.user_id) || null,
        }
      })

      setMembers(enriched)
    } catch (err) {
      console.error('Error fetching members:', err)
      setError('Kunne ikke laste medlemslisten. Prøv igjen om litt.')
    } finally {
      setLoading(false)
    }
  }, [bygd?.created_by, bygdId, canModerate])

  useEffect(() => {
    if (open && canModerate) {
      fetchMembers()
    }
  }, [open, canModerate, fetchMembers])

  const memberSummary = useMemo(() => {
    const moderators = members.filter((member) => member.role === 'moderator').length
    const ownerCount = members.filter((member) => member.role === 'owner').length
    return {
      total: members.length,
      moderators,
      ownerCount,
    }
  }, [members])

  const setBusy = (userId, value) => {
    setBusyMap((prev) => ({ ...prev, [userId]: value }))
  }

  const clearBusy = (userId) => {
    setBusyMap((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  const promoteToModerator = async (member) => {
    setBusy(member.user_id, 'promote')
    try {
      const { error } = await supabase
        .from('bygd_roles')
        .upsert(
          { bygd_id: bygdId, user_id: member.user_id, role: 'moderator' },
          { onConflict: 'bygd_id,user_id' }
        )

      if (error) throw error
      await fetchMembers()
      onMembersChanged?.()
    } catch (err) {
      console.error('Promote failed:', err)
      alert('Kunne ikke gjøre medlem til moderator: ' + err.message)
    } finally {
      clearBusy(member.user_id)
    }
  }

  const demoteModerator = async (member) => {
    setBusy(member.user_id, 'demote')
    try {
      const { error } = await supabase
        .from('bygd_roles')
        .delete()
        .eq('bygd_id', bygdId)
        .eq('user_id', member.user_id)

      if (error) throw error
      await fetchMembers()
      onMembersChanged?.()
    } catch (err) {
      console.error('Demote failed:', err)
      alert('Kunne ikke fjerne moderator: ' + err.message)
    } finally {
      clearBusy(member.user_id)
    }
  }

  const removeMember = async (member) => {
    if (member.user_id === bygd?.created_by) {
      alert('Du kan ikke fjerne eieren av bygda.')
      return
    }

    if (!isOwner && member.role === 'moderator') {
      alert('Bare eieren kan fjerne andre moderatorer.')
      return
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Vil du fjerne ${member.profile?.display_name || 'dette medlemmet'}?`)
      if (!confirmed) return
    }

    setBusy(member.user_id, 'remove')
    try {
      const { error } = await supabase
        .from('bygd_members')
        .delete()
        .eq('bygd_id', bygdId)
        .eq('user_id', member.user_id)

      if (error) throw error

      await supabase
        .from('bygd_roles')
        .delete()
        .eq('bygd_id', bygdId)
        .eq('user_id', member.user_id)

      await fetchMembers()
      onMembersChanged?.()
    } catch (err) {
      console.error('Remove member failed:', err)
      alert('Kunne ikke fjerne medlem: ' + err.message)
    } finally {
      clearBusy(member.user_id)
    }
  }

  if (!open || !canModerate) {
    return null
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <p style={styles.panelTitle}>Administrer bygda</p>
            <p style={styles.panelSubtitle}>
              {bygd?.name || 'Ukjent bygd'} · {roleLabels[userRole] || 'Medlem'}
            </p>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            Lukk
          </button>
        </div>

        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Medlemmer</span>
            <strong style={styles.summaryValue}>{memberSummary.total}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Moderatorer</span>
            <strong style={styles.summaryValue}>{memberSummary.moderators}</strong>
          </div>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Eiere</span>
            <strong style={styles.summaryValue}>{memberSummary.ownerCount}</strong>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Laster medlemmer…</div>
        ) : members.length === 0 ? (
          <div style={styles.empty}>Ingen medlemmer i denne bygda ennå.</div>
        ) : (
          <div style={styles.memberList}>
            {members.map((member) => {
              const isMe = member.user_id === currentUserId
              const canRemove = member.role !== 'owner' && (isOwner || member.role === 'member') && !isMe
              const showPromote = isOwner && member.role === 'member'
              const showDemote = isOwner && member.role === 'moderator'

              return (
                <div key={member.user_id} style={styles.memberRow}>
                  <div style={styles.memberInfo}>
                    <div style={styles.avatar}>
                      {member.profile?.avatar_url ? (
                        <img src={member.profile.avatar_url} alt="" style={styles.avatarImg} />
                      ) : (
                        <span>{member.profile?.display_name?.[0] || '?'}</span>
                      )}
                    </div>
                    <div>
                      <p style={styles.memberName}>{member.profile?.display_name || 'Ukjent'}</p>
                      <p style={styles.memberMeta}>Medlem siden {formatDate(member.joined_at)}</p>
                    </div>
                  </div>

                  <span style={{ ...styles.roleBadge, backgroundColor: roleColors[member.role] || '#374151' }}>
                    {roleLabels[member.role] || 'Medlem'}
                  </span>

                  <div style={styles.actions}>
                    {showPromote && (
                      <button
                        style={styles.actionButton}
                        onClick={() => promoteToModerator(member)}
                        disabled={!!busyMap[member.user_id]}
                      >
                        {busyMap[member.user_id] ? 'Oppdaterer…' : 'Gjør til moderator'}
                      </button>
                    )}
                    {showDemote && (
                      <button
                        style={styles.secondaryAction}
                        onClick={() => demoteModerator(member)}
                        disabled={!!busyMap[member.user_id]}
                      >
                        {busyMap[member.user_id] ? 'Oppdaterer…' : 'Fjern som moderator'}
                      </button>
                    )}
                    {canRemove && (
                      <button
                        style={styles.dangerAction}
                        onClick={() => removeMember(member)}
                        disabled={!!busyMap[member.user_id]}
                      >
                        {busyMap[member.user_id] === 'remove' ? 'Fjerner…' : 'Fjern medlem'}
                      </button>
                    )}
                    {isMe && <span style={styles.selfTag}>Deg selv</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const formatDate = (dateString) => {
  if (!dateString) return 'ukjent dato'
  return new Date(dateString).toLocaleDateString('no-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: '18px',
    width: 'min(900px, 100%)',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  panelHeader: {
    padding: '24px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  panelTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
  },
  panelSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },
  closeButton: {
    border: 'none',
    backgroundColor: '#1f2937',
    color: 'white',
    borderRadius: '999px',
    padding: '10px 18px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    padding: '16px 24px',
    borderBottom: '1px solid #f0f0f0',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  summaryLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: '#6b7280',
    letterSpacing: '0.04em',
  },
  summaryValue: {
    display: 'block',
    fontSize: '20px',
    marginTop: '6px',
    color: '#111827',
  },
  error: {
    margin: '16px 24px',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    fontSize: '14px',
  },
  loading: {
    padding: '40px 24px',
    textAlign: 'center',
    color: '#4b5563',
  },
  empty: {
    padding: '40px 24px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  },
  memberList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 24px 24px',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 0',
    borderBottom: '1px solid #f3f4f6',
    flexWrap: 'wrap',
  },
  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '200px',
    flex: 1,
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  memberName: {
    margin: 0,
    fontWeight: 600,
    color: '#111827',
  },
  memberMeta: {
    margin: 0,
    color: '#6b7280',
    fontSize: '12px',
  },
  roleBadge: {
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '999px',
    color: 'white',
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: '200px',
  },
  actionButton: {
    border: '1px solid #2563eb',
    color: '#1d4ed8',
    backgroundColor: '#eef2ff',
    borderRadius: '999px',
    padding: '6px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryAction: {
    border: '1px solid #f97316',
    color: '#c2410c',
    backgroundColor: '#ffedd5',
    borderRadius: '999px',
    padding: '6px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerAction: {
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: '999px',
    padding: '6px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  selfTag: {
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
}
