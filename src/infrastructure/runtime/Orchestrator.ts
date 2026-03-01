import { Engine } from "../ai/Engine.js";
import { Mutex } from "../../plumbing/Plumbing.js";
import { processSessionEnd, renderMessage } from "../Services.js";
import {
  Callbacks,
  RunTelemetry,
  AutomationService,
  SessionMetadata,
  ProviderType,
} from "../../domain/types.js";
import { AIProvider } from "../ai/AIProvider.js";

export interface RuntimeConfigPort {
  getAiProvider(): ProviderType;
  getApiKey(): string;
  getCliConfig(): Record<string, unknown>;
  getModel(): string;
  getLlmFast(): string;
}

export interface RuntimeSessionStorePort {
  getSessions(): Promise<Record<string, any[]>>;
  saveSessions(sessions: Record<string, any[]>): Promise<void>;
  getSessionMetadata(): Promise<SessionMetadata[]>;
  saveSessionMetadata(metadata: SessionMetadata[]): Promise<void>;
  getCurrentSessionId(): Promise<string>;
  setCurrentSessionId(id: string): Promise<void>;
}

export interface RuntimeOptions<TAutomation extends AutomationService> {
  config: RuntimeConfigPort;
  sessionStore: RuntimeSessionStorePort;
  toolRegistrar: (automation: TAutomation) => void;
  providerFactory: (providerType: ProviderType, apiKey: string) => AIProvider;
  automationService: TAutomation;
}

export class Orchestrator<TAutomation extends AutomationService> {
  private provider: AIProvider | undefined;
  private currentSessionId: string = "default";
  private messages: any[] = [];
  private readonly initPromise: Promise<void>;
  private readonly processingMutex = new Mutex("ProcessingLock");

  constructor(private readonly options: RuntimeOptions<TAutomation>) {
    this.options.toolRegistrar(this.options.automationService);
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    this.currentSessionId =
      (await this.options.sessionStore.getCurrentSessionId()) || "default";
    const historyMap = await this.options.sessionStore.getSessions();
    this.messages = historyMap[this.currentSessionId] || [];
  }

  public async handleMessage(
    text: string,
    callbacks?: Callbacks,
  ): Promise<string> {
    const unlock = await this.processingMutex.acquire(100000);
    try {
      await this.initPromise;
      if (!this.provider) {
        const key = this.options.config.getApiKey();
        if (!key) return "Please configure your API key.";
        this.provider = this.options.providerFactory(
          this.options.config.getAiProvider(),
          key,
        );
      }

      const run: RunTelemetry = {
        runId: `run_${Date.now()}`,
        startedAt: Date.now(),
      };

      this.messages.push({
        role: "user",
        content: text,
        timestamp: Date.now(),
      });

      const engine = new Engine(this.provider);
      const response = await engine.chatLoop(
        this.messages,
        run,
        callbacks || {},
      );

      processSessionEnd(this.currentSessionId, this.messages).catch(() => {});

      return renderMessage(response);
    } finally {
      unlock();
    }
  }

  public async createSession(): Promise<string> {
    await this.initPromise;
    this.currentSessionId = `session_${Date.now()}`;
    this.messages = [];
    await this.options.sessionStore.setCurrentSessionId(this.currentSessionId);
    return this.currentSessionId;
  }

  public async listSessions(): Promise<SessionMetadata[]> {
    await this.initPromise;
    return await this.options.sessionStore.getSessionMetadata();
  }

  public async loadSession(id: string): Promise<string> {
    await this.initPromise;
    this.currentSessionId = id;
    const historyMap = await this.options.sessionStore.getSessions();
    this.messages = historyMap[id] || [];
    await this.options.sessionStore.setCurrentSessionId(id);
    return id;
  }

  public getMessages() {
    return this.messages;
  }
  public getCurrentSessionId() {
    return this.currentSessionId;
  }
}
