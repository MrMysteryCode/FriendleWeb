import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchLatestPuzzles } from '../api/friendleApi'
import MedialeCanvas from '../components/MedialeCanvas'

const MAX_GUESSES = 6
const ACCOUNT_AGE_ORDER = ['Less than 1 year', '1-2 years', '2-4 years', '4+ years']
const MIN_PARTIAL_MATCH = 3

function storageKey(guildId, date, game) {
  return `friendle:${guildId}:${date}:${game}`
}

/**
 * Persist per-game state (guesses + status) in localStorage for a guild/date.
 */
function useStoredGameState(guildId, date, game) {
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
  }, [key])

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
  const key = normalizeName(value)
  if (!key) return 'classic'
  if (key === 'friendle_daily' || key === 'daily' || key === 'classic') return 'classic'
  if (['quotele', 'mediale', 'statle'].includes(key)) return key
  return 'classic'
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
function buildAllowedUsernames(allowed = [], names = {}) {
  const list = Array.isArray(allowed) && allowed.length ? allowed : Object.values(names)
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
  if (!allowedSet || allowedSet.size === 0) return items
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

function extractKeywordsFromUrl(url) {
  if (!url) return []
  const match = url.match(/\/view\/([^/]+?)-gif-/i)
  if (!match) return []
  const slug = match[1]
  return slug
    .split('-')
    .map((token) => token.toLowerCase())
    .filter((token) => token && token.length >= 3)
    .filter((token) => !['gif', 'view', 'tenor'].includes(token))
}

function parseMedialeGuess(input) {
  const raw = input.trim()
  if (!raw) return { username: '', keyword: '' }

  if (raw.includes('|')) {
    const [userPart, keywordPart] = raw.split('|')
    return {
      username: userPart.trim(),
      keyword: (keywordPart || '').trim(),
    }
  }

  const [first, ...rest] = raw.split(/\s+/)
  return { username: first, keyword: rest.join(' ') }
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
function GuessPool({ names, allowedUsernames, variant = 'dark' }) {
  const pool = useMemo(() => {
    const list = buildGuessPool(names, allowedUsernames)
    const unique = Array.from(new Set(list))
    return unique.sort((a, b) => a.localeCompare(b))
  }, [names, allowedUsernames])

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
function EmptyGame({ title, message, onContinue, names, allowedUsernames }) {
  return (
    <section className="game-panel game-panel-empty">
      <h3>{title}</h3>
      <p className="game-status">{message}</p>
      <GuessPool names={names} allowedUsernames={allowedUsernames} variant="light" />
      {onContinue && (
        <button className="ghost-button" type="button" onClick={onContinue}>
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
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(initialGame)

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

  const puzzles = useMemo(() => {
    const raw = data?.puzzles || {}
    if (Array.isArray(raw)) {
      return raw.reduce((acc, puzzle) => {
        if (puzzle?.game) acc[puzzle.game] = puzzle
        return acc
      }, {})
    }
    return raw
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
  const nameLookup = useMemo(() => buildNameLookup(names), [names])
  const dateLabel = data?.date || data?.metadata?.date || ''
  const dateNote = useMemo(() => getPuzzleDateNote(dateLabel), [dateLabel])
  const classicPuzzle = puzzles.friendle_daily || puzzles.classic || puzzles.friendle || null

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
              puzzle={classicPuzzle}
              metrics={metrics}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onComplete={() => advanceToNext('classic')}
            />
          )}
          {activeTab === 'quotele' && (
            <QuoteleGame
              puzzle={puzzles.quotele}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onComplete={() => advanceToNext('quotele')}
            />
          )}
          {activeTab === 'mediale' && (
            <MedialeGame
              puzzle={puzzles.mediale}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onComplete={() => advanceToNext('mediale')}
            />
          )}
          {activeTab === 'statle' && (
            <StatleGame
              puzzle={puzzles.statle}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveGuess={resolveGuess}
              resolveDisplayName={resolveDisplayName}
              names={names}
              onComplete={() => advanceToNext('statle')}
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
  puzzle,
  metrics,
  allowedUsernames,
  guildId,
  date,
  resolveGuess,
  resolveDisplayName,
  names,
  onComplete,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, resetGame, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'classic'
  )

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
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Keep going!')
  }

  const handleReset = () => {
    resetGame()
    setGuessInput('')
    setMessage('')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Classic"
        message="No Classic puzzle available."
        onContinue={onComplete}
        names={names}
        allowedUsernames={allowedUsernames}
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
          placeholder="Type a username or ID"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Guess
        </button>
      </div>

      <p className="game-status">{message}</p>
      <button className="ghost-button" type="button" onClick={handleReset}>
        Clear guesses
      </button>
      {!isComplete && attempts >= 3 && solutionName && (
        <p className="game-status">Hint: Their username starts with {firstLetter(solutionName)}.</p>
      )}
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}
      {isComplete && onComplete && (
        <button className="ghost-button" type="button" onClick={onComplete}>
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
        {guesses.map((row, index) => (
          <div key={`${row.userId}-${index}`} className="guess-row">
            <span>{row.name}</span>
            <span className={compareMessageCount(row.metrics?.messageCount, solutionMetrics?.messageCount)}>
              {clampValue(row.metrics?.messageCount)}
            </span>
            <span className={compareString(row.metrics?.topWord, solutionMetrics?.topWord)}>
              {clampValue(row.metrics?.topWord)}
            </span>
            <span className={compareActiveWindow(row.metrics?.activeWindow || 'Not active', solutionMetrics?.activeWindow)}>
              {clampValue(row.metrics?.activeWindow || 'Not active')}
            </span>
            <span className={compareMentions(row.metrics?.mentions, solutionMetrics?.mentions)}>
              {clampValue(row.metrics?.mentions)}
            </span>
            <span className={compareFirstBucket(row.metrics?.firstMessageBucket || 'Not active', solutionMetrics?.firstMessageBucket)}>
              {clampValue(row.metrics?.firstMessageBucket || 'Not active')}
            </span>
            <span className={compareAccountAge(row.metrics?.accountAgeRange, solutionMetrics?.accountAgeRange)}>
              {clampValue(row.metrics?.accountAgeRange)}
            </span>
          </div>
        ))}
      </div>

      <GuessHistory
        guesses={guesses.map((row) => ({
          label: row.name,
        }))}
      />
      <GuessPool names={names} allowedUsernames={allowedUsernames} />
    </section>
  )
}

/**
 * Quotele game mode: unscramble quote + identify author.
 */
function QuoteleGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveGuess,
  resolveDisplayName,
  names,
  onComplete,
}) {
  const [quoteInput, setQuoteInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, resetGame, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'quotele'
  )

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)
  const allowValidation = allowedUsernames && allowedUsernames.size > 0

  const handleSubmit = async () => {
    if (isComplete) return
    const guessInfo = resolveGuess(usernameInput)
    if (!guessInfo.normalizedGuess || !quoteInput.trim()) return

    if (allowValidation && !isGuessAllowed(guessInfo, allowedUsernames)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = guessInfo.userId
    const quoteNormalized = normalizeQuote(quoteInput)
    const quoteHash = await sha256Hex(quoteNormalized)

    const userCorrect = isUserGuessMatch(
      guessInfo,
      solutionId,
      puzzle?.solution_user_name
    )
    const quoteCorrect = quoteHash === puzzle?.quote_hash

    addGuess({
      label: `${usernameInput.trim()} - ${quoteCorrect ? 'quote ok' : 'quote no'} / ${userCorrect ? 'user ok' : 'user no'}`,
      userCorrect,
      quoteCorrect,
    })

    setQuoteInput('')
    setUsernameInput('')

    if (userCorrect && quoteCorrect) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} sent the quote.`)
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
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

  const handleReset = () => {
    resetGame()
    setQuoteInput('')
    setUsernameInput('')
    setMessage('')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Quotele"
        message="No Quotele puzzle available."
        onContinue={onComplete}
        names={names}
        allowedUsernames={allowedUsernames}
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
        />
        <input
          value={usernameInput}
          onChange={(event) => setUsernameInput(event.target.value)}
          placeholder="Who sent it? (username or ID)"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      <button className="ghost-button" type="button" onClick={handleReset}>
        Clear guesses
      </button>
      {!isComplete && attempts >= 3 && (puzzle?.meta?.time_bucket || puzzle?.meta?.channel_category) && (
        <p className="game-status">
          Hint: {puzzle?.meta?.time_bucket ? `Sent in the ${puzzle.meta.time_bucket.toLowerCase()}` : ''}
          {puzzle?.meta?.time_bucket && puzzle?.meta?.channel_category ? ' • ' : ''}
          {puzzle?.meta?.channel_category ? `Channel category: ${puzzle.meta.channel_category}` : ''}
        </p>
      )}
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}
      {isComplete && (puzzle?.quote_original || puzzle?.quote) && (
        <div className="quote-block">
          <p className="quote-text">{puzzle?.quote_original || puzzle?.quote}</p>
        </div>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool names={names} allowedUsernames={allowedUsernames} />
    </section>
  )
}

/**
 * Statle game mode: match standout stats to a member.
 */
function StatleGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveGuess,
  resolveDisplayName,
  names,
  onComplete,
}) {
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, resetGame, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'statle'
  )

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
      if (onComplete) onComplete()
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Try another guess.')
  }

  const handleReset = () => {
    resetGame()
    setUsernameInput('')
    setMessage('')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Statle"
        message="No Statle puzzle available."
        onContinue={onComplete}
        names={names}
        allowedUsernames={allowedUsernames}
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
          placeholder="Guess the member (username or ID)"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      <button className="ghost-button" type="button" onClick={handleReset}>
        Clear guesses
      </button>
      {!isComplete && attempts >= 3 && solutionName && (
        <p className="game-status">Hint: Their username starts with {firstLetter(solutionName)}.</p>
      )}
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}
      {isComplete && onComplete && (
        <button className="ghost-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool names={names} allowedUsernames={allowedUsernames} />
    </section>
  )
}

/**
 * Mediale game mode: identify media poster with keyword.
 */
function MedialeGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveGuess,
  resolveDisplayName,
  names,
  onComplete,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, resetGame, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'mediale'
  )

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)
  const mediaUrl = puzzle?.media?.url
  const keywordSource = puzzle?.media?.source_url || mediaUrl
  const mediaKeywords = Array.isArray(puzzle?.media?.keywords) ? puzzle.media.keywords : []
  const keywords = Array.from(
    new Set([
      ...mediaKeywords.map((item) => normalizeName(item)),
      ...extractKeywordsFromUrl(keywordSource),
    ])
  ).filter(Boolean)
  const allowValidation = allowedUsernames && allowedUsernames.size > 0

  const pixelSteps = [36, 28, 20, 14, 10, 6]
  const pixelSize = pixelSteps[Math.min(attempts, pixelSteps.length - 1)]
  const reveal = isComplete

  const handleSubmit = () => {
    if (isComplete) return
    const parsed = parseMedialeGuess(guessInput)
    const username = parsed.username
    const keyword = parsed.keyword
    const guessInfo = resolveGuess(username)

    if (!guessInfo.normalizedGuess) {
      setMessage('Not a valid member name for today.')
      return
    }

    if (allowValidation && !isGuessAllowed(guessInfo, allowedUsernames)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const keywordNormalized = normalizeName(keyword)
    const keywordOk =
      keywords.length === 0 || keywords.some((token) => keywordNormalized.includes(token))

    if (!keywordOk) {
      setMessage('Your guess must include at least one keyword from the media link.')
      return
    }

    const userId = guessInfo.userId
    const correctUser = isUserGuessMatch(guessInfo, solutionId, puzzle?.solution_user_name)
    const guessLabel = keyword
      ? `${guessInfo.displayName || username} - ${keyword}`
      : guessInfo.displayName || username

    addGuess({ label: guessLabel, correctUser, keywordOk })
    setGuessInput('')

    if (correctUser) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} posted the media.`)
      if (onComplete) onComplete()
      return
    }

    if (attempts + 1 >= MAX_GUESSES) {
      setStatus('lost')
      setMessage(`Out of guesses. Answer: ${solutionName}.`)
      return
    }

    setMessage('Not quite. The image is getting clearer.')
  }

  const handleReset = () => {
    resetGame()
    setGuessInput('')
    setMessage('')
  }

  if (!puzzle) {
    return (
      <EmptyGame
        title="Mediale"
        message="No Mediale puzzle available."
        onContinue={onComplete}
        names={names}
        allowedUsernames={allowedUsernames}
      />
    )
  }

  return (
    <section className="game-panel">
      <h3>Mediale</h3>
      <p className="game-status">Identify who posted the media and include a keyword from the link.</p>
      <MedialeCanvas url={mediaUrl} pixelSize={pixelSize} reveal={reveal} />

      <div className="guess-input">
        <input
          value={guessInput}
          onChange={(event) => setGuessInput(event.target.value)}
          placeholder="username or ID | keyword"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      <button className="ghost-button" type="button" onClick={handleReset}>
        Clear guesses
      </button>
      {!isComplete && attempts >= 3 && keywords.length > 0 && (
        <p className="game-status">Hint: One keyword is “{keywords[0]}”.</p>
      )}
      {isComplete && (
        <div className="game-status">
          <p>Answer: {solutionName}</p>
          <p>Accepted keywords: {keywords.length ? keywords.join(', ') : 'None'}</p>
        </div>
      )}
      {isComplete && onComplete && (
        <button className="ghost-button" type="button" onClick={onComplete}>
          Continue
        </button>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
      <GuessPool names={names} allowedUsernames={allowedUsernames} />
    </section>
  )
}
