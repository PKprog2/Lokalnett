import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabaseClient'

export default function CreatePost({ bygdId, onPostCreated }) {
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim() && !mediaFile) return

    setUploading(true)

    try {
      let mediaUrl = null
      let mediaType = null

      // Upload media if present
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, mediaFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(fileName)

        mediaUrl = urlData.publicUrl
        mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video'
      }

      // Create post
      const { error: postError } = await supabase
        .from('posts')
        .insert([
          {
            bygd_id: bygdId,
            user_id: user.id,
            content: content.trim(),
            media_url: mediaUrl,
            media_type: mediaType,
          },
        ])

      if (postError) throw postError

      setContent('')
      setMediaFile(null)
      onPostCreated()
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Kunne ikke opprette innlegg: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('Filen er for stor. Maksimal størrelse er 50MB.')
        return
      }
      setMediaFile(file)
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Hva har du på hjertet?"
          style={styles.textarea}
          rows={3}
        />

        {mediaFile && (
          <div style={styles.mediaPreview}>
            <span>{mediaFile.name}</span>
            <button
              type="button"
              onClick={() => setMediaFile(null)}
              style={styles.removeButton}
            >
              ✕
            </button>
          </div>
        )}

        <div style={styles.actions}>
          <label style={styles.fileLabel}>
            📎 Last opp bilde/video
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              style={styles.fileInput}
              disabled={uploading}
            />
          </label>

          <button
            type="submit"
            disabled={uploading || (!content.trim() && !mediaFile)}
            style={styles.submitButton}
          >
            {uploading ? 'Publiserer...' : 'Publiser'}
          </button>
        </div>
      </form>
    </div>
  )
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  textarea: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  mediaPreview: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#f0f0f0',
    borderRadius: '5px',
    fontSize: '14px',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#c33',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 4px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileLabel: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  fileInput: {
    display: 'none',
  },
  submitButton: {
    padding: '8px 24px',
    backgroundColor: '#2c5f2d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
}
