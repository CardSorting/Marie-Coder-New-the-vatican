import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { MarieEngine } from "../infrastructure/ai/core/MarieEngine.js";
import { MarieProgressTracker } from "../infrastructure/ai/core/MarieProgressTracker.js";
import { MarieResponse } from "../infrastructure/ai/core/MarieResponse.js";
import { StringUtils } from "../plumbing/utils/StringUtils.js";
import {
  ApprovalRequest,
  MarieCallbacks,
  RunTelemetry,
} from "../domain/marie/MarieTypes.js";
import { AIProvider } from "../infrastructure/ai/providers/AIProvider.js";
import {
  MarieProviderType,
  RuntimeAutomationPort,
  RuntimeMessageHandler,
  RuntimeOptions,
  SessionMetadata,
} from "./types.js";

interface PendingApproval {
  resolve: (approved: boolean) => void;
  toolName: string;
  timestamp: number;
}

export class MarieRuntime<
  TAutomation extends RuntimeAutomationPort,
> implements RuntimeMessageHandler {
  private provider: AIProvider | undefined;
  private lastProviderKey: string | undefined;
  private toolRegistry: ToolRegistry;
  private currentSessionId: string = "default";
  private messages: any[] = [];
  private abortController: AbortController | null = null;
  private currentRun: RunTelemetry | undefined;
  private readonly initPromise: Promise<void>;
  private pendingApprovals = new Map<string, PendingApproval>();
  private processingLock: Promise<any> = Promise.resolve();
  private persistenceLock: Promise<any> = Promise.resolve();

  constructor(private readonly options: RuntimeOptions<TAutomation>) {

    this.toolRegistry = new ToolRegistry();
    this.options.toolRegistrar(
      this.toolRegistry,
      this.options.automationService,
    );
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    this.currentSessionId =
      (await this.options.sessionStore.getCurrentSessionId()) || "default";
    await this.loadHistory();
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private createProvider(providerType: string): AIProvider {
    const typedProvider = providerType as MarieProviderType;
    const key = this.options.config.getApiKey(typedProvider) || "";
    return this.options.providerFactory(typedProvider, key);
  }

  private initializeProvider(): void {
    const providerType = this.options.config.getAiProvider();
    const key = this.options.config.getApiKey(providerType) || "";
    const cacheKey = `${providerType}:${key}`;

    if (this.provider && this.lastProviderKey === cacheKey) {
      return;
    }

    this.lastProviderKey = cacheKey;
    this.provider = this.options.providerFactory(providerType, key);
  }

  private async loadHistory(): Promise<void> {
    const historyMap = await this.options.sessionStore.getSessions();
    this.messages = historyMap[this.currentSessionId] || [];
  }

  private async saveHistory(
    telemetry?: any,
    specificSessionId?: string,
    runStartTime?: number,
  ): Promise<void> {
    const unlock = await this.acquirePersistenceLock();
    try {
      if (this.messages.length > 50) {
        this.messages = this.messages.slice(this.messages.length - 50);
      }


      const sid = specificSessionId || this.currentSessionId;
      const historyMap = await this.options.sessionStore.getSessions();

      const currentSessionMatches = sid === this.currentSessionId;
      const isSessionStillValid = runStartTime ? true : currentSessionMatches;

      if (sid === this.currentSessionId && isSessionStillValid) {
        historyMap[sid] = this.messages;
      } else {
        if (!historyMap[sid]) {
          historyMap[sid] = [];
        }
      }

      await this.options.sessionStore.saveSessions(historyMap);

      const sessionMetadata =
        await this.options.sessionStore.getSessionMetadata();
      const index = sessionMetadata.findIndex(
        (s: SessionMetadata) => s.id === sid,
      );

      const targetMessages =
        sid === this.currentSessionId ? this.messages : historyMap[sid];
      const firstMsg =
        targetMessages && targetMessages.length > 0
          ? targetMessages[0].content
          : "";
      const title =
        targetMessages && targetMessages.length > 0
          ? this.generateSessionTitle(firstMsg)
          : "New Session";

      if (index >= 0) {
        sessionMetadata[index].lastModified = Date.now();
        if (sessionMetadata[index].title === "New Session") {
          sessionMetadata[index].title = title;
        }
      } else if (sid !== "default") {
        sessionMetadata.unshift({
          id: sid,
          title,
          lastModified: Date.now(),
          isPinned: false,
        });
      }

      await this.options.sessionStore.saveSessionMetadata(sessionMetadata);

      if (sid === this.currentSessionId) {
        await this.options.sessionStore.setCurrentSessionId(sid);
      }

      if (telemetry !== undefined) {
        await this.options.sessionStore.setLastTelemetry(
          telemetry === null ? undefined : telemetry,
        );
      }
    } finally {
      unlock();
    }
  }

  private generateSessionTitle(firstMessage: any): string {

    const response = MarieResponse.wrap(firstMessage);
    const text = response.getText();

    const goalMatch = text.match(/(?:Goal|Objective|Task):\s*([^\n.]+)/i);
    if (goalMatch && goalMatch[1].trim()) {
      return this.formatTitle(goalMatch[1].trim());
    }

    const lines = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 5);
    if (lines.length > 0 && lines[0].length < 60) {
      return this.formatTitle(lines[0]);
    }

    const summary = text.trim() || "New Session";
    return this.formatTitle(summary);
  }

  private formatTitle(text: string): string {
    const clean = text.replace(/^[#\-*\s]+/, "").trim();
    if (clean.length > 30) {
      return clean.substring(0, 27) + "...";
    }
    return clean || "New Session";
  }

  public async createSession(): Promise<string> {
    await this.ensureInitialized();
    this.currentSessionId = `session_${Date.now()}`;
    this.messages = [];
    await this.saveHistory();
    return this.currentSessionId;
  }

  public async listSessions(): Promise<SessionMetadata[]> {
    await this.ensureInitialized();
    return this.options.sessionStore.getSessionMetadata();
  }

  public async loadSession(id: string): Promise<string> {
    await this.ensureInitialized();
    this.stopGeneration();
    this.currentSessionId = id;
    await this.loadHistory();
    await this.options.sessionStore.setCurrentSessionId(id);
    return this.currentSessionId;
  }

  public async deleteSession(id: string): Promise<void> {
    await this.ensureInitialized();
    let firstSessionId: string | undefined;
    let shouldLoadFirst = false;
    let shouldCreateNew = false;

    const unlock = await this.acquirePersistenceLock();
    try {
      if (this.currentSessionId === id) {
        this.stopGeneration();
      }

      const historyMap = await this.options.sessionStore.getSessions();
      delete historyMap[id];
      await this.options.sessionStore.saveSessions(historyMap);

      const sessionMetadata =
        await this.options.sessionStore.getSessionMetadata();
      const filteredMetadata = sessionMetadata.filter((s) => s.id !== id);
      await this.options.sessionStore.saveSessionMetadata(filteredMetadata);

      if (this.currentSessionId === id) {
        if (filteredMetadata.length > 0) {
          shouldLoadFirst = true;
          firstSessionId = filteredMetadata[0].id;
        } else {
          shouldCreateNew = true;
        }
      }
    } finally {
      unlock();
    }

    if (shouldLoadFirst && firstSessionId) {
      await this.loadSession(firstSessionId);
    } else if (shouldCreateNew) {
      await this.createSession();
    }
  }

  public async renameSession(id: string, newTitle: string): Promise<void> {
    const unlock = await this.acquirePersistenceLock();
    try {
      await this.ensureInitialized();
      const sessionMetadata =
        await this.options.sessionStore.getSessionMetadata();
      const index = sessionMetadata.findIndex((s) => s.id === id);
      if (index >= 0) {
        sessionMetadata[index].title = newTitle;
        await this.options.sessionStore.saveSessionMetadata(sessionMetadata);
      }
    } finally {
      unlock();
    }
  }

  public async togglePinSession(id: string): Promise<void> {
    const unlock = await this.acquirePersistenceLock();
    try {
      await this.ensureInitialized();
      const sessionMetadata =
        await this.options.sessionStore.getSessionMetadata();
      const index = sessionMetadata.findIndex((s) => s.id === id);
      if (index >= 0) {
        sessionMetadata[index].isPinned = !sessionMetadata[index].isPinned;
        await this.options.sessionStore.saveSessionMetadata(sessionMetadata);
      }
    } finally {
      unlock();
    }
  }

  public async handleMessage(
    text: string,
    callbacks?: MarieCallbacks,
  ): Promise<string> {
    const unlock = await this.acquireProcessingLock();
    try {
      await this.ensureInitialized();

      this.initializeProvider();

      if (!this.provider) {
        return "Please configure your API key for the selected provider.";
      }

      const lastTelemetry = await this.options.sessionStore.getLastTelemetry();
      const originatingSessionId = this.currentSessionId;
      const run: RunTelemetry = {
        runId: `run_${Date.now()}`,
        startedAt: Date.now(),
        steps: 0,
        tools: 0,
        objectives: [
          {
            id: "understand_request",
            label: "Understand request",
            status: "in_progress",
          },
          { id: "execute_plan", label: "Execute plan", status: "pending" },
          { id: "deliver_result", label: "Deliver result", status: "pending" },
        ],
        activeObjectiveId: "understand_request",
        achieved: [],
        currentPass: lastTelemetry?.currentPass,
        totalPasses: lastTelemetry?.totalPasses,
        passFocus: lastTelemetry?.passFocus,
        isResuming: !!lastTelemetry,
        originatingSessionId,
      };

      const tracker = new MarieProgressTracker(
        {
          ...callbacks,
          onStream: (chunk) =>
            callbacks?.onStream?.(chunk, run.runId, originatingSessionId),
          onTool: (tool) =>
            callbacks?.onTool?.(tool, run.runId, originatingSessionId),
          onToolDelta: (delta) =>
            callbacks?.onToolDelta?.(delta, run.runId, originatingSessionId),
          onEvent: (event) => {
            (event as any).originatingSessionId = originatingSessionId;
            if (
              event.type === "progress_update" ||
              event.type === "session_persistence_update" ||
              event.type === "file_stream_delta"
            ) {
              this.options.onProgressEvent?.(event);
            }
            callbacks?.onEvent?.(event);
          },
        },
        run,
      );

      this.currentRun = run;
      this.options.automationService.setCurrentRun(run);

      const approvalRequester = async (
        name: string,
        input: any,
        diff?: { old: string; new: string },
      ): Promise<boolean> => {
        if (this.options.shouldBypassApprovals?.()) {
          return true;
        }

        const request: ApprovalRequest = {
          id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          toolName: name,
          toolInput: input,
          diff,
        };

        const hasHandlers = Boolean(
          callbacks?.onApprovalRequest || this.options.onApprovalRequest,
        );
        if (!hasHandlers) {
          return true;
        }

        const approvalPromise = new Promise<boolean>((resolve) => {
          this.pendingApprovals.set(request.id, {
            resolve,
            toolName: name,
            timestamp: Date.now(),
          });
        });

        callbacks?.onApprovalRequest?.(request, run.runId, originatingSessionId);
        if (this.options.onApprovalRequest) {
          void this.options.onApprovalRequest(request).then((approved) => {
            this.resolveApproval(request.id, approved);
          });
        }

        return approvalPromise;
      };

      const engine = new MarieEngine(
        this.provider,
        this.toolRegistry,
        approvalRequester,
        this.createProvider.bind(this),
        this.options.fs,
        this.options.ghostPort,
      );

      tracker.emitEvent({
        type: "run_started",
        runId: run.runId,
        startedAt: run.startedAt,
      });
      tracker.emitProgressUpdate("Thinking...");

      this.messages.push({ role: "user", content: text, timestamp: Date.now() });
      await this.saveHistory();

      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();
      const runStartTime = Date.now();

      try {
        const response = await engine.chatLoop(
          this.messages,
          tracker,
          (t: any) => this.saveHistory(t, originatingSessionId, runStartTime),
          this.abortController.signal,
        );

        if (this.messages.length >= 6 && this.messages.length <= 10) {
          const sessionMetadata =
            await this.options.sessionStore.getSessionMetadata();
          const session = sessionMetadata.find(
            (s) => s.id === this.currentSessionId,
          );
          if (
            session &&
            (session.title === "New Session" || session.title.length > 50)
          ) {
            this.summarizeSession(this.currentSessionId).catch(console.error);
          }
        }

        return response;
      } catch (error) {
        tracker.emitEvent({
          type: "run_error",
          runId: run.runId,
          elapsedMs: tracker.elapsedMs(),
          message: String(error),
        });
        return `Error: ${error}`;
      }
    } finally {
      this.abortController = null;
      this.currentRun = undefined;
      unlock();
    }
  }



  private async summarizeSession(id: string): Promise<void> {
    this.initializeProvider();
    if (!this.provider) return;

    const historyMap = await this.options.sessionStore.getSessions();
    const messages = historyMap[id] || [];
    if (messages.length < 2) return;

    const engine = new MarieEngine(
      this.provider,
      this.toolRegistry,
      async () => true,
    );
    const prompt =
      "Based on our conversation so far, generate a very concise (3-5 words) and descriptive title for this session. Respond ONLY with the title. No quotes, no intro.";

    try {
      const summary = await engine.chatLoop(
        [...messages, { role: "user", content: prompt }],
        { emitProgressUpdate: () => { }, emitEvent: () => { } } as any,
        async () => { },
      );

      if (summary && typeof summary === "string" && summary.length < 60) {
        await this.renameSession(id, summary.trim().replace(/^"|"$/g, ""));
      } else if (summary && String(summary).length < 60) {
        const text = StringUtils.extractText(summary).trim();
        await this.renameSession(id, text.replace(/^"|"$/g, ""));
      }
    } catch (e) {
      console.error("Failed to summarize session", e);
    }
  }

  public async clearCurrentSession(): Promise<void> {
    await this.ensureInitialized();
    this.messages = [];
    await this.saveHistory();
  }

  public stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public updateSettings(): void {
    this.initializeProvider();
  }

  public async getModels(): Promise<{ id: string; name: string }[]> {
    await this.ensureInitialized();
    this.initializeProvider();
    return this.provider?.listModels() || [];
  }

  public getMessages(): any[] {
    return this.messages;
  }

  public getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  public getCurrentRun(): RunTelemetry | undefined {
    return this.currentRun;
  }

  public resolveApproval(requestId: string, approved: boolean): boolean {
    const entry = this.pendingApprovals.get(requestId);
    if (!entry) return false;
    this.pendingApprovals.delete(requestId);
    entry.resolve(approved);
    return true;
  }

  private async acquireProcessingLock(): Promise<() => void> {
    const currentTask = this.processingLock;
    let resolver: (value: void) => void;
    this.processingLock = new Promise((resolve) => {
      resolver = resolve;
    });
    await currentTask;
    return () => resolver(undefined);
  }

  private async acquirePersistenceLock(): Promise<() => void> {
    const currentTask = this.persistenceLock;
    let resolver: (value: void) => void;
    this.persistenceLock = new Promise((resolve) => {
      resolver = resolve;
    });
    await currentTask;
    return () => resolver(undefined);
  }


  public dispose(): void {

    this.stopGeneration();
    this.options.automationService.dispose?.();
  }
}
