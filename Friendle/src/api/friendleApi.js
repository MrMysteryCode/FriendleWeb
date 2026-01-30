const API_BASE = "https://friendle-api.officialmrmysteryman.workers.dev";
const GUILD_ID = "899803127534977054";

export async function fetchLatestPuzzles() {
  const url = `${API_BASE}/puzzles?guild_id=${encodeURIComponent(GUILD_ID)}&latest=1`;
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

  return json; // { guild_id, date, puzzles: { friendle_daily, quotele, mediale, statle } }
}
