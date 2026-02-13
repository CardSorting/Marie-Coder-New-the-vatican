import type { UiMessage } from "../types.js";

function summarize(content: string) {
  const trimmed = content.trim();
  return trimmed.length > 60
    ? `${trimmed.slice(0, 60)}…`
    : trimmed || "Activity";
}

export function ActivityTimeline({ messages }: { messages: UiMessage[] }) {
  const recent = messages
    .filter((message) => message.role === "system")
    .slice(-5)
    .reverse();

  if (recent.length === 0) {
    return (
      <aside className="activity-timeline empty" aria-label="Recent activity">
        <div className="timeline-title">Recent activity</div>
        <div className="timeline-empty compact">No activity yet</div>
      </aside>
    );
  }

  return (
    <aside className="activity-timeline" aria-label="Recent activity">
      <div className="timeline-title">Recent activity</div>
      <ul className="timeline-list">
        {recent.map((message) => (
          <li key={message.id} className="timeline-item">
            <span className="timeline-dot" aria-hidden="true" />
            <span>{summarize(message.content)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
