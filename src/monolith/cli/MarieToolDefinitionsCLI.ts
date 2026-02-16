import * as fsPromises from "fs/promises";
import * as path from "path";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import {
  getStringArg,
  getArrayArg,
} from "../infrastructure/tools/ToolUtils.js";
import { exec } from "child_process";
import { promisify } from "util";
import { RuntimeAutomationPort } from "../runtime/types.js";
import { registerSharedToolDefinitions } from "../infrastructure/tools/SharedToolDefinitions.js";
import { cherishFile, generateJoyDashboard } from "../domain/joy/JoyTools.js";
import { checkCodeHealth } from "../plumbing/analysis/CodeHealthService.js";
import { JoyAutomationServiceCLI } from "../cli/services/JoyAutomationServiceCLI.js";
import { LintService } from "../plumbing/analysis/LintService.js";
import { FileSystemPort } from "../infrastructure/ai/core/FileSystemPort.js";

const execAsync = promisify(exec);

async function readFile(
  filePath: string,
  startLine?: number,
  endLine?: number,
): Promise<string> {
  const content = await fsPromises.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  if (startLine && endLine) {
    return lines.slice(startLine - 1, endLine).join("\n");
  }
  return content;
}

async function writeFile(filePath: string, content: string): Promise<void> {
  if (process.env.MARIE_DEBUG) {
    console.log(`[CLI Debug] Writing to file: ${filePath}`);
  }
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, content, "utf-8");
}

async function deleteFile(filePath: string): Promise<void> {
  await fsPromises.unlink(filePath);
}

async function listFiles(dirPath: string): Promise<string> {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const files = entries.map((e) => {
      const icon = e.isDirectory() ? "📁" : "📄";
      return `${icon} ${e.name}${e.isDirectory() ? "/" : ""}`;
    });
    return files.join("\n") || "(empty directory)";
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function searchFiles(query: string, searchPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `grep -rn "${query.replace(/"/g, '\\"')}" "${searchPath}" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.json" --include="*.md" 2>/dev/null | head -50`,
    );
    return stdout || "No matches found";
  } catch {
    return "No matches found";
  }
}

async function getGitStatus(root: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git status --short", { cwd: root });
    return stdout || "Working tree clean";
  } catch {
    return "Not a git repository";
  }
}

async function getGitDiff(root: string, staged: boolean): Promise<string> {
  try {
    const cmd = staged ? "git diff --staged" : "git diff";
    const { stdout } = await execAsync(cmd, { cwd: root });
    return stdout || "No changes";
  } catch {
    return "Unable to get diff";
  }
}

async function runCommand(command: string, cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    return stdout + (stderr ? `\nstderr: ${stderr}` : "");
  } catch (e: any) {
    return `Error: ${e.message}\n${e.stdout || ""}\n${e.stderr || ""}`;
  }
}

async function getFolderTree(
  dirPath: string,
  maxDepth: number = 3,
): Promise<string> {
  async function buildTree(
    currentPath: string,
    depth: number,
    prefix: string,
  ): Promise<string> {
    if (depth > maxDepth) return "";

    try {
      const entries = await fsPromises.readdir(currentPath, {
        withFileTypes: true,
      });
      const visible = entries.filter(
        (e) => !e.name.startsWith(".") && !e.name.includes("node_modules"),
      );
      let result = "";

      for (let i = 0; i < visible.length; i++) {
        const e = visible[i];
        const isLast = i === visible.length - 1;
        const connector = isLast ? "└── " : "├── ";
        result += `${prefix}${connector}${e.name}${e.isDirectory() ? "/" : ""}\n`;

        if (e.isDirectory()) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          result += await buildTree(
            path.join(currentPath, e.name),
            depth + 1,
            newPrefix,
          );
        }
      }
      return result;
    } catch {
      return "";
    }
  }

  const name = path.basename(dirPath);
  return `${name}/\n${await buildTree(dirPath, 1, "")}`;
}

async function foldCodeCLI(filePath: string): Promise<string> {
  return `File '${path.basename(filePath)}' has been mentally folded. (CLI mode: structural formatting preserved)`;
}

export function registerMarieToolsCLI(
  registry: ToolRegistry,
  _automationService: RuntimeAutomationPort,
  workingDir: string,
  fsPort: FileSystemPort,
) {
  const automation = _automationService as JoyAutomationServiceCLI;

  registerSharedToolDefinitions(
    registry,
    {
      resolvePath: (p: string) =>
        path.isAbsolute(p) ? p : path.join(workingDir, p),
      writeFile: async (p, content, signal, onProgress) =>
        await fsPort.writeFile(p, content, signal, onProgress),
      appendFile: async (p, content, signal, onProgress) =>
        await fsPort.appendFile(p, content, signal, onProgress),
      readFile: async (p, start, end) => await readFile(p, start, end),
      listDir: async (p) => await listFiles(p),
      grepSearch: async (q, p) => await searchFiles(q, p),
      getGitContext: async () => {
        const [status, staged, unstaged] = await Promise.all([
          getGitStatus(workingDir),
          getGitDiff(workingDir, true),
          getGitDiff(workingDir, false),
        ]);
        return `# Git Context\n\n## Status\n\`\`\`\n${status}\n\`\`\`\n\n## Staged Changes\n\`\`\`\n${staged}\n\`\`\`\n\n## Unstaged Changes\n\`\`\`\n${unstaged}\n\`\`\``;
      },
      runCommand: async (cmd) => await runCommand(cmd, workingDir),
      getFolderStructure: async (p, depth) => await getFolderTree(p, depth),
      replaceInFile: async (p, s, r) => {
        if (process.env.MARIE_DEBUG) {
          console.log(`[CLI Debug] Replacing in file: ${p}`);
        }
        const content = await fsPromises.readFile(p, "utf-8");
        if (!content.includes(s)) {
          return `Error: Search text not found in file`;
        }
        const newContent = content.split(s).join(r);
        await fsPromises.writeFile(p, newContent, "utf-8");
        return `Replaced ${content.split(s).length - 1} occurrence(s) in ${p}`;
      },
    },
    { includeExtended: true },
  );

  registry.register({
    name: "delete_file",
    description: "Delete a file.",
    isDestructive: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to delete" },
      },
      required: ["path"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "path");
      const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
      await deleteFile(fullPath);
      return `Deleted ${fullPath}`;
    },
  });

  registry.register({
    name: "perform_strategic_planning",
    description:
      "A mandatory planning ritual. Call this at the start of any complex task.",
    input_schema: {
      type: "object",
      properties: {
        intent: { type: "string" },
        joyZone: { type: "string" },
        projectName: { type: "string" },
        lifecycleStage: { type: "string" },
        objectives: { type: "array", items: { type: "object" } },
        ritualChecked: { type: "boolean" },
        gratitudeMoment: { type: "string" },
        totalPasses: { type: "number" },
        passFocus: { type: "string" },
      },
      required: ["intent", "totalPasses", "passFocus"],
    },
    execute: async (args, onProgress) => {
      const intent = getStringArg(args, "intent");
      const projectName = getStringArg(args, "projectName");
      onProgress?.({
        context: `Mindfulness: ${intent}`,
        achieved: [`Planning for ${projectName}`],
        ritualComplete: true,
        currentPass: 1,
        totalPasses: (args.totalPasses as any) || 1,
        passFocus: getStringArg(args, "passFocus"),
      } as any);
      return `Strategic Plan for '${projectName}' accepted in CLI. ✨`;
    },
  });

  registry.register({
    name: "checkpoint_pass",
    description:
      "Explicitly end a pass, summarize achievements, and orient for the next pass.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        reflection: { type: "string" },
        nextPassFocus: { type: "string" },
        isFinalPass: { type: "boolean" },
      },
      required: ["summary", "nextPassFocus", "isFinalPass"],
    },
    execute: async (args, onProgress) => {
      const summary = getStringArg(args, "summary");
      onProgress?.({
        context: `Checkpoint: ${summary}`,
        achieved: [`Completed Pass: ${summary}`],
        currentPass: args.isFinalPass ? null : undefined,
        passFocus: args.isFinalPass
          ? undefined
          : getStringArg(args, "nextPassFocus"),
      } as any);
      return `Pass internal checkpoint reached in CLI.`;
    },
  });

  registry.register({
    name: "complete_task_ritual",
    description: "A final ritual to conclude a large task.",
    input_schema: {
      type: "object",
      properties: {
        finalSummary: { type: "string" },
        gratitude: { type: "string" },
      },
      required: ["finalSummary"],
    },
    execute: async (args, onProgress) => {
      const summary = getStringArg(args, "finalSummary");
      onProgress?.({
        context: `Bloom Ritual: ${summary}`,
        achieved: [`Task Completed: ${summary}`],
        ritualComplete: true,
      } as any);
      return `Task Bloom Ritual complete in CLI. ✨`;
    },
  });

  registry.register({
    name: "update_run_objectives",
    description: "Update the current run's objectives and progress context.",
    input_schema: {
      type: "object",
      properties: {
        context: { type: "string" },
        completedObjectiveIds: { type: "array", items: { type: "string" } },
        activeObjectiveId: { type: "string" },
      },
      required: ["context"],
    },
    execute: async (args, onProgress) => {
      onProgress?.({
        context: getStringArg(args, "context"),
        completedObjectiveIds: getArrayArg<string>(
          args,
          "completedObjectiveIds",
        ),
        activeObjectiveId: getStringArg(args, "activeObjectiveId"),
      } as any);
      return `Progress updated in CLI.`;
    },
  });

  registry.register({
    name: "augment_roadmap",
    description:
      "Insert a new pass into the current roadmap. Use this when significant unexpected complexity is discovered.",
    input_schema: {
      type: "object",
      properties: {
        addedPassCount: {
          type: "number",
          description: "How many passes to add (usually 1)",
        },
        newPassFocus: {
          type: "string",
          description: "The focus for the upcoming augmented pass",
        },
        reason: {
          type: "string",
          description:
            "Why is the roadmap being augmented? (Mindfulness discovery)",
        },
      },
      required: ["addedPassCount", "newPassFocus", "reason"],
    },
    execute: async (args, onProgress) => {
      const count = args.addedPassCount as number;
      const focus = getStringArg(args, "newPassFocus");
      const reason = getStringArg(args, "reason");

      onProgress?.({
        context: `Roadmap Augmented: ${reason}`,
        achieved: [`Calibrated roadmap: +${count} pass(es)`],
        totalPasses: count as any,
        passFocus: focus,
      } as any);

      return `Roadmap augmented with ${count} additional pass(es). Reason: ${reason}`;
    },
  });

  registry.register({
    name: "execute_genesis_ritual",
    description: "Convert an entire project to the JOY structure.",
    input_schema: { type: "object", properties: {} },
    execute: async () => await automation.triggerGenesis(),
  });

  registry.register({
    name: "sow_joy_feature",
    description: "Scaffold a new feature structure across all JOY zones.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        intent: { type: "string" },
      },
      required: ["name", "intent"],
    },
    execute: async (args) =>
      await automation.sowJoyFeature(
        getStringArg(args, "name"),
        getStringArg(args, "intent"),
      ),
  });

  registry.register({
    name: "perform_garden_pulse",
    description: "Deep audit of project structure and scaffolding.",
    input_schema: { type: "object", properties: {} },
    execute: async () => await automation.performGardenPulse(),
  });

  registry.register({
    name: "execute_joy_maintenance",
    description:
      "Perform autonomous maintenance on the garden structure (Restoration Ritual).",
    isDestructive: true,
    input_schema: { type: "object", properties: {} },
    execute: async () => await automation.executeAutonomousRestoration(),
  });

  registry.register({
    name: "fold_file",
    description: "Format and organize imports in a file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "path");
      const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
      return await foldCodeCLI(fullPath);
    },
  });

  registry.register({
    name: "cherish_file",
    description: "Update the timestamp of a 'Sentimental' file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "path");
      const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
      return await cherishFile(fullPath);
    },
  });

  registry.register({
    name: "check_code_health",
    description: "Analyze a file for complexity and technical debt.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "path");
      const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
      return JSON.stringify(await checkCodeHealth(fullPath));
    },
  });

  registry.register({
    name: "generate_joy_dashboard",
    description: "Generate a JOY.md dashboard for the workspace.",
    input_schema: {
      type: "object",
      properties: { rootPath: { type: "string" } },
      required: ["rootPath"],
    },
    execute: async (args) => {
      const p = getStringArg(args, "rootPath");
      const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
      return await generateJoyDashboard(fullPath);
    },
  });

  registry.register({
    name: "resolve_lint_errors",
    description:
      "Run linting and receive structured errors with suggested fixes for the entire project or specific files.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "Optional custom lint command (defaults to npm run lint)",
        },
      },
    },
    execute: async (args) => {
      const cmd = (args.command as string) || "npm run lint";
      const errors = await LintService.runLint(workingDir, cmd);

      if (errors.length === 0) {
        return "No lint errors found. The codebase is healthy. ✨";
      }

      let result = `# Linting Report (${errors.length} errors found)
\n`;
      errors.forEach((err, i) => {
        const fix = LintService.suggestFix(err);
        result += `### Error ${i + 1}: ${err.file}:${err.line}:${err.column}
- **Rule**: ${err.ruleId || "unknown"}
- **Message**: ${err.message}
- **Suggested Fix**: ${fix || "No automatic suggestion. Please investigate manually."}
\n`;
      });

      result += `\n**Instructions**: Use 'read_file' to examine the code around these locations and 'replace_file_content' to apply fixes surgically.`;
      return result;
    },
  });

  registry.register({
    name: "self_heal",
    description:
      "Autonomous systemic recovery. Marie will audit the project for errors and attempt to suggest or apply fixes.",
    isDestructive: true,
    input_schema: { type: "object", properties: {} },
    execute: async () => {
      const errors = await LintService.runLint(workingDir);
      if (errors.length === 0) {
        return "Marie's audit found no systemic issues. Structural harmony is maintained. ✨";
      }

      let result = `# 🧬 Autonomous Recovery Protocol Initiated
\nFound ${errors.length} stability alerts in the codebase.
\n`;

      const files = Array.from(new Set(errors.map((e) => e.file)));
      result += `**Impacted Files**:
${files.map((f) => `- ${f}`).join("\n")}
\n`;

      result += `Please use 'resolve_lint_errors' to see the full triage report and begin surgical remediation.`;
      return result;
    },
  });
}
