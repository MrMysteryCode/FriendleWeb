import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchLatestPuzzles } from '../api/friendleApi'
import MedialeCanvas from '../components/MedialeCanvas'

const MAX_GUESSES = 6
const ACCOUNT_AGE_ORDER = ['Less than 1 year', '1-2 years', '2-4 years', '4+ years']
const MIN_PARTIAL_MATCH = 3

function getApiBase() {
  const base = import.meta.env.VITE_API_URL || ''
  if (base) return base.replace(/\/$/, '')
  const statsUrl = import.meta.env.VITE_STATS_URL || ''
  if (!statsUrl) return ''
  try {
    const parsed = new URL(statsUrl, window.location.origin)
    parsed.pathname = parsed.pathname.replace(/\/stats\/?$/, '')
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

async function postStatsEvent(type) {
  const apiBase = getApiBase()
  if (!apiBase) return
  try {
    const writeKey = import.meta.env.VITE_STATS_WRITE_KEY || ''
    const headers = { 'Content-Type': 'application/json' }
    if (writeKey) {
      headers.Authorization = `Bearer ${writeKey}`
    }
    const res = await fetch(`${apiBase}/stats/event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, latest: true }),
    })
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('friendle:stats-updated'))
    }
  } catch {
    // ignore
  }
}

function storageKey(guildId, date, game) {
  return `friendle:${guildId}:${date}:${game}`
}

function clearStoredGameState(guildId, date) {
  if (!guildId || !date) return
  ;['classic', 'quotele', 'mediale', 'statle'].forEach((game) => {
    localStorage.removeItem(storageKey(guildId, date, game))
  })
}

function clearStoredGameStateForGuild(guildId) {
  if (!guildId) return
  const prefix = `friendle:${guildId}:`
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  }
}

/**
 * Persist per-game state (guesses + status) in localStorage for a guild/date.
 */
function useStoredGameState(guildId, date, game, resetSeed = 0) {
  const key = guildId && date ? storageKey(guildId, date, game) : null
  const [state, setState] = useState({ guesses: [], status: null })

  useEffect(() => {
    if (!key) return
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.guesses)) {
          setState({ guesses: parsed.guesses, status: parsed.status || null })
          return
        }
      } catch {
        // ignore
      }
    }
    setState({ guesses: [], status: null })
  }, [key, resetSeed])

  useEffect(() => {
    if (!key) return
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  const addGuess = (guess) => {
    setState((prev) => ({ ...prev, guesses: [...prev.guesses, guess] }))
  }

  const setStatus = (status) => {
    setState((prev) => ({ ...prev, status }))
  }

  const resetGame = () => {
    setState({ guesses: [], status: null })
    if (key) {
      localStorage.removeItem(key)
    }
  }

  const attempts = state.guesses.length
  const isComplete = state.status === 'won' || state.status === 'lost' || attempts >= MAX_GUESSES

  useEffect(() => {
    if (attempts >= MAX_GUESSES && !state.status) {
      setStatus('lost')
    }
  }, [attempts, state.status])

  return { state, addGuess, setStatus, resetGame, attempts, isComplete }
}

/**
 * Normalize input for case-insensitive comparisons.
 */
function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/**
 * Normalize usernames and IDs for loose matching (alphanumerics only).
 */
function normalizeUserToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeGameKey(value) {
  return normalizePuzzleKey(value) || 'classic'
}

function normalizePuzzleKey(value) {
  const key = normalizeName(value).replace(/[\s_-]+/g, '')
  if (!key) return null
  if (['friendledaily', 'daily', 'classic', 'friendle'].includes(key)) return 'classic'
  if (['quotele', 'quotedaily', 'quote'].includes(key)) return 'quotele'
  if (['mediale', 'medial', 'mediadaily', 'media'].includes(key)) return 'mediale'
  if (['statle', 'statledaily', 'stat', 'stats'].includes(key)) return 'statle'
  return null
}

function normalizeQuote(value) {
  return String(value || '')
    .replace(/<@!?\d+>/g, '[mention]')
    .replace(/@\w+/g, '[mention]')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .trim()
}

function parseDateLabel(value) {
  const match = String(value || '').match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null
  return new Date(year, month, day)
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getPuzzleDateNote(label) {
  const parsed = parseDateLabel(label)
  if (!parsed) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const puzzleDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  if (isSameDate(puzzleDate, today) || isSameDate(puzzleDate, yesterday)) return ''
  return `No activity in the last two days. Using the most recent messages from ${label}.`
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(hash))
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function buildNameLookup(names = {}) {
  const map = new Map()
  Object.entries(names).forEach(([userId, displayName]) => {
    const normalizedId = normalizeUserToken(userId)
    if (displayName) {
      const normalizedName = normalizeUserToken(displayName)
      if (normalizedName) {
        map.set(normalizedName, String(userId))
      }
    }
    if (normalizedId) {
      map.set(normalizedId, String(userId))
    }
  })
  return map
}

/**
 * Build a set of allowed usernames (and their IDs) for validation.
 */
function buildAllowedUsernames(allowed = [], names = {}, options = {}) {
  const list = Array.isArray(allowed) && allowed.length ? allowed : Object.values(names)
  if (options.strict && (!Array.isArray(allowed) || allowed.length === 0)) {
    return new Set()
  }
  const allowedSet = new Set()
  const nameToId = new Map()
  Object.entries(names).forEach(([userId, displayName]) => {
    const normalizedName = normalizeUserToken(displayName)
    if (normalizedName) {
      nameToId.set(normalizedName, String(userId))
    }
  })
  list.forEach((name) => {
    const normalizedName = normalizeUserToken(name)
    if (!normalizedName) return
    allowedSet.add(normalizedName)
    const id = nameToId.get(normalizedName)
    if (id) {
      allowedSet.add(normalizeUserToken(id))
    }
  })
  if (!Array.isArray(allowed) || allowed.length === 0) {
    Object.keys(names).forEach((userId) => {
      const normalizedId = normalizeUserToken(userId)
      if (normalizedId) {
        allowedSet.add(normalizedId)
      }
    })
  }
  return allowedSet
}

function buildGuessPool(names = {}, allowedSet) {
  const items = Object.values(names).filter(Boolean)
  if (!allowedSet) return items
  if (allowedSet.size === 0) return []
  return items.filter((name) => allowedSet.has(normalizeUserToken(name)))
}

function formatStatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (match) => match.toUpperCase())
}

function clampValue(value) {
  if (value === undefined || value === null) return '?'
  return value
}

function normalizeTopWord(value) {
  if (!value) return 'None'
  const text = String(value).trim()
  if (!text) return 'None'
  if (!/[a-z]/i.test(text)) return 'None'
  return text
}

function firstLetter(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text[0].toUpperCase()
}

function getMetricValue(metrics, key) {
  if (!metrics) return null
  return metrics[key]
}

function parseRange(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return value
  const match = String(value).match(/\d+/)
  return match ? Number(match[0]) : null
}

function compareMessageCount(guessValue, solutionValue) {
  const guess = parseRange(guessValue)
  const solution = parseRange(solutionValue)
  if (guess === null || solution === null) return 'cell-unknown'
  if (guess === solution) return 'cell-correct'
  if (solution < 10 && Math.abs(guess - solution) <= 2) return 'cell-close'
  if (solution >= 10 && Math.abs(guess - solution) <= solution * 0.2) return 'cell-close'
  return 'cell-wrong'
}

function compareMentions(guessValue, solutionValue) {
  const guess = parseRange(guessValue)
  const solution = parseRange(solutionValue)
  if (guess === null || solution === null) return 'cell-unknown'
  if (guess === solution) return 'cell-correct'
  if (Math.abs(guess - solution) <= 2) return 'cell-close'
  return 'cell-wrong'
}

function compareString(guessValue, solutionValue) {
  if (!guessValue || !solutionValue) return 'cell-unknown'
  return normalizeName(guessValue) === normalizeName(solutionValue)
    ? 'cell-correct'
    : 'cell-wrong'
}

function compareActiveWindow(guessValue, solutionValue) {
  const guess = normalizeName(guessValue)
  const solution = normalizeName(solutionValue)
  if (!guess || !solution) return 'cell-unknown'
  if (guess === 'not active' && solution === 'not active') return 'cell-correct'
  if (guess === 'not active' && solution !== 'not active') return 'cell-wrong'
  if (guess === solution) return 'cell-correct'
  const guessTokens = guess.split(/\W+/).filter(Boolean)
  const solutionTokens = solution.split(/\W+/).filter(Boolean)
  const shared = guessTokens.some((token) => solutionTokens.includes(token))
  return shared ? 'cell-close' : 'cell-wrong'
}

function compareFirstBucket(guessValue, solutionValue) {
  const guess = normalizeName(guessValue)
  const solution = normalizeName(solutionValue)
  if (!guess && !solution) return 'cell-correct'
  if (guess === 'not active' && solution === 'not active') return 'cell-correct'
  if (!guess || !solution) return 'cell-wrong'
  return guess === solution ? 'cell-correct' : 'cell-wrong'
}

function compareAccountAge(guessValue, solutionValue) {
  const guess = normalizeAccountAge(guessValue)
  const solution = normalizeAccountAge(solutionValue)
  if (!guess || !solution) return 'cell-unknown'
  if (guess === solution) return 'cell-correct'
  const guessIndex = ACCOUNT_AGE_ORDER.indexOf(guess)
  const solutionIndex = ACCOUNT_AGE_ORDER.indexOf(solution)
  if (guessIndex === -1 || solutionIndex === -1) return 'cell-wrong'
  return Math.abs(guessIndex - solutionIndex) === 1 ? 'cell-close' : 'cell-wrong'
}

function normalizeAccountAge(value) {
  return String(value || '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a searchable name index from the guild name map.
 */
function buildNameIndex(names = {}) {
  return Object.entries(names)
    .map(([userId, displayName]) => ({
      id: String(userId),
      name: displayName || '',
      normalized: normalizeUserToken(displayName),
    }))
    .filter((entry) => entry.normalized)
}

function findBestUserMatch(normalizedGuess, nameIndex) {
  if (!normalizedGuess || normalizedGuess.length < MIN_PARTIAL_MATCH) return null
  const matches = nameIndex.filter(
    (entry) =>
      entry.normalized.includes(normalizedGuess) ||
      normalizedGuess.includes(entry.normalized)
  )
  if (!matches.length) return null
  matches.sort((a, b) => {
    const diff =
      Math.abs(a.normalized.length - normalizedGuess.length) -
      Math.abs(b.normalized.length - normalizedGuess.length)
    if (diff !== 0) return diff
    return a.normalized.localeCompare(b.normalized)
  })
  return matches[0]
}

/**
 * Resolve a raw user guess into userId + best display name match.
 */
function resolveUserGuess(rawInput, nameLookup, nameIndex, names) {
  const raw = String(rawInput || '').trim()
  const normalizedGuess = normalizeUserToken(raw)
  if (!normalizedGuess) {
    return { raw, normalizedGuess: '', userId: '', displayName: raw, matchType: 'none' }
  }

  const directId = nameLookup.get(normalizedGuess)
  if (directId) {
    return {
      raw,
      normalizedGuess,
      userId: directId,
      displayName: names?.[directId] || raw,
      matchType: 'exact',
    }
  }

  const partial = findBestUserMatch(normalizedGuess, nameIndex)
  if (partial) {
    return {
      raw,
      normalizedGuess,
      userId: partial.id,
      displayName: partial.name || raw,
      matchType: 'partial',
    }
  }

  return { raw, normalizedGuess, userId: '', displayName: raw, matchType: 'none' }
}

function isGuessAllowed(guessInfo, allowedSet) {
  if (!allowedSet || allowedSet.size === 0) return true
  if (!guessInfo?.normalizedGuess) return false
  if (allowedSet.has(guessInfo.normalizedGuess)) return true
  if (guessInfo.userId && allowedSet.has(normalizeUserToken(guessInfo.userId))) return true
  const normalizedName = normalizeUserToken(guessInfo.displayName)
  if (normalizedName && allowedSet.has(normalizedName)) return true
  return false
}

/**
 * Determine whether a guess matches the solution (id, exact, or partial).
 */
function isUserGuessMatch(guessInfo, solutionId, solutionName) {
  if (!guessInfo?.normalizedGuess) return false
  const guessToken = guessInfo.normalizedGuess
  const solutionToken = normalizeUserToken(solutionName)
  const normalizedSolutionId = solutionId ? normalizeUserToken(solutionId) : ''

  if (normalizedSolutionId && guessToken === normalizedSolutionId) return true
  if (solutionId && guessInfo.userId && String(guessInfo.userId) === String(solutionId)) {
    return true
  }

  if (!solutionToken) return false
  if (guessToken === solutionToken) return true

  const allowPartial = /[a-z]/.test(guessToken) && /[a-z]/.test(solutionToken)
  if (
    allowPartial &&
    guessToken.length >= MIN_PARTIAL_MATCH &&
    (solutionToken.includes(guessToken) || guessToken.includes(solutionToken))
  ) {
    return true
  }

  return false
}

function GuessHistory({ guesses }) {
  if (!guesses.length) return null
  return (
    <ul className="guess-history">
      {guesses.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Render a collapsible pool of possible guesses.
 */
function GuessPool({ names, guessPoolUsernames, guessPoolNames, variant = 'dark' }) {
  const pool = useMemo(() => {
    if (Array.isArray(guessPoolNames) && guessPoolNames.length) {
      const unique = Array.from(
        new Set(guessPoolNames.map((name) => String(name || '').trim()).filter(Boolean))
      )
      return unique.sort((a, b) => a.localeCompare(b))
    }
    const list = buildGuessPool(names, guessPoolUsernames)
    const unique = Array.from(new Set(list))
    return unique.sort((a, b) => a.localeCompare(b))
  }, [names, guessPoolUsernames, guessPoolNames])

  if (!pool.length) return null

  return (
    <details className={`guess-pool ${variant === 'light' ? 'guess-pool-light' : ''}`}>
      <summary>Possible guesses ({pool.length})</summary>
      <div className="game-tags">
        {pool.map((name) => (
          <span className="game-tag" key={name}>
            {name}
          </span>
        ))}
      </div>
    </details>
  )
}

/**
 * Render a lightweight empty state with optional continue action.
 */
function EmptyGame({ title, message, onContinue, names, guessPoolUsernames, guessPoolNames }) {
  return (
    <section className="game-panel game-panel-empty">
      <h3>{title}</h3>
      <p className="game-status">{message}</p>
      <GuessPool
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
        variant="light"
      />
      {onContinue && (
        <button className="ghost-button continue-button" type="button" onClick={onContinue}>
          Continue
        </button>
      )}
    </section>
  )
}

/**
 * Main play screen for daily puzzles.
 */
export default function Play() {
  const [params] = useSearchParams()
  const fallbackParams = new URLSearchParams(window.location.search)
  const guildId = params.get('guild') || fallbackParams.get('guild') || ''
  const initialGame = normalizeGameKey(
    params.get('game') || fallbackParams.get('game') || 'classic'
  )
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(initialGame)
  const [resetSeed, setResetSeed] = useState(0)
  const lastResetKey = useRef('')
  const lastGuildReset = useRef('')

  useEffect(() => {
    if (!guildId) return
    let cancelled = false
    setStatus('loading')
    setError('')
    fetchLatestPuzzles(guildId)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load puzzles')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [guildId])

  useEffect(() => {
    setActiveTab(initialGame)
  }, [initialGame])

  useEffect(() => {
    if (!guildId || lastGuildReset.current === guildId) return
    lastGuildReset.current = guildId
    clearStoredGameStateForGuild(guildId)
    setResetSeed((prev) => prev + 1)
  }, [guildId])

  useEffect(() => {
    if (data?.puzzles) {
      console.log('[Friendle] raw puzzles payload', data.puzzles)
    }
  }, [data?.puzzles])

  const puzzles = useMemo(() => {
    const raw = data?.puzzles
    if (!raw || typeof raw !== 'object') return {}
    if (Array.isArray(raw)) {
      return raw.reduce((acc, puzzle) => {
        const candidates = [puzzle?.game, puzzle?.key, puzzle?.type]
        const normalized = candidates.map(normalizePuzzleKey).find(Boolean)
        if (normalized) acc[normalized] = puzzle
        return acc
      }, {})
    }
    return Object.entries(raw).reduce((acc, [key, puzzle]) => {
      const normalized =
        normalizePuzzleKey(key) ||
        normalizePuzzleKey(puzzle?.game) ||
        normalizePuzzleKey(puzzle?.key) ||
        normalizePuzzleKey(puzzle?.type)
      if (normalized) {
        acc[normalized] = puzzle
      }
      return acc
    }, {})
  }, [data?.puzzles])
  const names = data?.names || data?.metadata?.names || {}
  const metrics = data?.metrics || data?.metadata?.metrics || {}
  const allowedFromPayload =
    data?.allowed_usernames || data?.metadata?.allowed_usernames || data?.allowedUsernames
  const nameIndex = useMemo(() => buildNameIndex(names), [names])
  const allowedUsernames = useMemo(
    () => buildAllowedUsernames(allowedFromPayload, names),
    [allowedFromPayload, names]
  )
  const optedInUsernames = useMemo(
    () => buildAllowedUsernames(allowedFromPayload, names, { strict: true }),
    [allowedFromPayload, names]
  )
  const guessPoolNames = useMemo(() => {
    if (!Array.isArray(allowedFromPayload) || allowedFromPayload.length === 0) return []
    return allowedFromPayload.map((name) => String(name || '').trim()).filter(Boolean)
  }, [allowedFromPayload])
  const nameLookup = useMemo(() => buildNameLookup(names), [names])
  const dateLabel = data?.date || data?.metadata?.date || ''
  const dateNote = useMemo(() => getPuzzleDateNote(dateLabel), [dateLabel])
  const classicPuzzle = puzzles.classic || puzzles.friendle_daily || puzzles.friendle || null

  const trackGameWin = useCallback(
    (gameKey) => {
      if (!dateLabel || !gameKey) return
      const scope = guildId || 'global'
      const guardKey = `friendle:stats:correct:${scope}:${dateLabel}:${gameKey}`
      if (localStorage.getItem(guardKey)) return
      localStorage.setItem(guardKey, '1')
      postStatsEvent('guess_correct')
    },
    [dateLabel, guildId]
  )

  const trackGameCompletion = useCallback(
    (gameKey) => {
      if (!dateLabel || !gameKey) return
      const scope = guildId || 'global'
      const guardKey = `friendle:stats:completed:${scope}:${dateLabel}:${gameKey}`
      if (localStorage.getItem(guardKey)) return
      localStorage.setItem(guardKey, '1')
      postStatsEvent('game_complete')
    },
    [dateLabel, guildId]
  )

  const resolveGuess = (displayName) =>
    resolveUserGuess(displayName, nameLookup, nameIndex, names)

  const resolveDisplayName = (userId) => {
    if (!userId) return ''
    return names?.[userId] || String(userId) || 'Unknown member'
  }


  const advanceToNext = (gameKey) => {
    const order = ['classic', 'quotele', 'mediale', 'statle']
    const idx = order.indexOf(gameKey)
    if (idx === -1 || idx >= order.length - 1) return
    setActiveTab(order[idx + 1])
  }

  const goHome = () => {
    const target = guildId ? `/?guild=${encodeURIComponent(guildId)}` : '/'
    navigate(target)
  }

  useEffect(() => {
    if (status !== 'ready' || !guildId || !dateLabel) return
    const resetKey = `${guildId}:${dateLabel}`
    if (lastResetKey.current === resetKey) return
    lastResetKey.current = resetKey
    clearStoredGameState(guildId, dateLabel)
    setResetSeed((prev) => prev + 1)
  }, [status, guildId, dateLabel])

  useEffect(() => {
    if (!guildId || !dateLabel) return
    const handleUnload = () => clearStoredGameState(guildId, dateLabel)
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [guildId, dateLabel])

  useEffect(() => {
    if (status !== 'ready') return
    const viewKey = dateLabel ? `friendle:stats:view:${dateLabel}` : 'friendle:stats:view'
    if (sessionStorage.getItem(viewKey)) return
    sessionStorage.setItem(viewKey, '1')
    postStatsEvent('view')
  }, [status, dateLabel])

  if (!guildId) {
    return (
      <div className="page play-page">
        <Link className="play-back" to="/">
          {'<- Back to home'}
        </Link>
        <div className="play-empty">
          <h2>Ready to play Friendle?</h2>
          <p>Open <strong>/play?guild=SERVER_ID</strong> to start today's puzzles.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page play-page">
      <Link className="play-back" to={`/?guild=${encodeURIComponent(guildId)}`}>
        {'<- Back to home'}
      </Link>

      <header className="play-header">
        <div>
          <h2>Daily puzzles</h2>
          <p>{dateLabel ? `Date: ${dateLabel}` : 'Loading date...'}</p>
          {dateNote && <p className="game-status">{dateNote}</p>}
        </div>
      </header>

      {status === 'loading' && <p className="game-status">Loading puzzles...</p>}
      {status === 'error' && <p className="game-status error">{error}</p>}

      {status === 'ready' && (
        <div className="play-content">
          {activeTab === 'classic' && (
            <ClassicGame
              gameKey="classic"
              puzzle={classicPuzzle}
              metrics={metrics}
              allowedUsernames={allowedUsernames}
              guessPoolUsernames={optedInUsernames}
              guessPoolNames={guessPoolNames}
              guildId={guildId}
              date={dateLabel}
              resetSeed={resetSeed}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onCorrect={trackGameWin}
              onGameComplete={trackGameCompletion}
              onComplete={() => advanceToNext('classic')}
            />
          )}
          {activeTab === 'quotele' && (
            <QuoteleGame
              gameKey="quotele"
              puzzle={puzzles.quotele}
              allowedUsernames={allowedUsernames}
              guessPoolUsernames={optedInUsernames}
              guessPoolNames={guessPoolNames}
              guildId={guildId}
              date={dateLabel}
              resetSeed={resetSeed}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onCorrect={trackGameWin}
              onGameComplete={trackGameCompletion}
              onComplete={() => advanceToNext('quotele')}
            />
          )}
          {activeTab === 'mediale' && (
            <MedialeGame
              gameKey="mediale"
              puzzle={puzzles.mediale}
              allowedUsernames={allowedUsernames}
              guessPoolUsernames={optedInUsernames}
              guessPoolNames={guessPoolNames}
              guildId={guildId}
              date={dateLabel}
              resetSeed={resetSeed}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onCorrect={trackGameWin}
              onGameComplete={trackGameCompletion}
              onComplete={() => advanceToNext('mediale')}
            />
          )}
          {activeTab === 'statle' && (
            <StatleGame
              gameKey="statle"
              puzzle={puzzles.statle}
              allowedUsernames={allowedUsernames}
              guessPoolUsernames={optedInUsernames}
              guessPoolNames={guessPoolNames}
              guildId={guildId}
              date={dateLabel}
              resetSeed={resetSeed}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onCorrect={trackGameWin}
              onGameComplete={trackGameCompletion}
              onComplete={goHome}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Classic game mode: activity profile guessing.
 */
function ClassicGame({
  gameKey = 'classic',
  puzzle,
  metrics,
  allowedUsernames,
  guessPoolUsernames,
  guessPoolNames,
  guildId,
  date,
  resetSeed,
  resolveGuess,
  resolveDisplayName,
  names,
  onCorrect,
  onGameComplete,
  onComplete,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'classic',
    resetSeed
  )

  useEffect(() => {
    setGuessInput('')
    setMessage('')
  }, [resetSeed])

  useEffect(() => {
    if (!isComplete || !onGameComplete) return
    onGameComplete(gameKey)
  }, [isComplete, onGameComplete, gameKey])

  const solutionMetrics = puzzle?.solution_metrics || metrics?.[puzzle?.solution_user_id] || {}
  const solutionId = puzzle?.solution_user_id

  const allowedSet = allowedUsernames
  const guesses = state.guesses

  const solutionName =
    puzzle?.solution_user_name || (solutionId ? resolveDisplayName(solutionId) : 'Unknown')
  const allowValidation = allowedSet && allowedSet.size > 0

  const handleSubmit = () => {
    if (isComplete) return
    const guessInfo = resolveGuess(guessInput)
    if (!guessInfo.normalizedGuess) return

    if (allowValidation && !isGuessAllowed(guessInfo, allowedSet)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = guessInfo.userId
    const guessedMetrics = metrics?.[userId] || { activeWindow: 'Not active' }
    const displayName = userId
      ? resolveDisplayName(userId)
      : guessInfo.displayName || guessInput.trim()
    const row = {
      name: displayName,
      userId,
      metrics: guessedMetrics,
    }

    addGuess(row)
    setGuessInput('')

    if (isUserGuessMatch(guessInfo, solutionId, puzzle?.solution_user_name)) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} was the answer.`)
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Keep going!')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Classic"
        message="No Classic puzzle available."
        onContinue={onComplete}
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    )
  }

  return (
    <section className="game-panel">
      <h3>Classic</h3>
      <p className="game-status">Match the activity profile to the right member.</p>
      <div className="metrics-table">
        <div className="metrics-row metrics-header">
          <span>Message count</span>
          <span>Top word</span>
          <span>Active window</span>
          <span>Mentions</span>
          <span>First message</span>
          <span>Account age</span>
        </div>
        <div className="metrics-row">
          <span>{clampValue(solutionMetrics?.messageCount)}</span>
          <span>{normalizeTopWord(solutionMetrics?.topWord)}</span>
          <span>{clampValue(solutionMetrics?.activeWindow)}</span>
          <span>{clampValue(solutionMetrics?.mentions)}</span>
          <span>{clampValue(solutionMetrics?.firstMessageBucket)}</span>
          <span>{clampValue(solutionMetrics?.accountAgeRange)}</span>
        </div>
      </div>

      <div className="guess-input">
        <input
          value={guessInput}
          onChange={(event) => setGuessInput(event.target.value)}
          placeholder="Type a username"
          disabled={isComplete}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Guess
        </button>
      </div>

      <p className="game-status">{message}</p>
      {!isComplete && attempts >= 3 && solutionName && (
        <p className="game-status">Hint: Their username starts with {firstLetter(solutionName)}.</p>
      )}
      {isComplete && (
        <p className="game-status answer-text answer-reveal">Answer: {solutionName}</p>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button continue-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <div className="guess-table">
        <div className="guess-row metrics-header">
          <span>Guess</span>
          <span>Message count</span>
          <span>Top word</span>
          <span>Active window</span>
          <span>Mentions</span>
          <span>First message</span>
          <span>Account age</span>
        </div>
        {guesses.map((row, index) => {
          const isNewest = index === guesses.length - 1
          const flipStyle = (delayIndex) =>
            isNewest ? { animationDelay: `${delayIndex * 0.08}s` } : undefined
          const flipClass = isNewest ? 'cell-flip' : ''
          return (
            <div key={`${row.userId}-${index}`} className="guess-row">
              <span className={`guess-cell guess-name ${flipClass}`} style={flipStyle(0)}>
                {row.name}
              </span>
              <span
                className={`guess-cell ${compareMessageCount(
                  row.metrics?.messageCount,
                  solutionMetrics?.messageCount
                )} ${flipClass}`}
                style={flipStyle(1)}
              >
                {clampValue(row.metrics?.messageCount)}
              </span>
              <span
                className={`guess-cell ${compareString(
                  row.metrics?.topWord,
                  solutionMetrics?.topWord
                )} ${flipClass}`}
                style={flipStyle(2)}
              >
                {clampValue(row.metrics?.topWord)}
              </span>
              <span
                className={`guess-cell ${compareActiveWindow(
                  row.metrics?.activeWindow || 'Not active',
                  solutionMetrics?.activeWindow
                )} ${flipClass}`}
                style={flipStyle(3)}
              >
                {clampValue(row.metrics?.activeWindow || 'Not active')}
              </span>
              <span
                className={`guess-cell ${compareMentions(
                  row.metrics?.mentions,
                  solutionMetrics?.mentions
                )} ${flipClass}`}
                style={flipStyle(4)}
              >
                {clampValue(row.metrics?.mentions)}
              </span>
              <span
                className={`guess-cell ${compareFirstBucket(
                  row.metrics?.firstMessageBucket || 'Not active',
                  solutionMetrics?.firstMessageBucket
                )} ${flipClass}`}
                style={flipStyle(5)}
              >
                {clampValue(row.metrics?.firstMessageBucket || 'Not active')}
              </span>
              <span
                className={`guess-cell ${compareAccountAge(
                  row.metrics?.accountAgeRange,
                  solutionMetrics?.accountAgeRange
                )} ${flipClass}`}
                style={flipStyle(6)}
              >
                {clampValue(row.metrics?.accountAgeRange)}
              </span>
            </div>
          )
        })}
      </div>

      <GuessHistory
        guesses={guesses.map((row) => ({
          label: row.name,
        }))}
      />
      <GuessPool
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    </section>
  )
}

/**
 * Quotele game mode: unscramble quote + identify author.
 */
function QuoteleGame({
  gameKey = 'quotele',
  puzzle,
  allowedUsernames,
  guessPoolUsernames,
  guessPoolNames,
  guildId,
  date,
  resetSeed,
  resolveGuess,
  resolveDisplayName,
  names,
  onCorrect,
  onGameComplete,
  onComplete,
}) {
  const [quoteInput, setQuoteInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'quotele',
    resetSeed
  )

  useEffect(() => {
    setQuoteInput('')
    setUsernameInput('')
    setMessage('')
  }, [resetSeed])

  useEffect(() => {
    if (!isComplete || !onGameComplete) return
    onGameComplete(gameKey)
  }, [isComplete, onGameComplete, gameKey])

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)
  const allowValidation = allowedUsernames && allowedUsernames.size > 0

  const handleSubmit = async () => {
    if (isComplete) return
    const rawQuote = quoteInput.trim()
    const rawUser = usernameInput.trim()
    const hasQuote = Boolean(rawQuote)
    const hasUser = Boolean(rawUser)

    if (!hasQuote && !hasUser) return

    const guessInfo = hasUser
      ? resolveGuess(rawUser)
      : { normalizedGuess: '', userId: '', displayName: rawUser }

    if (hasUser) {
      if (!guessInfo.normalizedGuess) {
        setMessage('Not a valid member name for today.')
        return
      }
      if (allowValidation && !isGuessAllowed(guessInfo, allowedUsernames)) {
        setMessage('Not a valid member name for today.')
        return
      }
    }

    const quoteNormalized = hasQuote ? normalizeQuote(rawQuote) : ''
    const quoteHash = hasQuote ? await sha256Hex(quoteNormalized) : ''

    const userCorrect = hasUser
      ? isUserGuessMatch(guessInfo, solutionId, puzzle?.solution_user_name)
      : false
    const quoteCorrect = hasQuote && quoteHash === puzzle?.quote_hash
    const missingFields = []
    if (!hasUser) missingFields.push('username')
    if (!hasQuote) missingFields.push('quote')

    const guessLabel = `${hasUser ? rawUser : 'username empty'} - ${
      hasQuote ? (quoteCorrect ? 'quote ok' : 'quote no') : 'quote empty'
    } / ${hasUser ? (userCorrect ? 'user ok' : 'user no') : 'user empty'}`

    addGuess({
      label: guessLabel,
      userCorrect,
      quoteCorrect,
      missingFields,
    })

    setQuoteInput('')
    setUsernameInput('')

    if (userCorrect && quoteCorrect) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} sent the quote.`)
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (userCorrect && !hasQuote) {
      setStatus('won')
      setMessage('Username is correct. Quote was left empty.')
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (quoteCorrect && !hasUser) {
      setStatus('won')
      setMessage('Quote is correct. Username was left empty.')
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    if (missingFields.length) {
      setMessage(`You left the ${missingFields.join(' and ')} empty.`)
      return
    }

    if (userCorrect && !quoteCorrect) {
      setMessage('Username is correct, but the quote is not.')
    } else if (!userCorrect && quoteCorrect) {
      setMessage('Quote is correct, but the username is not.')
    } else {
      setMessage('Both are incorrect. Try again.')
    }
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Quotele"
        message="No Quotele puzzle available."
        onContinue={onComplete}
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    )
  }

  return (
    <section className="game-panel">
      <h3>Quotele</h3>
      <p className="game-status">The quote is scrambled. Guess the original quote and who sent it.</p>
      <div className="quote-block">{puzzle?.quote_scrambled || puzzle?.quote}</div>

      <div className="guess-input">
        <textarea
          value={quoteInput}
          onChange={(event) => setQuoteInput(event.target.value)}
          placeholder="Guess the original quote"
          disabled={isComplete}
          rows={3}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <input
          value={usernameInput}
          onChange={(event) => setUsernameInput(event.target.value)}
          placeholder="Who sent it? (username)"
          disabled={isComplete}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {!isComplete && attempts >= 3 && (puzzle?.meta?.time_bucket || puzzle?.meta?.channel_category) && (
        <p className="game-status">
          Hint: {puzzle?.meta?.time_bucket ? `Sent in the ${puzzle.meta.time_bucket.toLowerCase()}` : ''}
          {puzzle?.meta?.time_bucket && puzzle?.meta?.channel_category ? ' - ' : ''}
          {puzzle?.meta?.channel_category ? `Channel category: ${puzzle.meta.channel_category}` : ''}
        </p>
      )}
      {isComplete && (
        <div className="game-status answer-reveal">
          <p className="answer-text">Answer: {solutionName}</p>
          {(puzzle?.quote_original_raw || puzzle?.quote_original || puzzle?.quote) && (
            <p className="quote-reveal">
              {puzzle?.quote_original_raw || puzzle?.quote_original || puzzle?.quote}
            </p>
          )}
        </div>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button continue-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    </section>
  )
}

/**
 * Statle game mode: match standout stats to a member.
 */
function StatleGame({
  gameKey = 'statle',
  puzzle,
  allowedUsernames,
  guessPoolUsernames,
  guessPoolNames,
  guildId,
  date,
  resetSeed,
  resolveGuess,
  resolveDisplayName,
  names,
  onCorrect,
  onGameComplete,
  onComplete,
}) {
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'statle',
    resetSeed
  )

  useEffect(() => {
    setUsernameInput('')
    setMessage('')
  }, [resetSeed])

  useEffect(() => {
    if (!isComplete || !onGameComplete) return
    onGameComplete(gameKey)
  }, [isComplete, onGameComplete, gameKey])

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)
  const allowValidation = allowedUsernames && allowedUsernames.size > 0

  const handleSubmit = () => {
    if (isComplete) return
    const guessInfo = resolveGuess(usernameInput)
    if (!guessInfo.normalizedGuess) return

    if (allowValidation && !isGuessAllowed(guessInfo, allowedUsernames)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = guessInfo.userId
    addGuess({ label: guessInfo.displayName || usernameInput.trim(), userId })
    setUsernameInput('')

    if (isUserGuessMatch(guessInfo, solutionId, puzzle?.solution_user_name)) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} matches the stat.`)
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Try another guess.')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Statle"
        message="No Statle puzzle available."
        onContinue={onComplete}
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    )
  }

  return (
    <section className="game-panel">
      <h3>Statle</h3>
      <p className="game-status">Match the standout stat profile to the correct member.</p>
      <div className="stat-grid">
        {Object.entries(puzzle?.stats || {}).map(([key, value]) => (
          <div className="stat-card" key={key}>
            <span>{formatStatLabel(key)}</span>
            <strong>{clampValue(value)}</strong>
          </div>
        ))}
      </div>

      <div className="guess-input">
        <input
          value={usernameInput}
          onChange={(event) => setUsernameInput(event.target.value)}
          placeholder="Guess the member (username)"
          disabled={isComplete}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {!isComplete && attempts >= 3 && solutionName && (
        <p className="game-status">Hint: Their username starts with {firstLetter(solutionName)}.</p>
      )}
      {isComplete && (
        <p className="game-status answer-text answer-reveal">Answer: {solutionName}</p>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button continue-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    </section>
  )
}

/**
 * Mediale game mode: identify media poster.
 */
function MedialeGame({
  gameKey = 'mediale',
  puzzle,
  allowedUsernames,
  guessPoolUsernames,
  guessPoolNames,
  guildId,
  date,
  resetSeed,
  resolveGuess,
  resolveDisplayName,
  names,
  onCorrect,
  onGameComplete,
  onComplete,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'mediale',
    resetSeed
  )

  useEffect(() => {
    setGuessInput('')
    setMessage('')
  }, [resetSeed])

  useEffect(() => {
    if (!isComplete || !onGameComplete) return
    onGameComplete(gameKey)
  }, [isComplete, onGameComplete, gameKey])

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)
  const mediaUrl =
    puzzle?.media?.url ||
    puzzle?.media?.proxy_url ||
    puzzle?.media_url ||
    puzzle?.mediaUrl ||
    puzzle?.media?.source_url
  const allowValidation = allowedUsernames && allowedUsernames.size > 0

  const pixelSteps = [36, 28, 20, 14, 10, 6]
  const pixelSize = pixelSteps[Math.min(attempts, pixelSteps.length - 1)]
  const reveal = isComplete

  const handleSubmit = () => {
    if (isComplete) return
    const username = guessInput.trim()
    if (!username) return
    const guessInfo = resolveGuess(username)

    if (!guessInfo.normalizedGuess) {
      setMessage('Not a valid member name for today.')
      return
    }

    if (allowValidation && !isGuessAllowed(guessInfo, allowedUsernames)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const correctUser = isUserGuessMatch(guessInfo, solutionId, puzzle?.solution_user_name)
    const guessLabel = guessInfo.displayName || username

    addGuess({ label: guessLabel, correctUser })
    setGuessInput('')

    if (correctUser) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} posted the media.`)
      if (onCorrect) onCorrect(gameKey)
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Not quite. The image is getting clearer.')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Mediale"
        message="No Mediale puzzle available."
        onContinue={onComplete}
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    )
  }

  return (
    <section className="game-panel">
      <h3>Mediale</h3>
      <p className="game-status">Identify who posted the media.</p>
      <MedialeCanvas url={mediaUrl} pixelSize={pixelSize} reveal={reveal} />

      <div className="guess-input">
        <input
          value={guessInput}
          onChange={(event) => setGuessInput(event.target.value)}
          placeholder="username"
          disabled={isComplete}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {isComplete && (
        <div className="game-status answer-reveal">
          <p className="answer-text">Answer: {solutionName}</p>
        </div>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button continue-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool
        names={names}
        guessPoolUsernames={guessPoolUsernames}
        guessPoolNames={guessPoolNames}
      />
    </section>
  )
}
