import { getStringArg, getOptionalStringArg } from "./ToolUtils.js";
import { ToolRegistry } from "./ToolRegistry.js";

export interface SharedToolRuntime {
  resolvePath(path: string): string;
  writeFile(path: string, content: string, signal?: AbortSignal, onProgress?: (bytes: number) => void): Promise<void>;
  readFile(
    path: string,
    startLine?: number,
    endLine?: number,
    signal?: AbortSignal,
  ): Promise<string>;
  listDir(path: string, signal?: AbortSignal): Promise<string>;
  grepSearch(
    query: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<string>;
  getGitContext(): Promise<string>;
  runCommand?(command: string, signal?: AbortSignal): Promise<string>;
  getFolderStructure?(
    path: string,
    depth?: number,
    signal?: AbortSignal,
  ): Promise<string>;
  replaceInFile?(
    path: string,
    search: string,
    replace: string,
    signal?: AbortSignal,
  ): Promise<string>;
}

export function registerSharedToolDefinitions(
  registry: ToolRegistry,
  runtime: SharedToolRuntime,
  options?: { includeExtended?: boolean },
) {
  registry.register({
    name: "write_to_file",
    description: "Write content to a file.",
    isDestructive: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        targetFile: { type: "string", description: "Alias for path" },
        content: { type: "string", description: "The content to write" },
      },
      required: ["content"],
    },
    execute: async (args, _onProgress, signal) => {
      const p =
        getOptionalStringArg(args, "path") ||
        getOptionalStringArg(args, "targetFile");
      if (!p)
        throw new Error("Missing required argument: path (or targetFile)");

      const content =
        getOptionalStringArg(args, "content") ||
        getOptionalStringArg(args, "fileContent");
      if (content === undefined)
        throw new Error("Missing required argument: content (or fileContent)");

      const resolvedPath = runtime.resolvePath(p);
      await runtime.writeFile(resolvedPath, content, signal, (bytesWritten) => {
        _onProgress?.({ path: resolvedPath, bytesWritten });
      });
      return `File successfully updated: ${resolvedPath}`;
    },
  });

  registry.register({
    name: "read_file",
    description: "Read the content of a file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        startLine: {
          type: "number",
          description: "First line to read (1-indexed)",
        },
        endLine: {
          type: "number",
          description: "Last line to read (1-indexed)",
        },
      },
      required: ["path"],
    },
    execute: async (args, onProgress, signal) => {
      const p = runtime.resolvePath(getStringArg(args, "path"));
      const start = args.startLine as number | undefined;
      const end = args.endLine as number | undefined;
      return await runtime.readFile(p, start, end, signal);
    },
  });

  registry.register({
    name: "list_dir",
    description: "List files and directories in a path.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
    execute: async (args, onProgress, signal) => {
      const p = runtime.resolvePath(getStringArg(args, "path"));
      return await runtime.listDir(p, signal);
    },
  });

  registry.register({
    name: "grep_search",
    description: "Search for text patterns in files.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search pattern" },
        path: { type: "string", description: "Path to search in" },
      },
      required: ["query"],
    },
    execute: async (args, onProgress, signal) => {
      const q = getStringArg(args, "query");
      const rawPath = getStringArg(args, "path") || process.cwd();
      const p = runtime.resolvePath(rawPath);
      return await runtime.grepSearch(q, p, signal);
    },
  });

  registry.register({
    name: "get_git_context",
    description: "Get git status and diffs.",
    input_schema: { type: "object", properties: {} },
    execute: async () => await runtime.getGitContext(),
  });

  if (!options?.includeExtended) return;

  if (runtime.runCommand) {
    registry.register({
      name: "run_command",
      description: "Execute a shell command.",
      isDestructive: true,
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
      execute: async (args, onProgress, signal) => {
        const cmd = getStringArg(args, "command");
        return await runtime.runCommand!(cmd, signal);
      },
    });
  }

  if (runtime.getFolderStructure) {
    registry.register({
      name: "get_folder_structure",
      description: "Get a tree view of a directory structure.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path" },
          depth: { type: "number", description: "Maximum depth" },
        },
        required: ["path"],
      },
      execute: async (args, onProgress, signal) => {
        const p = runtime.resolvePath(getStringArg(args, "path"));
        const depth = args.depth as number | undefined;
        return await runtime.getFolderStructure!(p, depth, signal);
      },
    });
  }

  if (runtime.replaceInFile) {
    registry.register({
      name: "replace_file_content",
      description:
        "Replace a specific string with another in a file. Surgical and mindful.",
      isDestructive: true,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          targetFile: { type: "string", description: "Alias for path" },
          targetContent: {
            type: "string",
            description: "Text to find (alias for search)",
          },
          replacementContent: {
            type: "string",
            description: "Replacement text (alias for replace)",
          },
          search: { type: "string", description: "Text to find" },
          replace: { type: "string", description: "Replacement text" },
        },
        required: ["path"],
      },
      execute: async (args, _onProgress, signal) => {
        const p =
          getOptionalStringArg(args, "path") ||
          getOptionalStringArg(args, "targetFile");
        if (!p)
          throw new Error("Missing required argument: path (or targetFile)");

        const search =
          getOptionalStringArg(args, "targetContent") ||
          getOptionalStringArg(args, "search");
        if (search === undefined)
          throw new Error(
            "Missing required argument: targetContent (or search)",
          );

        const replace =
          getOptionalStringArg(args, "replacementContent") ||
          getOptionalStringArg(args, "replace");
        if (replace === undefined)
          throw new Error(
            "Missing required argument: replacementContent (or replace)",
          );

        if (runtime.replaceInFile) {
          return await runtime.replaceInFile(
            runtime.resolvePath(p),
            search,
            replace,
            signal,
          );
        }

        const resolvedPath = runtime.resolvePath(p);
        const content = await runtime.readFile(
          resolvedPath,
          undefined,
          undefined,
          signal,
        );
        if (!content.includes(search)) {
          return `Error: Could not find target content in ${p}. No changes made.`;
        }

        const occurrences = content.split(search).length - 1;
        const newContent = content.split(search).join(replace);
        await runtime.writeFile(resolvedPath, newContent, signal);

        return `Replaced ${occurrences} occurrence(s) of target content in ${p}.`;
      },
    });

    registry.register({
      name: "multi_replace_file_content",
      description: "Apply multiple replacements to a single file at once.",
      isDestructive: true,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          targetFile: { type: "string" },
          replacementChunks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                targetContent: { type: "string" },
                replacementContent: { type: "string" },
              },
              required: ["targetContent", "replacementContent"],
            },
          },
        },
        required: ["replacementChunks"],
      },
      execute: async (args, onProgress, signal) => {
        const pathRaw =
          getOptionalStringArg(args, "path") ||
          getOptionalStringArg(args, "targetFile");
        if (!pathRaw)
          throw new Error("Missing required argument: path (or targetFile)");

        const p = runtime.resolvePath(pathRaw);
        const chunks = args.replacementChunks as any[];
        let result = "";
        let totalBytesWritten = 0;
        for (const chunk of chunks) {
          const r = await runtime.replaceInFile!(
            p,
            chunk.targetContent,
            chunk.replacementContent,
            signal,
          );
          // Approximate progress for multi-replace by using length of replacement
          totalBytesWritten += chunk.replacementContent.length;
          onProgress?.({ path: p, bytesWritten: totalBytesWritten });
          result += r + "\n";
        }
        return result;
      },
    });
  }
}
