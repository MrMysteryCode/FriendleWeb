import { useEffect, useMemo, useRef, useState } from "react";

function drawPixelated(ctx, img, pixelSize) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const sw = Math.max(1, Math.floor(w / pixelSize));
  const sh = Math.max(1, Math.floor(h / pixelSize));

  const off = document.createElement("canvas");
  off.width = sw;
  off.height = sh;

  const octx = off.getContext("2d");
  octx.imageSmoothingEnabled = false;
  octx.drawImage(img, 0, 0, sw, sh);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
}

export default function MedialeCanvas({ puzzle }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [status, setStatus] = useState("");
  const [guess, setGuess] = useState("");
  const [guessCount, setGuessCount] = useState(0);

  const keywords = useMemo(() => {
    const arr = puzzle?.media?.keywords || [];
    return arr.map((k) => String(k).toLowerCase());
  }, [puzzle]);

  // 6 guesses, starts very pixelated
  const pixelSchedule = [40, 28, 20, 14, 10, 6];
  const pixelSize = pixelSchedule[Math.min(guessCount, pixelSchedule.length - 1)];

  useEffect(() => {
    if (!puzzle?.media?.url) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous"; // requires your Worker CORS to allow your GitHub Pages origin
    img.src = puzzle.media.url;

    img.onload = () => {
      imgRef.current = img;
      drawPixelated(ctx, img, pixelSize);
      setStatus("Guess the media. Your guess must include at least one keyword from the link.");
    };

    img.onerror = () => {
      setStatus("Failed to load media. (CORS or invalid media URL)");
    };
  }, [puzzle?.media?.url]); // load once per new puzzle

  // redraw when pixel size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!ctx || !img) return;
    drawPixelated(ctx, img, pixelSize);
  }, [pixelSize]);

  function submitGuess() {
    const g = guess.trim().toLowerCase();
    if (!g) return;

    // Enforce rule: guess must contain at least one keyword (if we have keywords)
    const keywordOk = keywords.length === 0 ? true : keywords.some((k) => g.includes(k));
    if (!keywordOk) {
      setStatus("Invalid guess: must include at least one keyword from the link.");
      return;
    }

    const next = guessCount + 1;
    setGuessCount(next);
    setGuess("");

    if (next >= 6) {
      // final reveal (no pixelation)
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = imgRef.current;
      if (ctx && img) {
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      setStatus("Out of guesses. Revealed!");
      return;
    }

    setStatus(`Valid guess recorded (${next}/6). Clarity increased.`);
  }

  if (!puzzle) return <div className="game-card">No Mediale today.</div>;
  if (!puzzle.media?.url) return <div className="game-card">No Mediale today.</div>;

  return (
    <article className="game-card">
      <div className="game-copy">
        <h3>Mediale</h3>
        <p style={{ marginTop: 6 }}>{status}</p>

        <canvas
          ref={canvasRef}
          width={420}
          height={420}
          style={{ width: "100%", maxWidth: 420, borderRadius: 12, marginTop: 12 }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type a guess (must include a keyword)"
            style={{ flex: 1, padding: 10, borderRadius: 10 }}
          />
          <button onClick={submitGuess} style={{ padding: "10px 14px", borderRadius: 10 }}>
            Guess
          </button>
        </div>

        {/* Optional: show keywords for debugging only (remove later) */}
        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Keywords: {keywords.length ? keywords.join(", ") : "(none)"}
        </div>
      </div>
    </article>
  );
}
