import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    fetchBygder()
    fetchAllBygder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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
      setBygder(data || [])
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

  const handleJoinBygd = async (bygdId) => {
    if (!user?.id) return
    setJoiningBygdId(bygdId)

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
      navigate(`/bygd/${bygdId}`)
    } catch (error) {
      console.error('Error joining bygd:', error)
      alert('Kunne ikke bli med i bygda: ' + error.message)
    } finally {
      setJoiningBygdId(null)
    }
  }

  const initials = (user?.user_metadata?.display_name || user?.email || '?')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const styles = getStyles(darkMode, backgroundImage)
  const memberIds = new Set(bygder.map((bygd) => bygd.id))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredSearchResults = normalizedQuery
    ? allBygder.filter((bygd) => bygd.name?.toLowerCase().includes(normalizedQuery))
    : []

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
        <h1 style={styles.title}>Mine Bygder</h1>
        <button onClick={handleSignOut} style={styles.signOutButton}>
          Logg ut
        </button>
        <div style={styles.userMenuWrapper}>
          <button
            style={styles.initialsButton}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {initials}
          </button>
          {menuOpen && (
            <div style={styles.userMenu}>
              <button
                style={styles.menuItem}
                onClick={() => fileInputRef.current?.click()}
              >
                Endre bakgrunn
              </button>
              <button
                style={styles.menuItem}
                onClick={handleDarkModeToggle}
              >
                {darkMode ? 'Lys modus' : 'Mørk modus'}
              </button>
              <button style={styles.menuItem} onClick={handleSignOut}>
                Logg ut
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={styles.content}>
        <div style={styles.mainColumn}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={styles.createButton}
          >
            {showCreateForm ? 'Avbryt' : '+ Opprett ny bygd'}
          </button>

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
              {bygder.map((bygd) => (
                <div
                  key={bygd.id}
                  style={styles.bygdCard}
                  onClick={() => navigate(`/bygd/${bygd.id}`)}
                >
                  <h3 style={styles.bygdName}>{bygd.name}</h3>
                  {bygd.description && (
                    <p style={styles.bygdDescription}>{bygd.description}</p>
                  )}
                  <div style={styles.bygdStats}>
                    <span>{bygd.member_count} / {bygd.max_members} medlemmer</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside style={styles.sideColumn}>
          <div style={styles.searchCard}>
            <h2 style={styles.searchTitle}>Finn bygder</h2>
            <p style={styles.searchHint}>Søk etter nye fellesskap og se hvor mange medlemmer de har.</p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter bygder..."
              style={styles.searchInput}
            />
            <div style={styles.searchResults}>
              {normalizedQuery === '' ? (
                <p style={styles.searchPlaceholder}>Begynn å skrive for å se forslag.</p>
              ) : filteredSearchResults.length === 0 ? (
                <p style={styles.searchEmpty}>Fant ingen bygder som matcher "{searchQuery}".</p>
              ) : (
                filteredSearchResults.map((bygd) => {
                  const alreadyMember = memberIds.has(bygd.id)

                  return (
                    <div
                      key={bygd.id}
                      style={{
                        ...styles.searchResult,
                        cursor: alreadyMember ? 'pointer' : 'default',
                        opacity: joiningBygdId === bygd.id ? 0.7 : 1,
                      }}
                      onClick={alreadyMember ? () => navigate(`/bygd/${bygd.id}`) : undefined}
                    >
                      <div>
                        <p style={styles.searchResultName}>{bygd.name}</p>
                        <p style={styles.searchResultMeta}>
                          {bygd.member_count} medlemmer
                          {alreadyMember && (
                            <span style={styles.memberPill}>Allerede medlem</span>
                          )}
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
          </div>
        </aside>
      </div>
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
    signOutButton: {
      padding: '8px 16px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
    },
    userMenuWrapper: {
      position: 'relative',
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
    },
    userMenu: {
      position: 'absolute',
      top: '50px',
      right: 0,
      backgroundColor: palette.cardBg,
      borderRadius: '8px',
      boxShadow: palette.cardShadow,
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '200px',
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
    },
    content: {
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '20px',
      display: 'flex',
      gap: '24px',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
    mainColumn: {
      flex: '2 1 560px',
      minWidth: '280px',
    },
    sideColumn: {
      flex: '1 1 280px',
      minWidth: '260px',
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
      marginBottom: '20px',
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
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    },
    bygdName: {
      margin: '0 0 8px 0',
      fontSize: '18px',
      color: palette.text,
    },
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
      backdropFilter: 'blur(10px)',
    },
    searchTitle: {
      margin: '0 0 8px 0',
      fontSize: '20px',
    },
    searchHint: {
      margin: '0 0 12px 0',
      fontSize: '14px',
      color: palette.text,
      opacity: 0.85,
    },
    searchInput: {
      width: '100%',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.4)',
      marginBottom: '12px',
      backgroundColor: 'rgba(255,255,255,0.15)',
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
      opacity: 0.85,
    },
    searchResult: {
      backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
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
  }
}
