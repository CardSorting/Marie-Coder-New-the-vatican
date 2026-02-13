import * as assert from "assert";
import { JoyAutomationService } from "../../src/monolith/services/JoyAutomationService.js";
import { MarieProgressTracker } from "../../src/monolith/infrastructure/ai/core/MarieProgressTracker.js";
import { MarieToolProcessor } from "../../src/monolith/infrastructure/ai/core/MarieToolProcessor.js";

async function testSingularityAutonomy() {
  console.log("🧪 Testing Singularity Autonomy Features...");

  // 1. Mocking Environment
  const vscodeMock = {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
      fs: {
        stat: async () => ({}),
        readFile: async () => Buffer.from(""),
        writeFile: async () => {},
      },
    },
    Uri: {
      file: (p: string) => ({ fsPath: p }),
    },
    languages: {
      getDiagnostics: () => [],
    },
    DiagnosticSeverity: {
      Error: 0,
    },
  };
  (global as any).vscode = vscodeMock;

  const joyServiceMock = {
    addAchievement: async (msg: string, pts: number) => {
      console.log(`  [Achievement] ${msg} (+${pts})`);
    },
  } as any;

  const automationService = new JoyAutomationService({} as any, joyServiceMock);

  // 2. Test Spiritual Journaling
  console.log("  Testing Autonomous Spiritual Journaling...");
  await (automationService as any).performSpiritualJournaling();
  console.log("  ✅ Spiritual Journaling logic executed!");

  // 3. Test Achievement Scouting
  console.log("  Testing Autonomous Achievement Scouting...");
  await (automationService as any).scoutAchievements();
  console.log("  ✅ Achievement Scouting logic executed!");

  // 4. Test Build Sentinel
  console.log("  Testing Autonomous Build Sentinel...");
  const tracker = new MarieProgressTracker(
    {} as any,
    { runId: "test", totalPasses: 3 } as any,
  );
  const processor = new MarieToolProcessor(
    {} as any,
    tracker,
    async () => true,
    {} as any,
  );

  // Mock getDiagnostics to return an error
  (vscodeMock.languages as any).getDiagnostics = () => [
    {
      severity: 0,
      message: "Syntax error: Unexpected token",
      range: { start: { line: 10 } },
    },
  ];

  const buildAlert = await (processor as any).runBuildSentinel("test.ts");
  assert.ok(
    buildAlert.includes("Build Regressions Detected"),
    "Build Sentinel should detect errors",
  );
  console.log("  ✅ Build Sentinel correctly detected simulated error!");

  console.log("🌌 SINGULARITY AUTONOMY TESTS PASSED!");
}

testSingularityAutonomy().catch((err) => {
  console.error(err);
  process.exit(1);
});
