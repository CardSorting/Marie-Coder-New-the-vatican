import { EventEmitter } from 'events';

export interface JoyScoreEvent {
    delta: number;
    reason?: string;
}

export interface RunProgressEvent {
    runId?: string;
    activeToolName?: string;
    lastToolName?: string;
    activeObjectiveId?: string;
    context?: string;
}

export interface LettingGoRequest {
    path: string;
    lines: number;
}

export class JoyServiceCLI {
    private intention: string | null = null;
    private readonly _onJoyScoreChange = new EventEmitter();
    private readonly _onRunProgress = new EventEmitter();
    private readonly _onLettingGoRequest = new EventEmitter();

    public readonly onJoyScoreChange = this._onJoyScoreChange;
    public readonly onRunProgress = this._onRunProgress;
    public readonly onLettingGoRequest = this._onLettingGoRequest;

    constructor() { }

    public async addAchievement(message: string, points: number = 5): Promise<void> {
        if (process.env.MARIE_DEBUG) {
            console.log(`[JOY +${points}] ${message}`);
        }
        this._onJoyScoreChange.emit('score', { delta: points, reason: message } as JoyScoreEvent);
    }

    public async setIntention(intention: string): Promise<void> {
        this.intention = intention;
        if (process.env.MARIE_DEBUG) {
            console.log(`[JOY] Intention set: ${intention}`);
        }
    }

    public async getProjectHealth() {
        return {
            average: 100,
            fileCount: 0,
            zoningViolations: 0,
            joyfulFiles: 0,
            plumbingFiles: 0,
            isJoyful: true,
            log: [] as string[],
            migrationAlerts: [] as string[],
            clusteringAlerts: [] as string[]
        };
    }

    public async requestLettingGo(path: string): Promise<void> {
        let lines = 0;
        try {
            const fs = await import('fs');
            const content = fs.readFileSync(path, 'utf-8');
            lines = content.split('\n').length;
        } catch {
            lines = 0;
        }

        this._onLettingGoRequest.emit('request', { path, lines } as LettingGoRequest);
    }

    public emitRunProgress(progress: RunProgressEvent): void {
        this._onRunProgress.emit('progress', progress);
    }

    public dispose(): void {
        this._onJoyScoreChange.removeAllListeners();
        this._onRunProgress.removeAllListeners();
        this._onLettingGoRequest.removeAllListeners();
    }
}