import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabaseClient'
import GifPicker from './GifPicker'

export default function CreatePost({ bygdId, onPostCreated }) {
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null)
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false)
  const [gifImporting, setGifImporting] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreviewUrl)
      }
    }
  }, [mediaPreviewUrl])

  const updatePreviewFromFile = (file) => {
    if (mediaPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }

    if (!file) {
      setMediaPreviewUrl(null)
      return
    }

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const objectUrl = URL.createObjectURL(file)
      setMediaPreviewUrl(objectUrl)
    } else {
      setMediaPreviewUrl(null)
    }
  }

  const resetMedia = () => {
    setMediaFile(null)
    updatePreviewFromFile(null)
  }

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
  resetMedia()
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
      if (file.size > 50 * 1024 * 1024) {
        alert('Filen er for stor. Maksimal størrelse er 50MB.')
        return
      }
      setMediaFile(file)
      updatePreviewFromFile(file)
    }
  }

  const handleGifSelect = async (gif) => {
    if (!gif?.url) return
    setIsGifPickerOpen(false)
    setGifImporting(true)
    try {
      const response = await fetch(gif.url)
      const blob = await response.blob()
      if (!blob.size) {
        throw new Error('Tomt GIF-svar')
      }
      const extension = (gif.url.split('.').pop() || 'gif').split('?')[0]
      const gifFile = new File([blob], `gif-${Date.now()}.${extension}`, {
        type: blob.type || 'image/gif',
      })
      setMediaFile(gifFile)
      updatePreviewFromFile(gifFile)
    } catch (error) {
      console.error('Error importing GIF:', error)
      alert('Kunne ikke hente GIF. Kontroller internettilkoblingen og prøv igjen.')
    } finally {
      setGifImporting(false)
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
            {mediaPreviewUrl && mediaFile.type.startsWith('video/') ? (
              <video src={mediaPreviewUrl} style={styles.mediaPreviewAsset} controls muted loop />
            ) : mediaPreviewUrl ? (
              <img src={mediaPreviewUrl} alt="Forhåndsvisning" style={styles.mediaPreviewAsset} />
            ) : null}
            <div style={styles.mediaPreviewMeta}>
              <span style={styles.mediaName}>{mediaFile.name}</span>
              <button
                type="button"
                onClick={resetMedia}
                style={styles.removeButton}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          <div style={styles.attachmentRow}>
            <label style={styles.fileLabel}>
              📎 Last opp bilde/video
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={styles.fileInput}
                disabled={uploading || gifImporting}
              />
            </label>
            <button
              type="button"
              onClick={() => setIsGifPickerOpen(true)}
              style={styles.gifButton}
              disabled={uploading || gifImporting}
            >
              {gifImporting ? 'Henter GIF…' : '🎞️ Velg GIF'}
            </button>
          </div>

          <button
            type="submit"
            disabled={uploading || gifImporting || (!content.trim() && !mediaFile)}
            style={styles.submitButton}
          >
            {uploading ? 'Publiserer...' : 'Publiser'}
          </button>
        </div>
      </form>

      {isGifPickerOpen && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setIsGifPickerOpen(false)}
        />
      )}
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
    flexDirection: 'column',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f7f7f7',
    borderRadius: '8px',
  },
  mediaPreviewAsset: {
    width: '100%',
    borderRadius: '6px',
    maxHeight: '240px',
    objectFit: 'cover',
  },
  mediaPreviewMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    gap: '12px',
  },
  mediaName: {
    fontWeight: 500,
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
    gap: '12px',
  },
  attachmentRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  gifButton: {
    padding: '8px 12px',
    borderRadius: '5px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
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
