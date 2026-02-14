import { useState } from "react";
import type { AgentStage } from "../types.js";
import { PlanIcon, ExecuteIcon, ReviewIcon } from "./Icons.js";

const stageIcons: Record<AgentStage, React.ReactNode> = {
  plan: <PlanIcon />,
  execute: <ExecuteIcon />,
  review: <ReviewIcon />,
};

const stageOrder: AgentStage[] = ["plan", "execute", "review"];

const stageLabels: Record<AgentStage, string> = {
  plan: "Plan",
  execute: "Execute",
  review: "Review",
};

export function StageRail({
  stage,
  onSelect,
}: {
  stage: AgentStage;
  onSelect: (stage: AgentStage) => void;
}) {
  const activeIndex = stageOrder.indexOf(stage);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`stage-rail ${isExpanded ? "expanded" : "compact"}`}
      aria-label="Agent stages"
    >
      <div className="stage-rail-header">
        <div className="stage-rail-status">
          {stageLabels[stage]}{" "}
          <span className="stage-rail-dot" aria-hidden="true" /> Idle
        </div>
        <button
          className="stage-rail-toggle"
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Hide stages" : "Show stages"}
        </button>
      </div>
      {isExpanded && (
        <div className="stage-rail-steps">
          {stageOrder.map((step, index) => {
            const isActive = index === activeIndex;
            const isComplete = index < activeIndex;
            return (
              <div
                key={step}
                className={`stage-pill ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                aria-current={isActive ? "step" : undefined}
              >
                <button
                  className="stage-trigger"
                  onClick={() => onSelect(step)}
                >
                  <span className="stage-icon" aria-hidden="true">
                    {isActive || !isComplete ? (
                      stageIcons[step]
                    ) : (
                      <ReviewIcon size={14} />
                    )}
                  </span>
                  <span className="stage-label">{stageLabels[step]}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
