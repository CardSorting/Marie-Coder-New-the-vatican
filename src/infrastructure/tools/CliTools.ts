import { registerTool, getStringArg } from "./ToolRegistry.js";
import { exec } from "child_process";
import { promisify } from "util";
import { Automation } from "../Automation.js";

const execAsync = promisify(exec);

export function registerToolDefinitions(
  automation: Automation,
  workingDir: string,
) {
  registerTool({
    name: "run_command",
    description: "Execute a shell command. Subject to security audits.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
    execute: async (args) => {
      const command = getStringArg(args, "command");
      const { stdout, stderr } = await execAsync(command, { cwd: workingDir });
      return stdout + (stderr ? `\nstderr: ${stderr}` : "");
    },
  });
}
