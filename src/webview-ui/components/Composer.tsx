import { useEffect, useRef, useState } from "react"

import type { AgentStage, ApprovalRequest } from "../types.js"

export function Composer({
    isLoading,
    stage,
    stageHint,
    pendingApproval,
    onSend,
}: {
    isLoading: boolean
    stage: AgentStage
    stageHint: string
    pendingApproval: ApprovalRequest | null
    onSend: (text: string) => void
}) {
    const [input, setInput] = useState("")
    const [showThinking, setShowThinking] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.style.height = "auto"
        const nextHeight = Math.min(textarea.scrollHeight, 220)
        textarea.style.height = `${Math.max(52, nextHeight)}px`
    }, [input])

    useEffect(() => {
        if (!isLoading) {
            setShowThinking(false)
            return
        }

        const timer = window.setTimeout(() => setShowThinking(true), 1200)
        return () => window.clearTimeout(timer)
    }, [isLoading])

    const submit = () => {
        const text = input.trim()
        if (!text) return
        setInput("")
        onSend(text)
    }

    const guidance = pendingApproval
        ? "Approval required before I can proceed."
        : stage === "plan"
            ? "Share goals, constraints, or desired outcomes to shape the plan."
            : stage === "execute"
                ? "You can add clarifications while I work."
                : "Review the result and ask for tweaks if needed."

    const quickActions = pendingApproval
        ? ["Approve tool", "Deny tool"]
        : stage === "plan"
            ? ["Summarize goal", "List constraints", "Define success criteria"]
            : stage === "execute"
                ? ["Pause run", "Add clarification", "Request status update"]
                : ["Summarize outcome", "Suggest refinements", "Validate results"]

    return (
        <footer className="composer-container">
            <div className="composer-box">
                <textarea
                    ref={textareaRef}
                    className="textarea-minimal"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault()
                            submit()
                            return
                        }

                        if (e.key === "Enter" && e.shiftKey) {
                            return
                        }

                        if (e.key === "Enter") {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    placeholder={`Ask Marie… (${stage} stage)`}
                />

                <div className="composer-actions">
                    <div className="composer-status">
                        {showThinking ? (
                            <span className="thinking">Thinking…</span>
                        ) : (
                            <span className="muted">{guidance}</span>
                        )}
                    </div>
                    <button onClick={submit} disabled={isLoading}>
                        Send
                    </button>
                </div>
            </div>
            <div className="composer-hint">
                <span className="stage-badge">{stage.toUpperCase()}</span>
                <span>{stageHint}</span>
            </div>
            <div className="composer-quick-actions">
                {quickActions.map((action) => (
                    <button
                        key={action}
                        type="button"
                        className="composer-chip"
                        onClick={() => {
                            if (pendingApproval && action.startsWith("Approve")) {
                                onSend("Approve the pending tool.")
                                return
                            }
                            if (pendingApproval && action.startsWith("Deny")) {
                                onSend("Deny the pending tool.")
                                return
                            }
                            onSend(action)
                        }}>
                        {action}
                    </button>
                ))}
            </div>
        </footer>
    )
}
