import { useEffect, useRef } from 'react'

function drawPixelated(ctx, img, pixelSize, reveal) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height

  ctx.clearRect(0, 0, w, h)

  if (reveal || pixelSize <= 1) {
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, w, h)
    return
  }

  const sw = Math.max(1, Math.floor(w / pixelSize))
  const sh = Math.max(1, Math.floor(h / pixelSize))

  const off = document.createElement('canvas')
  off.width = sw
  off.height = sh

  const octx = off.getContext('2d')
  octx.imageSmoothingEnabled = false
  octx.drawImage(img, 0, 0, sw, sh)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h)
}

export default function MedialeCanvas({ url, pixelSize, reveal }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!url) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url

    img.onload = () => {
      imgRef.current = img
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      drawPixelated(ctx, img, pixelSize, reveal)
    }
  }, [url])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const img = imgRef.current
    if (!ctx || !img) return
    drawPixelated(ctx, img, pixelSize, reveal)
  }, [pixelSize, reveal])

  if (!url) return null

  return (
    <div className="mediale-canvas">
      <canvas ref={canvasRef} width={420} height={420} />
    </div>
  )
}
