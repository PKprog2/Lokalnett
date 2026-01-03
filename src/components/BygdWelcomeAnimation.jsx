import { useEffect, useState } from 'react'

export default function BygdWelcomeAnimation({ bygdName, onComplete }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.textContainer}>
        <h1 style={styles.welcomeText}>
          VELKOMMEN TIL
          <br />
          {bygdName?.toUpperCase()}
        </h1>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'fadeIn 0.3s ease-out',
  },
  textContainer: {
    animation: 'zoomIn 3s cubic-bezier(0.10, 0.16, 0.15, 0.54) forwards',
    transformOrigin: 'center',
  },
  welcomeText: {
    color: '#fff',
    fontWeight: 120,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.2,
    fontSize: '1rem',
    textShadow: '0 4px 14px rgba(0,0,0,0.5)',
    whiteSpace: 'nowrap',
  },
}
