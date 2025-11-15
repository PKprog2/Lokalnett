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
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    if (!bygdId || !user?.id) return
    fetchBygdAndPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bygdId, user?.id])

  const fetchBygdAndPosts = async () => {
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

      if (!member) {
        setPosts([])
        return
      }

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
        .select('*')
        .eq('bygd_id', bygdId)
        .order('created_at', { ascending: false })

      if (error) throw error

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
            likes: likes || [],
          }
        })
      )

      setPosts(postsWithDetails)
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
}
