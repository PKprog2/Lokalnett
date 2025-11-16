import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../utils/supabaseClient'

const DEFAULT_VISIBLE = 2

export default function Comments({ postId, currentUserId, onUpdate, onCommentCountChange, canModerate = false }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [visibleRootCount, setVisibleRootCount] = useState(DEFAULT_VISIBLE)
  const [commentLikes, setCommentLikes] = useState({ counts: {}, liked: {} })
  const [likeBusyMap, setLikeBusyMap] = useState({})
  const [replyTarget, setReplyTarget] = useState(null)
  const [expandedReplies, setExpandedReplies] = useState({})
  const [deletingCommentIds, setDeletingCommentIds] = useState({})
  const commentInputRef = useRef(null)
  const commentsRef = useRef([])

  useEffect(() => {
    setVisibleRootCount(DEFAULT_VISIBLE)
    setReplyTarget(null)
    setNewComment('')
    setExpandedReplies({})
  }, [postId])

  useEffect(() => {
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const commentTree = useMemo(() => buildCommentTree(comments), [comments])
  useEffect(() => {
    onCommentCountChange?.(comments.length)
  }, [comments.length, onCommentCountChange])
  useEffect(() => {
    commentsRef.current = comments
  }, [comments])
  const commentIndex = useMemo(() => {
    const map = new Map()
    comments.forEach((comment) => map.set(comment.id, comment))
    return map
  }, [comments])
  const rootCount = commentTree.length
  const effectiveVisibleCount = rootCount === 0 ? 0 : Math.min(visibleRootCount, rootCount)
  const visibleRoots = rootCount === 0 ? [] : commentTree.slice(0, effectiveVisibleCount || rootCount)
  const hasOverflow = rootCount > DEFAULT_VISIBLE
  const canShowMore = hasOverflow && effectiveVisibleCount < rootCount
  const canShowLess = hasOverflow && effectiveVisibleCount === rootCount
  const showAllChildren = hasOverflow && visibleRootCount === rootCount
  const findRootComment = (comment) => {
    let current = comment
    while (current?.parent_comment_id && commentIndex.get(current.parent_comment_id)) {
      current = commentIndex.get(current.parent_comment_id)
    }
    return current || comment
  }

  const enrichCommentsWithProfiles = async (items) => {
    const userIds = Array.from(new Set(items.map((comment) => comment.user_id).filter(Boolean)))
    if (userIds.length === 0) return items.map((comment) => ({ ...comment, profiles: null }))

    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    if (error) {
      console.error('Error fetching comment profiles:', error)
      return items
    }

    const profileMap = new Map((profilesData || []).map((profile) => [profile.id, profile]))
    return items.map((comment) => ({
      ...comment,
      profiles: profileMap.get(comment.user_id) || null,
    }))
  }

  const fetchCommentLikes = async (rows) => {
    const ids = (rows || []).map((comment) => comment.id)
    if (ids.length === 0) {
      setCommentLikes({ counts: {}, liked: {} })
      return
    }

    const { data, error } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', ids)

    if (error) {
      console.error('Error fetching comment likes:', error)
      return
    }

    const counts = {}
    const liked = {}
    for (const entry of data || []) {
      counts[entry.comment_id] = (counts[entry.comment_id] || 0) + 1
      if (entry.user_id === currentUserId) {
        liked[entry.comment_id] = true
      }
    }

    setCommentLikes({ counts, liked })
  }

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const enriched = await enrichCommentsWithProfiles(data || [])
      setComments(enriched)
      await fetchCommentLikes(enriched)
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = newComment.trim()
    if (!trimmed) return

    setLoading(true)

    try {
      const { data: insertedComment, error } = await supabase
        .from('comments')
        .insert([
          {
            post_id: postId,
            user_id: currentUserId,
            content: trimmed,
            parent_comment_id: replyTarget?.id || null,
          },
        ])
        .select('*')
        .single()

      if (error) throw error

      let profileData = null
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', currentUserId)
          .single()

        profileData = profile
      } catch (profileErr) {
        console.warn('Could not load profile for comment:', profileErr)
      }

      setComments((prev) => {
        const nextComments = [
          ...prev,
          {
            ...insertedComment,
            profiles: profileData,
          },
        ]
        if (!replyTarget) {
          const nextRootCount = countRootComments(nextComments)
          setVisibleRootCount((count) => Math.min(nextRootCount, Math.max(count + 1, DEFAULT_VISIBLE)))
        }
        return nextComments
      })

      setCommentLikes((prev) => ({
        counts: { ...prev.counts, [insertedComment.id]: 0 },
        liked: { ...prev.liked, [insertedComment.id]: false },
      }))

      setNewComment('')
      setReplyTarget(null)
      onUpdate?.()
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

  const handleToggleLike = async (commentId) => {
    if (!currentUserId || likeBusyMap[commentId]) return
    const isLiked = !!commentLikes.liked[commentId]
    setLikeBusyMap((prev) => ({ ...prev, [commentId]: true }))

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert([{ comment_id: commentId, user_id: currentUserId }])

        if (error) throw error
      }

      await fetchCommentLikes(commentsRef.current)
    } catch (error) {
      console.error('Error toggling comment like:', error)
      alert('Kunne ikke oppdatere liker: ' + error.message)
    } finally {
      setLikeBusyMap((prev) => ({ ...prev, [commentId]: false }))
    }
  }

  const collectDescendantIds = (targetId) => {
    const ids = new Set([targetId])
    let changed = true
    while (changed) {
      changed = false
      commentsRef.current.forEach((comment) => {
        if (!ids.has(comment.id) && comment.parent_comment_id && ids.has(comment.parent_comment_id)) {
          ids.add(comment.id)
          changed = true
        }
      })
    }
    return ids
  }

  const handleDeleteComment = async (targetComment) => {
    const comment = typeof targetComment === 'object' ? targetComment : commentIndex.get(targetComment)
    if (!comment) return
    if (!currentUserId || deletingCommentIds[comment.id]) return
    if (comment.user_id !== currentUserId && !canModerate) return

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Vil du slette denne kommentaren?')
      if (!confirmed) return
    }

    setDeletingCommentIds((prev) => ({ ...prev, [comment.id]: true }))

    try {
      let query = supabase
        .from('comments')
        .delete()
        .eq('id', comment.id)

      if (!canModerate || comment.user_id === currentUserId) {
        query = query.eq('user_id', currentUserId)
      }

      const { error } = await query

      if (error) throw error

      const idsToRemove = collectDescendantIds(comment.id)
      const remaining = commentsRef.current.filter((comment) => !idsToRemove.has(comment.id))

      commentsRef.current = remaining
      setComments(remaining)
      setCommentLikes((prev) => {
        const counts = { ...prev.counts }
        const liked = { ...prev.liked }
        idsToRemove.forEach((id) => {
          delete counts[id]
          delete liked[id]
        })
        return { counts, liked }
      })
      setExpandedReplies((prev) => {
        const next = { ...prev }
        idsToRemove.forEach((id) => delete next[id])
        return next
      })
      const nextRootCount = countRootComments(remaining)
      setVisibleRootCount((prev) => {
        if (nextRootCount === 0) return DEFAULT_VISIBLE
        return Math.min(prev, nextRootCount)
      })

      await fetchCommentLikes(remaining)
      onUpdate?.()
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('Kunne ikke slette kommentar: ' + error.message)
    } finally {
      setDeletingCommentIds((prev) => ({ ...prev, [comment.id]: false }))
    }
  }

  const handleReplyClick = (comment) => {
  const rootComment = findRootComment(comment)
  const displayName = comment.profiles?.display_name || 'bruker'
  const mention = `@${displayName}`
  setReplyTarget({ id: rootComment.id, name: displayName })
    setNewComment((prev) => {
      if (prev.startsWith(`${mention} `)) return prev
      return `${mention} ${prev.replace(/^@\S+\s*/, '')}`.trim() + ' '
    })
    requestAnimationFrame(() => {
      commentInputRef.current?.focus()
    })
  }

  const handleCancelReply = () => {
    setReplyTarget(null)
    setNewComment('')
  }

  const handleShowMore = () => {
    setVisibleRootCount(rootCount || DEFAULT_VISIBLE)
  }

  const handleShowLess = () => {
    setVisibleRootCount(DEFAULT_VISIBLE)
    setExpandedReplies({})
  }

  const handleToggleReplies = (commentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
  }

  const renderCommentNode = (comment, depth = 0) => {
    const isLiked = !!commentLikes.liked[comment.id]
    const likeCount = commentLikes.counts[comment.id] || 0
    const isBusy = !!likeBusyMap[comment.id]
    const canDelete = comment.user_id === currentUserId || canModerate

    return (
      <div key={comment.id} style={{ ...styles.comment, marginLeft: depth * 20 }}>
        <div style={styles.avatarWrapper}>
          <div style={styles.avatar}>
            {comment.profiles?.avatar_url ? (
              <img src={comment.profiles.avatar_url} alt="" style={styles.avatarImg} />
            ) : (
              <span>{comment.profiles?.display_name?.[0] || '?'}</span>
            )}
          </div>
        </div>
        <div style={styles.commentBody}>
          <div style={styles.commentBubble}>
            <div style={styles.commentHeader}>
              <span style={styles.commentAuthor}>{comment.profiles?.display_name || 'Ukjent'}</span>
              <span style={styles.commentTime}>{formatDate(comment.created_at)}</span>
            </div>
            <p style={styles.commentText}>{comment.content}</p>
          </div>
          <div style={styles.commentFooter}>
            <button
              type="button"
              style={{
                ...styles.commentAction,
                color: isLiked ? '#2c5f2d' : styles.commentAction.color,
              }}
              onClick={() => handleToggleLike(comment.id)}
              disabled={isBusy}
            >
              {isLiked ? 'Liker' : 'Lik'}
              {likeCount > 0 && <span style={styles.likeCount}> ({likeCount})</span>}
            </button>
            <span style={styles.dot}>·</span>
            <button
              type="button"
              style={styles.commentAction}
              onClick={() => handleReplyClick(comment)}
            >
              Svar
            </button>
            {canDelete && (
              <>
                <span style={styles.dot}>·</span>
                <button
                  type="button"
                  style={styles.deleteCommentButton}
                  onClick={() => handleDeleteComment(comment)}
                  disabled={!!deletingCommentIds[comment.id]}
                >
                  {deletingCommentIds[comment.id] ? 'Sletter…' : 'Slett'}
                </button>
              </>
            )}
          </div>
          {comment.children?.length > 0 && (
            <div style={styles.childContainer}>
              <button
                type="button"
                style={styles.replyToggle}
                onClick={() => handleToggleReplies(comment.id)}
              >
                {showAllChildren || expandedReplies[comment.id]
                  ? 'Skjul svar'
                  : `Vis svar (${comment.children.length})`}
              </button>
              {(showAllChildren || expandedReplies[comment.id]) && (
                <div style={styles.childList}>
                  {comment.children.map((child) => renderCommentNode(child, depth + 1))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.commentsList}>
        {visibleRoots.map((comment) => renderCommentNode(comment))}
        {rootCount === 0 && (
          <p style={styles.emptyState}>Ingen kommentarer ennå. Bli den første til å si noe!</p>
        )}
      </div>

      {(canShowMore || canShowLess) && (
        <div style={styles.paginationRow}>
          {canShowMore && (
            <button type="button" style={styles.paginationButton} onClick={handleShowMore}>
              Vis alle kommentarer
            </button>
          )}
          {canShowLess && (
            <button type="button" style={styles.paginationButton} onClick={handleShowLess}>
              Skjul kommentarer
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          ref={commentInputRef}
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
      {replyTarget && (
        <div style={styles.replyBanner}>
          Svarer {replyTarget.name}
          <button style={styles.cancelReplyButton} type="button" onClick={handleCancelReply}>
            Avbryt
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    borderTop: '1px solid #e4e6eb',
    paddingTop: '12px',
    marginTop: '12px',
  },
  commentsList: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '12px',
    paddingRight: '4px',
  },
  comment: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  avatarWrapper: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  avatar: {
    width: '36px',
    height: '36px',
    minWidth: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2c5f2d, #4d8b4a)',
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
  commentBody: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#f0f2f5',
    borderRadius: '18px',
    padding: '10px 14px',
    display: 'inline-block',
    maxWidth: '100%',
  },
  commentHeader: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '4px',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: '13px',
    color: '#050505',
  },
  commentTime: {
    fontSize: '11px',
    color: '#65676b',
  },
  commentText: {
    margin: 0,
    fontSize: '13px',
    color: '#050505',
    lineHeight: '1.5',
    whiteSpace: 'pre-line',
  },
  commentFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '8px',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  commentAction: {
    background: 'none',
    border: 'none',
    color: '#65676b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
  },
  deleteCommentButton: {
    background: 'none',
    border: 'none',
    color: '#c33',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
  },
  dot: {
    color: '#b0b3b8',
  },
  likeCount: {
    fontSize: '11px',
    fontWeight: 600,
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
  emptyState: {
    textAlign: 'center',
    color: '#65676b',
    fontSize: '13px',
    padding: '8px 0',
  },
  paginationRow: {
    display: 'flex',
    gap: '8px',
    padding: '4px 0 12px',
  },
  paginationButton: {
    border: 'none',
    background: 'none',
    color: '#2c5f2d',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  replyBanner: {
    marginTop: '8px',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#f0f2f5',
    fontSize: '12px',
    color: '#1f1f1f',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  cancelReplyButton: {
    border: 'none',
    background: 'none',
    color: '#c33',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  childList: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  childContainer: {
    marginTop: '4px',
    paddingLeft: '8px',
  },
  replyToggle: {
    background: 'none',
    border: 'none',
    color: '#2c5f2d',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    marginTop: '4px',
  },
}

function buildCommentTree(comments) {
  const nodes = new Map()
  comments.forEach((comment) => {
    nodes.set(comment.id, {
      ...comment,
      children: [],
    })
  })

  const sortByCreated = (list) =>
    list.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  nodes.forEach((node) => {
    if (node.parent_comment_id && nodes.has(node.parent_comment_id)) {
      nodes.get(node.parent_comment_id).children.push(node)
    }
  })

  const flattenToSingleDepth = (node) => {
    const descendants = []
    const collect = (children) => {
      sortByCreated(children).forEach((child) => {
        descendants.push({ ...child, children: [] })
        if (child.children?.length) {
          collect(child.children)
        }
      })
    }
    collect(node.children || [])
    return descendants
  }

  const roots = []
  nodes.forEach((node) => {
    if (!node.parent_comment_id || !nodes.has(node.parent_comment_id)) {
      roots.push({
        ...node,
        children: flattenToSingleDepth(node),
      })
    }
  })

  return sortByCreated(roots)
}

function countRootComments(comments) {
  const ids = new Set(comments.map((comment) => comment.id))
  return comments.reduce((total, comment) => {
    const hasValidParent = comment.parent_comment_id && ids.has(comment.parent_comment_id)
    return total + (hasValidParent ? 0 : 1)
  }, 0)
}
