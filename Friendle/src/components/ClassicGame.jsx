import GenericGame from "./GenericGame";

export default function ClassicGame({ puzzle }) {
  return (
    <GenericGame
      puzzle={puzzle}
      gameKey="classic"
      title="Classic"
      prompt="Guess which server member matches yesterday's activity profile."
    />
  );
}
