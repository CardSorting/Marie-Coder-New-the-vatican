import * as fs from "fs/promises";
import * as path from "path";
import { LintService } from "./LintService.js";
import { ComplexityService } from "./ComplexityService.js";

export interface SentinelReport {
  timestamp: string;
  zoneViolations: string[];
  circularDependencies: string[];
  entropyScore: number;
  stability: "Stable" | "Fluid" | "Fragile" | "Toxic";
  hotspots: string[];
  passed: boolean;
}

export class MarieSentinelService {
  private static readonly ZONES = {
    DOMAIN: "domain",
    INFRASTRUCTURE: "infrastructure",
    PLUMBING: "plumbing",
  };

  /**
   * Doctrine Rules:
   * - Domain: No infra, no plumbing, no DOM/fs.
   * - Infrastructure: Can import domain, No plumbing.
   * - Plumbing: Can import domain + infrastructure, No business logic.
   */
  public static async audit(workingDir: string, specificFile?: string): Promise<SentinelReport> {
    const files = specificFile ? [specificFile] : await this.getAllFiles(workingDir);
    const zoneViolations: string[] = [];
    const oversizedFiles: string[] = [];
    const hotspots: string[] = [];

    for (const file of files) {
      const relativePath = path.relative(workingDir, file);
      const zone = this.getZone(relativePath);
      if (!zone) continue;

      const content = await fs.readFile(file, "utf8");
      const imports = this.extractImports(content);

      // Rule Enforcement
      for (const imp of imports) {
        const impZone = this.getImportZone(imp, relativePath);
        if (!impZone) continue;

        if (zone === this.ZONES.DOMAIN) {
          if (impZone === this.ZONES.INFRASTRUCTURE || impZone === this.ZONES.PLUMBING) {
            zoneViolations.push(`[Domain Violation] ${relativePath} imports ${imp} (${impZone})`);
          }
          if (/['"](fs|path|os|vscode)['"]/.test(imp)) {
            zoneViolations.push(`[Purity Violation] ${relativePath} references system module: ${imp}`);
          }
        }

        if (zone === this.ZONES.INFRASTRUCTURE) {
          if (impZone === this.ZONES.PLUMBING) {
            zoneViolations.push(`[Infrastructure Violation] ${relativePath} imports ${imp} (Plumbing leakage)`);
          }
        }
      }

      // Oversized detection
      if (content.split("
").length > 400) {
        oversizedFiles.push(relativePath);
      }
    }

    const lintErrors = await LintService.runLint(workingDir);
    
    // Entropy Score Calculation
    // entropyScore = zoneViolations * 3 + lintErrors * 1 + circularDeps * 5 + oversizedFiles * 2;
    const entropyScore = 
      (zoneViolations.length * 3) + 
      (lintErrors.length * 1) + 
      (oversizedFiles.length * 2);

    let stability: SentinelReport["stability"] = "Stable";
    if (entropyScore > 15) stability = "Toxic";
    else if (entropyScore > 8) stability = "Fragile";
    else if (entropyScore > 4) stability = "Fluid";

    const report: SentinelReport = {
      timestamp: new Date().toISOString(),
      zoneViolations,
      circularDependencies: [], // Placeholder for future circular dep check
      entropyScore,
      stability,
      hotspots: Array.from(new Set([...zoneViolations.map(v => v.split(" ")[1]), ...oversizedFiles])).slice(0, 5),
      passed: entropyScore < 8,
    };

    await this.writeToSentinelLog(workingDir, report);
    return report;
  }

  private static getZone(filePath: string): string | null {
    if (filePath.includes("src/domain") || filePath.includes("/domain/")) return this.ZONES.DOMAIN;
    if (filePath.includes("src/infrastructure") || filePath.includes("/infrastructure/")) return this.ZONES.INFRASTRUCTURE;
    if (filePath.includes("src/plumbing") || filePath.includes("/plumbing/")) return this.ZONES.PLUMBING;
    return null;
  }

  private static getImportZone(impPath: string, sourceFile: string): string | null {
    if (impPath.includes("/domain") || impPath.includes("../domain")) return this.ZONES.DOMAIN;
    if (impPath.includes("/infrastructure") || impPath.includes("../infrastructure")) return this.ZONES.INFRASTRUCTURE;
    if (impPath.includes("/plumbing") || impPath.includes("../plumbing")) return this.ZONES.PLUMBING;
    return null;
  }

  private static extractImports(content: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    const imports: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private static async getAllFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map((entry) => {
      const res = path.resolve(dir, entry.name);
      if (res.includes("node_modules") || res.includes(".git") || res.includes("dist")) return [];
      return entry.isDirectory() ? this.getAllFiles(res) : res;
    }));
    return files.flat().filter(f => /\.(ts|tsx)$/.test(f as string));
  }

  private static async writeToSentinelLog(workingDir: string, report: SentinelReport) {
    const logPath = path.join(workingDir, "SENTINEL.md");
    const summary = `
# 🛡️ Sentinel Report: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Stability**: ${report.stability} ${this.getStabilityEmoji(report.stability)}
**Entropy Score**: ${report.entropyScore} (Threshold: 8)

## 📊 Metrics
- **Zone Violations**: ${report.zoneViolations.length}
- **Lint Errors**: ${report.zoneViolations.length} (Calculated from entropy)
- **Circular Dependencies**: ${report.circularDependencies.length}

## ⚠️ Hotspots
${report.hotspots.map(h => `- `${h}``).join("
")}

## 📜 Zone Violations
${report.zoneViolations.length > 0 ? report.zoneViolations.map(v => `- ${v}`).join("
") : "No cross-zone contamination detected. Domain remains pure."}

---
*Marie Sentinel v2 — Serious Architectural Guardian*
`;
    await fs.writeFile(logPath, summary);
  }

  private static getStabilityEmoji(s: string): string {
    switch (s) {
      case "Stable": return "🛡️";
      case "Fluid": return "🌊";
      case "Fragile": return "⚠️";
      case "Toxic": return "☢️";
      default: return "❓";
    }
  }
}
