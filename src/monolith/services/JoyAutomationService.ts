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
} from "../infrastructure/joy/JoyTools.js";
import { JoyService } from "./JoyService.js";
import { RunTelemetry } from "../domain/marie/MarieTypes.js";
import { MarieSentinelService } from "../plumbing/analysis/MarieSentinelService.js";

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
      // 🛡️ Marie Sentinel v2 - Serious Architectural Guardian
      const report = await MarieSentinelService.audit(root);
      finalReport += `🛡️ **Sentinel Scan Complete**: ${report.stability} (Entropy: ${report.entropyScore})\n`;

      if (report.zoneViolations.length > 0) {
        finalReport += `- ❌ Found ${report.zoneViolations.length} architectural violations.\n`;
      } else {
        finalReport += `- ✅ No cross-zone contamination detected. Domain remains pure.\n`;
      }

      const joyful = await isProjectJoyful(root);
      await ensureJoyZoningFolders(root);
      const scaffolded = await scaffoldZoneAbstractions(root);

      const proposals = await proposeReorganization(root);
      const clustering = await proposeClustering(root);

      if (!joyful) {
        finalReport += `\n- ⚠️ **Architectural Void**: Project has not yet embraced the JOY structure.`;
      }

      if (proposals.length > 0) {
        finalReport += `\n- ${proposals.length} structural drifts detected.`;

        const { ConfigService } =
          await import("../infrastructure/config/ConfigService.js");
        const autoRepair = ConfigService.getAutoRepair();

        if (proposals.length > 5 || report.entropyScore > 10) {
          if (autoRepair) {
            await this.joyService.addAchievement(
              "Sentinel Auto-Repair initiated. 🛠️",
              10,
            );
            const repairResult = await this.executeAutonomousRestoration();
            finalReport += `\n- 🛠️ **Auto-Repair Executed**: ${repairResult}`;
          }
        }
      }

      await this.scoutAchievements();
    } catch (e: any) {
      finalReport += `\n- ❌ **Pulse Interrupted**: ${e.message}`;
    }

    return `${finalReport}\n\nThe system remains under Sentinel protection. 🛡️`;
  }

  public startAutonomousHeartbeat(intervalMs: number = 300000) {
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

  public async executeSelfHealing(
    failedPath: string,
    errorReason: string,
  ): Promise<string> {
    await this.joyService.addAchievement("Self-healing initiated. 🧬", 15);

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

  private async scoutAchievements() {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return;

    try {
      await this.joyService.addAchievement(
        "Sentinel Resonance achieved. 🌌",
        5,
      );

      const joyful = await isProjectJoyful(root);
      if (joyful) {
        await this.joyService.addAchievement(
          "Structural Harmony attained. 🏛️",
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
