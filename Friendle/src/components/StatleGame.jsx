import GenericGame from "./GenericGame";

export default function StatleGame({ puzzle }) {
  return (
    <GenericGame
      puzzle={puzzle}
      gameKey="statle"
      title="Statle"
      prompt="Match a standout daily stat profile to the right member."
    />
  );
}
