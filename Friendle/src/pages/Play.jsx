import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchLatestPuzzles } from '../api/friendleApi'
import MedialeCanvas from '../components/MedialeCanvas'

const MAX_GUESSES = 6
const ACCOUNT_AGE_ORDER = ['Less than 1 year', '1?2 years', '2?4 years', '4+ years']

function storageKey(guildId, date, game) {
  return `friendle:${guildId}:${date}:${game}`
}

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

  const attempts = state.guesses.length
  const isComplete = state.status === 'won' || state.status === 'lost' || attempts >= MAX_GUESSES

  useEffect(() => {
    if (attempts >= MAX_GUESSES && !state.status) {
      setStatus('lost')
    }
  }, [attempts, state.status])

  return { state, addGuess, setStatus, attempts, isComplete }
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeQuote(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<@!?\d+>/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
    if (!displayName) return
    map.set(normalizeName(displayName), userId)
  })
  return map
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
  if (!guessValue || !solutionValue) return 'cell-unknown'
  if (guessValue === solutionValue) return 'cell-correct'
  const guessIndex = ACCOUNT_AGE_ORDER.indexOf(guessValue)
  const solutionIndex = ACCOUNT_AGE_ORDER.indexOf(solutionValue)
  if (guessIndex === -1 || solutionIndex === -1) return 'cell-wrong'
  return Math.abs(guessIndex - solutionIndex) === 1 ? 'cell-close' : 'cell-wrong'
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

function parseMedialeGuess(input, allowedNames) {
  const raw = input.trim()
  if (!raw) return { username: '', keyword: '' }

  if (raw.includes('|')) {
    const [userPart, keywordPart] = raw.split('|')
    return {
      username: userPart.trim().toLowerCase(),
      keyword: (keywordPart || '').trim().toLowerCase(),
    }
  }

  const lowered = raw.toLowerCase()
  const sortedNames = [...allowedNames].sort((a, b) => b.length - a.length)
  let matched = ''

  for (const name of sortedNames) {
    if (lowered.startsWith(name)) {
      matched = name
      break
    }
  }

  if (!matched) {
    for (const name of sortedNames) {
      const pattern = new RegExp(`\b${name.replace(/[-/\^$*+?.()|[\]{}]/g, '\$&')}\b`, 'i')
      if (pattern.test(lowered)) {
        matched = name
        break
      }
    }
  }

  if (!matched) {
    return { username: '', keyword: lowered }
  }

  const keyword = lowered.replace(matched, '').trim()
  return { username: matched, keyword }
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

export default function Play() {
  const [params] = useSearchParams()
  const guildId = params.get('guild') || ''
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('classic')

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

  const puzzles = data?.puzzles || {}
  const names = data?.names || {}
  const metrics = data?.metrics || {}
  const allowedUsernames = new Set(data?.allowed_usernames || [])
  const nameLookup = useMemo(() => buildNameLookup(names), [names])
  const dateLabel = data?.date || ''

  const resolveUserId = (displayName) => {
    const key = normalizeName(displayName)
    return nameLookup.get(key) || ''
  }

  const resolveDisplayName = (userId) => {
    return names?.[userId] || 'Unknown member'
  }

  if (!guildId) {
    return (
      <div className="page play-page">
        <Link className="play-back" to="/">
          ? Back to home
        </Link>
        <div className="play-empty">
          <h2>Ready to play Friendle?</h2>
          <p>Open <strong>/play?guild=SERVER_ID</strong> to start today?s puzzles.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page play-page">
      <Link className="play-back" to={`/?guild=${encodeURIComponent(guildId)}`}>
        ? Back to home
      </Link>

      <header className="play-header">
        <div>
          <h2>Daily puzzles</h2>
          <p>{dateLabel ? `Date: ${dateLabel}` : 'Loading date...'}</p>
        </div>
        <div className="play-tabs">
          {[
            { key: 'classic', label: 'Classic' },
            { key: 'quotele', label: 'Quotele' },
            { key: 'mediale', label: 'Mediale' },
            { key: 'statle', label: 'Statle' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {status === 'loading' && <p className="game-status">Loading puzzles...</p>}
      {status === 'error' && <p className="game-status error">{error}</p>}

      {status === 'ready' && (
        <div className="play-content">
          {activeTab === 'classic' && (
            <ClassicGame
              puzzle={puzzles.friendle_daily}
              metrics={metrics}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveUserId={resolveUserId}
              resolveDisplayName={resolveDisplayName}
            />
          )}
          {activeTab === 'quotele' && (
            <QuoteleGame
              puzzle={puzzles.quotele}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveUserId={resolveUserId}
              resolveDisplayName={resolveDisplayName}
            />
          )}
          {activeTab === 'mediale' && (
            <MedialeGame
              puzzle={puzzles.mediale}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveUserId={resolveUserId}
              resolveDisplayName={resolveDisplayName}
            />
          )}
          {activeTab === 'statle' && (
            <StatleGame
              puzzle={puzzles.statle}
              allowedUsernames={allowedUsernames}
              guildId={guildId}
              date={dateLabel}
              resolveUserId={resolveUserId}
              resolveDisplayName={resolveDisplayName}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ClassicGame({
  puzzle,
  metrics,
  allowedUsernames,
  guildId,
  date,
  resolveUserId,
  resolveDisplayName,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'classic'
  )

  const solutionMetrics = puzzle?.solution_metrics || metrics?.[puzzle?.solution_user_id] || {}
  const solutionId = puzzle?.solution_user_id

  const allowedSet = allowedUsernames
  const guesses = state.guesses

  const solutionName = solutionId ? resolveDisplayName(solutionId) : 'Unknown'

  const handleSubmit = () => {
    if (isComplete) return
    const normalized = normalizeName(guessInput)
    if (!normalized) return

    if (!allowedSet.has(normalized)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = resolveUserId(normalized)
    const guessedMetrics = metrics?.[userId] || { activeWindow: 'Not active' }
    const row = {
      name: resolveDisplayName(userId) || guessInput.trim(),
      userId,
      metrics: guessedMetrics,
    }

    addGuess(row)
    setGuessInput('')

    if (userId && userId === solutionId) {
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

  if (!puzzle) {
    return <p className="game-status">No Classic puzzle available.</p>
  }

  return (
    <section className="game-panel">
      <h3>Classic</h3>
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
          <span>{clampValue(solutionMetrics?.topWord)}</span>
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
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Guess
        </button>
      </div>

      <p className="game-status">{message}</p>
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}

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
    </section>
  )
}

function QuoteleGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveUserId,
  resolveDisplayName,
}) {
  const [quoteInput, setQuoteInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'quotele'
  )

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = puzzle?.solution_user_name || resolveDisplayName(solutionId)

  const handleSubmit = async () => {
    if (isComplete) return
    const username = normalizeName(usernameInput)
    if (!username || !quoteInput.trim()) return

    if (!allowedUsernames.has(username)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = resolveUserId(username)
    const quoteNormalized = normalizeQuote(quoteInput)
    const quoteHash = await sha256Hex(quoteNormalized)

    const userCorrect = userId && userId === solutionId
    const quoteCorrect = quoteHash === puzzle?.quote_hash

    addGuess({
      label: `${usernameInput.trim()} ? ${quoteCorrect ? 'quote ?' : 'quote ?'} / ${userCorrect ? 'user ?' : 'user ?'}`,
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

  if (!puzzle) {
    return <p className="game-status">No Quotele puzzle available.</p>
  }

  return (
    <section className="game-panel">
      <h3>Quotele</h3>
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
          placeholder="Who sent it?"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
    </section>
  )
}

function StatleGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveUserId,
  resolveDisplayName,
}) {
  const [usernameInput, setUsernameInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'statle'
  )

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = resolveDisplayName(solutionId)

  const handleSubmit = () => {
    if (isComplete) return
    const username = normalizeName(usernameInput)
    if (!username) return

    if (!allowedUsernames.has(username)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const userId = resolveUserId(username)
    addGuess({ label: usernameInput.trim(), userId })
    setUsernameInput('')

    if (userId && userId === solutionId) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} matches the stat.`)
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
    return <p className="game-status">No Statle puzzle available.</p>
  }

  return (
    <section className="game-panel">
      <h3>Statle</h3>
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
          placeholder="Guess the member"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {isComplete && <p className="game-status">Answer: {solutionName}</p>}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
    </section>
  )
}

function MedialeGame({
  puzzle,
  allowedUsernames,
  guildId,
  date,
  resolveUserId,
  resolveDisplayName,
}) {
  const [guessInput, setGuessInput] = useState('')
  const [message, setMessage] = useState('')
  const { state, addGuess, setStatus, attempts, isComplete } = useStoredGameState(
    guildId,
    date,
    'mediale'
  )

  const guesses = state.guesses
  const solutionId = puzzle?.solution_user_id
  const solutionName = resolveDisplayName(solutionId)
  const mediaUrl = puzzle?.media?.url
  const keywordSource = puzzle?.media?.source_url || mediaUrl
  const keywords = extractKeywordsFromUrl(keywordSource)

  const pixelSteps = [36, 28, 20, 14, 10, 6]
  const pixelSize = pixelSteps[Math.min(attempts, pixelSteps.length - 1)]
  const reveal = isComplete

  const handleSubmit = () => {
    if (isComplete) return
    const parsed = parseMedialeGuess(guessInput, allowedUsernames)
    const username = parsed.username
    const keyword = parsed.keyword

    if (!username || !allowedUsernames.has(username)) {
      setMessage('Not a valid member name for today.')
      return
    }

    const keywordOk =
      keywords.length === 0 || keywords.some((token) => keyword.includes(token))

    if (!keywordOk) {
      setMessage('Your guess must include at least one keyword from the media link.')
      return
    }

    const userId = resolveUserId(username)
    const correctUser = userId && userId === solutionId

    addGuess({ label: `${username} ? ${keyword}`, correctUser, keywordOk })
    setGuessInput('')

    if (correctUser) {
      setStatus('won')
      setMessage(`Correct! ${solutionName} posted the media.`)
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
    return <p className="game-status">No Mediale puzzle available.</p>
  }

  return (
    <section className="game-panel">
      <h3>Mediale</h3>
      <MedialeCanvas url={mediaUrl} pixelSize={pixelSize} reveal={reveal} />

      <div className="guess-input">
        <input
          value={guessInput}
          onChange={(event) => setGuessInput(event.target.value)}
          placeholder="username | keyword"
          disabled={isComplete}
        />
        <button type="button" onClick={handleSubmit} disabled={isComplete}>
          Submit
        </button>
      </div>

      <p className="game-status">{message}</p>
      {isComplete && (
        <div className="game-status">
          <p>Answer: {solutionName}</p>
          <p>Accepted keywords: {keywords.length ? keywords.join(', ') : 'None'}</p>
        </div>
      )}

      <GuessHistory guesses={guesses.map((guess) => ({ label: guess.label }))} />
    </section>
  )
}
