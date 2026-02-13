import type { AgentStage } from "../types.js"

const stageOrder: AgentStage[] = ["plan", "execute", "review"]

const stageLabels: Record<AgentStage, string> = {
    plan: "Plan",
    execute: "Execute",
    review: "Review",
}

export function StageRail({ stage, onSelect }: { stage: AgentStage; onSelect: (stage: AgentStage) => void }) {
    const activeIndex = stageOrder.indexOf(stage)

    return (
        <div className="stage-rail" aria-label="Agent stages">
            {stageOrder.map((step, index) => {
                const isActive = index === activeIndex
                const isComplete = index < activeIndex
                return (
                    <div
                        key={step}
                        className={`stage-pill ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                        aria-current={isActive ? "step" : undefined}>
                        <button className="stage-trigger" onClick={() => onSelect(step)}>
                            <span className="stage-icon" aria-hidden="true">
                                {isComplete ? "✓" : index + 1}
                            </span>
                            <span className="stage-label">{stageLabels[step]}</span>
                        </button>
                    </div>
                )
            })}
        </div>
    )
}