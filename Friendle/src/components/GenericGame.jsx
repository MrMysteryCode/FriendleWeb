import { useMemo, useState } from "react";

const MAX_GUESSES = 6;

/**
 * Normalize input for case-insensitive comparisons.
 */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Collect possible answer strings from a puzzle payload.
 */
function extractAnswers(puzzle) {
  const answers = new Set();
  const pushValue = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    if (typeof value === "string") {
      const normalized = normalize(value);
      if (normalized) answers.add(normalized);
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
  pushValue(puzzle?.targets);

  return Array.from(answers);
}

/**
 * Render puzzle clues for generic game modes.
 */
function GameClues({ puzzle }) {
  const textClue =
    puzzle?.prompt ||
    puzzle?.question ||
    puzzle?.clue ||
    puzzle?.clues_text ||
    puzzle?.description;
  const listClues = puzzle?.clues || puzzle?.hints || puzzle?.lines;

  if (!textClue && !Array.isArray(listClues)) {
    return null;
  }

  return (
    <div className="game-clues">
      {textClue && <p className="game-status">{textClue}</p>}
      {Array.isArray(listClues) && listClues.length > 0 && (
        <ul className="game-guess-list">
          {listClues.map((item, index) => (
            <li key={`${index}-${String(item)}`}>{String(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Generic text-guess game with answer reveal after max guesses.
 */
export default function GenericGame({ puzzle, gameKey, title, prompt }) {
  const [guess, setGuess] = useState("");
  const [guessCount, setGuessCount] = useState(0);
  const [status, setStatus] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [guesses, setGuesses] = useState([]);

  const answers = useMemo(() => extractAnswers(puzzle), [puzzle]);
  const hasAnswers = answers.length > 0;

  const completeGame = (message) => {
    setStatus(message);
    setIsComplete(true);
    if (gameKey) {
      window.dispatchEvent(
        new CustomEvent("friendle:game-complete", { detail: { game: gameKey } })
      );
    }
  };

  const handleGuess = () => {
    if (isComplete) return;
    const value = normalize(guess);
    if (!value) return;

    const nextCount = guessCount + 1;
    setGuessCount(nextCount);
    setGuesses((prev) => [...prev, guess.trim()]);
    setGuess("");

    if (hasAnswers) {
      const isCorrect = answers.some(
        (answer) => value.includes(answer) || answer.includes(value)
      );
      if (isCorrect) {
        completeGame("Correct! Moving to the next game.");
        return;
      }

      if (nextCount >= MAX_GUESSES) {
        completeGame(
          `Out of guesses. Answer: ${answers[0] || "Unknown"}. Moving to the next game.`
        );
        return;
      }

      setStatus(`Not quite. (${nextCount}/${MAX_GUESSES})`);
      return;
    }

    if (nextCount >= MAX_GUESSES) {
      setStatus(`Guesses recorded (${MAX_GUESSES}/${MAX_GUESSES}). Mark solved to continue.`);
      return;
    }

    setStatus(`Guess recorded (${nextCount}/${MAX_GUESSES}).`);
  };

  if (!puzzle) {
    return <p className="puzzle-empty">No puzzle available today.</p>;
  }

  return (
    <div className="game-panel">
      {prompt && <p className="game-status">{prompt}</p>}
      <GameClues puzzle={puzzle} />

      <div className="game-input-row">
        <input
          className="game-input"
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          placeholder="Type your guess"
          disabled={isComplete}
        />
        <button className="game-submit" type="button" onClick={handleGuess}>
          Guess
        </button>
      </div>

      {(status || hasAnswers) && (
        <p className="game-status">
          {status || `You have ${MAX_GUESSES - guessCount} guesses left.`}
        </p>
      )}

      {!isComplete && !hasAnswers && (
        <button
          className="ghost-button"
          type="button"
          onClick={() => completeGame("Marked solved. Moving to the next game.")}
        >
          Mark solved &amp; continue
        </button>
      )}

      {guesses.length > 0 && (
        <div>
          <div className="game-tags">
            {guesses.map((item, index) => (
              <span className="game-tag" key={`${index}-${item}`}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {isComplete && hasAnswers && (
        <p className="game-status">Answer: {answers[0]}</p>
      )}

      <details className="puzzle-details">
        <summary>{title} payload</summary>
        <pre>{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
    </div>
  );
}
