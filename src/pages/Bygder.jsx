import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDirectMessaging } from '../contexts/DirectMessageContext'
import { supabase } from '../utils/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Bygder() {
  const [bygder, setBygder] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBygdName, setNewBygdName] = useState('')
  const [newBygdDescription, setNewBygdDescription] = useState('')
  const defaultBackground = new URL('../../pictures/hareid.jpg', import.meta.url).href
  const [backgroundImage, setBackgroundImage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bygdBackground') || defaultBackground
    }
    return defaultBackground
  })
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bygdDarkMode') === 'true'
    }
    return false
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [allBygder, setAllBygder] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [joiningBygdId, setJoiningBygdId] = useState(null)
  const [roleMap, setRoleMap] = useState({})
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [displayNameStatus, setDisplayNameStatus] = useState(null)
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [globalLogoutStatus, setGlobalLogoutStatus] = useState(null)
  const [globalLogoutLoading, setGlobalLogoutLoading] = useState(false)
  const [copyState, setCopyState] = useState('Kopier')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [isCreateButtonHovered, setIsCreateButtonHovered] = useState(false)
  const [hoveredBygdId, setHoveredBygdId] = useState(null)
  const { user, signOut, updateDisplayName, deleteAccount, signOutEverywhere } = useAuth()
  const messaging = useDirectMessaging()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const userMenuRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    fetchBygder()
    fetchAllBygder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchRoleMap = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('bygd_roles')
        .select('bygd_id, role')
        .eq('user_id', user.id)

      if (error) throw error

      const map = {}
      for (const entry of data || []) {
        map[entry.bygd_id] = entry.role
      }
      setRoleMap(map)
    } catch (error) {
      console.error('Error fetching roles for bygder:', error)
      setRoleMap({})
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setRoleMap({})
      return
    }
    fetchRoleMap()
  }, [fetchRoleMap, user?.id])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bygdBackground', backgroundImage)
    }
  }, [backgroundImage])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bygdDarkMode', darkMode)
    }
  }, [darkMode])

  useEffect(() => {
    if (!user) {
      setDisplayNameInput('')
      return
    }
    const fallbackName = user.user_metadata?.display_name || user.email?.split('@')[0] || ''
    setDisplayNameInput(fallbackName)
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('openSettingsOnBygder') === 'true') {
      localStorage.removeItem('openSettingsOnBygder')
      setIsSettingsOpen(true)
    }
  }, [])

  const fetchBygder = async () => {
    try {
      const { data, error } = await supabase
        .from('bygder')
        .select(`
          *,
          bygd_members!inner(user_id)
        `)
        .eq('bygd_members.user_id', user.id)

      if (error) throw error

      const enrichedBygder = await Promise.all(
        (data || []).map(async (bygd) => {
          try {
            const { count, error: countError } = await supabase
              .from('bygd_members')
              .select('id', { count: 'exact', head: true })
              .eq('bygd_id', bygd.id)

            if (countError) throw countError
            return { ...bygd, member_count: count ?? bygd.member_count }
          } catch (countErr) {
            console.error('Error fetching member count for bygd', bygd.id, countErr)
            return bygd
          }
        })
      )

      setBygder(enrichedBygder)
    } catch (error) {
      console.error('Error fetching bygder:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllBygder = async () => {
    try {
      const { data, error } = await supabase
        .from('bygder')
        .select('id, name, member_count, max_members')
        .order('name', { ascending: true })

      if (error) throw error
      setAllBygder(data || [])
    } catch (error) {
      console.error('Error fetching all bygder:', error)
    }
  }

  

  const createBygd = async (e) => {
    e.preventDefault()
    try {
      // Call the PostgreSQL function to create bygd (bypasses RLS issues)
      const { error } = await supabase
        .rpc('create_bygd', {
          bygd_name: newBygdName,
          bygd_description: newBygdDescription,
          user_id: user.id
        })

      if (error?.message?.includes('finnes allerede')) {
        alert('Denne bygden finnes allerede. Velg et annet navn.')
        return
      }
      if (error) throw error

      setNewBygdName('')
      setNewBygdDescription('')
      setShowCreateForm(false)
      fetchBygder()
      fetchRoleMap()
    } catch (error) {
      console.error('Error creating bygd:', error)
      alert('Kunne ikke opprette bygd: ' + error.message)
    }
  }

  const handleBackgroundUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBackgroundImage(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDarkModeToggle = () => {
    setDarkMode((prev) => !prev)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleJoinBygd = async (bygdId, options = {}) => {
    const { silent = false, autoNavigate = true } = options
    if (!user?.id) return
    if (!silent) {
      setJoiningBygdId(bygdId)
    }

    try {
      const { error } = await supabase
        .from('bygd_members')
        .insert({
          bygd_id: bygdId,
          user_id: user.id,
        })

      if (error) throw error

      await fetchBygder()
      await fetchAllBygder()
      fetchRoleMap()
      if (autoNavigate) {
        navigate(`/bygd/${bygdId}`)
      }
    } catch (error) {
      console.error('Error joining bygd:', error)
      alert('Kunne ikke bli med i bygda: ' + error.message)
    } finally {
      if (!silent) {
        setJoiningBygdId(null)
      }
    }
  }

  const handleSettingsOpen = () => {
    setMenuOpen(false)
    setDisplayNameStatus(null)
    setDeleteStatus(null)
    setIsSettingsOpen(true)
  }

  const handleCloseSettings = () => {
    setIsSettingsOpen(false)
    setDisplayNameStatus(null)
    setDeleteStatus(null)
    setDeleteConfirmation('')
  }

  const handleDisplayNameSave = async () => {
    setDisplayNameStatus(null)
    const trimmed = displayNameInput.trim()
    if (!trimmed) {
      setDisplayNameStatus({ type: 'error', text: 'Visningsnavn kan ikke være tomt.' })
      return
    }

    setSavingDisplayName(true)
    const { error } = await updateDisplayName(trimmed)
    if (error) {
      setDisplayNameStatus({ type: 'error', text: error.message })
    } else {
      setDisplayNameStatus({ type: 'success', text: 'Visningsnavn oppdatert.' })
    }
    setSavingDisplayName(false)
  }

  const handleAccountDeletion = async () => {
    if (deleteConfirmation !== 'SLETT') return
    setDeletingAccount(true)
    setDeleteStatus(null)
    const { error } = await deleteAccount()
    if (error) {
      const message = error.message?.includes('delete_user_account')
        ? 'Manglende databasefunksjon. Se DATABASE_SCHEMA.md for hvordan den opprettes.'
        : error.message
      setDeleteStatus({ type: 'error', text: message || 'Kunne ikke slette konto.' })
      setDeletingAccount(false)
      return
    }
    setDeleteStatus({ type: 'success', text: 'Kontoen er slettet. Vi sender deg til forsiden…' })
    setTimeout(() => navigate('/'), 1200)
  }

  const handleGlobalLogout = async () => {
    setGlobalLogoutLoading(true)
    setGlobalLogoutStatus(null)
    const { error } = await signOutEverywhere()
    if (error) {
      setGlobalLogoutStatus({ type: 'error', text: error.message })
    } else {
      setGlobalLogoutStatus({ type: 'success', text: 'Du er logget ut på alle enheter.' })
      setTimeout(() => navigate('/'), 800)
    }
    setGlobalLogoutLoading(false)
  }

  const handleCopyUserId = async () => {
    if (!user?.id || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(user.id)
      setCopyState('Kopiert!')
    } catch (error) {
      console.error('Kunne ikke kopiere bruker-ID', error)
      setCopyState('Kunne ikke kopiere')
    } finally {
      setTimeout(() => setCopyState('Kopier'), 2000)
    }
  }

  const handleResetBackground = () => {
    setBackgroundImage(defaultBackground)
    if (typeof window !== 'undefined') {
      localStorage.setItem('bygdBackground', defaultBackground)
    }
  }

  const providerKey = user?.app_metadata?.provider || 'email'
  const providerLabelMap = {
    email: 'E-post og passord',
    google: 'Google',
    azure: 'Microsoft',
    apple: 'Apple'
  }
  const providerLabel = providerLabelMap[providerKey] || providerKey
  const lastSignInFormatted = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString('nb-NO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Ukjent'

  const initials = (user?.user_metadata?.display_name || user?.email || '?')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!user?.id || loading) return
    if (typeof window === 'undefined') return
    const pendingBygdId = localStorage.getItem('inviteBygdId')
    if (!pendingBygdId) return

    const alreadyMember = bygder.some((bygd) => bygd.id === pendingBygdId)

    const handleInvite = async () => {
      if (alreadyMember) {
        localStorage.removeItem('inviteBygdId')
        navigate(`/bygd/${pendingBygdId}`)
        return
      }

      await handleJoinBygd(pendingBygdId, { silent: true, autoNavigate: true })
      localStorage.removeItem('inviteBygdId')
    }

    handleInvite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, bygder, loading])

  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  useEffect(() => {
    if (!isSearchActive) return
    const handleOutsideSearchClick = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchActive(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideSearchClick)
    return () => document.removeEventListener('mousedown', handleOutsideSearchClick)
  }, [isSearchActive])

  const styles = getStyles(darkMode, backgroundImage)
  const memberIds = new Set(bygder.map((bygd) => bygd.id))
  const getRoleForBygd = (bygd) => {
    if (!bygd) return null
    if (bygd.created_by === user?.id) return 'owner'
    return roleMap[bygd.id] || null
  }
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredSearchResults = normalizedQuery
    ? allBygder.filter((bygd) => bygd.name?.toLowerCase().includes(normalizedQuery))
    : []
  const unreadCount = messaging?.unreadCount ?? 0
  const hasUnreadMessages = unreadCount > 0
  const unreadDisplay = unreadCount > 99 ? '99+' : `${unreadCount}`

  if (loading) {
    return <div style={styles.loading}>Laster...</div>
  }

  return (
    <div style={styles.container}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleBackgroundUpload(e)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
      />
      <header style={styles.header}>
        <h1 style={styles.title}>Mine bygder</h1>
        <div style={styles.userMenuWrapper} ref={userMenuRef}>
          <div style={styles.initialsButtonWrapper}>
            <button
              style={styles.initialsButton}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {initials}
            </button>
            {hasUnreadMessages && <span style={styles.unreadBadge}>{unreadDisplay}</span>}
          </div>
          {menuOpen && (
            <div
              style={styles.userMenu}
              className="user-menu-dropdown"
              data-theme={darkMode ? 'dark' : 'light'}
            >
              <button
                className="user-menu-item"
                style={styles.menuItem}
                onClick={handleSettingsOpen}
              >
                Innstillinger
              </button>
              <button
                className="user-menu-item"
                style={{
                  ...styles.menuItem,
                  ...(hasUnreadMessages ? styles.menuItemWithBadge : null),
                }}
                onClick={() => {
                  messaging.openInbox()
                  setMenuOpen(false)
                }}
              >
                <span>Direktemeldinger</span>
                {hasUnreadMessages && <span style={styles.menuBadge}>{unreadDisplay}</span>}
              </button>
              <button
                className="user-menu-item"
                style={styles.menuItem}
                onClick={() => fileInputRef.current?.click()}
              >
                Endre bakgrunn
              </button>
              <button
                className="user-menu-item"
                style={styles.menuItem}
                onClick={handleDarkModeToggle}
              >
                {darkMode ? 'Lys modus' : 'Mørk modus'}
              </button>
              <button
                className="user-menu-item"
                style={styles.menuItem}
                onClick={handleSignOut}
              >
                Logg ut
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={styles.content}>
        <div style={styles.mainColumn}>
          <div style={styles.actionsRow}>
            <div style={styles.inlineSearchWrapper} ref={searchRef}>
              <span style={styles.searchIcon}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Finn en bygd..."
                style={styles.inlineSearchInput}
                onFocus={() => setIsSearchActive(true)}
              />
              {isSearchActive && normalizedQuery !== '' && (
                <div style={styles.inlineSearchDropdown}>
                  {filteredSearchResults.length === 0 ? (
                    <p style={styles.searchEmpty}>Fant ingen bygder som matcher "{searchQuery}".</p>
                  ) : (
                    filteredSearchResults.map((bygd) => {
                      const alreadyMember = memberIds.has(bygd.id)
                      return (
                        <div
                          key={bygd.id}
                          style={{
                            ...styles.inlineSearchResult,
                            cursor: alreadyMember ? 'pointer' : 'default',
                            opacity: joiningBygdId === bygd.id ? 0.7 : 1,
                          }}
                          onClick={alreadyMember ? () => navigate(`/bygd/${bygd.id}`) : undefined}
                        >
                          <div>
                            <p style={styles.searchResultName}>{bygd.name}</p>
                            <p style={styles.searchResultMeta}>
                              {bygd.member_count} medlemmer
                              {alreadyMember && <span style={styles.memberPill}>Allerede medlem</span>}
                            </p>
                          </div>
                          {!alreadyMember && (
                            <button
                              style={{
                                ...styles.joinButton,
                                opacity: joiningBygdId === bygd.id ? 0.6 : 1,
                                cursor: joiningBygdId === bygd.id ? 'not-allowed' : 'pointer',
                              }}
                              disabled={joiningBygdId === bygd.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleJoinBygd(bygd.id)
                              }}
                            >
                              {joiningBygdId === bygd.id ? 'Blir med...' : 'Bli med'}
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              onMouseEnter={() => setIsCreateButtonHovered(true)}
              onMouseLeave={() => setIsCreateButtonHovered(false)}
              style={{
                ...styles.createButton,
                ...(isCreateButtonHovered ? styles.createButtonHover : null),
              }}
            >
              {showCreateForm ? 'Avbryt' : '+ Opprett ny bygd'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={createBygd} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Bygdnavn</label>
                <input
                  type="text"
                  value={newBygdName}
                  onChange={(e) => setNewBygdName(e.target.value)}
                  style={styles.input}
                  placeholder="F.eks. Bjørkelangen"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Beskrivelse</label>
                <textarea
                  value={newBygdDescription}
                  onChange={(e) => setNewBygdDescription(e.target.value)}
                  style={styles.textarea}
                  placeholder="Fortell om bygda..."
                  rows={3}
                />
              </div>
              <button type="submit" style={styles.submitButton}>
                Opprett bygd
              </button>
            </form>
          )}

          {bygder.length === 0 ? (
            <div style={styles.emptyState}>
              <p>Du er ikke medlem av noen bygder ennå.</p>
              <p>Opprett en bygd eller få en invitasjon fra andre!</p>
            </div>
          ) : (
            <div style={styles.bygderList}>
              {bygder.map((bygd) => {
                const role = getRoleForBygd(bygd)

                return (
                  <div
                    key={bygd.id}
                    style={{
                      ...styles.bygdCard,
                      ...(hoveredBygdId === bygd.id ? styles.bygdCardHover : null),
                    }}
                    onMouseEnter={() => setHoveredBygdId(bygd.id)}
                    onMouseLeave={() => setHoveredBygdId(null)}
                    onClick={() => navigate(`/bygd/${bygd.id}`)}
                  >
                    <div style={styles.bygdHeader}>
                      <h3 style={styles.bygdName}>{bygd.name}</h3>
                      {role && (
                        <span style={styles.roleBadge(role)}>
                          {role === 'owner' ? 'Eier' : 'Moderator'}
                        </span>
                      )}
                    </div>
                    {bygd.description && (
                      <p style={styles.bygdDescription}>{bygd.description}</p>
                    )}
                    <div style={styles.bygdStats}>
                      <span>{bygd.member_count} / {bygd.max_members} medlemmer</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div style={styles.settingsOverlay}>
          <div style={styles.settingsModal}>
            <div style={styles.settingsHeader}>
              <div>
                <h2 style={styles.settingsTitle}>Kontoinnstillinger</h2>
                <p style={styles.settingsSubtitle}>Administrer profil, utseende og sikkerhet.</p>
              </div>
              <button style={styles.closeButton} onClick={handleCloseSettings}>
                ×
              </button>
            </div>

            <div style={styles.settingsBody}>
              <section style={styles.settingsSection}>
                <h3 style={styles.sectionTitle}>Profil</h3>
                <label style={styles.settingsLabel} htmlFor="displayNameInput">Visningsnavn</label>
                <input
                  id="displayNameInput"
                  style={styles.settingsInput}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ditt navn slik andre ser det"
                />
                <div style={styles.settingsActions}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={handleDisplayNameSave}
                    disabled={savingDisplayName}
                  >
                    {savingDisplayName ? 'Lagrer…' : 'Oppdater navn'}
                  </button>
                </div>
                {displayNameStatus && (
                  <p style={styles.feedback(displayNameStatus.type)}>
                    {displayNameStatus.text}
                  </p>
                )}

                <div style={styles.infoGrid}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>E-post</span>
                    <span style={styles.infoValue}>{user?.email || '—'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Innloggingstype</span>
                    <span style={styles.infoValue}>{providerLabel}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Sist innlogget</span>
                    <span style={styles.infoValue}>{lastSignInFormatted}</span>
                  </div>
                  <div style={{ ...styles.infoRow, flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={styles.infoLabel}>Bruker-ID</span>
                    <div style={styles.copyWrapper}>
                      <code style={styles.infoCode}>{user?.id}</code>
                      <button type="button" style={styles.copyButton} onClick={handleCopyUserId}>
                        {copyState}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section style={styles.settingsSection}>
                <h3 style={styles.sectionTitle}>Utseende</h3>
                <p style={styles.sectionSubtitle}>Disse valgene gjelder kun på denne enheten.</p>

                <div style={styles.preferenceRow}>
                  <div>
                    <p style={styles.preferenceTitle}>Modus</p>
                    <p style={styles.preferenceHint}>Veksle mellom mørkt og lyst tema for bygdeoversikten.</p>
                  </div>
                  <button type="button" style={styles.secondaryButton} onClick={handleDarkModeToggle}>
                    {darkMode ? 'Bruk lyst tema' : 'Bruk mørkt tema'}
                  </button>
                </div>

                <div style={styles.preferenceRow}>
                  <div>
                    <p style={styles.preferenceTitle}>Bakgrunnsbilde</p>
                    <p style={styles.preferenceHint}>Last opp din egen bakgrunn eller tilbakestill til standard.</p>
                  </div>
                  <div style={styles.preferenceButtons}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Last opp nytt
                    </button>
                    <button
                      type="button"
                      style={styles.ghostButton}
                      onClick={handleResetBackground}
                    >
                      Tilbakestill
                    </button>
                  </div>
                </div>
              </section>

              <section style={styles.settingsSection}>
                <h3 style={styles.sectionTitle}>Sikkerhet</h3>
                <div style={styles.preferenceRow}>
                  <div>
                    <p style={styles.preferenceTitle}>Logg ut på alle enheter</p>
                    <p style={styles.preferenceHint}>Bruk dette hvis du har logget inn på en delt eller tapt enhet.</p>
                  </div>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleGlobalLogout}
                    disabled={globalLogoutLoading}
                  >
                    {globalLogoutLoading ? 'Logger ut…' : 'Logg ut alle enheter'}
                  </button>
                </div>
                {globalLogoutStatus && (
                  <p style={styles.feedback(globalLogoutStatus.type)}>
                    {globalLogoutStatus.text}
                  </p>
                )}

                <div style={styles.dangerBox}>
                  <h4 style={styles.dangerTitle}>Slett konto</h4>
                  <p style={styles.preferenceHint}>
                    Dette fjerner bygde-medlemskap, innlegg og kontoen din permanent. Skriv «SLETT» for å bekrefte.
                  </p>
                  <input
                    style={styles.dangerInput}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value.toUpperCase())}
                    placeholder="Skriv SLETT for å bekrefte"
                  />
                  <button
                    type="button"
                    style={styles.dangerButton}
                    disabled={deleteConfirmation !== 'SLETT' || deletingAccount}
                    onClick={handleAccountDeletion}
                  >
                    {deletingAccount ? 'Sletter…' : 'Slett konto'}
                  </button>
                  {deleteStatus && (
                    <p style={styles.feedback(deleteStatus.type)}>
                      {deleteStatus.text}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const getStyles = (darkMode, backgroundImage) => {
  const palette = {
    text: darkMode ? '#f5f5f5' : '#1d1d1d',
    cardBg: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
    cardShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
    buttonBg: darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(32,67,54,0.85)',
  }

  return {
    container: {
      minHeight: '100vh',
      backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      color: palette.text,
    },
    header: {
      backgroundColor: 'rgba(17,42,33,0.85)',
      color: '#fff',
      padding: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    },
    title: {
      margin: 0,
      fontSize: '24px',
    },
    userMenuWrapper: {
      position: 'relative',
    },
    initialsButtonWrapper: {
      position: 'relative',
      display: 'inline-flex',
    },
    initialsButton: {
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
      fontSize: '14px',
      textTransform: 'uppercase',
    },
    unreadBadge: {
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      backgroundColor: '#ff4d4f',
      color: '#fff',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 5px',
      minWidth: '18px',
      lineHeight: 1.1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    },
    userMenu: {
      position: 'absolute',
      top: '50px',
      right: 0,
      backgroundColor: darkMode ? 'rgba(12, 24, 20, 0.92)' : '#fff',
      borderRadius: '8px',
      boxShadow: palette.cardShadow,
      padding: '8px 14px 8px 5px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '225px',
      zIndex: 10,
      backdropFilter: 'blur(12px)',
    },
    menuItem: {
      background: 'none',
      border: 'none',
      color: palette.text,
      textAlign: 'left',
      padding: '10px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      width: '100%',
      margin: '2px 4px',
      transition: 'background-color 0.15s ease, color 0.15s ease',
    },
    menuItemWithBadge: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
    },
    menuBadge: {
      backgroundColor: '#ff4d4f',
      color: '#fff',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 7px',
      minWidth: '22px',
      textAlign: 'center',
      lineHeight: 1.2,
    },
    content: {
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '20px',
      width: 'calc(100% - 8px)',
    },
    mainColumn: {
      flex: '1 1 100%',
      minWidth: '280px',
    },
    actionsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'stretch',
      marginBottom: '24px',
    },
    inlineSearchWrapper: {
      position: 'relative',
      flex: '1 1 260px',
      minWidth: '220px',
      maxWidth: '200px',
    },
    searchIcon: {
      position: 'absolute',
      left: '10px',
      top: '47%',
      transform: 'translateY(-55%)',
      color: palette.text,
      opacity: 0.7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    inlineSearchInput: {
      width: '100%',
      padding: '10px 10px 10px 34px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.35)',
      backgroundColor: 'rgba(232, 232, 232, 1)',
      color: palette.text,
      fontSize: '14px',
      lineHeight: 1.4,
    },
    inlineSearchDropdown: {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      left: 0,
      width: '100%',
      minWidth: '100%',
      maxHeight: '320px',
      overflowY: 'auto',
      backgroundColor: '#ffffff',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '8px',
      boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
      padding: '12px',
      zIndex: 20,
    },
    inlineSearchResult: {
      backgroundColor: darkMode ? '#1f2933' : '#f3f4f6',
      padding: '10px',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontSize: '18px',
      color: '#fff',
    },
    createButton: {
      padding: '12px 24px',
      backgroundColor: palette.buttonBg,
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer',
      flex: '0 0 260px',
      minWidth: '220px',
      maxWidth: '320px',
      marginBottom: 0,
      marginLeft: 'auto',
      textAlign: 'center',
      transition: 'background-color 0.2s ease, filter 0.2s ease',
    },
    createButtonHover: {
      backgroundColor: 'rgba(38, 81, 64, 0.95)',
      filter: 'brightness(1.08)',
    },
    form: {
      backgroundColor: palette.cardBg,
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      boxShadow: palette.cardShadow,
      backdropFilter: 'blur(10px)',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: palette.text,
    },
    input: {
      padding: '10px',
      border: '1px solid rgba(255,255,255,0.4)',
      borderRadius: '5px',
      fontSize: '14px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: palette.text,
    },
    textarea: {
      padding: '10px',
      border: '1px solid rgba(255,255,255,0.4)',
      borderRadius: '5px',
      fontSize: '14px',
      resize: 'vertical',
      minHeight: '80px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: palette.text,
    },
    submitButton: {
      padding: '12px 20px',
      backgroundColor: palette.buttonBg,
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      marginTop: '10px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      backgroundColor: palette.cardBg,
      borderRadius: '8px',
      color: palette.text,
      boxShadow: palette.cardShadow,
      backdropFilter: 'blur(10px)',
    },
    bygderList: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '16px',
    },
    bygdCard: {
      backgroundColor: palette.cardBg,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: palette.cardShadow,
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
    },
    bygdCardHover: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      transform: 'translateY(0px)',
    },
    bygdHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
    },
    bygdName: {
      margin: '0 0 8px 0',
      fontSize: '18px',
      color: palette.text,
    },
    roleBadge: (role) => ({
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      padding: '3px 10px',
      borderRadius: '999px',
      color: role === 'owner' ? '#92400e' : '#1d4ed8',
      backgroundColor: role === 'owner' ? 'rgba(250,204,21,0.3)' : 'rgba(191,219,254,0.4)',
    }),
    bygdDescription: {
      margin: '0 0 12px 0',
      color: palette.text,
      fontSize: '14px',
      opacity: 0.85,
    },
    bygdStats: {
      fontSize: '12px',
      color: palette.text,
      opacity: 0.75,
    },
    searchCard: {
      backgroundColor: palette.cardBg,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: palette.cardShadow,
      width: '100%',
      maxWidth: '3200px',
      backdropFilter: 'blur(10px)',
    },
    searchTitle: {
      margin: 0,
      fontSize: '20px',
    },
    searchHint: {
      margin: 0,
      fontSize: '14px',
      color: palette.text,
      opacity: 0.85,
    },
    searchInput: {
      width: '100%',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,1)',
      marginBottom: '12px',
      backgroundColor: 'rgba(255,255,255,1)',
      color: palette.text,
      fontSize: '14px',
    },
    searchResults: {
      maxHeight: '420px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    searchPlaceholder: {
      margin: 0,
      fontSize: '14px',
      color: palette.text,
      opacity: 0.75,
    },
    searchEmpty: {
      margin: 0,
      fontSize: '14px',
      color: palette.text,
      opacity: 0.8,
    },
    searchResult: {
      backgroundColor: darkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0,0,0,1)',
      padding: '12px',
      borderRadius: '8px',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      boxShadow: palette.cardShadow,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    },
    searchResultName: {
      margin: '0 0 4px 0',
      fontWeight: 600,
    },
    searchResultMeta: {
      margin: 0,
      fontSize: '13px',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      color: palette.text,
      opacity: 0.8,
    },
    memberPill: {
      fontSize: '11px',
      backgroundColor: 'rgba(248,197,55,0.2)',
      color: palette.text,
      padding: '2px 8px',
      borderRadius: '999px',
    },
    joinButton: {
      padding: '8px 16px',
      borderRadius: '999px',
      border: 'none',
      backgroundColor: palette.buttonBg,
      color: '#fff',
      fontWeight: 600,
      cursor: 'pointer',
      minWidth: '90px',
    },
    settingsOverlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '40px 16px',
      zIndex: 100,
      overflowY: 'auto',
    },
    settingsModal: {
      width: '100%',
      maxWidth: '720px',
      backgroundColor: palette.cardBg,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: palette.cardShadow,
      backdropFilter: 'blur(18px)',
    },
    settingsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
      gap: '12px',
    },
    settingsTitle: {
      margin: 0,
      fontSize: '24px',
    },
    settingsSubtitle: {
      margin: '4px 0 0 0',
      color: palette.text,
      opacity: 0.8,
      fontSize: '14px',
    },
    closeButton: {
      border: 'none',
      background: 'rgba(255,255,255,0.1)',
      color: palette.text,
      fontSize: '24px',
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      cursor: 'pointer',
    },
    settingsBody: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    settingsSection: {
      backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: '12px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    sectionTitle: {
      margin: 0,
      fontSize: '18px',
    },
    sectionSubtitle: {
      margin: '0 0 6px 0',
      fontSize: '13px',
      color: palette.text,
      opacity: 0.75,
    },
    settingsLabel: {
      fontSize: '13px',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      opacity: 0.8,
    },
    settingsInput: {
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.4)',
      backgroundColor: darkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)',
      color: palette.text,
      fontSize: '15px',
    },
    settingsActions: {
      display: 'flex',
      justifyContent: 'flex-end',
    },
    primaryButton: {
      padding: '10px 18px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: palette.buttonBg,
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 600,
    },
    feedback: (type) => ({
      margin: 0,
      fontSize: '13px',
      color: type === 'success' ? '#10b981' : '#f87171',
    }),
    infoGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginTop: '8px',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
    },
    infoLabel: {
      fontSize: '13px',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      opacity: 0.7,
    },
    infoValue: {
      fontWeight: 600,
      wordBreak: 'break-word',
    },
    infoCode: {
      padding: '6px 10px',
      borderRadius: '6px',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      fontFamily: 'monospace',
      fontSize: '13px',
    },
    copyWrapper: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    copyButton: {
      border: 'none',
      backgroundColor: palette.buttonBg,
      color: '#fff',
      borderRadius: '999px',
      padding: '6px 14px',
      cursor: 'pointer',
      fontSize: '13px',
    },
    preferenceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    preferenceTitle: {
      margin: '0 0 4px 0',
      fontWeight: 600,
    },
    preferenceHint: {
      margin: 0,
      fontSize: '13px',
      color: palette.text,
      opacity: 0.75,
      maxWidth: '380px',
    },
    secondaryButton: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.4)',
      background: 'none',
      color: palette.text,
      cursor: 'pointer',
    },
    ghostButton: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px dashed rgba(255,255,255,0.4)',
      background: 'none',
      color: palette.text,
      cursor: 'pointer',
    },
    preferenceButtons: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    },
    dangerBox: {
      border: '1px solid rgba(248,113,113,0.4)',
      borderRadius: '10px',
      padding: '12px',
      marginTop: '12px',
      backgroundColor: darkMode ? 'rgba(153,27,27,0.2)' : 'rgba(248,113,113,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    dangerTitle: {
      margin: 0,
      color: '#b91c1c',
    },
    dangerInput: {
      padding: '10px',
      borderRadius: '6px',
      border: '1px solid rgba(248,113,113,0.6)',
      background: 'rgba(255,255,255,0.9)',
      fontSize: '14px',
    },
    dangerButton: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      backgroundColor: '#b91c1c',
      color: '#fff',
      cursor: 'pointer',
    },
    searchBarSection: {
      display: 'flex',
      justifyContent: 'center',
      padding: '16px 20px 0',
    },
  }
}
