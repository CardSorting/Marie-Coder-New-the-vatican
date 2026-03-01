import { AIProvider } from "./AIProvider.js";
import { getTool, getRegisteredTools } from "../tools/ToolRegistry.js";
import { repairJson, safeStringify } from "../../plumbing/Plumbing.js";
import { getSystemPrompt } from "../../prompts.js";
import { Callbacks, RunTelemetry } from "../../domain/types.js";

export class Engine {
  constructor(private readonly provider: AIProvider) { }

  public async chatLoop(
    messages: any[],
    run: RunTelemetry,
    callbacks: Callbacks,
    signal?: AbortSignal,
  ): Promise<any> {
    const systemPrompt = getSystemPrompt();

    while (true) {
      if (signal?.aborted) throw new Error("Pass Aborted");

      const response = await this.provider.createMessage({
        model: "google/gemini-2.0-flash-001",
        system: systemPrompt,
        messages,
        tools: getRegisteredTools().map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        })),
      });

      const content = response.content;
      const toolCalls = response.tool_calls || [];

      if (toolCalls.length === 0) return content;

      messages.push({ role: "assistant", content, tool_calls: toolCalls });

      for (const call of toolCalls) {
        const tool = getTool(call.function.name);
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

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content:
              typeof result === "string" ? result : safeStringify(result),
          });

          callbacks.onProgress?.({
            type: "tool_end",
            tool: call.function.name,
            result,
          });
        } catch (e: any) {
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
