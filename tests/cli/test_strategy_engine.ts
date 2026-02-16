console.log("[Test Strategy Engine] Starting...");
import * as assert from "assert";
import { MarieEngine } from "../../src/monolith/infrastructure/ai/core/MarieEngine.js";
import { ToolRegistry } from "../../src/monolith/infrastructure/tools/ToolRegistry.js";
import { MarieProgressTracker } from "../../src/monolith/infrastructure/ai/core/MarieProgressTracker.js";
import {
  AIProvider,
  AIStreamEvent,
} from "../../src/monolith/infrastructure/ai/providers/AIProvider.js";
import { FileSystemPort } from "../../src/monolith/infrastructure/ai/core/FileSystemPort.js";

// --- MOCKS ---

class MockAIProvider implements AIProvider {
  private responseFlow: any[] = [];
  private currentIndex = 0;

  setResponseFlow(flow: any[]) {
    this.responseFlow = flow;
    this.currentIndex = 0;
  }

  async createMessage(): Promise<any> {
    return { role: "assistant", content: "Thought" };
  }

  async createMessageStream(
    params: any,
    onUpdate: (e: AIStreamEvent) => void,
  ): Promise<any> {
    const scenario = this.responseFlow[this.currentIndex] || {
      events: [],
      response: { role: "assistant", content: "Done" },
    };
    this.currentIndex++;

    for (const event of scenario.events) {
      onUpdate(event);
    }

    return scenario.response;
  }
  estimateTokens() {
    return 0;
  }
  async listModels() {
    return [];
  }
}

class MockFileSystemPort implements FileSystemPort {
  constructor(public readonly type: string) {}
  async readFile() {
    return "";
  }
  async writeFile() {}
  async appendFile() {}
  async deleteFile() {}
  async backupFile() {}
  async restoreFile() {}
  async rollbackAll() {}
  clearBackups() {}
}

// --- TEST SUITE ---

async function testCliEnvironment() {
  console.log("🧪 Testing CLI Strategy Flow...");

  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: "test_tool",
    description: "Test",
    input_schema: { type: "object", properties: {} },
    execute: async () => "Success",
  });

  const run = {
    runId: "test_cli",
    startedAt: Date.now(),
    steps: 0,
    tools: 0,
    objectives: [
      { id: "understand_request", label: "Understand", status: "in_progress" },
      { id: "execute_plan", label: "Execute", status: "pending" },
    ],
    activeObjectiveId: "understand_request",
    achieved: [],
  } as any;

  const events: any[] = [];
  const tracker = new MarieProgressTracker(
    {
      onEvent: (e) => {
        events.push(e);
        if (e.type === "stage")
          console.log(`[Test Debug] Stage change: ${e.stage}`);
        if (e.type === "progress_update")
          console.log(
            `[Test Debug] Progress: ${e.activeObjectiveId} -> ${e.context}`,
          );
      },
    },
    run,
  );

  const provider = new MockAIProvider();
  provider.setResponseFlow([
    {
      events: [
        { type: "content_delta", text: "Thinking... " },
        { type: "tool_call_delta", index: 0, id: "c1", name: "test_tool" },
        { type: "tool_call_delta", index: 0, id: "c1", argumentsDelta: "{}" },
      ],
      response: {
        role: "assistant",
        content: "Thinking...",
        tool_uses: [{ id: "c1", name: "test_tool", input: {} }],
      },
    },
    {
      events: [{ type: "content_delta", text: "All done." }],
      response: { role: "assistant", content: "All done." },
    },
  ]);

  const fs = new MockFileSystemPort("cli");
  const engine = new MarieEngine(
    provider,
    toolRegistry,
    async () => true,
    undefined,
    fs,
  );

  await engine.chatLoop([], tracker, async () => {});
  await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for dispatcher tool throttles

  // Verification
  const state = (engine as any).state;
  console.log(`[Test Debug] Detected Environment: ${state.environment}`);
  console.log(`[Test Debug] Final Objective ID: ${run.activeObjectiveId}`);
  console.log(
    `[Test Debug] Event Types: ${events.map((e) => e.type).join(", ")}`,
  );

  assert.strictEqual(
    state.environment,
    "cli",
    "Environment should be detected as cli",
  );
  assert.strictEqual(
    run.activeObjectiveId,
    "execute_plan",
    "Objective should transition to execute_plan",
  );
  assert.ok(
    events.some((e) => e.type === "tool"),
    "Should have emitted tool event",
  );

  console.log("✅ CLI Strategy Flow Passed!");
}

async function testSequentialTools() {
  console.log("🧪 Testing Sequential Tool Calls...");

  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: "tool_1",
    description: "Test 1",
    input_schema: { type: "object", properties: {} },
    execute: async () => "Success 1",
  });
  toolRegistry.register({
    name: "tool_2",
    description: "Test 2",
    input_schema: { type: "object", properties: {} },
    execute: async () => "Success 2",
  });

  const run = {
    runId: "test_seq",
    startedAt: Date.now(),
    steps: 0,
    tools: 0,
    objectives: [
      { id: "understand_request", label: "Understand", status: "in_progress" },
      { id: "execute_plan", label: "Execute", status: "pending" },
    ],
    activeObjectiveId: "understand_request",
    achieved: [],
  } as any;

  const tracker = new MarieProgressTracker({ onEvent: () => {} }, run);
  const provider = new MockAIProvider();
  provider.setResponseFlow([
    {
      events: [
        { type: "tool_call_delta", index: 0, id: "t1", name: "tool_1" },
        { type: "tool_call_delta", index: 0, id: "t1", argumentsDelta: "{}" },
      ],
      response: {
        role: "assistant",
        content: "",
        tool_uses: [{ id: "t1", name: "tool_1", input: {} }],
      },
    },
    {
      events: [
        { type: "tool_call_delta", index: 0, id: "t2", name: "tool_2" },
        { type: "tool_call_delta", index: 0, id: "t2", argumentsDelta: "{}" },
      ],
      response: {
        role: "assistant",
        content: "",
        tool_uses: [{ id: "t2", name: "tool_2", input: {} }],
      },
    },
    {
      events: [{ type: "content_delta", text: "Done" }],
      response: { role: "assistant", content: "Done" },
    },
  ]);

  const fs = new MockFileSystemPort("cli");
  const engine = new MarieEngine(
    provider,
    toolRegistry,
    async () => true,
    undefined,
    fs,
  );

  await engine.chatLoop([], tracker, async () => {});
  assert.strictEqual(
    run.activeObjectiveId,
    "execute_plan",
    "Should remain in execute_plan after first tool",
  );

  await engine.chatLoop([], tracker, async () => {});
  assert.strictEqual(
    run.activeObjectiveId,
    "execute_plan",
    "Should remain in execute_plan after second tool",
  );

  console.log("✅ Sequential Tool Calls Passed!");
}

async function testToolError() {
  console.log("🧪 Testing Tool Error Handling...");

  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: "buggy_tool",
    description: "Buggy",
    input_schema: { type: "object", properties: {} },
    execute: async () => {
      throw new Error("Boom");
    },
  });

  const run = {
    runId: "test_error",
    startedAt: Date.now(),
    steps: 0,
    tools: 0,
    objectives: [
      { id: "understand_request", label: "Understand", status: "in_progress" },
      { id: "execute_plan", label: "Execute", status: "pending" },
    ],
    activeObjectiveId: "understand_request",
    achieved: [],
  } as any;

  const tracker = new MarieProgressTracker({ onEvent: () => {} }, run);
  const provider = new MockAIProvider();
  provider.setResponseFlow([
    {
      events: [
        { type: "tool_call_delta", index: 0, id: "t1", name: "buggy_tool" },
        { type: "tool_call_delta", index: 0, id: "t1", argumentsDelta: "{}" },
      ],
      response: {
        role: "assistant",
        content: "",
        tool_uses: [{ id: "t1", name: "buggy_tool", input: {} }],
      },
    },
    {
      events: [{ type: "content_delta", text: "Recovering..." }],
      response: { role: "assistant", content: "Recovering..." },
    },
  ]);

  const fs = new MockFileSystemPort("cli");
  const engine = new MarieEngine(
    provider,
    toolRegistry,
    async () => true,
    undefined,
    fs,
  );

  await engine.chatLoop([], tracker, async () => {});

  // Even if tool fails, the engine transitions to execute_plan when it ATTEMPTS to call it.
  assert.strictEqual(
    run.activeObjectiveId,
    "execute_plan",
    "Should transition even if tool fails",
  );

  console.log("✅ Tool Error Handling Passed!");
}

async function runAllTests() {
  try {
    await testCliEnvironment();
    await testSequentialTools();
    await testToolError();
    console.log("\n🌟 STRATEGY ENGINE TESTS PASSED!");
  } catch (err) {
    console.error("\n❌ STRATEGY ENGINE TESTS FAILED:");
    console.error(err);
    process.exit(1);
  }
}

runAllTests();
