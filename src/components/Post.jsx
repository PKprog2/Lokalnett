import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient'
import Comments from './Comments'

export default function Post({ post, currentUserId, onUpdate, canModerate = false }) {
  const [showComments, setShowComments] = useState((post.comments_count || 0) > 0)
  const [isLiked, setIsLiked] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comments_count || 0)
  const [likeUsers, setLikeUsers] = useState(post.likes || [])
  const [deleting, setDeleting] = useState(false)
  const canDelete = post.user_id === currentUserId || canModerate

  useEffect(() => {
    // Check if current user has liked this post
    const userLiked = post.likes?.some(like => like.user_id === currentUserId)
    setIsLiked(userLiked)
  }, [post.likes, currentUserId])

  useEffect(() => {
    setCommentCount(post.comments_count || 0)
    setLikeUsers(post.likes || [])
  }, [post.likes_count, post.comments_count, post.likes])

  useEffect(() => {
    setShowComments((post.comments_count || 0) > 0)
  }, [post.id, post.comments_count])

  useEffect(() => {
    if (commentCount > 0) {
      setShowComments(true)
    }
  }, [commentCount])

  const refreshCommentCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', post.id)

      if (error) throw error
      setCommentCount(count ?? 0)
    } catch (error) {
      console.error('Error refreshing comment count:', error)
    }
  }, [post.id])

  const refreshLikeUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('user_id')
        .eq('post_id', post.id)

      if (error) throw error

      const likeRows = data || []
      const userIds = Array.from(new Set(likeRows.map((like) => like.user_id).filter(Boolean)))

      if (userIds.length === 0) {
        setLikeUsers(likeRows)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      if (profileError) {
        console.error('Error fetching like profiles:', profileError)
        setLikeUsers(likeRows)
        return
      }

      const profileMap = new Map((profileData || []).map((profile) => [profile.id, profile]))
      const enriched = likeRows.map((like) => ({
        ...like,
        profiles: profileMap.get(like.user_id) || null,
      }))
      setLikeUsers(enriched)
    } catch (error) {
      console.error('Error refreshing likes:', error)
    }
  }, [post.id])

  useEffect(() => {
    refreshCommentCount()
    refreshLikeUsers()
  }, [refreshCommentCount, refreshLikeUsers])

  useEffect(() => {
    const channel = supabase
      .channel(`post-comments-${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          refreshCommentCount()
          refreshLikeUsers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [post.id, refreshCommentCount, refreshLikeUsers])

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
        onUpdate?.()
        await refreshLikeUsers()
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert([{ post_id: post.id, user_id: currentUserId }])

        if (error) throw error
        setIsLiked(true)
        onUpdate?.()
        await refreshLikeUsers()
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleDeletePost = async () => {
    if (!canDelete) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Vil du slette dette innlegget? Dette kan ikke angres.')
      if (!confirmed) return
    }

    setDeleting(true)
    try {
      let query = supabase
        .from('posts')
        .delete()
        .eq('id', post.id)

      if (!canModerate || post.user_id === currentUserId) {
        query = query.eq('user_id', currentUserId)
      }

      const { error } = await query

      if (error) throw error

      onUpdate?.()
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('Kunne ikke slette innlegget: ' + error.message)
    } finally {
      setDeleting(false)
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
        <div style={styles.headerRow}>
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
          {canDelete && (
            <button
              onClick={handleDeletePost}
              style={{
                ...styles.deleteButton,
                opacity: deleting ? 0.6 : 1,
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}
              disabled={deleting}
            >
              {deleting ? 'Sletter…' : 'Slett'}
            </button>
          )}
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
        <span title={getLikeTooltip(likeUsers)}>{getLikeSummary(likeUsers, currentUserId)}</span>
        <span>{commentCount} kommentarer</span>
      </div>

      <div style={styles.actions}>
        <button
          onClick={handleLike}
          style={{
            ...styles.actionButton,
            color: isLiked ? '#2c5f2d' : '#666',
            fontWeight: isLiked ? '600' : 'normal',
          }}
          title={getLikeTooltip(likeUsers)}
        >
          {isLiked ? '❤️' : '🤍'} Lik
        </button>
        <button
          onClick={() => setShowComments((prev) => !prev)}
          style={styles.actionButton}
        >
          {showComments ? '🙈 Skjul' : '💬 Kommenter'}
        </button>
      </div>

      {showComments && (
        <Comments
          postId={post.id}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onUpdate={() => {
            onUpdate?.()
            refreshCommentCount()
          }}
          onCommentCountChange={setCommentCount}
        />
      )}
    </div>
  )
}

const getDisplayName = (entry) => entry?.profiles?.display_name || 'en bruker'

const getLikeSummary = (likes = [], currentUserId) => {
  const total = likes.length
  if (total === 0) return 'Ingen liker dette ennå'

  const youLike = likes.some((like) => like.user_id === currentUserId)
  const others = likes.filter((like) => like.user_id !== currentUserId)

  if (youLike) {
    if (others.length === 0) return 'Du liker dette'
    if (others.length === 1) return `Du og ${getDisplayName(others[0])} liker dette`
    return `Du og ${others.length} andre liker dette`
  }

  if (total === 1) return `${getDisplayName(likes[0])} liker dette`
  if (total === 2) return `${getDisplayName(likes[0])} og ${getDisplayName(likes[1])} liker dette`

  const [first, second] = likes
  return `${getDisplayName(first)}, ${getDisplayName(second)} og ${total - 2} andre liker dette`
}

const getLikeTooltip = (likes = []) => {
  const names = likes
    .map((like) => like.profiles?.display_name)
    .filter(Boolean)

  if (names.length === 0) return 'Ingen liker dette ennå'
  if (names.length === 1) return `${names[0]} liker dette`
  if (names.length <= 5) {
    const last = names[names.length - 1]
    return `${names.slice(0, -1).join(', ')} og ${last} liker dette`
  }
  return `${names.slice(0, 5).join(', ')} og ${names.length - 5} andre liker dette`
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
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
  deleteButton: {
    border: '1px solid #f0c4c4',
    backgroundColor: '#fff5f5',
    color: '#c33',
    borderRadius: '20px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
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
