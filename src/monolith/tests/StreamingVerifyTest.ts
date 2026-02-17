import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SessionLogService } from "../infrastructure/ai/core/SessionLogService.js";
import { CliFileSystemPort } from "../cli/CliFileSystemPort.js";
import { MarieProgressTracker } from "../infrastructure/ai/core/MarieProgressTracker.js";
import { MarieToolProcessor } from "../infrastructure/ai/core/MarieToolProcessor.js";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { registerSharedToolDefinitions } from "../infrastructure/tools/SharedToolDefinitions.js";

async function verifyStreaming() {
  const workingDir = path.join(
    process.cwd(),
    `.marie_streaming_verify_${Date.now()}`,
  );
  fs.mkdirSync(workingDir, { recursive: true });

  const sessionId = `test_streaming_${Date.now()}`;
  const logService = new SessionLogService(sessionId);

  console.log(
    `Starting streaming & persistence verification for session: ${sessionId}`,
  );

  const cliFs = new CliFileSystemPort(workingDir);
  const registry = new ToolRegistry();

  // Register shared tools
  registerSharedToolDefinitions(registry, {
    resolvePath: (p) => (path.isAbsolute(p) ? p : path.join(workingDir, p)),
    writeFile: (p, c, s, onProgress) => cliFs.writeFile(p, c, s, onProgress),
    appendFile: (p, c, s, onProgress) => cliFs.appendFile(p, c, s, onProgress),
    readFile: (p, s, e, sig) => cliFs.readFile(p, sig),
    listDir: (p, sig) => Promise.resolve(""),
    grepSearch: (q, p, sig) => Promise.resolve(""),
    getGitContext: () => Promise.resolve(""),
  });

  const emittedEvents: any[] = [];
  const tracker = new MarieProgressTracker(
    {
      onEvent: async (e) => {
        emittedEvents.push(e);
        await logService.appendEvent(e);
      },
    },
    {
      runId: "streaming_run",
      startedAt: Date.now(),
      steps: 0,
      tools: 0,
      objectives: [],
      achieved: [],
    },
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
      victoryStreak: 0,
    } as any,
    cliFs,
  );

  // Large content (>16KB to trigger chunking)
  const totalSize = 50000;
  const largeContent = "S".repeat(totalSize);
  const filePath = path.join(workingDir, "streaming_test.txt");

  console.log("Executing write_to_file with 50KB content...");
  const result = await processor.process({
    id: "call_streaming",
    name: "write_to_file",
    input: { path: filePath, content: largeContent },
  });
  console.log(`Tool Result: ${result}`);

  // Verify events
  const deltas = emittedEvents.filter((e) => e.type === "file_stream_delta");
  console.log(
    `Verification: ${deltas.length} file_stream_delta events emitted.`,
  );

  if (deltas.length < 2) {
    throw new Error(
      `Insufficient streaming deltas! Expected > 1, got ${deltas.length}`,
    );
  }

  const lastDelta = deltas[deltas.length - 1];
  if (
    lastDelta.bytesWritten !== totalSize ||
    lastDelta.totalBytes !== totalSize
  ) {
    throw new Error(
      `Final delta mismatch! Expected ${totalSize} bytes, got ${lastDelta.bytesWritten}`,
    );
  }

  // Verify stage was changed to "editing"
  const stages = emittedEvents.filter(
    (e) => e.type === "stage" && e.stage === "editing",
  );
  if (stages.length === 0) {
    throw new Error("Missing 'editing' stage event!");
  }
  console.log(`Verification: 'editing' stage detected correctly.`);

  // Verify persistence
  const logPath = path.join(
    os.homedir(),
    ".marie",
    "logs",
    "sessions",
    `${sessionId}.jsonl`,
  );
  const logContent = fs.readFileSync(logPath, "utf-8");
  const logLines = logContent.trim().split("\n");

  console.log(`Log Content Check: ${logLines.length} lines persisted.`);
  if (logLines.length === 0) {
    throw new Error("Log file is empty!");
  }

  const recoveredEvents = logLines.map((l) => JSON.parse(l));
  const persistedDeltas = recoveredEvents.filter(
    (e) => e.type === "file_stream_delta",
  );

  if (persistedDeltas.length !== deltas.length) {
    throw new Error(
      `Persistence mismatch! Expected ${deltas.length} deltas, got ${persistedDeltas.length}`,
    );
  }

  console.log(
    "✅ Granular file streaming & high-integrity persistence verified!",
  );

  // Cleanup
  fs.rmSync(workingDir, { recursive: true, force: true });
}

verifyStreaming().catch((err) => {
  console.error("❌ Verification FAILED:", err);
  process.exit(1);
});
