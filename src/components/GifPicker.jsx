import { useEffect, useState } from 'react'

const API_BASE = 'https://api.giphy.com/v1/gifs'

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const apiKey = import.meta.env.VITE_GIPHY_API_KEY

  useEffect(() => {
    if (!apiKey) return
    fetchGifs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const fetchGifs = async (searchTerm = '') => {
    setLoading(true)
    setError('')
    try {
      const endpoint = searchTerm ? 'search' : 'trending'
      const params = new URLSearchParams({
        api_key: apiKey,
        limit: '24',
        rating: 'pg-13',
        q: searchTerm,
      })

      if (!searchTerm) {
        params.delete('q')
      }

      const response = await fetch(`${API_BASE}/${endpoint}?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Kunne ikke hente GIF-er akkurat nå')
      }

      const data = await response.json()
      setGifs(data?.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    fetchGifs(query.trim())
  }

  const handleSelect = (gif) => {
    if (!gif) return
    const images = gif.images || {}
    const payload = {
      url: images.original?.url || gif.url,
      previewUrl: images.fixed_width?.url || images.preview_gif?.url,
      title: gif.title,
    }
    onSelect(payload)
  }

  const renderBody = () => {
    if (!apiKey) {
      return (
        <div style={styles.apiKeyMessage}>
          <p style={styles.infoText}>
            Legg til en <code style={styles.code}>VITE_GIPHY_API_KEY</code> i <code style={styles.code}>.env</code> for å aktivere GIF-søk.
          </p>
          <p style={styles.infoText}>
            Opprett en API-nøkkel på <a href="https://developers.giphy.com/" target="_blank" rel="noreferrer" style={styles.link}>Giphy Developers</a> og start serveren på nytt.
          </p>
        </div>
      )
    }

    return (
      <>
        <form style={styles.searchBar} onSubmit={handleSubmit}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk etter GIFer..."
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchButton}>
            Søk
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
        {loading ? (
          <p style={styles.loading}>Laster GIFer...</p>
        ) : (
          <div style={styles.gridWrapper}>
            <div style={styles.grid}>
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  style={styles.gifButton}
                  onClick={() => handleSelect(gif)}
                >
                  <img
                    src={gif.images?.fixed_width?.url || gif.images?.preview_gif?.url}
                    alt={gif.title}
                    style={styles.gifImage}
                  />
                </button>
              ))}
              {gifs.length === 0 && !error && (
                <p style={styles.infoText}>Ingen GIFer funnet. Prøv et annet søk.</p>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>Finn en GIF</h3>
          <button onClick={onClose} style={styles.closeButton} aria-label="Lukk">
            ×
          </button>
        </div>
        {renderBody()}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  card: {
    width: 'min(720px, 100%)',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  searchBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  searchButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#2c5f2d',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
  },
  gridWrapper: {
    overflowY: 'auto',
    maxHeight: '60vh',
    paddingRight: '4px',
  },
  gifButton: {
    border: 'none',
    padding: 0,
    background: 'none',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  gifImage: {
    width: '100%',
    height: '120px',
    objectFit: 'cover',
    display: 'block',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
  },
  error: {
    color: '#c33',
    marginBottom: '8px',
  },
  apiKeyMessage: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '12px',
  },
  infoText: {
    fontSize: '14px',
    color: '#333',
    marginBottom: '8px',
  },
  link: {
    color: '#2c5f2d',
    textDecoration: 'underline',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#e4e6eb',
    padding: '2px 4px',
    borderRadius: '4px',
  },
}
