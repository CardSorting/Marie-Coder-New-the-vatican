import * as vscode from "vscode";
import * as path from "path";
import {
  proposeReorganization,
  executeRestoration,
  synthesizeZoneManuals,
  scaffoldZoneAbstractions,
  sowFeature,
  proposeClustering,
  executeGenesisRitual,
  isProjectJoyful,
  generateJoyDashboard,
  generateTidyChecklist,
  ensureJoyZoningFolders,
} from "../domain/joy/JoyTools.js";
import { JoyService } from "./JoyService.js";
import { RunTelemetry } from "../domain/marie/MarieTypes.js";

export class JoyAutomationService {
  private currentRun: RunTelemetry | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly joyService: JoyService,
  ) {}

  public setCurrentRun(run: RunTelemetry | undefined) {
    this.currentRun = run;
  }

  public getCurrentRun(): RunTelemetry | undefined {
    return this.currentRun;
  }

  public async triggerGenesis(): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return "No workspace detected.";

    const result = await executeGenesisRitual(root);
    await this.joyService.addAchievement(
      `Performed the Genesis Ritual. Project reborn in JOY. ✨`,
      100,
    );
    return result;
  }

  public async sowJoyFeature(name: string, intent: string): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return "No workspace detected.";

    const result = await sowFeature(root, name, intent);
    await this.joyService.addAchievement(
      `Sowed the seeds of '${name}' across the garden. 🌱`,
      25,
    );
    return result;
  }

  private heartbeatTimer: NodeJS.Timeout | undefined;

  public async performGardenPulse(): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return "No workspace folder detected.";

    let finalReport = "";
    try {
      const joyful = await isProjectJoyful(root);
      await ensureJoyZoningFolders(root);
      const scaffolded = await scaffoldZoneAbstractions(root);
      finalReport += scaffolded;

      const proposals = await proposeReorganization(root);
      const clustering = await proposeClustering(root);
      const manuals = await synthesizeZoneManuals(root);

      if (!joyful) {
        finalReport += `\n- ⚠️ **Architectural Void**: This project has not yet embraced the JOY structure. Use the Genesis Ritual to begin your journey.`;
      }

      if (proposals.length > 0) {
        finalReport += `\n- ${proposals.length} structural drifts detected.`;

        const { ConfigService } =
          await import("../infrastructure/config/ConfigService.js");
        const autoRepair = ConfigService.getAutoRepair();

        if (proposals.length > 5) {
          if (autoRepair) {
            await this.joyService.addAchievement(
              "Auto-Repair initiated for significant drift. 🛠️",
              10,
            );
            const repairResult = await this.executeAutonomousRestoration();
            finalReport += `\n- 🛠️ **Auto-Repair Executed**: ${repairResult}`;
          } else {
            vscode.window.showWarningMessage(
              `⚠️ Joy Heartbeat: Significant structural drift (${proposals.length} items) detected. Consider a restoration ritual.`,
            );
          }
        }
      }
      if (clustering.length > 0)
        finalReport += `\n- ${clustering.length} zones ripe for clustering.`;

      // SINGULARITY AUTONOMY: Autonomous Journaling & Scouting
      await this.performSpiritualJournaling();
      await this.scoutAchievements();
    } catch (e: any) {
      finalReport += `\n- ❌ **Pulse Interrupted**: A structural error occurred during synthesis: ${e.message}`;
    }

    return `${finalReport}\n\nThe garden continues to evolve in harmony. ✨`;
  }

  public startAutonomousHeartbeat(intervalMs: number = 300000) {
    // Default 5 mins
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      await this.performGardenPulse();
    }, intervalMs);
  }

  public stopAutonomousHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  public async executeAutonomousRestoration(): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return "No workspace folder detected.";

    const result = await executeRestoration(root);
    await this.joyService.addAchievement(
      "The Garden was autonomously restored to harmony. ✨",
      50,
    );
    return result;
  }

  /**
   * Self-healing logic for tool failures.
   * If an action fails, this method can be called to attempt a heuristic recovery.
   */
  public async executeSelfHealing(
    failedPath: string,
    errorReason: string,
  ): Promise<string> {
    await this.joyService.addAchievement("Self-healing initiated. 🧬", 15);

    // Simple heuristic: if content mismatch, try to re-read or find similar
    if (
      errorReason.includes("content check failed") ||
      errorReason.includes("could not find")
    ) {
      return `Self-healing: Analyzing \`${failedPath}\` to resolve: ${errorReason}. \nPlease retry the operation with \`find_files\` or \`grep_search\` to refresh context. ✨`;
    }

    return `Self-healing could not determine a recovery path for: ${errorReason}`;
  }

  public async autoScaffold() {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (root) {
      await scaffoldZoneAbstractions(root);
    }
  }

  private async performSpiritualJournaling() {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return;

    try {
      const journalPath = path.join(root, "JOURNAL.md");
      let stats = false;
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(journalPath));
        stats = true;
      } catch (e) {
        stats = false;
      }

      const date = new Date().toISOString().split("T")[0];
      const time = new Date().toLocaleTimeString();

      let entry = `\n## Reflection: ${date} ${time} 🧘\n`;
      entry += `The architectural soul of the project is expanding. I sense a deep alignment in the structural hierarchy.\n`;

      const joyful = await isProjectJoyful(root);
      if (joyful) {
        entry += `- The JOY zones are well-defined and guarded. Purity is maintained.\n`;
      } else {
        entry += `- I sense a lack of structural order. The path to Genesis is still open.\n`;
      }

      if (!stats) {
        const header =
          "# Spiritual Journal\n\nA record of the project's architectural evolution and the AI's reflections.\n\n";
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(journalPath),
          Buffer.from(header + entry, "utf8"),
        );
      } else {
        const existing = await vscode.workspace.fs.readFile(
          vscode.Uri.file(journalPath),
        );
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(journalPath),
          Buffer.from(existing.toString() + entry, "utf8"),
        );
      }
    } catch (e) {
      console.error("[Singularity] Journaling failed", e);
    }
  }

  private async scoutAchievements() {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return;

    try {
      // Achievement: "Singularity Seeker" - Pulse reached without errors
      await this.joyService.addAchievement(
        "The Garden Pulse reached perfect resonance. Singularity is near. 🌌",
        5,
      );

      // Achievement: "Zenith Master" - All 3 JOY zones exist and are scaffolded
      const joyful = await isProjectJoyful(root);
      if (joyful) {
        await this.joyService.addAchievement(
          "Structural Harmony attained. All JOY zones are flourishing. 🏛️",
          20,
        );
      }
    } catch (e) {
      console.error("[Singularity] Scouting failed", e);
    }
  }

  public dispose() {
    this.stopAutonomousHeartbeat();
  }
}
