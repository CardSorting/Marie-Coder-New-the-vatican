import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SessionLogService } from "../infrastructure/ai/core/SessionLogService.js";

async function verifyStreaming() {
    const logService = SessionLogService.getInstance();
    const sessionId = `test_persistence_${Date.now()}`;
    logService.initializeSession(sessionId);

    console.log(`Starting persistence verification for session: ${sessionId}`);

    const events: any[] = [
        { type: "stage_update", stage: "thinking", stage_status: "active" },
        { type: "content_delta", text: "Hello" },
        { type: "content_delta", text: " world" },
        { type: "tool_call", tool: "read_file", input: { path: "foo.txt" } },
        { type: "run_completed" }
    ];

    for (const event of events) {
        await logService.appendEvent(event);
        console.log(`Logged event: ${event.type}`);
    }

    const logPath = path.join(os.homedir(), ".marie", "logs", "sessions", `${sessionId}.jsonl`);
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n");

    console.log(`Log Content Check: ${lines.length} lines persisted.`);

    if (lines.length !== events.length) {
        throw new Error(`Persistence mismatch! Expected ${events.length} lines, got ${lines.length}`);
    }

    // Verify recovery
    const recoveredEvents = lines.map(l => JSON.parse(l));
    if (recoveredEvents[1].text !== "Hello") {
        throw new Error("Data integrity check failed!");
    }

    console.log("✅ High-integrity persistence verification successful!");
}

verifyStreaming().catch(err => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
