import * as fs from "fs/promises";
import * as path from "path";
import { LintService } from "./LintService.js";
import { ComplexityService } from "./ComplexityService.js";

export interface SentinelReport {
  timestamp: string;
  zoneViolations: string[];
  circularDependencies: string[];
  leakyAbstractions: string[];
  entropyScore: number;
  stability: "Stable" | "Fluid" | "Fragile" | "Toxic";
  hotspots: string[];
  quarantineCandidates: string[];
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
   * - Domain: No infra, no plumbing, no DOM/fs/process. No "Leaky Abstractions" (e.g. 'Express', 'React', 'sql').
   * - Infrastructure: Can import domain, No plumbing.
   * - Plumbing: Can import domain + infrastructure, No business logic.
   * - Global: No Circular Dependencies. No "Toxic" Complexity.
   */
  public static async audit(workingDir: string, specificFile?: string): Promise<SentinelReport> {
    const files = await this.getAllFiles(workingDir);
    const targetFiles = specificFile ? [specificFile] : files;
    
    const zoneViolations: string[] = [];
    const circularDependencies: string[] = [];
    const leakyAbstractions: string[] = [];
    const toxicFiles: string[] = [];
    const hotspots: string[] = [];

    // 1. Build Dependency Graph for Circular Check
    const dependencyGraph = new Map<string, string[]>();

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      const imports = this.extractImports(content);
      const relativePath = path.relative(workingDir, file);
      
      const resolvedImports = imports.map(i => this.resolveImport(i, file, workingDir));
      dependencyGraph.set(relativePath, resolvedImports.filter(Boolean) as string[]);

      // Only analyze specific files for violations if requested
      if (targetFiles.includes(file)) {
        await this.analyzeFile(file, workingDir, content, imports, zoneViolations, leakyAbstractions, toxicFiles);
      }
    }

    // 2. Detect Circular Dependencies (Global Scan)
    const cycles = this.detectCycles(dependencyGraph);
    circularDependencies.push(...cycles);

    // 3. Linting Audit
    const lintErrors = await LintService.runLint(workingDir); // Global or targeted? Keep global for context
    
    // 4. Entropy Score Calculation
    // entropyScore = zoneViolations * 5 + lintErrors * 1 + circularDeps * 10 + toxicFiles * 5 + leakyAbstractions * 3
    const entropyScore = 
      (zoneViolations.length * 5) + 
      (lintErrors.length * 1) + 
      (circularDependencies.length * 10) + 
      (toxicFiles.length * 5) +
      (leakyAbstractions.length * 3);

    let stability: SentinelReport["stability"] = "Stable";
    if (entropyScore > 25) stability = "Toxic";
    else if (entropyScore > 15) stability = "Fragile";
    else if (entropyScore > 5) stability = "Fluid";

    const report: SentinelReport = {
      timestamp: new Date().toISOString(),
      zoneViolations,
      circularDependencies,
      leakyAbstractions,
      entropyScore,
      stability,
      hotspots: Array.from(new Set([...zoneViolations.map(v => v.split(" ")[1]), ...toxicFiles])).slice(0, 5),
      quarantineCandidates: toxicFiles,
      passed: entropyScore < 10,
    };

    await this.writeToSentinelLog(workingDir, report);
    return report;
  }

  private static async analyzeFile(
    file: string, 
    workingDir: string, 
    content: string, 
    imports: string[], 
    zoneViolations: string[], 
    leakyAbstractions: string[],
    toxicFiles: string[]
  ) {
    const relativePath = path.relative(workingDir, file);
    const zone = this.getZone(relativePath);
    if (!zone) return;

    // A. Zone Enforcement
    for (const imp of imports) {
      const impZone = this.getImportZone(imp, relativePath);
      if (!impZone) continue;

      if (zone === this.ZONES.DOMAIN) {
        if (impZone === this.ZONES.INFRASTRUCTURE || impZone === this.ZONES.PLUMBING) {
          zoneViolations.push(`[Domain Violation] ${relativePath} imports ${imp} (${impZone})`);
        }
        if (/['"](fs|path|os|vscode|express|react|vue|angular|typeorm|mongoose)['"]/.test(imp)) {
          zoneViolations.push(`[Purity Violation] ${relativePath} imports impure module: ${imp}`);
        }
      }

      if (zone === this.ZONES.INFRASTRUCTURE) {
        if (impZone === this.ZONES.PLUMBING) {
          zoneViolations.push(`[Infrastructure Violation] ${relativePath} imports ${imp} (Plumbing leakage)`);
        }
      }
    }

    // B. Leaky Abstraction Check (Heuristic)
    if (zone === this.ZONES.DOMAIN) {
      // Check for implementation details in types/interfaces
      if (content.includes("HTMLElement") || content.includes("Request") || content.includes("Response") || content.includes("Buffer")) {
        leakyAbstractions.push(`[Leaky Abstraction] ${relativePath} exposes implementation details (DOM/HTTP types).`);
      }
    }

    // C. Complexity & Toxicity Check
    const metrics = await ComplexityService.analyze(file);
    if (metrics.cyclomaticComplexity > 25 || metrics.clutterLevel === "Toxic") {
      toxicFiles.push(relativePath);
    }
    if (content.split("\n").length > 500) {
      toxicFiles.push(relativePath); // Oversized
    }
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

  private static resolveImport(imp: string, sourceFile: string, workingDir: string): string | null {
    // Simple resolution heuristic for TS
    if (imp.startsWith(".")) {
      const resolved = path.resolve(path.dirname(sourceFile), imp);
      return path.relative(workingDir, resolved); // Return relative path for graph
    }
    return null; // External or alias (ignore for cycle check for now)
  }

  private static detectCycles(graph: Map<string, string[]>): string[] {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(node: string, path: string[]) {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        // Attempt to match neighbor to a key in the graph (handling extensions roughly)
        const matchedKey = Array.from(graph.keys()).find(k => k.startsWith(neighbor) || neighbor.startsWith(k));
        
        if (matchedKey) {
          if (!visited.has(matchedKey)) {
            dfs(matchedKey, [...path, matchedKey]);
          } else if (recursionStack.has(matchedKey)) {
            cycles.push(`Cycle: ${path.join(" -> ")} -> ${matchedKey}`);
          }
        }
      }

      recursionStack.delete(node);
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, [node]);
      }
    }

    return cycles;
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
**Entropy Score**: ${report.entropyScore} (Threshold: 10)

## 📊 Metrics
- **Zone Violations**: ${report.zoneViolations.length}
- **Circular Dependencies**: ${report.circularDependencies.length}
- **Leaky Abstractions**: ${report.leakyAbstractions.length}
- **Toxic Files**: ${report.quarantineCandidates.length}

## ⚠️ Quarantine Candidates
${report.quarantineCandidates.length > 0 ? report.quarantineCandidates.map(f => `- ☣️ \`${f}\``).join("\n") : "None. Codebase is sanitary."}

## 📜 Violations
${report.zoneViolations.map(v => `- ${v}`).join("\n")}
${report.circularDependencies.map(c => `- 🔄 ${c}`).join("\n")}
${report.leakyAbstractions.map(l => `- 💧 ${l}`).join("\n")}

---
*Marie Sentinel v2.1 — Serious Architectural Guardian*
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
