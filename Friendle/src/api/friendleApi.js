const API_BASE = import.meta.env.VITE_API_URL || "YOUR_WORKER_URL";

export async function fetchLatestPuzzles(guildId) {
  if (!guildId) {
    throw new Error("Missing guild id");
  }

  const url = `${API_BASE}/puzzles?guild_id=${encodeURIComponent(guildId)}&latest=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(json?.error || `API error ${res.status}`);
  }

  return json;
}
