export type AscensionTechnique =
  | "EXECUTE"
  | "RESEARCH"
  | "DEBUG"
  | "PANIC"
  | "HYPE"
  | "LIMIT_BREAK";
export type SpiritMood =
  | "AGGRESSIVE"
  | "CAUTIOUS"
  | "INQUISITIVE"
  | "ZEN"
  | "EUPHORIA"
  | "DOUBT"
  | "FRICTION"
  | "STABLE"
  | "FLUIDITY"
  | "HESITATION";
export type SpiritUrgency = "LOW" | "MEDIUM" | "HIGH";
export type AscensionStopCondition = "landed" | "structural_uncertainty";

export interface TechniqueExecution {
  name: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
  filePath?: string;
}

export interface AscensionDecree {
  strategy: AscensionTechnique;
  urgency: SpiritUrgency;
  confidence: number;
  isContinueDirective: boolean;
  structuralUncertainty: boolean;
  reason: string;
  requiredActions: string[];
  blockedBy: string[];
  stopCondition: AscensionStopCondition;
  heroicVow?: string;
  vowLockMs?: number;
  sacrificeTriggered?: boolean;
  profile: "demo_day" | "balanced" | "recovery";
  raw: string;
}

export interface AscensionState {
  lastActiveFile?: string;
  errorHotspots: Record<string, number>;
  totalErrorCount: number;
  spiritPressure: number; // Formerly flowState, 0-100
  recentFiles: string[];
  toolHistory: string[];
  techniqueExecutions: TechniqueExecution[];
  victoryStreak: number;
  shakyResponseDensity: number;
  writtenFiles: string[];
  actionDiffs: Record<string, string>;
  wiringAlerts: string[];
  lastDecree?: AscensionDecree;
  mood: SpiritMood;
  isSpiritBurstActive: boolean;
  isAwakened: boolean;
  karmaBond?: string;
  panicCoolDown: number;
  environment: "cli" | "vscode" | "unknown";
}
