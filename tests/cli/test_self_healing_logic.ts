import * as assert from "assert";
import { JoyServiceCLI } from "../../src/monolith/cli/services/JoyServiceCLI.js";
import { JoyAutomationService } from "../../src/monolith/services/JoyAutomationService.js";
import * as vscode from "vscode";

async function testSelfHealing() {
  console.log("🧪 Testing Self-Healing Logic...");

  const joyService = new JoyServiceCLI() as any;
  const automationService = new JoyAutomationService(null as any, joyService);

  const result = await automationService.executeSelfHealing(
    "path/to/fail.ts",
    "content check failed",
  );

  assert.ok(
    result.includes("Self-healing"),
    "Should return self-healing message",
  );
  assert.ok(result.includes("retry the operation"), "Should suggest retry");

  console.log("✅ Self-Healing Logic Test Passed!");
}

testSelfHealing().catch((err) => {
  console.error(err);
  process.exit(1);
});
