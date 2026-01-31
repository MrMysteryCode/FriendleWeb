export default function MedialeCanvas({ url, pixelSize, reveal }) {
  if (!url) return null

  const isGif = /\.gif($|\?)/i.test(url)
  const blurStrength = reveal ? 0 : Math.max(4, Math.round(pixelSize / 2))
  const blurStyle = blurStrength ? `blur(${blurStrength}px)` : 'none'

  const wrapperStyle = isGif
    ? { filter: blurStyle, borderRadius: '12px', overflow: 'hidden' }
    : undefined

  return (
    <div className="mediale-canvas" style={wrapperStyle}>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        style={isGif ? undefined : { filter: blurStyle }}
      />
    </div>
  )
}
