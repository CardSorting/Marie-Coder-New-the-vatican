
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { CliFileSystemPort } from "../cli/CliFileSystemPort.js";
import { MarieProgressTracker } from "../infrastructure/ai/core/MarieProgressTracker.js";
import { MarieToolProcessor } from "../infrastructure/ai/core/MarieToolProcessor.js";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { registerSharedToolDefinitions } from "../infrastructure/tools/SharedToolDefinitions.js";

async function verifyVisualProgressBar() {
    console.log("Starting Visual Progress Bar Verification...");

    const workingDir = path.join(process.cwd(), `.marie_visual_verify_${Date.now()}`);
    fs.mkdirSync(workingDir, { recursive: true });

    const cliFs = new CliFileSystemPort(workingDir);
    const registry = new ToolRegistry();

    // Register only the shared tools we need for testing
    registerSharedToolDefinitions(registry, {
        resolvePath: (p) => path.isAbsolute(p) ? p : path.join(workingDir, p),
        writeFile: (p, c, s, onProgress) => cliFs.writeFile(p, c, s, onProgress),
        appendFile: (p, c, s, onProgress) => cliFs.appendFile(p, c, s, onProgress),
        readFile: (p, s, e, sig) => cliFs.readFile(p, sig),
        listDir: (p, sig) => Promise.resolve(""),
        grepSearch: (q, p, sig) => Promise.resolve(""),
        getGitContext: () => Promise.resolve("")
    });

    const eventLogs: any[] = [];
    const tracker = new MarieProgressTracker(
        {
            onEvent: (e) => {
                if (e.type === "file_stream_delta") {
                    eventLogs.push(e);
                    // MOCK THE CLI RENDERER LOGIC HERE
                    if (e.totalBytes) {
                        const pct = Math.round((e.bytesWritten / e.totalBytes) * 100);
                        const barWidth = 10;
                        const completed = Math.round((barWidth * pct) / 100);
                        const bar = "=".repeat(completed) + ">" + " ".repeat(Math.max(0, barWidth - completed));
                        const fileName = e.path.split("/").pop();
                        console.log(`[CLI MOCK] Writing ${fileName} [${bar}] ${pct}% (${e.bytesWritten}/${e.totalBytes})`);
                    } else {
                        console.log(`[CLI MOCK] Writing... (No totalBytes)`);
                    }
                }
            }
        },
        {
            runId: "verify_visual_run",
            startedAt: Date.now(),
            steps: 0,
            tools: 0,
            objectives: [],
            achieved: []
        }
    );

    const processor = new MarieToolProcessor(
        registry,
        tracker,
        async () => true,
        {
            spiritPressure: 100,
            toolHistory: [],
            techniqueExecutions: [],
            mood: "CAUTIOUS",
            errorHotspots: {},
            totalErrorCount: 0,
            victoryStreak: 0
        } as any,
        cliFs
    );

    // Large content (>16KB to trigger chunking)
    const totalSize = 50000;
    const largeContent = "X".repeat(totalSize);
    const filePath = path.join(workingDir, "progress_bar_check.txt");

    console.log("Executing write_to_file with large content...");
    await processor.process({
        id: "call_visual",
        name: "write_to_file",
        input: { path: filePath, content: largeContent }
    });

    console.log(`Verification Results:`);
    const hasTotalBytes = eventLogs.every(e => e.totalBytes === totalSize);
    console.log(`- All events have correct totalBytes (${totalSize}): ${hasTotalBytes ? "✅" : "❌"}`);

    if (!hasTotalBytes) {
        throw new Error("Events missing correct totalBytes!");
    }

    console.log("✅ Visual Progress Bar logic verified!");

    // Cleanup
    fs.rmSync(workingDir, { recursive: true, force: true });
}

verifyVisualProgressBar().catch(err => {
    console.error("❌ Verification FAILED:", err);
    process.exit(1);
});
