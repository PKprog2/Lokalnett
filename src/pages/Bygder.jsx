import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Bygder() {
  const [bygder, setBygder] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBygdName, setNewBygdName] = useState('')
  const [newBygdDescription, setNewBygdDescription] = useState('')
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchBygder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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

  const createBygd = async (e) => {
    e.preventDefault()
    try {
      // First create the bygd
      const { data: bygdData, error: bygdError } = await supabase
        .from('bygder')
        .insert([
          {
            name: newBygdName,
            description: newBygdDescription,
            created_by: user.id,
          },
        ])
        .select()
        .single()

      if (bygdError) throw bygdError

      // Then add the creator as a member
      const { error: memberError } = await supabase
        .from('bygd_members')
        .insert([
          {
            bygd_id: bygdData.id,
            user_id: user.id,
          },
        ])

      if (memberError) throw memberError

      setNewBygdName('')
      setNewBygdDescription('')
      setShowCreateForm(false)
      fetchBygder()
    } catch (error) {
      console.error('Error creating bygd:', error)
      alert('Kunne ikke opprette bygd: ' + error.message)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading) {
    return <div style={styles.loading}>Laster...</div>
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Mine Bygder</h1>
        <button onClick={handleSignOut} style={styles.signOutButton}>
          Logg ut
        </button>
      </header>

      <div style={styles.content}>
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
                required
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  content: {
    maxWidth: '800px',
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
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  form: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px',
    color: '#666',
  },
  bygderList: {
    display: 'grid',
    gap: '16px',
  },
  bygdCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s',
  },
  bygdName: {
    margin: '0 0 8px 0',
    color: '#2c5f2d',
    fontSize: '20px',
  },
  bygdDescription: {
    margin: '0 0 12px 0',
    color: '#666',
    fontSize: '14px',
  },
  bygdStats: {
    fontSize: '12px',
    color: '#999',
  },
}
