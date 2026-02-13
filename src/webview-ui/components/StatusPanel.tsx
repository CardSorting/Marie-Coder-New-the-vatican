import { useState } from "react"
import type { AgentStage, ApprovalRequest } from "../types.js"

const stageLabels: Record<AgentStage, string> = {
    plan: "Planning",
    execute: "Executing",
    review: "Reviewing",
}

export function StatusPanel({
    stage,
    summary,
    hint,
    actions,
    onActionClick,
    pendingApproval,
    isLoading,
}: {
    stage: AgentStage
    summary: string
    hint: string
    actions: string[]
    onActionClick: (action: string) => void
    pendingApproval: ApprovalRequest | null
    isLoading: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(false)

    const statusTone = pendingApproval ? "warn" : isLoading ? "active" : "success"
    const statusLabel = pendingApproval
        ? `Approval: ${pendingApproval.toolName}`
        : isLoading
            ? "Running tools"
            : "All clear"

    return (
        <section className={`status-panel ${isExpanded ? "expanded" : "collapsed"}`} aria-live="polite">
            <div className="status-main">
                <div className="status-title-row">
                    <div className="status-title">{stageLabels[stage]}</div>
                    <button
                        type="button"
                        className="status-toggle"
                        onClick={() => setIsExpanded((prev: boolean) => !prev)}>
                        {isExpanded ? "Hide" : "Details"}
                    </button>
                </div>
                <div className="status-summary">{summary}</div>
                {isExpanded && (
                    <>
                        <div className="status-hint">{hint}</div>
                        <div className="status-actions">
                            {actions.map((action) => (
                                <button
                                    key={action}
                                    className="status-action"
                                    type="button"
                                    onClick={() => onActionClick(action)}>
                                    {action}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div className="status-side">
                <div className={`status-pill ${statusTone}`}>{statusLabel}</div>
            </div>
        </section>
    )
}