import GuessTableGame, { createColumn } from "./GuessTableGame";

const columns = [
  createColumn({
    key: "span",
    label: "Quote span",
    type: "range",
    keys: [
      "message_span",
      "messageSpan",
      "span_count",
      "spanCount",
      "message_count",
      "messages",
    ],
  }),
  createColumn({
    key: "timeWindow",
    label: "Time window",
    type: "time",
    keys: [
      "time_window",
      "timeWindow",
      "sent_window",
      "sentWindow",
      "active_time_window",
      "activeTimeWindow",
      "time_bucket",
    ],
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
    key: "length",
    label: "Length %",
    type: "range",
    keys: [
      "message_length_percentile",
      "length_percentile",
      "lengthPercentile",
      "length_percent",
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

export default function QuoteleGame({ puzzle }) {
  const meta = puzzle?.meta || {};
  const leadItems = [
    { label: "Quote span", value: meta.message_span ?? "—" },
    { label: "Time window", value: meta.time_bucket || "—" },
    { label: "Channel category", value: meta.channel_category || "—" },
  ];

  return (
    <GuessTableGame
      puzzle={puzzle}
      gameKey="quotele"
      title="Quotele"
      prompt="Guess who sent the scrambled quote."
      quote={puzzle?.quote}
      leadItems={leadItems}
      columns={columns}
      targetFallback={meta || null}
    />
  );
}
