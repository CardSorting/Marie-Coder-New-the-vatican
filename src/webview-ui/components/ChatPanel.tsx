import { useEffect, useRef } from "react"
import { marked } from "marked"
import type { UiMessage, ApprovalRequest } from "../types.js"

function renderMarkdown(content: string): string {
    const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return marked.parse(escaped) as string
}

function summarizeActivity(content: string): string {
    const firstLine = content.split("\n").find((line) => line.trim()) || "Activity"
    return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine
}

export function ChatPanel({
    messages,
    streamingBuffer,
    pendingApproval,
    onApprove,
    isLoading,
}: {
    messages: UiMessage[]
    streamingBuffer: string
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
                    return (
                        <details className="activity-log" key={message.id}>
                            <summary>
                                <span className="activity-tag">Activity</span>
                                <span>{summarizeActivity(message.content)}</span>
                            </summary>
                            <div
                                className="activity-body markdown"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                            />
                        </details>
                    )
                }

                return (
                    <div className={`msg ${message.role}`} key={message.id}>
                        <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                    </div>
                )
            })}

            {streamingBuffer && (
                <div className="msg assistant">
                    <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingBuffer) }} />
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

            {isLoading && !streamingBuffer && (
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
