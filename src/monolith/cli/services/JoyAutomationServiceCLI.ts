import type { RunTelemetry } from '../../domain/marie/MarieTypes.js';
import type { RuntimeAutomationPort } from '../../runtime/types.js';
import type { JoyServiceCLI } from './JoyServiceCLI.js';
import {
    ensureJoyZoningFolders,
    executeGenesisRitual,
    scaffoldZoneAbstractions,
    sowFeature,
    synthesizeZoneManuals,
    isProjectJoyful
} from '../../domain/joy/JoyTools.js';

export class JoyAutomationServiceCLI implements RuntimeAutomationPort {
    private currentRun: RunTelemetry | undefined;

    constructor(
        private readonly joyService: JoyServiceCLI,
        private readonly workingDir: string
    ) { }

    private async ensureWorkingDir(): Promise<void> {
        const fs = await import('fs/promises');
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
        await this.joyService.addAchievement('Performed Genesis Ritual in CLI mode.', 50);
        return result;
    }

    public async sowJoyFeature(name: string, _intent: string): Promise<string> {
        await this.ensureWorkingDir();
        const result = await sowFeature(this.workingDir, name, _intent);
        await this.joyService.addAchievement(`Sowed feature '${name}' in CLI mode.`, 10);
        return result;
    }

    public async performGardenPulse(): Promise<string> {
        await this.ensureWorkingDir();
        const joyful = await isProjectJoyful(this.workingDir);
        await ensureJoyZoningFolders(this.workingDir);
        const scaffolded = await scaffoldZoneAbstractions(this.workingDir);
        const manuals = await synthesizeZoneManuals(this.workingDir);
        const status = joyful
            ? 'Garden pulse complete. JOY structure is stable.'
            : 'Garden pulse complete. JOY structure initialized.';
        await this.joyService.addAchievement('Performed garden pulse in CLI mode.', 5);
        return `${status}\n${scaffolded}\n${manuals}`;
    }

    public async autoScaffold(): Promise<void> {
        await this.ensureWorkingDir();
        await scaffoldZoneAbstractions(this.workingDir);
    }

    public dispose(): void {
        void this.workingDir;
    }
}