import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import Comments from './Comments'

export default function Post({ post, currentUserId, onUpdate }) {
  const [showComments, setShowComments] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count || 0)

  useEffect(() => {
    // Check if current user has liked this post
    const userLiked = post.likes?.some(like => like.user_id === currentUserId)
    setIsLiked(userLiked)
  }, [post.likes, currentUserId])

  const handleLike = async () => {
    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId)

        if (error) throw error
        setIsLiked(false)
        setLikesCount(prev => prev - 1)
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert([{ post_id: post.id, user_id: currentUserId }])

        if (error) throw error
        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'akkurat nå'
    if (diffMins < 60) return `${diffMins} min siden`
    if (diffHours < 24) return `${diffHours} timer siden`
    if (diffDays < 7) return `${diffDays} dager siden`
    
    return date.toLocaleDateString('no-NO', { 
      day: 'numeric', 
      month: 'short', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    })
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>
            {post.profiles?.avatar_url ? (
              <img src={post.profiles.avatar_url} alt="" style={styles.avatarImg} />
            ) : (
              <span>{post.profiles?.display_name?.[0] || '?'}</span>
            )}
          </div>
          <div>
            <div style={styles.displayName}>{post.profiles?.display_name || 'Ukjent'}</div>
            <div style={styles.timestamp}>{formatDate(post.created_at)}</div>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        <p style={styles.text}>{post.content}</p>

        {post.media_url && (
          <div style={styles.media}>
            {post.media_type === 'image' ? (
              <img src={post.media_url} alt="Post media" style={styles.mediaImg} />
            ) : (
              <video src={post.media_url} controls style={styles.mediaVideo} />
            )}
          </div>
        )}
      </div>

      <div style={styles.stats}>
        <span>{likesCount} liker dette</span>
        <span>{post.comments_count || 0} kommentarer</span>
      </div>

      <div style={styles.actions}>
        <button
          onClick={handleLike}
          style={{
            ...styles.actionButton,
            color: isLiked ? '#2c5f2d' : '#666',
            fontWeight: isLiked ? '600' : 'normal',
          }}
        >
          {isLiked ? '❤️' : '🤍'} Lik
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          style={styles.actionButton}
        >
          💬 Kommenter
        </button>
      </div>

      {showComments && (
        <Comments
          postId={post.id}
          currentUserId={currentUserId}
          onUpdate={onUpdate}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    marginBottom: '12px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#2c5f2d',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  displayName: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#333',
  },
  timestamp: {
    fontSize: '12px',
    color: '#999',
  },
  content: {
    marginBottom: '12px',
  },
  text: {
    margin: '0 0 12px 0',
    lineHeight: '1.5',
    color: '#333',
  },
  media: {
    borderRadius: '8px',
    overflow: 'hidden',
  },
  mediaImg: {
    width: '100%',
    display: 'block',
  },
  mediaVideo: {
    width: '100%',
    display: 'block',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '13px',
    color: '#666',
    borderBottom: '1px solid #eee',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    paddingTop: '8px',
  },
  actionButton: {
    flex: 1,
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#666',
    borderRadius: '5px',
    transition: 'background-color 0.2s',
  },
}
