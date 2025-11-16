import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabaseClient'
import Post from '../components/Post'
import CreatePost from '../components/CreatePost'
import BygdAdminPanel from '../components/BygdAdminPanel'

export default function BygdFeed() {
  const { bygdId } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [bygd, setBygd] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [membershipActionLoading, setMembershipActionLoading] = useState(false)
  const [userRole, setUserRole] = useState('guest')
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [hoveredBygdId, setHoveredBygdId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const canModerate = userRole === 'owner' || userRole === 'moderator'

  const resolveRole = useCallback(async (bygdData, isCurrentlyMember) => {
    if (!user?.id) return 'guest'
    if (bygdData?.created_by === user.id) return 'owner'
    if (!isCurrentlyMember) return 'guest'

    try {
      const { data, error } = await supabase
        .from('bygd_roles')
        .select('role')
        .eq('bygd_id', bygdId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return data?.role || 'member'
    } catch (roleError) {
      console.warn('Error resolving role for bygd', roleError)
      return 'member'
    }
  }, [bygdId, user?.id])

  const refreshMemberCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('bygd_members')
        .select('id', { count: 'exact', head: true })
        .eq('bygd_id', bygdId)

      if (error) throw error

      setBygd((prev) => (prev ? { ...prev, member_count: count ?? prev.member_count } : prev))
    } catch (error) {
      console.error('Error refreshing member count:', error)
    }
  }, [bygdId])

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('bygd_id', bygdId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const enrichLikesWithProfiles = async (likesRows = []) => {
        const userIds = Array.from(new Set(likesRows.map((like) => like.user_id).filter(Boolean)))
        if (userIds.length === 0) return likesRows

        const { data: likeProfiles, error } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds)

        if (error) {
          console.error('Error fetching like profiles:', error)
          return likesRows
        }

        const profileMap = new Map((likeProfiles || []).map((profile) => [profile.id, profile]))
        return likesRows.map((like) => ({
          ...like,
          profiles: profileMap.get(like.user_id) || null,
        }))
      }

      const postsWithDetails = await Promise.all(
        (data || []).map(async (post) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', post.user_id)
            .single()

          const { data: likes } = await supabase
            .from('likes')
            .select('user_id')
            .eq('post_id', post.id)

          return {
            ...post,
            profiles: profile,
            likes: await enrichLikesWithProfiles(likes || []),
          }
        })
      )

      setPosts(postsWithDetails)
    } catch (error) {
      console.error('Error fetching posts:', error)
    }
  }, [bygdId])

  const fetchBygdAndPosts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: bygdData, error: bygdError } = await supabase
        .from('bygder')
        .select('*')
        .eq('id', bygdId)
        .single()

      if (bygdError) throw bygdError
      setBygd(bygdData)

      const { data: membershipData, error: membershipError } = await supabase
        .from('bygd_members')
        .select('id')
        .eq('bygd_id', bygdId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (membershipError) throw membershipError

      const member = !!membershipData
      setIsMember(member)

      await refreshMemberCount()

      if (!member) {
        setUserRole('guest')
        setPosts([])
        return
      }

      const role = await resolveRole(bygdData, member)
      setUserRole(role)
      await fetchPosts()
    } catch (error) {
      console.error('Error fetching bygd:', error)
      navigate('/bygder')
    } finally {
      setLoading(false)
    }
  }, [bygdId, fetchPosts, navigate, refreshMemberCount, resolveRole, user?.id])

  useEffect(() => {
    if (!bygdId || !user?.id) return
    fetchBygdAndPosts()
  }, [bygdId, fetchBygdAndPosts, user?.id])

  useEffect(() => {
    if (!isMember) {
      setAdminPanelOpen(false)
    }
  }, [isMember])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleLeaveBygd = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Er du sikker på at du vil forlate denne bygda?')
      if (!confirmed) return
    }

    setMembershipActionLoading(true)
    try {
      const { error } = await supabase
        .from('bygd_members')
        .delete()
        .eq('bygd_id', bygdId)
        .eq('user_id', user.id)

      if (error) throw error

      setIsMember(false)
  setUserRole('guest')
  setAdminPanelOpen(false)
      setBygd((prev) => (prev ? { ...prev, member_count: Math.max(0, (prev.member_count ?? 1) - 1) } : prev))
      await fetchBygdAndPosts()
      navigate('/bygder')
    } catch (error) {
      console.error('Error leaving bygd:', error)
      alert('Kunne ikke forlate bygda: ' + error.message)
    } finally {
      setMembershipActionLoading(false)
    }
  }

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/?bygd=${bygdId}` : ''

  const handleCopyLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopyStatus('Lenke kopiert!')
      setTimeout(() => setCopyStatus(''), 2000)
    } catch (error) {
      console.error('Error copying link:', error)
      setCopyStatus('Kunne ikke kopiere')
    }
  }

  const handleSendInvite = (event) => {
    event.preventDefault()
    if (!inviteEmail || !inviteLink) return

    const subject = encodeURIComponent(`Bli med i ${bygd?.name || 'bygda mi'} på LokalNett`)
    const body = encodeURIComponent(
      `Hei! Jeg vil invitere deg til å bli med i bygda "${bygd?.name || ''}" på LokalNett. Registrer deg via denne lenken: ${inviteLink}`
    )

    window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`
  }

  const closeShareModal = () => {
    setShareModalOpen(false)
    setInviteEmail('')
    setCopyStatus('')
  }

  const handlePostCreated = () => {
    fetchPosts()
  }

  const initials = (user?.user_metadata?.display_name || user?.email || '?')
    .split(' ')
    .map((word) => word?.[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleOpenSettingsShortcut = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('openSettingsOnBygder', 'true')
    }
    setMenuOpen(false)
    navigate('/bygder')
  }

  const handleGoToMessages = () => {
    setMenuOpen(false)
    navigate('/direktemeldinger')
  }

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  if (loading) {
    return <div style={styles.loading}>Laster...</div>
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <button onClick={() => navigate('/bygder')} style={styles.backButton}>
            ← Mine bygder
          </button>
          <div style={styles.headerControls}>
            {isMember && (
              <div style={styles.headerActions}>
                {canModerate && (
                  <button
                    style={styles.adminButton}
                    onClick={() => setAdminPanelOpen(true)}
                  >
                    Administrer bygda
                  </button>
                )}
                <button
                  style={styles.shareButton}
                  onClick={() => setShareModalOpen(true)}
                >
                  Del bygda
                </button>
                <button
                  style={styles.leaveButton}
                  onClick={handleLeaveBygd}
                  disabled={membershipActionLoading}
                >
                  {membershipActionLoading ? 'Forlater...' : 'Forlat bygda'}
                </button>
              </div>
            )}
            <div style={styles.userMenuWrapper} ref={userMenuRef}>
              <button
                style={styles.initialsButton}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                {initials}
              </button>
              {menuOpen && (
                <div style={styles.userMenu}>
                  <button style={styles.menuItem} onClick={handleOpenSettingsShortcut}>
                    Innstillinger
                  </button>
                  <button style={styles.menuItem} onClick={handleGoToMessages}>
                    Direktemeldinger
                  </button>
                  <button style={styles.menuItem} onClick={handleSignOut}>
                    Logg ut
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={styles.headerInfo}>
          <h1 style={styles.title}>{bygd?.name}</h1>
          {bygd?.description && (
            <p style={styles.description}>{bygd.description}</p>
          )}
          <div style={styles.stats}>
            {bygd?.member_count ?? 0} / {bygd?.max_members} medlemmer
          </div>
        </div>
      </header>

      <div style={styles.content}>
        {isMember ? (
          <>
            <CreatePost bygdId={bygdId} onPostCreated={handlePostCreated} />
            <div style={styles.postsContainer}>
              {posts.length === 0 ? (
                <div style={styles.emptyState}>
                  <p>Ingen innlegg ennå. Vær den første til å dele noe!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <Post
                    key={post.id}
                    post={post}
                    currentUserId={user.id}
                    canModerate={canModerate}
                    onUpdate={fetchPosts}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div style={styles.accessCard}>
            <h2 style={styles.accessTitle}>Bli medlem for å se innhold</h2>
            <p style={styles.accessText}>
              Du har ikke tilgang til denne bygda ennå. Gå tilbake til oversikten og bli med for å se innleggene.
            </p>
            <button style={styles.accessButton} onClick={() => navigate('/bygder')}>
              Finn bygder
            </button>
          </div>
        )}
      </div>

      {shareModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <button style={styles.modalClose} onClick={closeShareModal} aria-label="Lukk">
              ×
            </button>
            <h2 style={styles.modalTitle}>Del bygda</h2>
            <p style={styles.modalDescription}>
              Send lenken til en venn eller bruk e-post for å invitere andre direkte.
            </p>

            <div style={styles.modalSection}>
              <label style={styles.modalLabel}>Direktelenke</label>
              <div style={styles.modalLinkRow}>
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  style={styles.modalLinkInput}
                />
                <button style={styles.modalSecondaryButton} onClick={handleCopyLink}>
                  {copyStatus || 'Kopier'}
                </button>
              </div>
            </div>

            <form style={styles.modalSection} onSubmit={handleSendInvite}>
              <label style={styles.modalLabel}>Send e-postinvitasjon</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="venn@epost.no"
                style={styles.modalInput}
                required
              />
              <button type="submit" style={styles.modalPrimaryButton}>
                Send e-post
              </button>
            </form>

            <p style={styles.modalHint}>
              Invitasjonslenken tar mottakeren til registrering. Etter fullført registrering sendes de rett til denne bygda.
            </p>
          </div>
        </div>
      )}

      {canModerate && (
        <BygdAdminPanel
          open={adminPanelOpen}
          onClose={() => setAdminPanelOpen(false)}
          bygdId={bygdId}
          bygd={bygd}
          userRole={userRole}
          currentUserId={user.id}
          onMembersChanged={() => {
            refreshMemberCount()
          }}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c5f2d',
    color: 'white',
    padding: '20px',
    borderBottomLeftRadius: '16px',
    borderBottomRightRadius: '16px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  headerControls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  headerInfo: {
    marginTop: '16px',
  },
  settingsButton: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '28px',
  },
  description: {
    margin: 0,
    opacity: 0.9,
    fontSize: '14px',
  },
  stats: {
    marginTop: '8px',
    fontSize: '12px',
    opacity: 0.8,
  },
  adminButton: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  shareButton: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.3)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  leaveButton: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  content: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '18px',
  },
  postsContainer: {
    marginTop: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px',
    color: '#666',
  },
  accessCard: {
    marginTop: '40px',
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '40px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
  },
  accessTitle: {
    margin: '0 0 12px 0',
    fontSize: '24px',
    color: '#2c5f2d',
  },
  accessText: {
    margin: '0 0 24px 0',
    color: '#555',
    fontSize: '15px',
  },
  accessButton: {
    padding: '12px 24px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '999px',
    fontSize: '15px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '500px',
    backgroundColor: '#fff',
    borderRadius: '18px',
    padding: '32px',
    position: 'relative',
    boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
  },
  modalClose: {
    position: 'absolute',
    top: '12px',
    right: '16px',
    border: 'none',
    background: 'transparent',
    fontSize: '26px',
    cursor: 'pointer',
  },
  modalTitle: {
    margin: '0 0 6px 0',
    fontSize: '24px',
    color: '#1f2a1c',
  },
  modalDescription: {
    margin: '0 0 18px 0',
    color: '#4a4a4a',
  },
  modalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  modalLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1f2a1c',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  modalLinkRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modalLinkInput: {
    flex: '1 1 220px',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  modalSecondaryButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #2c5f2d',
    backgroundColor: '#fff',
    color: '#2c5f2d',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalInput: {
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  modalPrimaryButton: {
    padding: '12px 20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#2c5f2d',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  modalHint: {
    fontSize: '13px',
    color: '#4a4a4a',
    margin: 0,
  },
  userMenuWrapper: {
    position: 'relative',
  },
  initialsButton: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.25)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textTransform: 'uppercase',
  },
  userMenu: {
    position: 'absolute',
    top: '50px',
    right: 0,
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    padding: '6px',
    minWidth: '200px',
    zIndex: 20,
  },
  menuItem: {
    width: '100%',
    border: 'none',
    background: 'none',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 600,
    color: '#1f2a1c',
  },
}
