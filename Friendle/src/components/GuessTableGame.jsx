import { useMemo, useState } from "react";

const MAX_GUESSES = 6;
const MIN_PARTIAL_MATCH = 3;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
]);

/**
 * Normalize names for loose string comparisons.
 */
function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function pickFirst(source, keys) {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
}

function toProfiles(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === "object") {
    return Object.entries(source).map(([name, value]) => {
      if (value && typeof value === "object") {
        return { username: name, ...value };
      }
      return { username: name, value };
    });
  }
  return [];
}

/**
 * Collect user profiles from various API payload shapes.
 */
function collectProfiles(puzzle) {
  const sources = [
    puzzle?.profiles,
    puzzle?.users,
    puzzle?.members,
    puzzle?.players,
    puzzle?.entries,
    puzzle?.stats,
    puzzle?.user_profiles,
    puzzle?.userProfiles,
    puzzle?.data?.profiles,
    puzzle?.data?.users,
    puzzle?.data?.members,
    puzzle?.payload?.profiles,
    puzzle?.payload?.users,
  ];

  const profiles = [];
  sources.forEach((source) => {
    const items = toProfiles(source);
    items.forEach((item) => profiles.push(item));
  });

  return profiles;
}

/**
 * Extract the primary answer name from a puzzle payload.
 */
function extractAnswerName(puzzle) {
  const direct = pickFirst(puzzle || {}, [
    "answer",
    "answers",
    "solution",
    "solutions",
    "correct",
    "correctAnswer",
    "correct_answer",
    "target",
    "targetUser",
    "target_user",
    "user",
    "username",
    "member",
    "author",
    "poster",
    "winner",
  ]);

  if (Array.isArray(direct)) return direct[0];
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    return pickFirst(direct, ["username", "user", "name", "member"]);
  }

  const nested = pickFirst(puzzle || {}, ["result", "answer_profile", "target_profile"]);
  if (nested && typeof nested === "object") {
    return pickFirst(nested, ["username", "user", "name", "member"]);
  }

  return undefined;
}

/**
 * Build a lookup map for userId/name matching.
 */
function buildUserIndex(puzzle, profiles) {
  const index = new Map();
  const addEntry = (id, name) => {
    if (!id || !name) return;
    index.set(normalizeName(name), String(id));
  };

  if (Array.isArray(profiles)) {
    profiles.forEach((profile) => {
      addEntry(profile?.user_id || profile?.id, profile?.username || profile?.user || profile?.name);
      addEntry(profile?.id, profile?.displayName || profile?.display_name);
    });
  }

  const userContainers = [
    puzzle?.users,
    puzzle?.members,
    puzzle?.players,
    puzzle?.usernames,
    puzzle?.usernames_by_id,
    puzzle?.user_map,
    puzzle?.userMap,
  ];

  userContainers.forEach((container) => {
    if (!container) return;
    if (Array.isArray(container)) {
      container.forEach((entry) => {
        if (typeof entry === "string") return;
        addEntry(entry?.id || entry?.user_id, entry?.username || entry?.name);
      });
      return;
    }
    if (typeof container === "object") {
      Object.entries(container).forEach(([id, value]) => {
        if (typeof value === "string") {
          addEntry(id, value);
        } else if (value && typeof value === "object") {
          addEntry(id, value.username || value.name);
        }
      });
    }
  });

  return index;
}

/**
 * Find a profile matching the guessed name.
 */
function findProfileByName(profiles, name) {
  if (!name) return undefined;
  const needle = normalizeName(name);
  if (!needle) return undefined;

  return profiles.find((profile) => {
    const candidates = [
      profile?.username,
      profile?.user,
      profile?.name,
      profile?.displayName,
      profile?.display_name,
      profile?.tag,
      profile?.nickname,
    ];

    return candidates.some((candidate) => normalizeName(candidate) === needle);
  });
}

function extractString(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    return String(value.label || value.value || value.name || value.text || "");
  }
  return String(value);
}

function parseRange(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return { min: value, max: value };

  const text = String(value);
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/);
  if (!match) return null;

  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : min;
  if (Number.isNaN(min) || Number.isNaN(max)) return null;

  return { min, max };
}

function compareRanges(guess, target) {
  if (!guess || !target) return "unknown";
  if (guess.min === target.min && guess.max === target.max) return "correct";
  const overlap = guess.min <= target.max && target.min <= guess.max;
  return overlap ? "partial" : "incorrect";
}

const TIME_WINDOWS = [
  "night",
  "late night",
  "early morning",
  "morning",
  "afternoon",
  "evening",
];

function normalizeTimeWindow(value) {
  const text = normalizeToken(value);
  if (!text) return "";
  const match = TIME_WINDOWS.find((item) => text.includes(item));
  if (match) return match;
  if (text.includes("not active")) return "not active";
  return text;
}

function compareTimeWindow(guess, target) {
  if (!guess || !target) return "unknown";
  if (guess === target) return "correct";
  if (guess === "not active" || target === "not active") return "incorrect";

  const gIndex = TIME_WINDOWS.indexOf(guess);
  const tIndex = TIME_WINDOWS.indexOf(target);
  if (gIndex === -1 || tIndex === -1) {
    return "incorrect";
  }

  return Math.abs(gIndex - tIndex) === 1 ? "partial" : "incorrect";
}

function compareStrings(guess, target) {
  if (!guess || !target) return "unknown";
  const g = normalizeName(guess);
  const t = normalizeName(target);
  if (!g || !t) return "unknown";
  if (g === t) return "correct";
  if (g.includes(t) || t.includes(g)) return "partial";
  return "incorrect";
}

function compareFirstLetter(guess, target) {
  if (!guess || !target) return "unknown";
  const g = normalizeToken(guess)[0];
  const t = normalizeToken(target)[0];
  if (!g || !t) return "unknown";
  return g === t ? "correct" : "incorrect";
}

function formatValue(value, fallback = "?") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

/**
 * Generic comparison table for member-guessing games.
 */
export default function GuessTableGame({
  puzzle,
  gameKey,
  title,
  prompt,
  columns,
  leadItems,
  targetFallback,
  quote,
}) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [guessRows, setGuessRows] = useState([]);

  const profiles = useMemo(() => collectProfiles(puzzle), [puzzle]);
  const answerName = useMemo(() => extractAnswerName(puzzle), [puzzle]);
  const hasProfiles = profiles.length > 0;
  const targetProfile = useMemo(() => {
    const found =
      findProfileByName(profiles, answerName) ||
      puzzle?.target_profile ||
      puzzle?.answer_profile;
    return found || targetFallback || null;
  }, [profiles, answerName, puzzle, targetFallback]);

  const userIndex = useMemo(() => buildUserIndex(puzzle, profiles), [puzzle, profiles]);

  const remaining = MAX_GUESSES - guessRows.length;

  const completeGame = (message) => {
    setStatus(message);
    setIsComplete(true);
    if (gameKey) {
      window.dispatchEvent(
        new CustomEvent("friendle:game-complete", { detail: { game: gameKey } })
      );
    }
  };

  const buildRow = (name, profile) => {
    return columns.map((column) => {
      const guessValue = column.value(profile, puzzle);
      const targetValue = column.value(targetProfile, puzzle);
      let statusKey = "incorrect";

      if (column.type === "range") {
        statusKey = compareRanges(parseRange(guessValue), parseRange(targetValue));
      } else if (column.type === "time") {
        statusKey = compareTimeWindow(
          normalizeTimeWindow(guessValue),
          normalizeTimeWindow(targetValue)
        );
      } else if (column.type === "letter") {
        statusKey = compareFirstLetter(guessValue, targetValue);
      } else if (column.type === "string") {
        statusKey = compareStrings(guessValue, targetValue);
      }

      if (!targetProfile) statusKey = "unknown";
      if (!profile && !targetProfile) statusKey = "unknown";
      if (!profile && targetProfile) statusKey = "incorrect";
      if (!hasProfiles) statusKey = "unknown";

      return {
        key: column.key,
        label: column.label,
        value: formatValue(guessValue),
        status: statusKey,
      };
    });
  };

  const handleGuess = () => {
    if (isComplete) return;

    const trimmed = guess.trim();
    if (!trimmed) return;

    const profile = findProfileByName(profiles, trimmed);
    const row = buildRow(trimmed, profile);

    setGuessRows((prev) => [
      ...prev,
      {
        name: trimmed,
        cells: row,
      },
    ]);

    setGuess("");

    const normalizedGuess = normalizeName(trimmed);
    const solutionId = puzzle?.solution_user_id ? String(puzzle.solution_user_id) : "";
    const normalizedSolutionId = solutionId ? normalizeName(solutionId) : "";
    const normalizedAnswer = answerName ? normalizeName(answerName) : "";
    const guessId = userIndex.get(normalizedGuess);
    const hasAlphaGuess = /[a-z]/.test(normalizedGuess);
    const hasAlphaAnswer = /[a-z]/.test(normalizedAnswer);
    const nameExact = normalizedAnswer && normalizedGuess === normalizedAnswer;
    const namePartial =
      normalizedAnswer &&
      hasAlphaGuess &&
      hasAlphaAnswer &&
      normalizedGuess.length >= MIN_PARTIAL_MATCH &&
      (normalizedAnswer.includes(normalizedGuess) ||
        normalizedGuess.includes(normalizedAnswer));
    const idMatch =
      normalizedSolutionId &&
      (normalizedGuess === normalizedSolutionId || (solutionId && guessId === solutionId));

    const answerLabel = answerName || solutionId || trimmed;

    if (nameExact || namePartial || idMatch) {
      completeGame(`Correct! Answer: ${answerLabel}`);
      return;
    }

    if (guessRows.length + 1 >= MAX_GUESSES) {
      completeGame(`Out of guesses. Answer: ${answerName || solutionId || "Unknown"}`);
      return;
    }

    setStatus(`Not quite. ${guessRows.length + 1}/${MAX_GUESSES}`);
  };

  if (!puzzle) {
    return <p className="puzzle-empty">No puzzle available today.</p>;
  }

  const tableMinWidth = columns.length * 140 + 180;
  const rowTemplate = `150px repeat(${columns.length}, minmax(110px, 1fr))`;

  return (
    <div className="game-panel">
      {prompt && <p className="game-status">{prompt}</p>}
      {quote && (
        <div className="quote-block">
          <p className="quote-text">“{quote}”</p>
        </div>
      )}
      {leadItems && leadItems.length > 0 && (
        <div className="clue-grid">
          {leadItems.map((item) => (
            <div className="clue-card" key={`${item.label}-${item.value}`}>
              <span className="clue-label">{item.label}</span>
              <span className="clue-value">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="guess-input-row">
        <input
          className="game-input"
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          placeholder="Type a username or ID"
          disabled={isComplete}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleGuess();
            }
          }}
        />
        <button className="game-submit" type="button" onClick={handleGuess}>
          Guess
        </button>
      </div>

      <p className="game-status">
        {status || `Guesses left: ${Math.max(remaining, 0)}`}
      </p>

      <div className="guess-table" style={{ minWidth: tableMinWidth }}>
        <div className="guess-row guess-row-header" style={{ gridTemplateColumns: rowTemplate }}>
          <div className="guess-cell">Guess</div>
          {columns.map((column) => (
            <div className="guess-cell" key={column.key}>
              {column.label}
            </div>
          ))}
        </div>
        {guessRows.map((row, index) => (
          <div
            className="guess-row"
            key={`${row.name}-${index}`}
            style={{ gridTemplateColumns: rowTemplate }}
          >
            <div className="guess-cell guess-name">{row.name}</div>
            {row.cells.map((cell) => (
              <div
                className={`guess-cell guess-cell-${cell.status}`}
                key={`${row.name}-${cell.key}`}
              >
                {cell.value}
              </div>
            ))}
          </div>
        ))}
      </div>

      {isComplete && (answerName || puzzle?.solution_user_id) && (
        <p className="game-status">
          Answer: {answerName || puzzle?.solution_user_id}
        </p>
      )}

      {!isComplete && !answerName && (
        <p className="game-status">
          Answer data missing. Guessing will still count.
        </p>
      )}
      {!isComplete && !hasProfiles && (
        <p className="game-status">
          Profile comparisons are unavailable until the API provides per-user stats.
        </p>
      )}
    </div>
  );
}

export function createColumn({ key, label, type, keys, fallback }) {
  return {
    key,
    label,
    type,
    value: (profile) => {
      if (!profile) return fallback || "?";
      const value = pickFirst(profile, keys);
      if (type === "time") {
        return value || fallback || "Not active";
      }
      if (value === undefined || value === null || value === "") {
        return fallback || "?";
      }
      return value;
    },
  };
}

export function createDerivedColumn({ key, label, type, getter }) {
  return {
    key,
    label,
    type,
    value: getter,
  };
}

export function filterStopWords(values) {
  return values.filter((item) => !STOP_WORDS.has(item));
}
