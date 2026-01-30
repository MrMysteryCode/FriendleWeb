import GuessTableGame, { createColumn } from "./GuessTableGame";

const columns = [
  createColumn({
    key: "messages",
    label: "Message count",
    type: "range",
    keys: [
      "message_count_range",
      "messageCountRange",
      "message_range",
      "messages",
      "message_count",
    ],
  }),
  createColumn({
    key: "activeWindow",
    label: "Active window",
    type: "time",
    keys: [
      "active_time_window",
      "activeTimeWindow",
      "active_window",
      "activeWindow",
      "activity_window",
      "activityWindow",
    ],
    fallback: "Not active",
  }),
  createColumn({
    key: "category",
    label: "Category",
    type: "string",
    keys: [
      "channel_category",
      "channelCategory",
      "category",
      "channel_group",
    ],
  }),
  createColumn({
    key: "accountAge",
    label: "Account age",
    type: "range",
    keys: [
      "account_age_range",
      "accountAgeRange",
      "account_age",
      "accountAge",
    ],
  }),
  createColumn({
    key: "firstLetter",
    label: "First letter",
    type: "letter",
    keys: [
      "first_letter",
      "firstLetter",
      "username_first_letter",
      "usernameFirstLetter",
    ],
  }),
];

export default function StatleGame({ puzzle }) {
  const prompt =
    puzzle?.stat_description ||
    puzzle?.stat ||
    puzzle?.prompt ||
    "Guess the member described by today's standout stat.";
  const stats = puzzle?.stats || {};
  const leadItems = [
    { label: "Unique word", value: stats.unique_word || "—" },
    { label: "Messages", value: stats.messages ?? "—" },
    { label: "Reactions", value: stats.reactions_received ?? "—" },
  ];

  return (
    <GuessTableGame
      puzzle={puzzle}
      gameKey="statle"
      title="Statle"
      prompt={prompt}
      columns={columns}
      leadItems={leadItems}
      targetFallback={stats || null}
    />
  );
}
