import * as fs from "node:fs/promises";
import { LintError } from "./LintService.js";

/**
 * SURGICAL MENDER: High-precision code remediation.
 * Applies sub-atomic fixes to source code based on structured error data.
 */
export class SurgicalMender {
  /**
   * Applies surgical fixes to a file based on provided lint errors.
   */
  public static async mend(
    filePath: string,
    errors: LintError[],
  ): Promise<{ mended: boolean; fixedCount: number }> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    let fixedCount = 0;

    // Sort errors bottom-to-top to avoid offset issues
    const sortedErrors = [...errors].sort((a, b) => b.line - a.line);

    for (const err of sortedErrors) {
      const lineIdx = err.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) continue;

      let line = lines[lineIdx];
      const originalLine = line;

      // Precision Fix 1: Unused Variables (Prefix with _)
      if (
        err.message.includes("is defined but never used") ||
        err.message.includes("unused")
      ) {
        // Try to find the variable name in the error or line
        const varMatch = err.message.match(/'([^']+)'/);
        const varName = varMatch ? varMatch[1] : null;
        if (varName && line.includes(varName)) {
          line = line.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
        }
      }

      // Precision Fix 2: Prefer Const
      if (
        err.ruleId === "prefer-const" ||
        err.message.includes("should be a const")
      ) {
        line = line.replace(/\blet\b/, "const");
      }

      // Precision Fix 3: Missing Semicolon
      if (err.ruleId === "semi" && err.message.includes("Missing semicolon")) {
        if (!line.trim().endsWith(";")) {
          line = line.trimEnd() + ";";
        }
      }

      // Precision Fix 4: No Var
      if (err.ruleId === "no-var") {
        line = line.replace(/\bvar\b/, "let");
      }

      if (line !== originalLine) {
        lines[lineIdx] = line;
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      await fs.writeFile(filePath, lines.join("\n"), "utf-8");
      return { mended: true, fixedCount };
    }

    return { mended: false, fixedCount: 0 };
  }

  /**
   * Type-Sovereignty Guard: Strips 'as any' casts to force proper typing.
   * (Intimidatingly precise enforcement)
   */
  public static async enforceTypeSovereignty(
    filePath: string,
  ): Promise<number> {
    const content = await fs.readFile(filePath, "utf-8");
    const sovereignContent = content.replace(
      /\s+as\s+any\b/g,
      " /* 🚩 Type sovereignty breach corrected */",
    );

    if (content !== sovereignContent) {
      await fs.writeFile(filePath, sovereignContent, "utf-8");
      return 1;
    }
    return 0;
  }
}
