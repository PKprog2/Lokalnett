import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import harpBackground from '../../pictures/harp.png'
import { supabase } from '../utils/supabaseClient'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(null)
  const [pendingInviteBygdId, setPendingInviteBygdId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('inviteBygdId')
    }
    return null
  })
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const inviteBygdId = params.get('bygd')

    if (inviteBygdId) {
      localStorage.setItem('inviteBygdId', inviteBygdId)
      setPendingInviteBygdId(inviteBygdId)
      setIsLogin(false)

      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.delete('bygd')
      window.history.replaceState({}, '', currentUrl.toString())
      return
    }

    const storedInvite = localStorage.getItem('inviteBygdId')
    if (storedInvite) {
      setPendingInviteBygdId(storedInvite)
      setIsLogin(false)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/bygder')
      } else {
        if (!displayName.trim()) {
          throw new Error('Visningsnavn er påkrevd')
        }
        const { error } = await signUp(email, password, displayName)
        if (error) throw error
        setError('Registrering vellykket! Sjekk e-posten din for bekreftelse.')
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSocialSignIn = async (provider) => {
    if (typeof window === 'undefined') return
    setError('')
    setSocialLoading(provider)
    try {
      const redirectTo = `${window.location.origin}/bygder`
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      })

      if (error) throw error
    } catch (error) {
      setError(error.message)
      setSocialLoading(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>BygdeNett</h1>
        <p style={styles.subtitle}>
          Sosialt nettverk for norske bygdesamfunn
        </p>

        {pendingInviteBygdId && (
          <div style={styles.inviteNotice}>
            <p style={styles.inviteNoticeTitle}>Du er invitert til en bygd!</p>
            <p style={styles.inviteNoticeText}>
              Fullfør registreringen, så sender vi deg automatisk inn i bygda etterpå.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Visningsnavn</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={styles.input}
                placeholder="Ditt navn"
                required={!isLogin}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="din@epost.no"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Passord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={styles.button}
          >
            {loading ? 'Laster...' : isLogin ? 'Logg inn' : 'Registrer deg'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>eller</span>
          <span style={styles.dividerLine} />
        </div>

        <div style={styles.socialSection}>
          <p style={styles.socialHint}>Fortsett med en konto du allerede har</p>
          <div style={styles.socialButtons}>
            <button
              type="button"
              style={{
                ...styles.socialButton,
                ...styles.googleButton,
                opacity: socialLoading && socialLoading !== 'google' ? 0.6 : 1,
                cursor: socialLoading ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleSocialSignIn('google')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'google' ? 'Sender deg til Google…' : 'Fortsett med Google'}
            </button>

            <button
              type="button"
              style={{
                ...styles.socialButton,
                ...styles.microsoftButton,
                opacity: socialLoading && socialLoading !== 'azure' ? 0.6 : 1,
                cursor: socialLoading ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleSocialSignIn('azure')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'azure' ? 'Åpner Microsoft…' : 'Fortsett med Microsoft'}
            </button>

            <button
              type="button"
              style={{
                ...styles.socialButton,
                ...styles.appleButton,
                opacity: socialLoading && socialLoading !== 'apple' ? 0.6 : 1,
                cursor: socialLoading ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleSocialSignIn('apple')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'apple' ? 'Åpner Apple…' : 'Fortsett med Apple'}
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsLogin(!isLogin)}
          style={styles.toggleButton}
        >
          {isLogin ? 'Trenger du en konto? Registrer deg' : 'Har du allerede en konto? Logg inn'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    backgroundImage: `linear-gradient(rgba(24, 104, 48, 0.55), rgba(12, 32, 18, 0.55)), url(${harpBackground})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '20px',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 2px 1px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(1px)',
    WebkitBackdropFilter: 'blur(1px)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2c5f2d',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: '30px',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '24px 0 12px',
    color: '#888',
    fontSize: '12px',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#dcdcdc',
  },
  dividerText: {
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
  },
  socialSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  socialHint: {
    margin: 0,
    fontSize: '13px',
    color: '#444',
    textAlign: 'center',
  },
  socialButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  socialButton: {
    padding: '11px',
    borderRadius: '6px',
    border: '1px solid #dcdcdc',
    fontSize: '15px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
    backgroundColor: '#fff',
  },
  googleButton: {
    backgroundColor: '#fff',
    color: '#1f1f1f',
  },
  microsoftButton: {
    backgroundColor: '#f3f4f6',
    color: '#111827',
  },
  appleButton: {
    backgroundColor: '#111',
    color: '#fff',
    borderColor: '#000',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
  },
  button: {
    padding: '12px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px',
  },
  toggleButton: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#2c5f2d',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    padding: '10px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '5px',
    fontSize: '14px',
  },
  inviteNotice: {
    backgroundColor: '#e6f4ea',
    border: '1px solid #b9dfc7',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
  },
  inviteNoticeTitle: {
    margin: 0,
    fontWeight: '600',
    color: '#1f4f22',
    fontSize: '15px',
  },
  inviteNoticeText: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#1f4f22',
  },
}
