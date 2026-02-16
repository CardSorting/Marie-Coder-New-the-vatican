import { LintService, LintError } from "./LintService.js";
import { TestService, TriageReport } from "./TestService.js";
import { ComplexityService, ComplexityMetrics } from "./ComplexityService.js";
import { SurgicalMender } from "./SurgicalMender.js";
import { MarieSentinelService } from "./MarieSentinelService.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface GuardrailResult {
  passed: boolean;
  score: number;
  violations: string[];
  autoFixed: boolean;
  surgicalMends: number;
  metrics: {
    lintErrors: number;
    complexity: number;
    testsPassed: boolean | null;
    zoningHealthy: boolean;
    typeSovereignty: boolean;
    entropy: number;
  };
}

/**
 * PRODUCTION GUARDRAIL: Sub-Atomic Integrity Edition.
 * Marie's final word on whether code is worthy of the Garden.
 */
export class QualityGuardrailService {
  /**
   * Evaluates a modified file against production-level quality standards with surgical precision.
   */
  public static async evaluate(
    cwd: string,
    filePath: string,
  ): Promise<GuardrailResult> {
    const violations: string[] = [];
    let passed = true;
    let autoFixed = false;
    let surgicalMends = 0;

    // 1. TYPE SOVEREIGNTY (Surgical Enforcement) - Do this first as it modifies the file
    surgicalMends += await SurgicalMender.enforceTypeSovereignty(filePath);

    // 2. LINTING & SURGICAL MENDING - May also modify the file
    let lintErrors = await LintService.runLintOnFile(cwd, filePath);

    if (lintErrors.length > 0) {
      // Step A: Attempt standard fixer (ESLint --fix)
      const fixResult = await LintService.fixFile(cwd, filePath);
      if (fixResult.success) autoFixed = true;

      // Step B: Apply high-precision surgical mending
      const mendResult = await SurgicalMender.mend(filePath, lintErrors);
      if (mendResult.mended) {
        surgicalMends += mendResult.fixedCount;
        // Re-scan after surgical intervention
        lintErrors = await LintService.runLintOnFile(cwd, filePath);
      }
    }

    const finalCriticalLint = lintErrors.filter((e) => e.severity === "error");
    if (finalCriticalLint.length > 0) {
      passed = false;
      violations.push(
        `Lint Regression: ${finalCriticalLint.length} persistent error(s) found.`,
      );
    }

    // 3. PARALLEL ANALYTICAL AUDIT
    // Run expensive analytical checks in parallel once modifications are complete
    const [sentinelReport, complexity, testReport, content] = await Promise.all(
      [
        MarieSentinelService.audit(cwd, filePath),
        ComplexityService.analyze(filePath),
        TestService.runTargetedTests(cwd, filePath),
        fs.readFile(filePath, "utf-8"),
      ],
    );

    // Sentinel Violations
    if (sentinelReport.zoneViolations.length > 0) {
      violations.push(...sentinelReport.zoneViolations);
      passed = false;
    }
    if (sentinelReport.circularDependencies.length > 0) {
      violations.push(...sentinelReport.circularDependencies);
      passed = false;
    }
    if (sentinelReport.leakyAbstractions.length > 0) {
      violations.push(...sentinelReport.leakyAbstractions);
      passed = false;
    }
    if (sentinelReport.duplication.length > 0) {
      violations.push(...sentinelReport.duplication);
      passed = false;
    }

    // Entropy Ratchet
    if (sentinelReport.entropyDelta > 0) {
      violations.push(
        `RATCHET LOCK: Entropy increased by +${sentinelReport.entropyDelta}. Changes must maintain or lower entropy.`,
      );
      passed = false;
    }

    if (
      sentinelReport.quarantineCandidates.includes(path.relative(cwd, filePath))
    ) {
      violations.push(
        `TOXICITY ALERT: This file is a quarantine candidate. Immediate refactor required.`,
      );
      passed = false;
    }

    // Complexity Violations
    if (complexity.clutterLevel === "Toxic") {
      passed = false;
      violations.push(
        `Complexity Alert: Cyclomatic complexity (${complexity.cyclomaticComplexity}) exceeds production safety limits.`,
      );
    }

    // Type Sovereignty (Any check)
    const anyUsage = (content.match(/:\s*any\b|as\s+any\b|<\s*any\s*>/gi) || [])
      .length;
    if (anyUsage > 0) {
      passed = false;
      violations.push(
        `Type Sovereignty Breach: ${anyUsage} instance(s) of 'any' detected. Be more precise.`,
      );
    }

    // Test Regression Violations
    if (testReport && !testReport.success) {
      passed = false;
      violations.push(
        `Test Regression: ${testReport.failedTests.length} related test(s) failed.`,
      );
    }

    // Scoring (0-100)
    let score = 100;
    score -= sentinelReport.zoneViolations.length * 15;
    score -= sentinelReport.circularDependencies.length * 20;
    score -= sentinelReport.leakyAbstractions.length * 10;
    score -= sentinelReport.duplication.length * 10;
    score -= sentinelReport.entropyDelta > 0 ? 50 : 0;
    score -= finalCriticalLint.length * 10;
    score -= complexity.cyclomaticComplexity > 10 ? 20 : 0;
    score -= anyUsage * 5;
    if (testReport && !testReport.success) score -= 40;
    score = Math.max(0, score);

    return {
      passed,
      score,
      violations,
      autoFixed,
      surgicalMends,
      metrics: {
        lintErrors: finalCriticalLint.length,
        complexity: complexity.cyclomaticComplexity,
        testsPassed: testReport ? testReport.success : null,
        zoningHealthy: sentinelReport.zoneViolations.length === 0,
        typeSovereignty: anyUsage === 0,
        entropy: sentinelReport.entropyScore,
      },
    };
  }
}
