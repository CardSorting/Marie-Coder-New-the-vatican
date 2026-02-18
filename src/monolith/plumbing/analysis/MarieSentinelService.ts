import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { LintService } from "./LintService.js";
import { ComplexityService } from "./ComplexityService.js";
import { ConfigService } from "../../infrastructure/config/ConfigService.js";

export interface SentinelReport {
  timestamp: string;
  zoneViolations: string[];
  circularDependencies: string[];
  leakyAbstractions: string[];
  duplication: string[];
  entropyScore: number;
  entropyDelta: number;
  stability: "Stable" | "Fluid" | "Fragile" | "Toxic";
  hotspots: string[];
  quarantineCandidates: string[];
  navigationDrifts: string[];
  graphDefinition: string;
  passed: boolean;
}

interface SentinelState {
  lastEntropy: number;
  history: { date: string; entropy: number }[];
  fileHashes: Record<string, number>; // Path -> mtimeMs
}

/**
 * MARIE SENTINEL v3.1: THE GROUNDED GUARDIAN
 * Improved accuracy in resolution, duplication, and graph fidelity.
 */
export class MarieSentinelService {
  private static readonly ZONES = {
    DOMAIN: "domain",
    INFRASTRUCTURE: "infrastructure",
    PLUMBING: "plumbing",
  };

  private static readonly STATE_FILE = ".marie/sentinel_state.json";

  public static async audit(
    workingDir: string,
    specificFile?: string,
  ): Promise<SentinelReport> {
    const allFiles = await this.getAllFiles(workingDir);
    const targetFiles = specificFile ? [specificFile] : allFiles;

    const zoneViolations: string[] = [];
    const circularDependencies: string[] = [];
    const leakyAbstractions: string[] = [];
    const duplication: string[] = [];
    const navigationDrifts: string[] = [];
    const toxicFiles: string[] = [];

    // 1. Precise Dependency Graph & Semantic Content Maps
    const dependencyGraph = new Map<string, string[]>();
    const semanticHashMap = new Map<string, string>(); // Hash -> FilePath

    // INCREMENTAL SENTINEL: Load state to check mtimes
    const state = await this.loadState(workingDir);
    const lastMtimes = state.fileHashes || {};
    const newMtimes: Record<string, number> = {};

    // FAST PATH: Check ascension mode
    const isAscension = ConfigService.getAutonomyMode() === "ascension";

    await Promise.all(
      allFiles.map(async (file) => {
        const stats = await fs.stat(file);
        const mtime = stats.mtimeMs;
        const relativePath = path.relative(workingDir, file);
        newMtimes[relativePath] = mtime;

        const hasChanged = lastMtimes[relativePath] !== mtime;
        const content = await fs.readFile(file, "utf8");

        // A. Semantic Duplication
        if (!isAscension) {
          const semanticHash = this.computeSemanticHash(content);
          if (semanticHashMap.has(semanticHash)) {
            const original = semanticHashMap.get(semanticHash)!;
            if (original !== relativePath) {
              duplication.push(
                `[Semantic Duplicate] ${relativePath} matches ${original}`,
              );
            }
          } else {
            semanticHashMap.set(semanticHash, relativePath);
          }
        }

        // B. Robust Import Extraction & Resolution
        const rawImports = this.extractImports(content);
        const resolvedImports = await Promise.all(
          rawImports.map((i) => this.resolveImportDeep(i, file, workingDir)),
        );

        const validImports = resolvedImports.filter(Boolean) as string[];
        dependencyGraph.set(relativePath, validImports);

        // C. Target Analysis
        if (targetFiles.includes(file) && hasChanged) {
          await this.analyzeFile(
            file,
            workingDir,
            content,
            validImports,
            zoneViolations,
            leakyAbstractions,
            navigationDrifts,
            toxicFiles,
          );
        }
      }),
    );

    // 2. Cycle Detection (Global)
    // FAST PATH: Skip expensive cycle detection in Ascension mode
    if (!isAscension) {
      const cycles = this.detectCycles(dependencyGraph);
      circularDependencies.push(...cycles);
    }

    // 3. Score Normalization & Ratchet
    const lintErrors = await LintService.runLint(workingDir);

    const entropyScore =
      zoneViolations.length * 8 + // Weighted higher
      lintErrors.length * 1 +
      circularDependencies.length * 15 + // Structural rot is expensive
      toxicFiles.length * 6 +
      leakyAbstractions.length * 5 +
      duplication.length * 10 +
      navigationDrifts.length * 12; // Ecclesiastical Navigation is mandatory

    const entropyDelta = entropyScore - state.lastEntropy;

    await this.saveState(workingDir, {
      lastEntropy: entropyScore,
      history: [
        ...state.history,
        { date: new Date().toISOString(), entropy: entropyScore },
      ].slice(-20),
      fileHashes: newMtimes,
    });

    let stability: SentinelReport["stability"] = "Stable";
    if (entropyScore > 30) stability = "Toxic";
    else if (entropyScore > 15) stability = "Fragile";
    else if (entropyScore > 7) stability = "Fluid";

    const report: SentinelReport = {
      timestamp: new Date().toISOString(),
      zoneViolations,
      circularDependencies,
      leakyAbstractions,
      duplication,
      entropyScore,
      entropyDelta,
      stability,
      hotspots: Array.from(
        new Set([...zoneViolations.map((v) => v.split(" ")[1]), ...toxicFiles]),
      ).slice(0, 5),
      quarantineCandidates: toxicFiles,
      navigationDrifts,
      graphDefinition: this.generateMermaidGraph(
        dependencyGraph,
        zoneViolations,
      ),
      passed: entropyScore < 20 && entropyDelta <= 0,
    };

    await this.writeToSentinelLog(workingDir, report);
    return report;
  }

  /**
   * Computes a "Semantic Hash" by tokenizing the code and stripping noise.
   * This catches duplication even if variables are renamed (shallowly).
   */
  private static computeSemanticHash(content: string): string {
    const tokens = content
      .replace(/\/\/.*$/gm, "") // Strip line comments
      .replace(/\/\*[\s\S]*?\*\//g, "") // Strip block comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\b(const|let|var)\s+\w+\b/g, "VAR") // Normalize variable declarations
      .replace(/\bfunction\s+\w+\b/g, "FUNC") // Normalize function names
      .trim();
    return crypto.createHash("sha256").update(tokens).digest("hex");
  }

  private static async resolveImportDeep(
    imp: string,
    sourceFile: string,
    workingDir: string,
  ): Promise<string | null> {
    if (!imp.startsWith(".")) return null; // Ignore external for now

    const baseDir = path.dirname(sourceFile);
    const candidatePaths = [
      path.resolve(baseDir, imp),
      path.resolve(baseDir, `${imp}.ts`),
      path.resolve(baseDir, `${imp}.tsx`),
      path.resolve(baseDir, `${imp}.js`),
      path.resolve(baseDir, imp, "index.ts"),
      path.resolve(baseDir, imp, "index.js"),
    ];

    for (const p of candidatePaths) {
      try {
        const stats = await fs.stat(p);
        if (stats.isFile()) {
          return path.relative(workingDir, p);
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private static async analyzeFile(
    file: string,
    workingDir: string,
    content: string,
    resolvedImports: string[],
    zoneViolations: string[],
    leakyAbstractions: string[],
    navigationDrifts: string[],
    toxicFiles: string[],
  ) {
    const relativePath = path.relative(workingDir, file);
    const zone = this.getZone(relativePath);
    if (!zone) return;

    // A. Real Zone Verification (based on RESOLVED paths)
    for (const impPath of resolvedImports) {
      const impZone = this.getZone(impPath);
      if (!impZone) continue;

      if (zone === this.ZONES.DOMAIN && impZone !== this.ZONES.DOMAIN) {
        zoneViolations.push(
          `[Purity Breach] ${relativePath} -> ${impPath} (${impZone})`,
        );
      }
      if (
        zone === this.ZONES.INFRASTRUCTURE &&
        impZone === this.ZONES.PLUMBING
      ) {
        zoneViolations.push(
          `[Architecture Leak] ${relativePath} -> ${impPath} (Infrastructure cannot use Plumbing)`,
        );
      }
    }

    // B. Purity Scan (System Types in Domain)
    if (zone === this.ZONES.DOMAIN) {
      const systemKeywords =
        /\b(fs|path|os|vscode|express|React|HTMLElement|Buffer|process|window|document)\b/;
      if (systemKeywords.test(content)) {
        leakyAbstractions.push(
          `[System Leak] ${relativePath} references non-domain types.`,
        );
      }
    }

    // C. Complexity Guard
    const metrics = await ComplexityService.analyze(file);
    if (metrics.cyclomaticComplexity > 20 || metrics.clutterLevel === "Toxic") {
      toxicFiles.push(relativePath);
    }

    // D. Ecclesiastical Navigation Check (Webapp/UI Files)
    if (relativePath.includes(".tsx") || content.includes("react-router-dom")) {
      const flatRouteRegex = /path=['"]\/(blog|docs|legal|support)\/:slug['"]/g;
      if (flatRouteRegex.test(content)) {
        navigationDrifts.push(
          `[Ecclesiastical Violation] ${relativePath} uses flat routes. Use hierarchical schema (e.g., /blog/:year/:month/:slug).`,
        );
      }

      // Secondary check for Breadcrumb presence in content views
      if (
        content.includes("ArticleView") &&
        !content.includes("Breadcrumbs")
      ) {
        navigationDrifts.push(
          `[Liturgical Violation] ${relativePath} is a content view missing mandatory Breadcrumbs.`,
        );
      }
    }
  }

  private static getZone(filePath: string): string | null {
    if (filePath.includes("src/domain") || filePath.includes("/domain/"))
      return this.ZONES.DOMAIN;
    if (
      filePath.includes("src/infrastructure") ||
      filePath.includes("/infrastructure/")
    )
      return this.ZONES.INFRASTRUCTURE;
    if (filePath.includes("src/plumbing") || filePath.includes("/plumbing/"))
      return this.ZONES.PLUMBING;
    return null;
  }

  private static extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /from\s+['"](.*?)['"]/g;
    const requireRegex = /require\(['"](.*?)['"]\)/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) imports.push(match[1]);
    while ((match = requireRegex.exec(content)) !== null)
      imports.push(match[1]);

    return Array.from(new Set(imports));
  }

  private static detectCycles(graph: Map<string, string[]>): string[] {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      stack.add(node);

      for (const neighbor of graph.get(node) || []) {
        if (stack.has(neighbor)) {
          cycles.push(`🔄 ${path.join(" -> ")} -> ${neighbor}`);
        } else if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        }
      }
      stack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) dfs(node, [node]);
    }
    return cycles;
  }

  private static generateMermaidGraph(
    graph: Map<string, string[]>,
    violations: string[],
  ): string {
    let mermaid = "graph TD;\n";
    const nodes = Array.from(graph.keys()).slice(0, 40);
    nodes.forEach((node) => {
      const id = node.replace(/[^a-zA-Z0-9]/g, "_");
      const name = path.basename(node);
      graph.get(node)?.forEach((dep) => {
        const depId = dep.replace(/[^a-zA-Z0-9]/g, "_");
        const isViolated = violations.some(
          (v) => v.includes(node) && v.includes(dep),
        );
        mermaid += `  ${id}[${name}] --> ${depId}[${path.basename(dep)}];\n`;
        if (isViolated)
          mermaid += `  style ${id} fill:#f96,stroke:#333,stroke-width:2px\n`;
      });
    });
    return mermaid;
  }

  private static async loadState(workingDir: string): Promise<SentinelState> {
    try {
      const content = await fs.readFile(
        path.join(workingDir, this.STATE_FILE),
        "utf8",
      );
      return JSON.parse(content);
    } catch {
      return { lastEntropy: 0, history: [], fileHashes: {} };
    }
  }

  private static async saveState(workingDir: string, state: SentinelState) {
    const dir = path.join(workingDir, ".marie");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(workingDir, this.STATE_FILE),
      JSON.stringify(state, null, 2),
    );
  }

  private static async getAllFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((entry) => {
        const res = path.resolve(dir, entry.name);
        if (
          res.includes("node_modules") ||
          res.includes(".git") ||
          res.includes("dist")
        )
          return [];
        return entry.isDirectory() ? this.getAllFiles(res) : res;
      }),
    );
    return files.flat().filter((f) => /\.(ts|tsx)$/.test(f as string));
  }

  private static async writeToSentinelLog(
    workingDir: string,
    report: SentinelReport,
  ) {
    const logPath = path.join(workingDir, "SENTINEL.md");
    const summary = `
# 🛡️ Sentinel Report: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Stability**: ${report.stability}
**Entropy**: ${report.entropyScore} (${report.entropyDelta > 0 ? "⚠️ Regression" : "✅ Monotonic"})
**Ratchet**: ${report.entropyDelta > 0 ? "🚫 LOCKED" : "🔓 OPEN"}

## 📊 Metrics
- **Zoning Law**: ${report.zoneViolations.length} violations
- **Cyclic Rot**: ${report.circularDependencies.length} cycles
- **Duplication**: ${report.duplication.length} instances
- **Toxicity**: ${report.quarantineCandidates.length} hotspots
- **Navigation Drift**: ${report.navigationDrifts.length} violations

## 🗺️ Visual Architecture
\`\`\`mermaid
${report.graphDefinition}
\`\`\`

## 📜 High-Priority Alerts
${report.zoneViolations
        .slice(0, 5)
        .map((v) => `- ❌ ${v}`)
        .join("\n")}
${report.circularDependencies
        .slice(0, 3)
        .map((c) => `- 🔄 ${c}`)
        .join("\n")}
${report.duplication
        .slice(0, 3)
        .map((d) => `- 👯 ${d}`)
        .join("\n")}
${report.navigationDrifts
        .slice(0, 5)
        .map((n) => `- 🧭 ${n}`)
        .join("\n")}

---
*Marie Sentinel v3.1 — Grounded Architectural Guardian*
`;
    await fs.writeFile(logPath, summary);
  }
}
