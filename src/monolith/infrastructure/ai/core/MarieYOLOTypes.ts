export type YoloStrategy = 'EXECUTE' | 'RESEARCH' | 'DEBUG' | 'PANIC' | 'HYPE';
export type YoloMood = 'AGGRESSIVE' | 'CAUTIOUS' | 'INQUISITIVE' | 'ZEN' | 'EUPHORIA' | 'DOUBT' | 'FRICTION' | 'STABLE' | 'FLUIDITY' | 'HESITATION';
export type YoloUrgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type YoloStopCondition = 'landed' | 'structural_uncertainty';

export interface YoloToolExecution {
    name: string;
    durationMs: number;
    success: boolean;
    timestamp: number;
    filePath?: string;
}

export interface YoloDecision {
    strategy: YoloStrategy;
    urgency: YoloUrgency;
    confidence: number;
    isContinueDirective: boolean;
    structuralUncertainty: boolean;
    reason: string;
    requiredActions: string[];
    blockedBy: string[];
    stopCondition: YoloStopCondition;
    profile: 'demo_day' | 'balanced' | 'recovery';
    raw: string;
}

export interface YoloMemory {
    lastActiveFile?: string;
    errorHotspots: Record<string, number>;
    totalErrorCount: number;
    flowState: number; // 0-100
    recentFiles: string[];
    toolHistory: string[];
    toolExecutions: YoloToolExecution[];
    successStreak: number;
    shakyResponseDensity: number;
    writtenFiles: string[];
    actionDiffs: Record<string, string>;
    wiringAlerts: string[];
    lastDecision?: YoloDecision;
    mood: YoloMood;
    panicCoolDown: number;
}
