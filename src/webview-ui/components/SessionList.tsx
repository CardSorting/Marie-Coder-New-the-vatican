import { useMemo, useState } from "react";
import type { Session } from "../types.js";
import { SessionIcon, SearchIcon, MascotIcon, PinIcon } from "./Icons.js";

function formatSessionDate(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return "";
  }
}

export function SessionList({
  sessions,
  currentSessionId,
  onLoad,
  onCreate,
  onRefresh,
}: {
  sessions: Session[];
  currentSessionId: string;
  onLoad: (id: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          b.lastModified - a.lastModified,
      ),
    [sessions],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const lower = query.toLowerCase();
    return sorted.filter((session) =>
      session.title?.toLowerCase().includes(lower),
    );
  }, [query, sorted]);

  const hasResults = filtered.length > 0;

  const emptyStateMessage = query.trim()
    ? `No sessions match “${query.trim()}”.`
    : "Start a new chat to create your first session.";

  const emptyStateTitle = query.trim()
    ? "No matching sessions"
    : "No sessions yet";

  const emptyStateIcon = query.trim() ? <SearchIcon size={32} /> : <MascotIcon size={32} />;

  return (
    <aside className="left stack">
      <div className="session-heading">
        <span className="session-heading-icon" aria-hidden="true">
          <SessionIcon size={18} />
        </span>
        <strong>Sessions</strong>
      </div>
      <div className="row">
        <button onClick={onCreate}>New</button>
        <button onClick={onRefresh} className="secondary">
          Refresh
        </button>
      </div>
      <label className="session-search">
        <span className="muted">Search sessions</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by title"
        />
      </label>
      <div className="stack">
        {!hasResults && (
          <div className="session-empty">
            <div className="session-empty-icon">{emptyStateIcon}</div>
            <div className="session-empty-title">{emptyStateTitle}</div>
            <div className="muted">{emptyStateMessage}</div>
          </div>
        )}
        {filtered.map((session) => (
          <button
            key={session.id}
            onClick={() => onLoad(session.id)}
            className={`session ${session.id === currentSessionId ? "active" : ""}`}
          >
            <span className="session-title">
              {session.isPinned ? (
                <PinIcon size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
              ) : (
                <SessionIcon size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
              )}
              {session.title || "New Session"}
            </span>
            <span className="session-date muted">
              {formatSessionDate(session.lastModified)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
