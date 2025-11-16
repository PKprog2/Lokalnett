import PropTypes from 'prop-types'

export default function UserNameWithMessage({
  userId,
  displayName,
  onMessage,
  currentUserId,
  className,
  style,
}) {
  const safeName = displayName || 'Ukjent'
  const canMessage = Boolean(onMessage && userId && userId !== currentUserId)

  const handleButtonClick = (event) => {
    event.stopPropagation()
    if (!canMessage) return
    onMessage?.({ id: userId, displayName })
  }

  const handleWrapperClick = (event) => {
    // Prevent parent click handlers (like navigating to a bygd) from triggering
    event.stopPropagation()
  }

  const combinedClassName = ['user-name-hover', className].filter(Boolean).join(' ')

  return (
    <span className={combinedClassName} style={style} onClick={handleWrapperClick}>
      <span>{safeName}</span>
      {canMessage && (
        <button
          type="button"
          className="user-name-message-button"
          onClick={handleButtonClick}
        >
          Meld
        </button>
      )}
    </span>
  )
}

UserNameWithMessage.propTypes = {
  userId: PropTypes.string,
  currentUserId: PropTypes.string,
  displayName: PropTypes.string,
  onMessage: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
}
