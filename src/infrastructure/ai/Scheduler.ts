import { DbLayer } from "../DbPool.js";

export interface DiffProposal {
    id: string;
    agentId: string;
    layer: DbLayer;
    affectedFiles: string[];
    dependencies: string[]; // List of proposal IDs
    status: "pending" | "approved" | "applied" | "blocked" | "rejected";
    timestamp: number;
    riskScore: number; // 0-100
}

const LAYER_SCORE: Record<DbLayer, number> = {
    domain: 100,
    infrastructure: 50,
    ui: 10,
    plumbing: 5,
};

export class DiffScheduler {
    private proposals = new Map<string, DiffProposal>();

    public propose(proposal: Omit<DiffProposal, "status" | "timestamp">): string {
        const fullProposal: DiffProposal = {
            ...proposal,
            status: "pending",
            timestamp: Date.now(),
        };
        this.proposals.set(fullProposal.id, fullProposal);
        this.recalculateDependencies();
        return fullProposal.id;
    }

    private recalculateDependencies() {
        // Simple heuristic: If a lower priority layer touches a file 
        // that a higher priority layer is also touching, it becomes blocked.
        for (const p of this.proposals.values()) {
            if (p.status === "applied" || p.status === "rejected") continue;

            const higherPrioConflicts = Array.from(this.proposals.values()).filter(other =>
                other.id !== p.id &&
                other.status !== "applied" &&
                LAYER_SCORE[other.layer] > LAYER_SCORE[p.layer] &&
                other.affectedFiles.some(f => p.affectedFiles.includes(f))
            );

            if (higherPrioConflicts.length > 0) {
                p.status = "blocked";
                p.dependencies = higherPrioConflicts.map(c => c.id);
            } else {
                if (p.status === "blocked") p.status = "pending";
            }
        }
    }

    public getExecutableProposal(agentId: string): DiffProposal | null {
        this.recalculateDependencies();
        const executable = Array.from(this.proposals.values())
            .filter(p => p.agentId === agentId && p.status === "pending")
            .sort((a, b) => {
                // Priority: Layer Score > Timestamp (older first)
                if (LAYER_SCORE[a.layer] !== LAYER_SCORE[b.layer]) {
                    return LAYER_SCORE[b.layer] - LAYER_SCORE[a.layer];
                }
                return a.timestamp - b.timestamp;
            });

        return executable[0] || null;
    }

    public updateStatus(id: string, status: DiffProposal["status"]) {
        const p = this.proposals.get(id);
        if (p) {
            p.status = status;
            this.recalculateDependencies();
        }
    }

    public getContext() {
        return Array.from(this.proposals.values()).map(p => ({
            id: p.id,
            layer: p.layer,
            status: p.status,
            files: p.affectedFiles
        }));
    }
}

export const scheduler = new DiffScheduler();
