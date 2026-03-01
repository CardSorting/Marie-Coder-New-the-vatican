import { AIProvider } from "./AIProvider.js";
import { getTool, getRegisteredTools } from "../tools/ToolRegistry.js";
import { repairJson, safeStringify } from "../../plumbing/Plumbing.js";
import { PromptHarness, DevelopmentLoop, LayerContext } from "../../prompts.js";
import { Callbacks, RunTelemetry } from "../../domain/types.js";
import { orchestrator } from "./Orchestrator.js";
import { dbPool } from "../DbPool.js";
import { getLayer, validateLayering } from "../Validator.js";
import { scheduler } from "./Scheduler.js";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";

export class Engine {
  private currentStep: DevelopmentLoop = DevelopmentLoop.LIST;
  private lastOperation?: { tool: string; result: string; success: boolean };
  private streamId: string = "main-stream"; // Default for now

  constructor(private readonly provider: AIProvider) { }

  public async chatLoop(
    messages: any[],
    run: RunTelemetry,
    callbacks: Callbacks,
    signal?: AbortSignal,
  ): Promise<any> {
    dbPool.beginWork(this.streamId);

    while (true) {
      if (signal?.aborted) {
        dbPool.rollbackWork(this.streamId);
        throw new Error("Pass Aborted");
      }

      // Resolve orchestration context
      const activeStreams = await orchestrator.getActiveStreams();
      const streamContext = {
        streamId: this.streamId,
        focus: "Evolutionary Loop execution",
        activeDiffs: scheduler.getContext(), // Now shows the scheduler queue
        sharedLocks: [],
        activeStreams: activeStreams.map(s => ({ id: s.id, focus: s.focus }))
      };

      // Resolve context for the harness
      const activePath = messages.findLast((m) => m.role === "tool" && m.name === "read_file")?.path || "Unknown";
      let layerContext: LayerContext | undefined;
      try {
        const layer = getLayer(activePath);
        layerContext = {
          path: activePath,
          layer,
          constraints: [] // Constraints are now mechanically enforced by AstValidator
        };
      } catch {
        // Fallback or skip if not a valid layer path
      }

      const harness = new PromptHarness({
        layerContext,
        streamContext,
        currentStep: this.currentStep,
        lastOperation: this.lastOperation,
        telemetry: {
          memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          uptime: `${Math.round(process.uptime())}s`
        }
      });
      const systemPrompt = harness.generateSystemPrompt();

      const response = await this.provider.createMessage({
        model: "google/gemini-2.0-flash-001",
        system: systemPrompt,
        messages,
        tools: getRegisteredTools().map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: `${t.description} (IMPORTANT: Use strict JSON as defined in OUTPUT_SCHEMAS)`,
            parameters: t.input_schema,
          },
        })),
      });

      const content = response.content;
      const toolCalls = response.tool_calls || [];

      // MECHANICAL GUARD: Thinking Enforcement
      if (!content.includes("<thinking>")) {
        this.currentStep = DevelopmentLoop.ERROR_RECOVERY;
        this.lastOperation = { tool: "assistant_thinking", result: "ABSOLUTE BREACH: AI skipped mandatory <thinking> block.", success: false };
        messages.push({ role: "assistant", content: `Architectural Breach: Missing <thinking> block. Entering recovery.` });
        continue;
      }

      if (toolCalls.length === 0) return content;

      messages.push({ role: "assistant", content, tool_calls: toolCalls });

      for (const call of toolCalls) {
        // MECHANICAL GUARD: Loop Integrity Check
        const toolName = call.function.name;
        const validNextSteps: Record<DevelopmentLoop, string[]> = {
          [DevelopmentLoop.LIST]: ["list_files", "read_file"],
          [DevelopmentLoop.IDENTIFY]: ["read_file", "propose_diff", "list_files"],
          [DevelopmentLoop.PROPOSE]: ["propose_diff", "apply_change"],
          [DevelopmentLoop.APPLY]: ["apply_change", "list_files"],
          [DevelopmentLoop.RE_EVALUATE]: ["list_files", "read_file", "propose_diff"],
          [DevelopmentLoop.ERROR_RECOVERY]: ["list_files", "read_file", "propose_diff"]
        };

        if (!validNextSteps[this.currentStep].includes(toolName)) {
          this.currentStep = DevelopmentLoop.ERROR_RECOVERY;
          this.lastOperation = { tool: toolName, result: `ABSOLUTE BREACH: Illegal loop transition from ${this.currentStep} to ${toolName}.`, success: false };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: `Architectural Breach: Tool usage does not follow the evolutionary loop sequence.`
          });
          continue;
        }

        const tool = getTool(toolName);
        if (!tool) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: `Error: Tool '${call.function.name}' is deprecated or unauthorized. You must use the diff-native toolset.`,
          });
          continue;
        }

        try {
          const args =
            typeof call.function.arguments === "string"
              ? JSON.parse(repairJson(call.function.arguments).repaired)
              : call.function.arguments;

          callbacks.onProgress?.({
            type: "tool_start",
            tool: call.function.name,
            args,
          });
          const result = await tool.execute(
            args,
            (u) => callbacks.onProgress?.(u as any),
            signal,
          );

          // SOVEREIGN GUARD: Architectural Validation & Scheduling
          if (["propose_diff", "apply_change", "write_to_file", "multi_replace_file_content", "replace_file_content"].includes(toolName)) {
            const targetPath = args.path || args.targetFile || args.TargetFile;
            const targetContent = args.content || args.codeContent || args.CodeContent || (targetPath ? fs.readFileSync(targetPath, "utf-8") : "");

            if (targetPath) {
              const layer = getLayer(targetPath);

              if (toolName === "propose_diff") {
                // Register proposal with scheduler
                scheduler.propose({
                  id: uuidv4(),
                  agentId: this.streamId,
                  layer,
                  affectedFiles: [targetPath],
                  dependencies: [],
                  riskScore: 50 // Default risk for now
                });
              }

              if (toolName === "apply_change") {
                // Check with scheduler
                const executable = scheduler.getExecutableProposal(this.streamId);
                if (!executable || !executable.affectedFiles.includes(targetPath)) {
                  throw new Error(`CRITICAL SCHEDULING BREACH: Diff for ${targetPath} is currently blocked or not at the head of the queue. Layer context: ${layer}`);
                }
                scheduler.updateStatus(executable.id, "applied");
              }

              try {
                await validateLayering(targetPath, targetContent);
              } catch (e: any) {
                throw new Error(`CRITICAL ARCHITECTURAL BREACH: ${e.message}`);
              }
            }
          }

          // State Transition Logic
          if (call.function.name === "list_files") this.currentStep = DevelopmentLoop.IDENTIFY;
          if (call.function.name === "read_file") this.currentStep = DevelopmentLoop.IDENTIFY;
          if (call.function.name === "propose_diff") this.currentStep = DevelopmentLoop.APPLY;
          if (call.function.name === "apply_change") this.currentStep = DevelopmentLoop.RE_EVALUATE;

          this.lastOperation = { tool: call.function.name, result: typeof result === "string" ? result : safeStringify(result), success: true };

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: this.lastOperation.result,
            path: args.path // Store path for layer context retrieval
          });

          // Guidance Injection
          messages.push({
            role: "user",
            content: harness.generateContinuationPrompt()
          });

          callbacks.onProgress?.({
            type: "tool_end",
            tool: call.function.name,
            result,
          });
        } catch (e: any) {
          this.currentStep = DevelopmentLoop.ERROR_RECOVERY;
          this.lastOperation = { tool: call.function.name, result: e.message, success: false };

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: `Architectural Breach: ${e.message}`,
          });
        }
      }
    }
  }
}
