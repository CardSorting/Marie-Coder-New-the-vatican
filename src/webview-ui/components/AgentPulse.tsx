import type { AgentStage, ApprovalRequest } from "../types.js"

const stageLabels: Record<AgentStage, string> = {
    plan: "Planning",
    execute: "Executing",
    review: "Reviewing",
}

export function AgentPulse({
    stage,
    isLoading,
    pendingApproval,
}: {
    stage: AgentStage
    isLoading: boolean
    pendingApproval: ApprovalRequest | null
}) {
    const statusLabel = pendingApproval
        ? "Approval needed"
        : isLoading
            ? "Working"
            : "Idle"

    const tone = pendingApproval ? "warn" : isLoading ? "active" : "idle"

    return (
        <div
            className={`agent-pulse compact ${tone}`}
            aria-live="polite"
            title={`${stageLabels[stage]} • ${statusLabel}`}>
            <span className="pulse-dot" aria-hidden="true" />
        </div>
    )
}