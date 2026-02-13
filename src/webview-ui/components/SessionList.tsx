import type { Session } from "../types.js"

function formatSessionDate(timestamp: number) {
    try {
        return new Date(timestamp).toLocaleDateString()
    } catch {
        return ""
    }
}

export function SessionList({
    sessions,
    currentSessionId,
    onLoad,
    onCreate,
    onRefresh,
}: {
    sessions: Session[]
    currentSessionId: string
    onLoad: (id: string) => void
    onCreate: () => void
    onRefresh: () => void
}) {
    const sorted = [...sessions].sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.lastModified - a.lastModified,
    )

    return (
        <aside className="left stack">
            <div className="session-heading">
                <span className="session-heading-icon" aria-hidden="true">🗂️</span>
                <strong>Sessions</strong>
            </div>
            <div className="row">
                <button onClick={onCreate}>New</button>
                <button onClick={onRefresh} className="secondary">
                    Refresh
                </button>
            </div>
            <div className="stack">
                {sorted.length === 0 && (
                    <div className="session-empty">
                        <div className="session-empty-icon">✨</div>
                        <div className="session-empty-title">No sessions yet</div>
                        <div className="muted">Start a new chat to create your first session.</div>
                    </div>
                )}
                {sorted.map((session) => (
                    <button
                        key={session.id}
                        onClick={() => onLoad(session.id)}
                        className={`session ${session.id === currentSessionId ? "active" : ""}`}>
                        <span className="session-title">
                            {session.isPinned ? "📌 " : "💬 "}
                            {session.title || "New Session"}
                        </span>
                        <span className="session-date muted">{formatSessionDate(session.lastModified)}</span>
                    </button>
                ))}
            </div>
        </aside>
    )
}
