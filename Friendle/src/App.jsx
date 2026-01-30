import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchLatestPuzzles } from './api/friendleApi'
import ClassicGame from './components/ClassicGame'
import QuoteleGame from './components/QuoteleGame'
import MedialeCanvas from './components/MedialeCanvas'
import StatleGame from './components/StatleGame'
import friendleIcon from './assets/friendle.png'
import './App.css'

function HomeView({ games, puzzleBundle, puzzleLoading, puzzleError }) {
  return (
    <>
      <section className="game-list" style={{ marginTop: 20 }}>
        <article className="game-card">
          <div className="game-copy">
            <h3>Daily Puzzles (Live)</h3>

            {puzzleLoading && <p>Loading puzzles...</p>}
            {puzzleError && <p className="puzzle-error">{puzzleError}</p>}

            {!puzzleLoading && !puzzleError && puzzleBundle && (
              <>
                <p>
                  <strong>Date:</strong> {puzzleBundle.date}
                </p>

                <details style={{ marginTop: 10 }}>
                  <summary>Friendle payload</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(puzzleBundle.puzzles.friendle_daily, null, 2)}
                  </pre>
                </details>

                <details style={{ marginTop: 10 }}>
                  <summary>Quotele payload</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(puzzleBundle.puzzles.quotele, null, 2)}
                  </pre>
                </details>

                <details style={{ marginTop: 10 }}>
                  <summary>Statle payload</summary>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(puzzleBundle.puzzles.statle, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        </article>
      </section>

      <main className="game-list">
        {games.map((game) => (
          <Link className="game-card game-card-link" to={game.path} key={game.key}>
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
    </>
  )
}

function GameShell({
  title,
  description,
  puzzleLoading,
  puzzleError,
  nextPath,
  gameKey,
  autoAdvance,
  children,
}) {
  const navigate = useNavigate()
  const advance = () => {
    if (nextPath) {
      navigate(nextPath)
    }
  }

  useEffect(() => {
    if (!autoAdvance || !gameKey || !nextPath) {
      return undefined
    }

    const handler = (event) => {
      if (event?.detail?.game !== gameKey) return
      navigate(nextPath)
    }

    window.addEventListener('friendle:game-complete', handler)
    return () => window.removeEventListener('friendle:game-complete', handler)
  }, [autoAdvance, gameKey, nextPath, navigate])

  return (
    <section className="game-route">
      <header className="game-route-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      {puzzleLoading && <p>Loading puzzles...</p>}
      {puzzleError && <p className="puzzle-error">{puzzleError}</p>}

      {children}

      <div className="game-route-actions">
        {nextPath && (
          <button
            className="modal-action"
            type="button"
            onClick={advance}
          >
            Finish &amp; Continue
          </button>
        )}
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          Back to menu
        </button>
      </div>
    </section>
  )
}

function NotFound() {
  const navigate = useNavigate()

  return (
    <section className="game-route">
      <header className="game-route-header">
        <h2>Page not found</h2>
        <p>Pick a game to get started.</p>
      </header>
      <button className="modal-action" type="button" onClick={() => navigate('/')}>
        Back to menu
      </button>
    </section>
  )
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLangModalOpen, setIsLangModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const [puzzleBundle, setPuzzleBundle] = useState(null);
  const [puzzleError, setPuzzleError] = useState("");
  const [puzzleLoading, setPuzzleLoading] = useState(true);

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
              'Guess which server member matches the shown activity profile from yesterday.',
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
            "Five daily mini-games powered by anonymized Discord activity from yesterday only. Everyone sees the same puzzle, with fresh clues after each incorrect guess.",
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
              'Guess which server member matches the shown activity profile from yesterday.',
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
            "Five daily mini-games powered by anonymized Discord activity from yesterday only. Everyone sees the same puzzle, with fresh clues after each incorrect guess.",
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
    {
      code: 'es',
      label: 'Spanish',
      flag: 'es',
      flagName: 'Spain',
      htmlLang: 'es',
      strings: {
        subtitle: { before: 'Adivina a tus ', highlight: 'Amigos', after: '' },
        games: {
          classic: {
            title: 'Clasico',
            description:
              'Adivina que miembro del servidor coincide con el perfil de actividad de ayer.',
          },
          quotele: {
            title: 'Quotele',
            description:
              'Identifica quien envio la cita mezclada, con nombres y emojis eliminados.',
          },
          mediale: {
            title: 'Mediale',
            description:
              'Descubre quien publico la imagen o el GIF mientras se revela.',
          },
          statle: {
            title: 'Statle',
            description:
              'Relaciona un perfil de estadisticas diarias con el miembro correcto.',
          },
        },
        how: {
          title: 'Como funciona Friendle',
          body:
            'Cinco minijuegos diarios basados en la actividad de Discord de ayer. Todos ven el mismo rompecabezas con nuevas pistas tras cada error.',
          bullets: [
            'Maximo 6 intentos por juego.',
            'Se reinicia a una hora fija del servidor.',
            'No se usan roles ni datos sensibles.',
            'El cache evita reescanear mensajes.',
          ],
          action: 'Entendido',
        },
        language: {
          title: 'Idioma',
          prompt: 'Elige el idioma en el que deseas jugar.',
          label: 'Idioma',
          action: 'Guardar',
        },
        about: {
          title: 'Sobre el creador',
          body:
            'Soy el creador de Friendle. Hice este juego para celebrar momentos diarios de comunidad en Discord y proteger la privacidad. Friendle convierte la actividad de ayer en puzzles rapidos para competir cada dia.',
          action: 'Cerrar',
        },
        social: {
          x: 'Seguir en X',
          about: 'Sobre Friendle',
          coffee: 'Comprame un cafe',
        },
        footer: {
          privacy: 'Politica de privacidad',
        },
        aria: {
          settings: 'Como funciona Friendle',
          language: 'Elegir idioma',
        },
      },
    },
    {
      code: 'fr',
      label: 'French',
      flag: 'fr',
      flagName: 'France',
      htmlLang: 'fr',
      strings: {
        subtitle: { before: 'Devine tes ', highlight: 'Amis', after: '' },
        games: {
          classic: {
            title: 'Classique',
            description:
              "Devine quel membre du serveur correspond au profil d'activite d'hier.",
          },
          quotele: {
            title: 'Quotele',
            description:
              'Identifie qui a envoye la citation melangee, avec noms et emojis supprimes.',
          },
          mediale: {
            title: 'Mediale',
            description:
              "Decouvre qui a poste l'image ou le GIF a mesure qu'il se revele.",
          },
          statle: {
            title: 'Statle',
            description:
              'Associe un profil de statistiques quotidiennes au bon membre.',
          },
        },
        how: {
          title: 'Comment Friendle fonctionne',
          body:
            "Cinq mini-jeux quotidiens bases sur l'activite Discord d'hier. Tout le monde voit le meme puzzle, avec de nouveaux indices apres chaque erreur.",
          bullets: [
            '6 essais max par jeu.',
            'Reinitialise a une heure fixe du serveur.',
            'Aucun role ni donnee sensible.',
            'Le cache evite de rescanner les messages.',
          ],
          action: 'Compris',
        },
        language: {
          title: 'Langue',
          prompt: 'Choisis la langue dans laquelle tu veux jouer.',
          label: 'Langue',
          action: 'Enregistrer',
        },
        about: {
          title: 'A propos du createur',
          body:
            "Je suis le createur de Friendle. J'ai cree ce jeu pour celebrer les moments quotidiens de la communaute Discord tout en protegeant la vie privee. Friendle transforme l'activite d'hier en puzzles rapides pour jouer chaque jour.",
          action: 'Fermer',
        },
        social: {
          x: 'Suivre sur X',
          about: 'A propos de Friendle',
          coffee: 'Achete-moi un cafe',
        },
        footer: {
          privacy: 'Politique de confidentialite',
        },
        aria: {
          settings: 'Comment Friendle fonctionne',
          language: 'Choisir la langue',
        },
      },
    },
    {
      code: 'de',
      label: 'German',
      flag: 'de',
      flagName: 'Germany',
      htmlLang: 'de',
      strings: {
        subtitle: { before: 'Rate deine ', highlight: 'Freunde', after: '' },
        games: {
          classic: {
            title: 'Klassik',
            description:
              'Rate welches Servermitglied zum Aktivitaetsprofil von gestern passt.',
          },
          quotele: {
            title: 'Quotele',
            description:
              'Finde heraus, wer das gemischte Zitat gesendet hat, ohne Namen und Emojis.',
          },
          mediale: {
            title: 'Mediale',
            description:
              'Finde heraus, wer das Bild oder GIF gepostet hat, waehrend es klarer wird.',
          },
          statle: {
            title: 'Statle',
            description:
              'Ordne ein einzigartiges Tagesstatistik-Profil dem richtigen Mitglied zu.',
          },
        },
        how: {
          title: 'So funktioniert Friendle',
          body:
            'Fuenf taegliche Minispiele basierend auf der Discord-Aktivitaet von gestern. Alle sehen dasselbe Puzzle, mit neuen Hinweisen nach jedem Fehler.',
          bullets: [
            'Maximal 6 Versuche pro Spiel.',
            'Reset zu einer festen Serverzeit.',
            'Keine Rollen oder sensiblen Daten.',
            'Cache vermeidet erneutes Scannen.',
          ],
          action: 'Verstanden',
        },
        language: {
          title: 'Sprache',
          prompt: 'Waehle die Sprache, in der du spielen moechtest.',
          label: 'Sprache',
          action: 'Speichern',
        },
        about: {
          title: 'Ueber den Ersteller',
          body:
            'Ich bin der Schoepfer von Friendle. Ich habe dieses Spiel gebaut, um taegliche Community-Momente in Discord zu feiern und die Privatsphaere zu schuetzen. Friendle verwandelt die Aktivitaet von gestern in kurze Raetsel fuer jeden Tag.',
          action: 'Schliessen',
        },
        social: {
          x: 'Folge auf X',
          about: 'Ueber Friendle',
          coffee: 'Kauf mir einen Kaffee',
        },
        footer: {
          privacy: 'Datenschutzerklaerung',
        },
        aria: {
          settings: 'So funktioniert Friendle',
          language: 'Sprache waehlen',
        },
      },
    },
  ]

  const currentLanguage =
    languageOptions.find((option) => option.code === language) || languageOptions[0]
  const copy = currentLanguage.strings

  useEffect(() => {
    document.title = 'Friendle'

  }, [])
  useEffect(() => {
  let cancelled = false;

  async function load() {
    setPuzzleLoading(true);
    setPuzzleError("");
    try {
      const data = await fetchLatestPuzzles();
      if (!cancelled) setPuzzleBundle(data);
    } catch (e) {
      if (!cancelled) setPuzzleError(e.message || "Failed to load puzzles");
    } finally {
      if (!cancelled) setPuzzleLoading(false);
    }
  }

  load();
  return () => { cancelled = true; };
}, []);

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
      path: '/classic',
      nextPath: '/quotele',
    },
    {
      key: 'quotele',
      title: copy.games.quotele.title,
      icon: 'chat',
      description: copy.games.quotele.description,
      path: '/quotele',
      nextPath: '/mediale',
    },
    {
      key: 'mediale',
      title: copy.games.mediale.title,
      icon: 'image',
      description: copy.games.mediale.description,
      path: '/mediale',
      nextPath: '/statle',
    },
    {
      key: 'statle',
      title: copy.games.statle.title,
      icon: 'finance',
      description: copy.games.statle.description,
      path: '/statle',
      nextPath: '/',
    },
  ]

  const classicGame = games.find((game) => game.key === 'classic')
  const quoteleGame = games.find((game) => game.key === 'quotele')
  const medialeGame = games.find((game) => game.key === 'mediale')
  const statleGame = games.find((game) => game.key === 'statle')
  const autoAdvance = true

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

      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              games={games}
              puzzleBundle={puzzleBundle}
              puzzleLoading={puzzleLoading}
              puzzleError={puzzleError}
            />
          }
        />
        <Route
          path="/classic"
          element={
            <GameShell
              title={classicGame?.title}
              description={classicGame?.description}
              puzzleLoading={puzzleLoading}
              puzzleError={puzzleError}
              nextPath={classicGame?.nextPath}
              gameKey="classic"
              autoAdvance={autoAdvance}
            >
              {!puzzleLoading && !puzzleError && (
                <>
                  <ClassicGame puzzle={puzzleBundle?.puzzles?.friendle_daily} />
                </>
              )}
            </GameShell>
          }
        />
        <Route
          path="/quotele"
          element={
            <GameShell
              title={quoteleGame?.title}
              description={quoteleGame?.description}
              puzzleLoading={puzzleLoading}
              puzzleError={puzzleError}
              nextPath={quoteleGame?.nextPath}
              gameKey="quotele"
              autoAdvance={autoAdvance}
            >
              {!puzzleLoading && !puzzleError && (
                <>
                  <QuoteleGame puzzle={puzzleBundle?.puzzles?.quotele} />
                </>
              )}
            </GameShell>
          }
        />
        <Route
          path="/mediale"
          element={
            <GameShell
              title={medialeGame?.title}
              description={medialeGame?.description}
              puzzleLoading={puzzleLoading}
              puzzleError={puzzleError}
              nextPath={medialeGame?.nextPath}
              gameKey="mediale"
              autoAdvance={autoAdvance}
            >
              {!puzzleLoading && !puzzleError && (
                <>
                  <MedialeCanvas puzzle={puzzleBundle?.puzzles?.mediale} gameKey="mediale" />
                  {puzzleBundle?.puzzles?.mediale && (
                    <details className="puzzle-details">
                      <summary>Mediale payload</summary>
                      <pre>{JSON.stringify(puzzleBundle.puzzles.mediale, null, 2)}</pre>
                    </details>
                  )}
                </>
              )}
            </GameShell>
          }
        />
        <Route
          path="/statle"
          element={
            <GameShell
              title={statleGame?.title}
              description={statleGame?.description}
              puzzleLoading={puzzleLoading}
              puzzleError={puzzleError}
              nextPath={statleGame?.nextPath}
              gameKey="statle"
              autoAdvance={autoAdvance}
            >
              {!puzzleLoading && !puzzleError && (
                <>
                  <StatleGame puzzle={puzzleBundle?.puzzles?.statle} />
                </>
              )}
            </GameShell>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

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
