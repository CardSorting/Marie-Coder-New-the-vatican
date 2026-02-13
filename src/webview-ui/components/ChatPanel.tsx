import { useEffect, useRef } from "react"
import { marked } from "marked"
import type { UiMessage, ApprovalRequest } from "../types.js"

function renderMarkdown(content: string): string {
    const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return marked.parse(escaped) as string
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function highlightToolInput(input: string): string {
    const escaped = escapeHtml(input)
    return escaped
        .replace(/("[^"]*")\s*:/g, '<span class="tool-key">$1</span>:')
        .replace(/:\s*("[^"]*")/g, ': <span class="tool-string">$1</span>')
        .replace(/\b(true|false|null)\b/g, '<span class="tool-literal">$1</span>')
        .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tool-number">$1</span>')
}

function summarizeActivity(content: string): string {
    const firstLine = content.split("\n").find((line) => line.trim()) || "Activity"
    return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine
}

function stageSeparatorLabel(content: string) {
    const lower = content.toLowerCase()
    if (lower.includes("plan") || lower.includes("strategy") || lower.includes("approach")) return "Plan"
    if (lower.includes("execute") || lower.includes("implement") || lower.includes("running")) return "Execute"
    if (lower.includes("review") || lower.includes("verify") || lower.includes("final")) return "Review"
    return null
}

function formatTime(timestamp: number) {
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
        return ""
    }
}

export function ChatPanel({
    messages,
    streamingBuffer,
    toolStreamingBuffer,
    activeToolName,
    pendingApproval,
    onApprove,
    isLoading,
}: {
    messages: UiMessage[]
    streamingBuffer: string
    toolStreamingBuffer: string
    activeToolName: string
    pendingApproval: ApprovalRequest | null
    onApprove: (approved: boolean) => void
    isLoading: boolean
}) {
    const chatRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
    }, [messages, streamingBuffer, pendingApproval])

    return (
        <section className="feed" ref={chatRef}>
            {messages.map((message) => {
                if (message.role === "system") {
                    const stageLabel = stageSeparatorLabel(message.content)
                    return (
                        <div key={message.id} className="activity-group">
                            {stageLabel && (
                                <div className="stage-separator">
                                    <span className="stage-line" aria-hidden="true" />
                                    <span className="stage-chip">{stageLabel} Stage</span>
                                    <span className="stage-line" aria-hidden="true" />
                                </div>
                            )}
                            <details className="activity-log">
                                <summary>
                                    <span className="activity-tag">Activity</span>
                                    <span>{summarizeActivity(message.content)}</span>
                                </summary>
                                <div
                                    className="activity-body markdown"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                />
                            </details>
                        </div>
                    )
                }

                const roleLabel = message.role === "user" ? "You" : "Marie"
                return (
                    <div className={`msg ${message.role}`} key={message.id}>
                        <div className="msg-meta">
                            <span className="msg-role">{roleLabel}</span>
                            <span className="msg-time">{formatTime(message.timestamp)}</span>
                        </div>
                        <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                    </div>
                )
            })}

            {streamingBuffer && (
                <div className="msg assistant">
                    <div className="msg-meta">
                        <span className="msg-role">Marie</span>
                        <span className="msg-time">Typing…</span>
                    </div>
                    <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingBuffer) }} />
                </div>
            )}

            {toolStreamingBuffer && (
                <div className="msg assistant tool-input">
                    <div className="msg-meta">
                        <span className="msg-role">{activeToolName || "Tool"}</span>
                        <span className="msg-time">Receiving input…</span>
                    </div>
                    <details className="tool-stream-panel" open>
                        <summary>Tool input stream</summary>
                        <pre
                            className="tool-stream"
                            aria-live="polite"
                            dangerouslySetInnerHTML={{ __html: highlightToolInput(toolStreamingBuffer) }}
                        />
                    </details>
                </div>
            )}

            {pendingApproval && (
                <div className="msg assistant tool-request">
                    <div className="tool-card">
                        <div className="tool-header">Tool Permission Required</div>
                        <div>
                            <strong>{pendingApproval.toolName}</strong>
                        </div>
                        <pre style={{ fontSize: "11px", marginTop: "4px", opacity: 0.8 }}>
                            {JSON.stringify(pendingApproval.toolInput, null, 2)}
                        </pre>
                        <div className="btn-group">
                            <button onClick={() => onApprove(true)}>Approve</button>
                            <button className="secondary" onClick={() => onApprove(false)}>Deny</button>
                        </div>
                    </div>
                </div>
            )}

            {isLoading && !streamingBuffer && !toolStreamingBuffer && (
                <div className="activity-inline">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                    <span>Running tools…</span>
                </div>
            )}
        </section>
    )
}
