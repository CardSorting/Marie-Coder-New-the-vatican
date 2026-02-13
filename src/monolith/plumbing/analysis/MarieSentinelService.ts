import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { LintService } from "./LintService.js";
import { ComplexityService } from "./ComplexityService.js";

export interface SentinelReport {
  timestamp: string;
  zoneViolations: string[];
  circularDependencies: string[];
  leakyAbstractions: string[];
  duplication: string[];
  entropyScore: number;
  entropyDelta: number; // New: Change from last scan
  stability: "Stable" | "Fluid" | "Fragile" | "Toxic";
  hotspots: string[];
  quarantineCandidates: string[];
  graphDefinition: string; // New: Mermaid Graph
  passed: boolean;
}

interface SentinelState {
  lastEntropy: number;
  history: { date: string; entropy: number }[];
}

export class MarieSentinelService {
  private static readonly ZONES = {
    DOMAIN: "domain",
    INFRASTRUCTURE: "infrastructure",
    PLUMBING: "plumbing",
  };

  private static readonly STATE_FILE = ".marie/sentinel_state.json";

  /**
   * Doctrine Rules:
   * - Domain: No infra, no plumbing, no DOM/fs/process. No "Leaky Abstractions".
   * - Infrastructure: Can import domain, No plumbing.
   * - Plumbing: Can import domain + infrastructure, No business logic.
   * - Global: No Circular Dependencies. No Toxic Complexity. No Duplication.
   * - Ratchet: Entropy must not increase.
   */
  public static async audit(workingDir: string, specificFile?: string): Promise<SentinelReport> {
    const files = await this.getAllFiles(workingDir);
    const targetFiles = specificFile ? [specificFile] : files;
    
    const zoneViolations: string[] = [];
    const circularDependencies: string[] = [];
    const leakyAbstractions: string[] = [];
    const duplication: string[] = [];
    const toxicFiles: string[] = [];
    
    // 1. Build Dependency Graph & Content Maps
    const dependencyGraph = new Map<string, string[]>();
    const contentMap = new Map<string, string>(); // Hash -> FilePath

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      const relativePath = path.relative(workingDir, file);
      
      // Duplication Check (Simple content hash of stripped code)
      const hash = this.hashContent(content);
      if (contentMap.has(hash)) {
        duplication.push(`[Doppelgänger] ${relativePath} is a duplicate of ${contentMap.get(hash)}`);
      } else {
        contentMap.set(hash, relativePath);
      }

      const imports = this.extractImports(content);
      const resolvedImports = imports.map(i => this.resolveImport(i, file, workingDir));
      dependencyGraph.set(relativePath, resolvedImports.filter(Boolean) as string[]);

      if (targetFiles.includes(file)) {
        await this.analyzeFile(file, workingDir, content, imports, zoneViolations, leakyAbstractions, toxicFiles);
      }
    }

    // 2. Global Scans
    const cycles = this.detectCycles(dependencyGraph);
    circularDependencies.push(...cycles);
    const lintErrors = await LintService.runLint(workingDir); 
    
    // 3. Entropy Calculation
    const entropyScore = 
      (zoneViolations.length * 5) + 
      (lintErrors.length * 1) + 
      (circularDependencies.length * 10) + 
      (toxicFiles.length * 5) +
      (leakyAbstractions.length * 3) +
      (duplication.length * 4);

    // 4. The Ratchet Protocol (State Comparison)
    const state = await this.loadState(workingDir);
    const entropyDelta = entropyScore - state.lastEntropy;
    await this.saveState(workingDir, {
      lastEntropy: entropyScore,
      history: [...state.history, { date: new Date().toISOString(), entropy: entropyScore }].slice(-10)
    });

    let stability: SentinelReport["stability"] = "Stable";
    if (entropyScore > 25) stability = "Toxic";
    else if (entropyScore > 15) stability = "Fragile";
    else if (entropyScore > 5) stability = "Fluid";

    const report: SentinelReport = {
      timestamp: new Date().toISOString(),
      zoneViolations,
      circularDependencies,
      leakyAbstractions,
      duplication,
      entropyScore,
      entropyDelta,
      stability,
      hotspots: Array.from(new Set([...zoneViolations.map(v => v.split(" ")[1]), ...toxicFiles])).slice(0, 5),
      quarantineCandidates: toxicFiles,
      graphDefinition: this.generateMermaidGraph(dependencyGraph, zoneViolations),
      passed: entropyScore < 15 && entropyDelta <= 0, // Failed if entropy RISES (Ratchet)
    };

    await this.writeToSentinelLog(workingDir, report);
    return report;
  }

  private static hashContent(content: string): string {
    // Strip comments and whitespace to detect semantic duplication
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
    return crypto.createHash('md5').update(stripped).digest('hex');
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
          zoneViolations.push(`[Domain Violation] ${relativePath} -> ${imp} (${impZone})`);
        }
        if (/['"](fs|path|os|vscode|express|react|vue|angular|typeorm|mongoose)['"]/.test(imp)) {
          zoneViolations.push(`[Purity Violation] ${relativePath} -> ${imp}`);
        }
      } else if (zone === this.ZONES.INFRASTRUCTURE) {
        if (impZone === this.ZONES.PLUMBING) {
          zoneViolations.push(`[Infrastructure Violation] ${relativePath} -> ${imp} (Plumbing leakage)`);
        }
      }
    }

    // B. Leaky Abstraction Check
    if (zone === this.ZONES.DOMAIN) {
      if (content.match(/\b(HTMLElement|Request|Response|Buffer|EventEmitter)\b/)) {
        leakyAbstractions.push(`[Leaky Abstraction] ${relativePath} exposes implementation types.`);
      }
    }

    // C. Complexity Check
    const metrics = await ComplexityService.analyze(file);
    if (metrics.cyclomaticComplexity > 25 || metrics.clutterLevel === "Toxic") {
      toxicFiles.push(relativePath);
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
    if (imp.startsWith(".")) {
      const resolved = path.resolve(path.dirname(sourceFile), imp);
      return path.relative(workingDir, resolved);
    }
    return null;
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
      if (!visited.has(node)) dfs(node, [node]);
    }
    return cycles;
  }

  private static generateMermaidGraph(graph: Map<string, string[]>, violations: string[]): string {
    let mermaid = "graph TD;\n";
    let linkCount = 0;
    
    // Heuristic: Limit graph size for readability
    const nodes = Array.from(graph.keys()).slice(0, 50); 
    
    nodes.forEach(node => {
      const cleanNode = node.replace(/[^a-zA-Z0-9]/g, '_');
      const deps = graph.get(node) || [];
      
      deps.forEach(dep => {
        const cleanDep = dep.replace(/[^a-zA-Z0-9]/g, '_');
        // Check if this link is a violation
        const isViolation = violations.some(v => v.includes(node) && v.includes(dep));
        
        mermaid += `  ${cleanNode}[${path.basename(node)}] --> ${cleanDep}[${path.basename(dep)}];\n`;
        if (isViolation) {
          mermaid += `  linkStyle ${linkCount} stroke:#ff0000,stroke-width:2px;\n`;
        }
        linkCount++;
      });
    });
    
    return mermaid;
  }

  private static async loadState(workingDir: string): Promise<SentinelState> {
    try {
      const statePath = path.join(workingDir, this.STATE_FILE);
      const content = await fs.readFile(statePath, "utf8");
      return JSON.parse(content);
    } catch {
      return { lastEntropy: 0, history: [] };
    }
  }

  private static async saveState(workingDir: string, state: SentinelState) {
    try {
      const dir = path.join(workingDir, ".marie");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(workingDir, this.STATE_FILE), JSON.stringify(state, null, 2));
    } catch (e) {
      console.warn("Failed to save Sentinel state", e);
    }
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
    const deltaEmoji = report.entropyDelta > 0 ? "📈 (Degrading)" : report.entropyDelta < 0 ? "📉 (Improving)" : "➡️ (Constant)";
    
    const summary = `
# 🛡️ Sentinel Report: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

**Stability**: ${report.stability} ${this.getStabilityEmoji(report.stability)}
**Entropy**: ${report.entropyScore} ${deltaEmoji}
**Ratchet Status**: ${report.entropyDelta > 0 ? "🚫 LOCKED (Regression Detected)" : "✅ OPEN"}

## 📊 Metrics
- **Zone Violations**: ${report.zoneViolations.length}
- **Circular Deps**: ${report.circularDependencies.length}
- **Doppelgängers**: ${report.duplication.length}
- **Toxic Files**: ${report.quarantineCandidates.length}

## 🗺️ Architecture Graph
\`\`\`mermaid
${report.graphDefinition}
\`\`\`

## ⚠️ Hotspots
${report.hotspots.map(h => `- ${h}`).join("\n")}

## 📜 Violations
${report.zoneViolations.map(v => `- ${v}`).join("\n")}
${report.circularDependencies.map(c => `- 🔄 ${c}`).join("\n")}
${report.duplication.map(d => `- 👯 ${d}`).join("\n")}

---
*Marie Sentinel v3.0 — The Omniscient Guardian*
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
