import type { RunTelemetry } from "../../domain/marie/MarieTypes.js";
import type { RuntimeAutomationPort } from "../../runtime/types.js";
import type { JoyServiceCLI } from "./JoyServiceCLI.js";
import {
  ensureJoyZoningFolders,
  executeGenesisRitual,
  scaffoldZoneAbstractions,
  sowFeature,
  synthesizeZoneManuals,
  isProjectJoyful,
  proposeReorganization,
  proposeClustering,
  generateJoyDashboard,
  generateTidyChecklist,
  executeRestoration,
} from "../../domain/joy/JoyTools.js";
import { FileSystemPort } from "../../infrastructure/ai/core/FileSystemPort.js";

export class JoyAutomationServiceCLI implements RuntimeAutomationPort {
  private currentRun: RunTelemetry | undefined;

  constructor(
    private readonly workingDir: string,
    private readonly joyService: JoyServiceCLI,
    public readonly fs: FileSystemPort,
  ) {}

  private async ensureWorkingDir(): Promise<void> {
    const fs = await import("fs/promises");
    await fs.mkdir(this.workingDir, { recursive: true });
  }

  public setCurrentRun(run: RunTelemetry | undefined): void {
    this.currentRun = run;
  }

  public getCurrentRun(): RunTelemetry | undefined {
    return this.currentRun;
  }

  public async triggerGenesis(): Promise<string> {
    await this.ensureWorkingDir();
    const result = await executeGenesisRitual(this.workingDir);
    await this.joyService.addAchievement(
      "Performed Genesis Ritual in CLI mode. Project reborn in JOY. ✨",
      50,
    );
    return result;
  }

  public async sowJoyFeature(name: string, _intent: string): Promise<string> {
    await this.ensureWorkingDir();
    const result = await sowFeature(this.workingDir, name, _intent);
    await this.joyService.addAchievement(
      `Sowed feature '${name}' in CLI mode. 🌱`,
      10,
    );
    return result;
  }

  public async performGardenPulse(): Promise<string> {
    await this.ensureWorkingDir();
    let finalReport = "";
    try {
      const joyful = await isProjectJoyful(this.workingDir);
      await ensureJoyZoningFolders(this.workingDir);
      const scaffolded = await scaffoldZoneAbstractions(this.workingDir);
      finalReport += scaffolded;

      const proposals = await proposeReorganization(this.workingDir);
      const clustering = await proposeClustering(this.workingDir);
      const manuals = await synthesizeZoneManuals(this.workingDir);

      if (!joyful) {
        finalReport += `\n- ⚠️ **Architectural Void**: This project has not yet embraced the JOY structure. Use the Genesis Ritual to begin your journey.`;
      }
      if (proposals.length > 0)
        finalReport += `\n- ${proposals.length} structural drifts detected.`;
      if (clustering.length > 0)
        finalReport += `\n- ${clustering.length} zones ripe for clustering.`;

      await this.joyService.addAchievement(
        "Performed garden pulse in CLI mode. 🌸",
        5,
      );
      return `${finalReport}\n${manuals}\n\nThe garden continues to evolve in harmony. ✨`;
    } catch (e: any) {
      return `\n- ❌ **Pulse Interrupted**: A structural error occurred during synthesis: ${e.message}`;
    }
  }

  public async triggerReview(): Promise<string> {
    const dashboard = await generateJoyDashboard(this.workingDir);
    const checklist = await generateTidyChecklist(this.workingDir);
    return `# 🌸 Joy Review\n\n${dashboard}\n\n## 📋 Tidy Checklist\n${checklist}`;
  }

  public async autoScaffold(): Promise<void> {
    await this.ensureWorkingDir();
    await scaffoldZoneAbstractions(this.workingDir);
  }

  public async executeAutonomousRestoration(): Promise<string> {
    await this.ensureWorkingDir();
    const result = await executeRestoration(this.workingDir);
    await this.joyService.addAchievement(
      "The Garden was autonomously restored to harmony in CLI. ✨",
      50,
    );
    return result;
  }

  public async executeSelfHealing(
    failedPath: string,
    errorReason: string,
  ): Promise<string> {
    await this.joyService.addAchievement(
      "Self-healing initiated in CLI. 🧬",
      15,
    );
    return `Self-healing: Analyzing \`${failedPath}\` to resolve: ${errorReason}. \nPlease retry the operation to refresh context. ✨`;
  }

  public dispose(): void {
    void this.workingDir;
  }
}
