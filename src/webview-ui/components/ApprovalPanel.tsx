import { useEffect } from "react";
import type { ApprovalRequest } from "../types.js";

export function ApprovalPanel({
  pendingApproval,
  onApprove,
}: {
  pendingApproval: ApprovalRequest | null;
  onApprove: (approved: boolean) => void;
}) {
  useEffect(() => {
    if (!pendingApproval) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onApprove(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onApprove(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onApprove, pendingApproval]);

  if (!pendingApproval) return null;

  return (
    <div className="approval-modal" role="dialog" aria-modal="true">
      <div className="approval-card">
        <div className="approval-header">Tool Approval Required</div>
        <div className="approval-tool-name">{pendingApproval.toolName}</div>
        {pendingApproval.diff ? (
          <div className="approval-diff">
            <div className="approval-diff-title">Diff Preview</div>
            <div className="approval-diff-grid">
              <div>
                <div className="approval-diff-label">Before</div>
                <pre>{pendingApproval.diff.old}</pre>
              </div>
              <div>
                <div className="approval-diff-label">After</div>
                <pre>{pendingApproval.diff.new}</pre>
              </div>
            </div>
          </div>
        ) : (
          <pre className="approval-input">
            {typeof pendingApproval.toolInput === "string"
              ? pendingApproval.toolInput
              : JSON.stringify(pendingApproval.toolInput, null, 2)}
          </pre>
        )}
        <div className="approval-actions">
          <button onClick={() => onApprove(true)}>Approve</button>
          <button className="secondary" onClick={() => onApprove(false)}>
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
