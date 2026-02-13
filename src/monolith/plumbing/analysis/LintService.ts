import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";

const execAsync = promisify(exec);

export interface LintError {
  file: string;
  line: number;
  column: number;
  message: string;
  ruleId?: string;
  severity: "error" | "warning";
  source?: string;
}

export class LintService {
  /**
   * Executes a lint command and parses the output into structured LintError objects.
   */
  public static async runLint(cwd: string, command: string = "npm run lint"): Promise<LintError[]> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      // If it exits with 0, everything is fine
      return [];
    } catch (e: any) {
      const output = (e.stdout || "") + (e.stderr || "");
      return this.parseLintOutput(output, cwd);
    }
  }

  /**
   * Parses various lint output formats (ESLint, TSC).
   */
  private static parseLintOutput(output: string, cwd: string): LintError[] {
    const errors: LintError[] = [];
    const lines = output.split("\n");

    // Pattern 1: ESLint stylish format
    // /path/to/file.ts
    //   1:1  error  Message  rule-id
    let currentFile = "";
    for (const line of lines) {
      const fileMatch = line.match(/^(\/[^ ]+|\w:[\/][^ ]+)$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      const errorMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z0-9\-/]+|)$/i);
      if (errorMatch && currentFile) {
        errors.push({
          file: path.relative(cwd, currentFile),
          line: parseInt(errorMatch[1]),
          column: parseInt(errorMatch[2]),
          severity: errorMatch[3].toLowerCase() as any,
          message: errorMatch[4].trim(),
          ruleId: errorMatch[5] || undefined,
        });
      }

      // Pattern 2: TSC format
      // src/file.ts(1,1): error TS1234: Message
      const tscMatch = line.match(/^(.+)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/);
      if (tscMatch) {
        errors.push({
          file: tscMatch[1],
          line: parseInt(tscMatch[2]),
          column: parseInt(tscMatch[3]),
          severity: tscMatch[4].toLowerCase() as any,
          ruleId: tscMatch[5],
          message: tscMatch[6].trim(),
        });
      }
      
      // Pattern 3: Generic unix format
      // src/file.ts:1:1: error: Message
      const genericMatch = line.match(/^([^:]+):(\d+):(\d+): (error|warning): (.+)$/);
      if (genericMatch) {
        errors.push({
          file: genericMatch[1],
          line: parseInt(genericMatch[2]),
          column: parseInt(genericMatch[3]),
          severity: genericMatch[4].toLowerCase() as any,
          message: genericMatch[5].trim(),
        });
      }
    }

    return errors;
  }

  /**
   * Heuristically suggests a fix for common lint errors.
   */
  public static suggestFix(error: LintError): string | null {
    const msg = error.message.toLowerCase();
    
    if (msg.includes("unused") || msg.includes("is defined but never used")) {
      return `Remove unused declaration or prefix with underscore.`;
    }
    
    if (msg.includes("missing semicolon") || msg.includes("extra semicolon")) {
      return `Add or remove semicolon.`;
    }

    if (msg.includes("prefer-const") || msg.includes("should be a const")) {
      return `Change 'let' to 'const'.`;
    }

    if (msg.includes("no-var") || msg.includes("unexpected var")) {
      return `Change 'var' to 'let' or 'const'.`;
    }

    return null;
  }
}
