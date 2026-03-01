export type PassStatus = "pending" | "in_progress" | "completed" | "failed";
export type ProviderType = "openrouter" | "anthropic" | "google";

export interface SessionMetadata {
  id: string;
  title: string;
  lastModified: number;
  isPinned: boolean;
}

export interface ProgressObjective {
  id: string;
  label: string;
  status: PassStatus;
  context?: string;
}

export interface RunTelemetry {
  runId: string;
  startedAt: number;
  completedAt?: number;
  success?: boolean;
  error?: string;
}

export interface ProgressUpdate {
  context?: string;
  currentPass?: number;
  totalPasses?: number;
  passFocus?: string;
  type?: string;
  tool?: string;
  args?: any;
  result?: any;
}

export interface Callbacks {
  onStream?: (chunk: string, runId: string) => void;
  onProgress?: (update: ProgressUpdate) => void;
}

export interface AutomationService {
  executeRun(
    sessionId: string,
    messages: any[],
    callbacks: Callbacks,
    signal?: AbortSignal,
  ): Promise<RunTelemetry>;
  dispose?(): void;
}
