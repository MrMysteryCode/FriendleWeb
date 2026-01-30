import GenericGame from "./GenericGame";

export default function QuoteleGame({ puzzle }) {
  return (
    <GenericGame
      puzzle={puzzle}
      gameKey="quotele"
      title="Quotele"
      prompt="Identify who sent the scrambled quote."
    />
  );
}
