export default function MedialeCanvas({ url, pixelSize, reveal }) {
  if (!url) return null

  const blurStrength = reveal ? 0 : Math.max(4, Math.round(pixelSize / 2))

  return (
    <div className="mediale-canvas">
      <img
        src={url}
        alt=""
        aria-hidden="true"
        style={{ filter: `blur(${blurStrength}px)` }}
      />
    </div>
  )
}
