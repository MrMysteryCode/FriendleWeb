import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import friendleIcon from './assets/friendle.png'
import './App.css'

function useGuildQuery() {
  const location = useLocation()
  return useMemo(() => {
    const params = new URLSearchParams(location.search)
    const guild = params.get('guild')
    if (guild) return guild
    const fallbackParams = new URLSearchParams(window.location.search)
    return fallbackParams.get('guild') || ''
  }, [location.search])
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLangModalOpen, setIsLangModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const location = useLocation()
  const navigate = useNavigate()

  const languageOptions = [
    {
      code: 'en-US',
      label: 'English (US)',
      flag: 'us',
      flagName: 'United States',
      htmlLang: 'en',
      strings: {
        subtitle: { before: 'Guess your ', highlight: 'Friends', after: '' },
        games: {
          classic: {
            title: 'Classic',
            description:
              'Guess which server member matches the shown activity profile from yesterday (or the most recent day with activity).',
          },
          quotele: {
            title: 'Quotele',
            description:
              'Identify who sent the scrambled quote, with usernames and emojis removed.',
          },
          mediale: {
            title: 'Mediale',
            description:
              'Reveal who posted the image or GIF as the media becomes clearer.',
          },
          statle: {
            title: 'Statle',
            description:
              'Match a standout daily stat profile to the right server member.',
          },
        },
        how: {
          title: 'How Friendle Works',
          body:
            "Five daily mini-games powered by anonymized Discord activity from yesterday when available, or the most recent day with activity. Everyone sees the same puzzle, with fresh clues after each incorrect guess.",
          bullets: [
            '6 guesses max per game.',
            'Resets at a fixed server time.',
            'No roles or sensitive data used.',
            'Cache prevents re-scanning messages.',
          ],
          action: 'Got it',
        },
        language: {
          title: 'Language',
          prompt: 'Pick the language you wish to play in.',
          label: 'Language',
          action: 'Save',
        },
        about: {
          title: 'About the Creator',
          body:
            "I'm the creator of Friendle. I built this game to have fun daily Discord moments based on the day. Friendle turns yesterday's activity into quick, fun puzzles so friends can compete and reconnect every day.",
          action: 'Close',
        },
        social: {
          x: 'Follow on X',
          about: 'About Friendle',
          coffee: 'Buy me a coffee',
        },
        footer: {
          privacy: 'Privacy Policy',
        },
        aria: {
          settings: 'How Friendle works',
          language: 'Choose language',
        },
      },
    },
    {
      code: 'en-GB',
      label: 'English (UK)',
      flag: 'gb',
      flagName: 'United Kingdom',
      htmlLang: 'en',
      strings: {
        subtitle: { before: 'Guess your ', highlight: 'Friends', after: '' },
        games: {
          classic: {
            title: 'Classic',
            description:
              'Guess which server member matches the shown activity profile from yesterday (or the most recent day with activity).',
          },
          quotele: {
            title: 'Quotele',
            description:
              'Guess the original quote and who sent it, based on a scrambled version.',
          },
          mediale: {
            title: 'Mediale',
            description:
              'Reveal who posted the image or GIF as the media becomes clearer.',
          },
          statle: {
            title: 'Statle',
            description:
              'Match a standout daily stat profile to the right server member.',
          },
        },
        how: {
          title: 'How Friendle Works',
          body:
            "Five daily mini-games powered by anonymized Discord activity from yesterday when available, or the most recent day with activity. Everyone sees the same puzzle, with fresh clues after each incorrect guess.",
          bullets: [
            '6 guesses max per game.',
            'Resets at a fixed server time.',
            'No roles or sensitive data used.',
            'Cache prevents re-scanning messages.',
          ],
          action: 'Got it',
        },
        language: {
          title: 'Language',
          prompt: 'Pick the language you wish to play in.',
          label: 'Language',
          action: 'Save',
        },
        about: {
          title: 'About the Creator',
          body:
            "I'm the creator of Friendle. I built this game to celebrate daily Discord community moments while keeping member activity private. Friendle turns yesterday's activity into quick, fun puzzles so friends can compete and reconnect every day.",
          action: 'Close',
        },
        social: {
          x: 'Follow on X',
          about: 'About Friendle',
          coffee: 'Buy me a coffee',
        },
        footer: {
          privacy: 'Privacy Policy',
        },
        aria: {
          settings: 'How Friendle works',
          language: 'Choose language',
        },
      },
    },
  ]

  const currentLanguage =
    languageOptions.find((option) => option.code === language) || languageOptions[0]
  const copy = currentLanguage.strings
  const guildId = useGuildQuery()
  const playLink = (gameKey) => {
    const base = `/play?game=${encodeURIComponent(gameKey)}`
    if (!guildId) return base
    return `${base}&guild=${encodeURIComponent(guildId)}`
  }

  useEffect(() => {
    document.title = 'Friendle'
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const guild = searchParams.get('guild')
    if (!guild) return
    const hashParams = new URLSearchParams(location.search)
    if (hashParams.get('guild')) return
    const game = searchParams.get('game')
    const target = `/play?guild=${encodeURIComponent(guild)}${
      game ? `&game=${encodeURIComponent(game)}` : ''
    }`
    navigate(target, { replace: true })
  }, [location.search, navigate])

  useEffect(() => {
    const link = document.querySelector("link[rel='icon']")
    if (link) {
      link.setAttribute('href', friendleIcon)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = currentLanguage.htmlLang
  }, [currentLanguage.htmlLang])

  useEffect(() => {
    if (!isModalOpen && !isLangModalOpen && !isAboutModalOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false)
        setIsLangModalOpen(false)
        setIsAboutModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, isLangModalOpen, isAboutModalOpen])

  const games = [
    {
      key: 'classic',
      title: copy.games.classic.title,
      icon: 'person',
      description: copy.games.classic.description,
    },
    {
      key: 'quotele',
      title: copy.games.quotele.title,
      icon: 'chat',
      description: copy.games.quotele.description,
    },
    {
      key: 'mediale',
      title: copy.games.mediale.title,
      icon: 'image',
      description: copy.games.mediale.description,
    },
    {
      key: 'statle',
      title: copy.games.statle.title,
      icon: 'finance',
      description: copy.games.statle.description,
    },
  ]

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">
          <div className="title-row">
            <button
              className="settings-link"
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label={copy.aria.settings}
            >
              <span className="settings-icon material-symbols-outlined" aria-hidden="true">
                settings
              </span>
            </button>
            <h1>Friendle</h1>
            <button
              className="flag-link"
              type="button"
              onClick={() => setIsLangModalOpen(true)}
              aria-label={copy.aria.language}
            >
              <img
                className="flag-icon"
                src={`https://flagcdn.vercel.app/flags/${currentLanguage.flag}.svg`}
                alt={`${currentLanguage.flagName} flag`}
              />
            </button>
          </div>
          <p className="hero-subtitle">
            {copy.subtitle.before}
            <span className="subtitle-highlight">{copy.subtitle.highlight}</span>
            {copy.subtitle.after}
          </p>
        </div>
      </header>

      <main className="game-list">
        {games.map((game) => (
          <Link className="game-card game-card-link" to={playLink(game.key)} key={game.key}>
            <div className="icon">
              <span
                className="game-icon-symbol material-symbols-outlined"
                aria-hidden="true"
              >
                {game.icon}
              </span>
            </div>
            <div className="game-copy">
              <div className="game-title">
                <h3>{game.title}</h3>
              </div>
              <p>{game.description}</p>
            </div>
          </Link>
        ))}
      </main>

      <section className="social-row" aria-label="Social links">
        <a
          className="social-circle"
          href="https://x.com/"
          target="_blank"
          rel="noreferrer"
          aria-label={copy.social.x}
        >
          <img
            className="social-icon"
            src="https://cdn.simpleicons.org/x/ffffff"
            alt=""
            aria-hidden="true"
          />
        </a>
        <button
          className="social-circle"
          type="button"
          onClick={() => setIsAboutModalOpen(true)}
          aria-label={copy.social.about}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
        </button>
        <a
          className="social-circle"
          href="https://www.buymeacoffee.com/"
          target="_blank"
          rel="noreferrer"
          aria-label={copy.social.coffee}
        >
          <img
            className="social-icon"
            src="https://cdn.simpleicons.org/buymeacoffee/ffffff"
            alt=""
            aria-hidden="true"
          />
        </a>
      </section>

      <footer className="footer">
        <div className="footer-title">Friendle 2026</div>
        <a className="footer-link" href={`${import.meta.env.BASE_URL}privacy.html`}>
          {copy.footer.privacy}
        </a>
      </footer>

      {isModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="modal-title">{copy.how.title}</h2>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <p>{copy.how.body}</p>
            <ul>
              {copy.how.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              className="modal-action"
              type="button"
              onClick={() => setIsModalOpen(false)}
            >
              {copy.how.action}
            </button>
          </div>
        </div>
      )}

      {isLangModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsLangModalOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="language-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="language-modal-title">{copy.language.title}</h2>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsLangModalOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <p>{copy.language.prompt}</p>
            <label className="select-label" htmlFor="language-select">
              {copy.language.label}
            </label>
            <select
              id="language-select"
              className="select"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="modal-action"
              type="button"
              onClick={() => setIsLangModalOpen(false)}
            >
              {copy.language.action}
            </button>
          </div>
        </div>
      )}

      {isAboutModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsAboutModalOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="about-modal-title">{copy.about.title}</h2>
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <p>{copy.about.body}</p>
            <button
              className="modal-action"
              type="button"
              onClick={() => setIsAboutModalOpen(false)}
            >
              {copy.about.action}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
