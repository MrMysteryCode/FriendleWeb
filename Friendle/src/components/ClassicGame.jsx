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
      "messages_range",
      "messages_yesterday",
      "messageCount",
      "messages",
      "message_count",
    ],
  }),
  createColumn({
    key: "topWord",
    label: "Top word",
    type: "string",
    keys: [
      "most_used_word",
      "mostUsedWord",
      "top_word",
      "topWord",
      "non_common_word",
      "most_used_non_common_word",
      "mostUsedNonCommonWord",
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
      "active_period",
      "activePeriod",
    ],
    fallback: "Not active",
  }),
  createColumn({
    key: "mentions",
    label: "Mentions",
    type: "range",
    keys: [
      "mention_count_range",
      "mentionCountRange",
      "mentions",
      "mention_count",
      "mentionCount",
    ],
  }),
  createColumn({
    key: "firstMessage",
    label: "First message",
    type: "time",
    keys: [
      "first_message_bucket",
      "firstMessageBucket",
      "first_message_time",
      "firstMessageTime",
      "first_message",
      "firstMessage",
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
      "account_age_years",
    ],
  }),
];

export default function ClassicGame({ puzzle }) {
  const clues = puzzle?.clues;
  const leadItems = clues
    ? [
        { label: "Message count", value: clues.messages_yesterday || "—" },
        { label: "Top word", value: clues.top_word || "—" },
        { label: "Active window", value: clues.active_window || "Not active" },
        { label: "Mentions", value: clues.mentions ?? "—" },
        { label: "First message", value: clues.first_message_bucket || "—" },
        { label: "Account age", value: clues.account_age_range || "—" },
      ]
    : [];

  return (
    <GuessTableGame
      puzzle={puzzle}
      gameKey="classic"
      title="Classic"
      prompt="Guess which member matches the activity profile."
      columns={columns}
      leadItems={leadItems}
      targetFallback={clues || null}
    />
  );
}
