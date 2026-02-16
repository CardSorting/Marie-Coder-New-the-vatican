import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs/promises";

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
  public static async runLint(
    cwd: string,
    command: string = "npm run lint",
  ): Promise<LintError[]> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      return [];
    } catch (e: any) {
      const output = (e.stdout || "") + (e.stderr || "");
      return this.parseLintOutput(output, cwd);
    }
  }

  /**
   * Performs targeted linting on a specific file.
   * Attempts to detect the best tool (ESLint, TSC) for the job.
   */
  public static async runLintOnFile(
    cwd: string,
    filePath: string,
  ): Promise<LintError[]> {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;

    // 1. Try ESLint first if it's a TS/JS file
    if (/\.(ts|js|tsx|jsx)$/.test(relativePath)) {
      try {
        // Try to use the project's own lint script if it supports passing files,
        // otherwise use npx eslint directly.
        const { stdout, stderr } = await execAsync(
          `npx eslint "${relativePath}" --format stylish`,
          { cwd },
        );
        return [];
      } catch (e: any) {
        const output = (e.stdout || "") + (e.stderr || "");
        const errors = this.parseLintOutput(output, cwd);
        if (errors.length > 0) return errors;
      }
    }

    // 2. Fallback to full project lint if targeted failed or was unavailable
    return this.runLint(cwd);
  }

  /**
   * Attempts to automatically fix lint errors in a file.
   */
  public static async fixFile(
    cwd: string,
    filePath: string,
  ): Promise<{ success: boolean; output: string }> {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;

    if (/\.(ts|js|tsx|jsx)$/.test(relativePath)) {
      try {
        // Prefer npm run lint:fix if available, but ESLint --fix is more precise for single files
        const { stdout } = await execAsync(
          `npx eslint "${relativePath}" --fix`,
          { cwd },
        );
        return { success: true, output: stdout };
      } catch (e: any) {
        return { success: false, output: (e.stdout || "") + (e.stderr || "") };
      }
    }

    return {
      success: false,
      output: "Auto-fix not supported for this file type.",
    };
  }

  /**
   * Parses various lint output formats (ESLint, TSC).
   */
  private static parseLintOutput(output: string, cwd: string): LintError[] {
    const errors: LintError[] = [];
    const lines = output.split("\n");

    let currentFile = "";
    for (const line of lines) {
      // ESLint stylish file header
      const fileMatch = line.match(/^(\/[^ ]+|\w:[\/][^ ]+)$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      // ESLint stylish error line
      const errorMatch = line.match(
        /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z0-9\-/]+|)$/i,
      );
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

      // TSC format
      const tscMatch = line.match(
        /^(.+)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/,
      );
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

      // Generic unix format
      const genericMatch = line.match(
        /^([^:]+):(\d+):(\d+): (error|warning): (.+)$/,
      );
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
