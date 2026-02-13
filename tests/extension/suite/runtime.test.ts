import assert from "assert";
import * as vscode from "vscode";
import { MarieRuntime } from "../../../src/monolith/runtime/MarieRuntime.js";
import { suite, setup, test } from "mocha";

suite("MarieRuntime Mock Tests", () => {
  let runtime: MarieRuntime<any>;
  let mockSessionStore: any;

  setup(() => {
    mockSessionStore = {
      getCurrentSessionId: async () => "test-session",
      getSessions: async () => ({ "test-session": [] }),
      saveSessions: async () => {},
      getSessionMetadata: async () => [],
      saveSessionMetadata: async () => {},
      setCurrentSessionId: async () => {},
      getLastTelemetry: async () => undefined,
      setLastTelemetry: async () => {},
    };

    const options: any = {
      config: {
        getAiProvider: () => "anthropic",
        getApiKey: () => "fake-key",
        getAutonomyMode: () => "balanced",
      },
      sessionStore: mockSessionStore,
      toolRegistrar: () => {},
      providerFactory: () => ({
        listModels: async () => [{ id: "test-model", name: "Test Model" }],
      }),
      automationService: { setCurrentRun: () => {} },
      onProgressEvent: () => {},
    };

    runtime = new MarieRuntime(options);
  });

  async function waitForInit(runtime: any) {
    await (runtime as any).initPromise;
  }

  test("Initializes with current session", async () => {
    await waitForInit(runtime);
    assert.strictEqual(runtime.getCurrentSessionId(), "test-session");
  });

  test("Can get models", async () => {
    await waitForInit(runtime);
    const models = await runtime.getModels();
    assert.ok(Array.isArray(models));
    assert.strictEqual(models[0].id, "test-model");
  });

  test("Can create new session", async () => {
    await waitForInit(runtime);
    const newId = await runtime.createSession();
    assert.ok(newId.startsWith("session_"));
    assert.strictEqual(runtime.getCurrentSessionId(), newId);
    assert.strictEqual(runtime.getMessages().length, 0);
  });
});
