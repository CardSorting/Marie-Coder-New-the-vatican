import type { ApprovalRequest } from "../types.js"

export function ApprovalPanel({
    pendingApproval,
    onApprove,
}: {
    pendingApproval: ApprovalRequest | null
    onApprove: (approved: boolean) => void
}) {
    return null
}
