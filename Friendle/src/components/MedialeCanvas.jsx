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

const STOP_WORDS = new Set([
  "gif",
  "gifs",
  "image",
  "images",
  "view",
  "media",
  "cdn",
  "tenor",
  "giphy",
  "img",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp4",
  "webm",
]);

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function extractKeywordsFromUrl(url) {
  try {
    const parsed = new URL(url);
    const rawTokens = decodeURIComponent(parsed.pathname)
      .split(/[\/\\-_.]+/)
      .concat(parsed.hostname.split("."));
    return rawTokens
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 1)
      .filter((token) => !STOP_WORDS.has(token))
      .filter((token) => !/^\d+$/.test(token));
  } catch {
    return [];
  }
}

function extractAnswers(puzzle) {
  const values = [];
  const pushValue = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    if (typeof value === "string") {
      values.push(value);
      return;
    }
    if (typeof value === "object") {
      const name = value.username || value.user || value.name || value.member;
      if (name) values.push(name);
    }
  };

  pushValue(puzzle?.answer);
  pushValue(puzzle?.answers);
  pushValue(puzzle?.solution);
  pushValue(puzzle?.solutions);
  pushValue(puzzle?.correct);
  pushValue(puzzle?.correctAnswer);
  pushValue(puzzle?.correct_answer);
  pushValue(puzzle?.target);
  pushValue(puzzle?.user);
  pushValue(puzzle?.username);
  pushValue(puzzle?.member);
  pushValue(puzzle?.author);
  pushValue(puzzle?.poster);

  return Array.from(new Set(values.map((value) => normalizeToken(value)).filter(Boolean)));
}

export default function MedialeCanvas({ puzzle, gameKey = "mediale" }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [status, setStatus] = useState("");
  const [guess, setGuess] = useState("");
  const [guessCount, setGuessCount] = useState(0);

  const keywords = useMemo(() => {
    const provided = (puzzle?.media?.keywords || []).map((k) => String(k).toLowerCase());
    const sourceUrl = puzzle?.media?.source_url || puzzle?.media?.url;
    const derived = sourceUrl ? extractKeywordsFromUrl(sourceUrl) : [];
    return Array.from(new Set([...provided, ...derived]));
  }, [puzzle]);

  const answers = useMemo(() => extractAnswers(puzzle), [puzzle]);

  // 6 guesses, starts very pixelated
  const pixelSchedule = [40, 28, 20, 14, 10, 6];
  const pixelSize = pixelSchedule[Math.min(guessCount, pixelSchedule.length - 1)];

  useEffect(() => {
    setStatus("");
    setGuess("");
    setGuessCount(0);
    if (!puzzle?.media?.url) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous"; // requires your Worker CORS to allow your GitHub Pages origin
    img.src = puzzle.media.url;

    img.onload = () => {
      imgRef.current = img;
      drawPixelated(ctx, img, pixelSize);
      setStatus("Guess who posted it. Include at least one word from the media link.");
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

  function revealImage() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!ctx || !img) return;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  function submitGuess() {
    const g = guess.trim().toLowerCase();
    if (!g) return;

    const keywordOk =
      keywords.length === 0 ? true : keywords.some((k) => g.includes(k));
    if (!keywordOk) {
      setStatus("Your guess must include at least one word from the media link.");
      return;
    }

    const next = guessCount + 1;
    setGuessCount(next);
    setGuess("");

    const guessNormalized = normalizeToken(g);
    const isCorrect =
      answers.length > 0 && answers.some((answer) => guessNormalized.includes(answer));

    if (isCorrect) {
      revealImage();
      setStatus("Correct! Moving to the next game.");
      if (gameKey) {
        window.dispatchEvent(
          new CustomEvent("friendle:game-complete", { detail: { game: gameKey } })
        );
      }
      return;
    }

    if (next >= 6) {
      revealImage();
      setStatus("Out of guesses. Revealed!");
      if (gameKey) {
        window.dispatchEvent(
          new CustomEvent("friendle:game-complete", { detail: { game: gameKey } })
        );
      }
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

      </div>
    </article>
  );
}
