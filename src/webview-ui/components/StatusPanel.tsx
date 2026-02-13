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
    return (
        <section className="status-panel" aria-live="polite">
            <div className="status-main">
                <div className="status-title">{stageLabels[stage]}</div>
                <div className="status-summary">{summary}</div>
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
            </div>
            <div className="status-side">
                {pendingApproval && (
                    <div className="status-pill warn">Approval: {pendingApproval.toolName}</div>
                )}
                {!pendingApproval && isLoading && <div className="status-pill">Running tools</div>}
                {!pendingApproval && !isLoading && <div className="status-pill success">All clear</div>}
            </div>
        </section>
    )
}