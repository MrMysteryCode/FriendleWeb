import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import friendleIcon from './assets/friendle.png'
import './App.css'

/**
 * Read the guild query parameter from the URL.
 */
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

/**
 * Return a human-readable countdown to the next 1:00 AM America/New_York reset.
 */
function getNextResetCountdown() {
  const now = new Date()
  const nyNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  const resetNy = new Date(nyNow)
  resetNy.setHours(1, 0, 0, 0)
  if (nyNow >= resetNy) {
    resetNy.setDate(resetNy.getDate() + 1)
  }
  const offsetMs = nyNow.getTime() - now.getTime()
  const resetUtc = new Date(resetNy.getTime() - offsetMs)
  const diffMs = resetUtc.getTime() - now.getTime()
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')} ET`
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLangModalOpen, setIsLangModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const [resetCountdown, setResetCountdown] = useState('')
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
          metrics: {
            title: 'Classic clue meanings',
            items: [
              { label: 'Message count', text: 'How many messages the member sent in the source day.' },
              { label: 'Top word', text: 'Most-used non‑common word in their messages.' },
              { label: 'Active window', text: 'The time period they were most active (UTC buckets).' },
              { label: 'Mentions', text: 'How many users they mentioned.' },
              { label: 'First message', text: 'Time bucket for their first message that day.' },
              { label: 'Account age', text: 'How old their Discord account is.' },
            ],
          },
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
          metrics: {
            title: 'Classic clue meanings',
            items: [
              { label: 'Message count', text: 'How many messages the member sent in the source day.' },
              { label: 'Top word', text: 'Most-used non‑common word in their messages.' },
              { label: 'Active window', text: 'The time period they were most active (UTC buckets).' },
              { label: 'Mentions', text: 'How many users they mentioned.' },
              { label: 'First message', text: 'Time bucket for their first message that day.' },
              { label: 'Account age', text: 'How old their Discord account is.' },
            ],
          },
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
    const saved = localStorage.getItem('friendle:language')
    if (saved) {
      setLanguage(saved)
    }
  }, [])

  useEffect(() => {
    setResetCountdown(getNextResetCountdown())
    const interval = setInterval(() => {
      setResetCountdown(getNextResetCountdown())
    }, 1000)
    return () => clearInterval(interval)
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
    localStorage.setItem('friendle:language', language)
  }, [language])

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
    {
      code: 'es-ES',
      label: 'Español',
      flag: 'es',
      flagName: 'Spain',
      htmlLang: 'es',
      strings: {
        subtitle: { before: 'Adivina a tus ', highlight: 'Amigos', after: '' },
        games: {
          classic: {
            title: 'Clásico',
            description:
              'Adivina qué miembro coincide con el perfil de actividad mostrado.',
          },
          quotele: {
            title: 'Quotele',
            description:
              'Identifica quién envió la cita mezclada (usuarios y emojis ocultos).',
          },
          mediale: {
            title: 'Mediale',
            description:
              'Descubre quién publicó la imagen o GIF a medida que se aclara.',
          },
          statle: {
            title: 'Statle',
            description:
              'Relaciona un perfil de estadísticas destacado con el miembro correcto.',
          },
        },
        how: {
          title: 'Cómo funciona Friendle',
          body:
            'Cinco mini‑juegos diarios con actividad anonimizada. Todos ven el mismo puzzle.',
          metrics: {
            title: 'Significado de las pistas',
            items: [
              { label: 'Message count', text: 'Cantidad de mensajes enviados.' },
              { label: 'Top word', text: 'Palabra no común más usada.' },
              { label: 'Active window', text: 'Franja horaria más activa (UTC).' },
              { label: 'Mentions', text: 'Usuarios mencionados.' },
              { label: 'First message', text: 'Hora del primer mensaje.' },
              { label: 'Account age', text: 'Antigüedad de la cuenta.' },
            ],
          },
          bullets: [
            'Máximo 6 intentos por juego.',
            'Se reinicia a una hora fija.',
            'No se usan roles ni datos sensibles.',
            'El caché evita re‑escanear mensajes.',
          ],
          action: 'Entendido',
        },
        language: {
          title: 'Idioma',
          prompt: 'Elige el idioma en el que quieres jugar.',
          label: 'Idioma',
          action: 'Guardar',
        },
        about: {
          title: 'Sobre el creador',
          body:
            'Creé Friendle para compartir momentos diarios de Discord de forma divertida.',
          action: 'Cerrar',
        },
        social: {
          x: 'Seguir en X',
          about: 'Sobre Friendle',
          coffee: 'Invítame un café',
        },
        footer: {
          privacy: 'Política de privacidad',
        },
        aria: {
          settings: 'Cómo funciona Friendle',
          language: 'Elegir idioma',
        },
      },
    },
    {
      code: 'fr-FR',
      label: 'Français',
      flag: 'fr',
      flagName: 'France',
      htmlLang: 'fr',
      strings: {
        subtitle: { before: 'Devine tes ', highlight: 'Amis', after: '' },
        games: {
          classic: {
            title: 'Classique',
            description:
              "Devine quel membre correspond au profil d'activité affiché.",
          },
          quotele: {
            title: 'Quotele',
            description:
              'Identifie qui a envoyé la citation mélangée (utilisateurs/émojis masqués).',
          },
          mediale: {
            title: 'Mediale',
            description:
              "Découvre qui a posté l'image ou le GIF à mesure qu'il se révèle.",
          },
          statle: {
            title: 'Statle',
            description:
              'Associe un profil de stats marquant au bon membre.',
          },
        },
        how: {
          title: 'Comment fonctionne Friendle',
          body:
            "Cinq mini‑jeux quotidiens basés sur l'activité anonymisée. Tout le monde voit le même puzzle.",
          metrics: {
            title: 'Signification des indices',
            items: [
              { label: 'Message count', text: 'Nombre de messages envoyés.' },
              { label: 'Top word', text: 'Mot non commun le plus utilisé.' },
              { label: 'Active window', text: "Période la plus active (UTC)." },
              { label: 'Mentions', text: 'Utilisateurs mentionnés.' },
              { label: 'First message', text: 'Heure du premier message.' },
              { label: 'Account age', text: 'Âge du compte.' },
            ],
          },
          bullets: [
            '6 essais max par jeu.',
            'Réinitialisation à heure fixe.',
            'Aucun rôle ni donnée sensible.',
            'Le cache évite de rescanner les messages.',
          ],
          action: 'Compris',
        },
        language: {
          title: 'Langue',
          prompt: 'Choisis la langue de jeu.',
          label: 'Langue',
          action: 'Enregistrer',
        },
        about: {
          title: 'À propos du créateur',
          body:
            "J'ai créé Friendle pour partager des moments Discord quotidiens.",
          action: 'Fermer',
        },
        social: {
          x: 'Suivre sur X',
          about: 'À propos de Friendle',
          coffee: 'M’offrir un café',
        },
        footer: {
          privacy: 'Politique de confidentialité',
        },
        aria: {
          settings: 'Comment fonctionne Friendle',
          language: 'Choisir la langue',
        },
      },
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
            <div className="lang-row">
              {resetCountdown && (
                <span className="date-badge">Resets in {resetCountdown}</span>
              )}
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
            <div className="modal-subsection">
              <h3>{copy.how.metrics.title}</h3>
              <ul>
                {copy.how.metrics.items.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}:</strong> {item.text}
                  </li>
                ))}
              </ul>
            </div>
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
