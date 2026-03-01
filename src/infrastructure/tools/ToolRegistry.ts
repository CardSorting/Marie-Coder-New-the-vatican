import {
  resolvePath,
  writeFile,
  readFile,
  safeStringify,
} from "../../plumbing/Plumbing.js";
import { validateLayering } from "../Validator.js";

export type JsonObjectSchema = Record<string, any>;

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
  execute: (
    args: Record<string, unknown>,
    onProgress?: (update: any) => void,
    signal?: AbortSignal,
  ) => Promise<string>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
}

const globalTools = new Map<string, ToolDefinition>();
let cachedRegisteredTools: RegisteredTool[] | null = null;

export function registerTool(tool: ToolDefinition) {
  globalTools.set(tool.name, tool);
  cachedRegisteredTools = null;
}

export function getTool(name: string): ToolDefinition | undefined {
  return globalTools.get(name);
}

export function getRegisteredTools(): RegisteredTool[] {
  if (!cachedRegisteredTools) {
    cachedRegisteredTools = Array.from(globalTools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }
  return cachedRegisteredTools;
}

export function getStringArg(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (value === undefined || value === null)
    throw new Error(`Missing required argument: ${key}`);
  return String(value);
}

export function registerCoreTools() {
  registerTool({
    name: "propose_diff",
    description:
      "Analyze requirement and propose architectural changes. Must be called before any modifications.",
    input_schema: {
      type: "object",
      properties: {
        analysis: {
          type: "object",
          properties: {
            goal: { type: "string" },
            affected_files: { type: "array", items: { type: "string" } },
            layer_impact: {
              type: "object",
              properties: {
                domain: { type: "array", items: { type: "string" } },
                infrastructure: { type: "array", items: { type: "string" } },
                plumbing: { type: "array", items: { type: "string" } },
                ui: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["goal", "affected_files", "layer_impact"],
        },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { enum: ["create", "modify", "delete"] },
              path: { type: "string" },
              summary: { type: "string" },
            },
            required: ["type", "path", "summary"],
          },
        },
      },
      required: ["analysis", "operations"],
    },
    execute: async (args) => {
      return `Architectural proposal accepted. Proceed to apply changes atomicly.\nPlan: ${safeStringify(args.analysis, 2)}`;
    },
  });

  registerTool({
    name: "apply_change",
    description: "Apply a single validated file creation or modification.",
    input_schema: {
      type: "object",
      properties: {
        type: { enum: ["create", "modify"] },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["type", "path", "content"],
    },
    execute: async (args) => {
      const pathStr = getStringArg(args, "path");
      const contentStr = getStringArg(args, "content");

      // ARCHITECTURAL VALIDATION
      validateLayering(pathStr, contentStr);

      const resolvedPath = resolvePath(pathStr);
      await writeFile(resolvedPath, contentStr);
      return `Change applied to ${pathStr}. Architectural integrity verified.`;
    },
  });

  registerTool({
    name: "read_file",
    description: "Read a file's content. Mandatory before modify operations.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "path");
      return await readFile(p);
    },
  });

  registerTool({
    name: "list_files",
    description: "List files in the project to ground context.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    execute: async (args) => {
      const { listFiles } = await import("../../plumbing/Plumbing.js");
      return await listFiles(getStringArg(args, "path"));
    },
  });
}
