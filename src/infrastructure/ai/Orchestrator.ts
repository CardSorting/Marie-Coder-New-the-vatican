import { Schema } from "../Config.js";
import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../DbPool.js";

export interface AgentStream {
    id: string;
    parentId: string | null;
    focus: string;
    status: "active" | "completed" | "failed";
    createdAt: number;
}

export interface AgentTask {
    id: string;
    streamId: string;
    description: string;
    status: "pending" | "running" | "completed" | "failed";
    result: string | null;
}

export class AgentOrchestrator {
    public async createStream(focus: string, parentId: string | null = null): Promise<AgentStream> {
        const streamId = uuidv4();
        dbPool.beginWork(streamId);

        const stream: AgentStream = {
            id: streamId,
            parentId,
            focus,
            status: "active",
            createdAt: Date.now(),
        };

        await dbPool.push({
            type: "insert",
            table: "agent_streams",
            values: stream,
            layer: "infrastructure"
        }, streamId);

        await dbPool.commitWork(streamId);
        return stream;
    }

    public async createTask(streamId: string, description: string): Promise<AgentTask> {
        const task: AgentTask = {
            id: uuidv4(),
            streamId,
            description,
            status: "pending",
            result: null,
        };

        await dbPool.push({
            type: "insert",
            table: "agent_tasks",
            values: task,
            layer: "infrastructure"
        }, streamId);

        return task;
    }

    public async updateTaskStatus(taskId: string, status: AgentTask["status"], result: string | null = null): Promise<void> {
        // Find the streamId for this task to use as agentId if needed
        // For simplicity in this pass, we use a generic agent update or assume the caller knows the stream.
        // In full impl, we'd lookup taskId's streamId.
        await dbPool.push({
            type: "update",
            table: "agent_tasks",
            values: { status, result },
            where: { column: "id", value: taskId },
            layer: "infrastructure"
        });
    }

    public async getActiveStreams(requestingAgentId?: string): Promise<AgentStream[]> {
        const all = await dbPool.selectAllFrom("agent_streams", requestingAgentId);
        return all.filter(s => s.status === "active");
    }

    public async getStreamTasks(streamId: string, requestingAgentId?: string): Promise<AgentTask[]> {
        const all = await dbPool.selectAllFrom("agent_tasks", requestingAgentId);
        return all.filter(t => t.streamId === streamId);
    }
}

export const orchestrator = new AgentOrchestrator();
