import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabaseClient'
import Post from '../components/Post'
import CreatePost from '../components/CreatePost'

export default function BygdFeed() {
  const { bygdId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bygd, setBygd] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBygdAndPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bygdId])

  const fetchBygdAndPosts = async () => {
    try {
      // Fetch bygd details
      const { data: bygdData, error: bygdError } = await supabase
        .from('bygder')
        .select('*')
        .eq('id', bygdId)
        .single()

      if (bygdError) throw bygdError
      setBygd(bygdData)

      // Fetch posts
      await fetchPosts()
    } catch (error) {
      console.error('Error fetching bygd:', error)
      navigate('/bygder')
    } finally {
      setLoading(false)
    }
  }

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (display_name, avatar_url),
          likes (user_id)
        `)
        .eq('bygd_id', bygdId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    }
  }

  const handlePostCreated = () => {
    fetchPosts()
  }

  if (loading) {
    return <div style={styles.loading}>Laster...</div>
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/bygder')} style={styles.backButton}>
          ← Tilbake
        </button>
        <div>
          <h1 style={styles.title}>{bygd?.name}</h1>
          {bygd?.description && (
            <p style={styles.description}>{bygd.description}</p>
          )}
        </div>
        <div style={styles.stats}>
          {bygd?.member_count} / {bygd?.max_members} medlemmer
        </div>
      </header>

      <div style={styles.content}>
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
                onUpdate={fetchPosts}
              />
            ))
          )}
        </div>
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
}
