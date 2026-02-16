import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const execAsync = promisify(exec);

export interface TriageReport {
  success: boolean;
  totalTests: number;
  failedTests: string[];
  errors: string[];
  rawOutput: string;
}

export class TestService {
  /**
   * Executes a test suite and parses the output into a structured Triage Report.
   */
  public static async runAndTriage(
    command: string,
    cwd: string = process.cwd(),
  ): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      const rawOutput = stdout + stderr;
      const report = this.parseOutput(rawOutput);

      let result = `# 🏥 Test Triage Report\n\n`;
      result += `**Status**: ${report.success ? "Success ✨" : "Regressions Detected ⚠️"}\n`;

      if (!report.success) {
        result += `\n## ❌ Failing Tests\n`;
        report.failedTests.forEach((t) => (result += `- \`${t}\`\n`));

        result += `\n## 🔍 Top Errors\n`;
        report.errors
          .slice(0, 3)
          .forEach((e) => (result += `\`\`\`\n${e}\n\`\`\`\n`));
      } else {
        result += `\nAll tests passed across the target suite. The project remains stable. ✨\n`;
      }

      return result;
    } catch (error: any) {
      const rawOutput = (error.stdout || "") + (error.stderr || "");
      const report = this.parseOutput(rawOutput);
      if (report.failedTests.length > 0) {
        // It failed because of test failures, not a crash
        let result = `# 🏥 Test Triage Report\n\n`;
        result += `**Status**: Regressions Detected ⚠️\n`;
        result += `\n## ❌ Failing Tests\n`;
        report.failedTests.forEach((t) => (result += `- \`${t}\`\n`));
        return result;
      }
      return `Failed to execute test suite: ${error.message}\n${rawOutput}`;
    }
  }

  /**
   * Discovers and runs tests related to a specific file.
   */
  public static async runTargetedTests(
    cwd: string,
    filePath: string,
  ): Promise<TriageReport | null> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const testPattern = `**/${fileName}*test*`;

    // Simple heuristic: look for neighboring test files or in a 'tests' folder
    const possibleTestFiles = [
      path.join(path.dirname(filePath), `${fileName}.test.ts`),
      path.join(path.dirname(filePath), `${fileName}.spec.ts`),
      path.join(path.dirname(filePath), "tests", `${fileName}.test.ts`),
      path.join(cwd, "tests", `${fileName}.test.ts`),
    ];

    for (const testFile of possibleTestFiles) {
      try {
        await fs.access(testFile);
        const { stdout, stderr } = await execAsync(
          `npm test -- "${testFile}"`,
          { cwd },
        );
        return this.parseOutput(stdout + stderr);
      } catch (e: any) {
        if (e.code === "ENOENT") continue;
        return this.parseOutput((e.stdout || "") + (e.stderr || ""));
      }
    }

    return null; // No targeted tests found
  }

  private static parseOutput(output: string): TriageReport {
    const failedTests: string[] = [];
    const errors: string[] = [];

    const lines = output.split("\n");
    let capturingError = false;
    let currentError = "";

    for (const line of lines) {
      if (
        line.includes(" ❌ ") ||
        line.includes(" FAIL ") ||
        line.includes("FAILED")
      ) {
        failedTests.push(line.trim());
      }

      if (line.includes("AssertionError") || line.includes("Error: ")) {
        capturingError = true;
        currentError = line.trim() + "\n";
      } else if (capturingError) {
        if (line.trim() === "" || line.startsWith("      at ")) {
          currentError += line + "\n";
        } else {
          errors.push(currentError.trim());
          capturingError = false;
        }
      }
    }

    return {
      success:
        failedTests.length === 0 && output.toLowerCase().includes("pass"),
      totalTests: lines.length,
      failedTests,
      errors,
      rawOutput: output,
    };
  }
}
