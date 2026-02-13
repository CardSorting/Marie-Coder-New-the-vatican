import type { RunTelemetry } from '../../domain/marie/MarieTypes.js';
import type { RuntimeAutomationPort } from '../../runtime/types.js';
import type { JoyServiceCLI } from './JoyServiceCLI.js';

export class JoyAutomationServiceCLI implements RuntimeAutomationPort {
    private currentRun: RunTelemetry | undefined;

    constructor(
        private readonly joyService: JoyServiceCLI,
        private readonly workingDir: string
    ) { }

    public setCurrentRun(run: RunTelemetry | undefined): void {
        this.currentRun = run;
    }

    public getCurrentRun(): RunTelemetry | undefined {
        return this.currentRun;
    }

    public async triggerGenesis(): Promise<string> {
        await this.joyService.addAchievement('Genesis ritual not available in CLI mode.', 0);
        return 'Genesis ritual is not available in CLI mode.';
    }

    public async sowJoyFeature(name: string, _intent: string): Promise<string> {
        await this.joyService.addAchievement(`Sow joy feature is not available in CLI mode (${name}).`, 0);
        return `Sow joy feature is not available in CLI mode: ${name}.`;
    }

    public async performGardenPulse(): Promise<string> {
        await this.joyService.addAchievement('Garden pulse not available in CLI mode.', 0);
        return 'Garden pulse is not available in CLI mode.';
    }

    public async autoScaffold(): Promise<void> {
        // No-op in CLI mode.
    }

    public dispose(): void {
        void this.workingDir;
    }
}