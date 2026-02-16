import { ProgressUpdate } from "../../domain/marie/MarieTypes.js";
import type { JsonObjectSchema } from "../ai/providers/AIProvider.js";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
  isDestructive?: boolean;
  execute: (
    args: Record<string, unknown>,
    onProgress?: (update: ProgressUpdate) => void,
    signal?: AbortSignal,
  ) => Promise<string>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private cachedRegisteredTools: RegisteredTool[] | null = null;

  register(tool: ToolDefinition) {
    if (process.env.MARIE_DEBUG) {
      console.log(`[ToolRegistry] Registering tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.cachedRegisteredTools = null; // Invalidate cache
  }

  getTool(name: string): ToolDefinition | undefined {
    const tool = this.tools.get(name);
    if (process.env.MARIE_DEBUG) {
      console.log(`[ToolRegistry] Getting tool: ${name}, found: ${!!tool}`);
    }
    return tool;
  }

  getTools(): RegisteredTool[] {
    if (!this.cachedRegisteredTools) {
      this.cachedRegisteredTools = Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }
    return this.cachedRegisteredTools;
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    onProgress?: (update: ProgressUpdate) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return await tool.execute(args, onProgress, signal);
  }
}
