export default function MedialeCanvas({ url, pixelSize, reveal }) {
  if (!url) return null

  const isGif = /\.gif($|\?)/i.test(url)
  const isVideo = /\.(mp4|webm|ogg)($|\?)/i.test(url)
  const blurStrength = reveal ? 0 : Math.max(4, Math.round(pixelSize / 2))
  const blurStyle = blurStrength ? `blur(${blurStrength}px)` : 'none'

  const wrapperStyle = {
    borderRadius: '12px',
    overflow: 'hidden',
    ...(isGif || isVideo ? { filter: blurStyle } : {}),
  }

  return (
    <div className="mediale-canvas" style={wrapperStyle}>
      {isVideo ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          style={{ width: 'min(420px, 100%)', display: 'block' }}
        />
      ) : (
        <img
          src={url}
          alt=""
          aria-hidden="true"
          style={isGif ? undefined : { filter: blurStyle }}
        />
      )}
    </div>
  )
}
