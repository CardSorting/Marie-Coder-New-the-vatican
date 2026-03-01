import { Kysely, CompiledQuery } from "kysely";
import { Schema, getDb } from "./Config.js";
import { Mutex } from "../plumbing/Plumbing.js";

export type DbLayer = "domain" | "infrastructure" | "ui" | "plumbing";

type WriteOp = {
    type: "insert" | "update" | "delete";
    table: keyof Schema;
    values?: any;
    where?: { column: string; value: any };
    agentId?: string;
    layer?: DbLayer;
};

const LAYER_PRIORITY: Record<DbLayer, number> = {
    domain: 0,
    infrastructure: 1,
    ui: 2,
    plumbing: 3,
};

export class BufferedDbPool {
    private globalBuffer: WriteOp[] = [];
    private agentShadows = new Map<string, WriteOp[]>();
    private flushMutex = new Mutex("DbFlushMutex");
    private flushInterval: NodeJS.Timeout | null = null;
    private db: Kysely<Schema> | null = null;

    constructor() {
        this.startFlushLoop();
    }

    private async ensureDb(): Promise<Kysely<Schema>> {
        if (!this.db) {
            this.db = await getDb();
        }
        return this.db;
    }

    private startFlushLoop() {
        if (this.flushInterval) return;
        this.flushInterval = setInterval(() => this.flush(), 100);
    }

    public beginWork(agentId: string) {
        if (!this.agentShadows.has(agentId)) {
            this.agentShadows.set(agentId, []);
        }
    }

    public async push(op: WriteOp, agentId?: string) {
        if (agentId) {
            const shadow = this.agentShadows.get(agentId) || [];
            shadow.push({ ...op, agentId });
            this.agentShadows.set(agentId, shadow);
        } else {
            this.globalBuffer.push(op);
        }

        if (this.globalBuffer.length > 50) {
            this.flush();
        }
    }

    public async commitWork(agentId: string) {
        const shadow = this.agentShadows.get(agentId);
        if (!shadow || shadow.length === 0) return;

        const conflicts = this.detectConflicts(shadow);
        if (conflicts.length > 0) {
            throw new Error(`[DbPool] Conflict detected for agent ${agentId}: ${conflicts.join(", ")}`);
        }

        this.globalBuffer.push(...shadow);
        this.agentShadows.delete(agentId);
        await this.flush();
    }

    public rollbackWork(agentId: string) {
        this.agentShadows.delete(agentId);
    }

    private detectConflicts(shadow: WriteOp[]): string[] {
        const conflicts: string[] = [];
        for (const op of shadow) {
            if (op.where) {
                const overlap = this.globalBuffer.some(gOp =>
                    gOp.table === op.table &&
                    gOp.where?.column === op.where?.column &&
                    gOp.where?.value === op.where?.value
                );
                if (overlap) conflicts.push(`Overlapping mutation on ${op.table}.${op.where.column}=${op.where.value}`);
            }
        }
        return conflicts;
    }

    public async flush() {
        if (this.globalBuffer.length === 0) return;

        const release = await this.flushMutex.acquire();
        try {
            const db = await this.ensureDb();
            const opsToFlush = [...this.globalBuffer].sort((a, b) => {
                const pA = LAYER_PRIORITY[a.layer || "plumbing"];
                const pB = LAYER_PRIORITY[b.layer || "plumbing"];
                return pA - pB;
            });
            this.globalBuffer = [];

            await db.transaction().execute(async (trx) => {
                for (const op of opsToFlush) {
                    if (op.type === "insert") {
                        await trx.insertInto(op.table as any).values(op.values).execute();
                    } else if (op.type === "update") {
                        let query = trx.updateTable(op.table as any).set(op.values);
                        if (op.where) {
                            query = query.where(op.where.column as any, "=", op.where.value as any);
                        }
                        await query.execute();
                    } else if (op.type === "delete") {
                        let query = trx.deleteFrom(op.table as any);
                        if (op.where) {
                            query = query.where(op.where.column as any, "=", op.where.value as any);
                        }
                        await query.execute();
                    }
                }
            });
            console.log(`[DbPool] Flushed ${opsToFlush.length} prioritized operations.`);
        } catch (e) {
            console.error("[DbPool] Flush failed:", e);
        } finally {
            release();
        }
    }

    // Specialized query methods to ensure Read-Your-Writes consistency
    // Note: This is an "imagined" high-performance strategy as requested.
    // In a real system, we'd merge buffered writes with disk results.
    public async selectAllFrom<T extends keyof Schema>(table: T, agentId?: string): Promise<Schema[T][]> {
        const db = await this.ensureDb();
        const diskResults = await db.selectFrom(table as any).selectAll().execute() as any[];

        const globalPending = this.globalBuffer
            .filter(op => op.table === table && op.type === "insert")
            .map(op => op.values);

        const shadowPending = agentId ? (this.agentShadows.get(agentId) || [])
            .filter(op => op.table === table && op.type === "insert")
            .map(op => op.values) : [];

        return [...diskResults, ...globalPending, ...shadowPending];
    }

    public async stop() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flush();
    }
}

export const dbPool = new BufferedDbPool();
