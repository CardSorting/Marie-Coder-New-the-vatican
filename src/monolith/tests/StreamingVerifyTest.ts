import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SessionLogService } from "../infrastructure/ai/core/SessionLogService.js";

async function verifyStreaming() {
    const logService = SessionLogService.getInstance();
    const sessionId = "test_streaming_session_" + Date.now();
    const logPath = path.join(os.homedir(), ".marie", "logs", "sessions", `${sessionId}.log`);

    console.log(`Starting verification for session: ${sessionId}`);
    logService.initializeSession(sessionId);

    if (!fs.existsSync(logPath)) {
        throw new Error("Log file was not created!");
    }

    const chunks = ["Hello", " world", "!", " This is a", " streamed", " test."];

    for (const chunk of chunks) {
        await logService.append(chunk);
        const content = fs.readFileSync(logPath, "utf-8");
        console.log(`Appended: "${chunk}" -> Current Content: "${content}"`);
    }

    const finalContent = fs.readFileSync(logPath, "utf-8");
    if (finalContent !== chunks.join("")) {
        throw new Error(`Verification failed! Expected "${chunks.join("")}" but got "${finalContent}"`);
    }

    console.log("✅ Verification successful! Incremental logging works.");
}

verifyStreaming().catch(err => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
