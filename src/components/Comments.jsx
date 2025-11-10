import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'

export default function Comments({ postId, currentUserId, onUpdate }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (display_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('comments')
        .insert([
          {
            post_id: postId,
            user_id: currentUserId,
            content: newComment.trim(),
          },
        ])

      if (error) throw error

      setNewComment('')
      fetchComments()
      onUpdate()
    } catch (error) {
      console.error('Error creating comment:', error)
      alert('Kunne ikke legge til kommentar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'akkurat nå'
    if (diffMins < 60) return `${diffMins} min siden`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}t`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    
    return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={styles.container}>
      <div style={styles.commentsList}>
        {comments.map((comment) => (
          <div key={comment.id} style={styles.comment}>
            <div style={styles.avatar}>
              {comment.profiles?.avatar_url ? (
                <img src={comment.profiles.avatar_url} alt="" style={styles.avatarImg} />
              ) : (
                <span>{comment.profiles?.display_name?.[0] || '?'}</span>
              )}
            </div>
            <div style={styles.commentContent}>
              <div style={styles.commentHeader}>
                <span style={styles.commentAuthor}>
                  {comment.profiles?.display_name || 'Ukjent'}
                </span>
                <span style={styles.commentTime}>{formatDate(comment.created_at)}</span>
              </div>
              <p style={styles.commentText}>{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Skriv en kommentar..."
          style={styles.input}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newComment.trim()}
          style={styles.submitButton}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  container: {
    borderTop: '1px solid #eee',
    paddingTop: '12px',
    marginTop: '12px',
  },
  commentsList: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '12px',
  },
  comment: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    minWidth: '32px',
    borderRadius: '50%',
    backgroundColor: '#2c5f2d',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: '13px',
    color: '#333',
  },
  commentTime: {
    fontSize: '11px',
    color: '#999',
  },
  commentText: {
    margin: 0,
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '20px',
    fontSize: '14px',
  },
  submitButton: {
    padding: '8px 16px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
}
