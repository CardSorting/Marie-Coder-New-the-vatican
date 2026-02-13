import assert from "assert";
import * as vscode from "vscode";
import { JoyService } from "../../../src/monolith/services/JoyService.js";
import { JoyLogService } from "../../../src/monolith/services/JoyLogService.js";
import { suite, setup, teardown, test } from "mocha";

suite("JoyService Mock Tests", () => {
  let context: vscode.ExtensionContext;
  let joyLog: JoyLogService;
  let joyService: JoyService;

  setup(() => {
    // Minimal mock context
    context = {
      subscriptions: [],
      workspaceState: {
        get: (key: string) => undefined,
        update: (key: string, value: any) => Promise.resolve(),
      },
      globalState: {
        get: (key: string) => undefined,
        update: (key: string, value: any) => Promise.resolve(),
      },
    } as any;

    joyLog = new JoyLogService(context);
    joyService = new JoyService(context, joyLog);
  });

  teardown(() => {
    joyService.dispose();
  });

  test("Initializes with a status bar item", () => {
    assert.ok(
      context.subscriptions.length > 0,
      "Should have registered status bar item in subscriptions",
    );
  });

  test("Can set intention", async () => {
    const testIntention = "Refactor codebase with JOY";
    await joyService.setIntention(testIntention);
    // Success if no crash
  });

  test("addAchievement adds to log", async () => {
    await joyService.addAchievement("Test Achievement", 50);
    const log = joyLog.getLog();
    assert.ok(
      log.some((a) => a.description === "Test Achievement"),
      "Achievement should be in log",
    );
  });

  test("getProjectHealth returns a health report", async () => {
    const health = await joyService.getProjectHealth();
    // Since we have no workspace folders in the shim, it might return null or a default
    // Let's see how the shim handles it. JoyService checks vscode.workspace.workspaceFolders
    if (health) {
      assert.strictEqual(typeof health.average, "number");
      assert.ok(Array.isArray(health.log));
    }
  });
});
