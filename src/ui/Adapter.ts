import { Callbacks, SessionMetadata, ProviderType } from "../domain/types.js";
import { registerToolDefinitions } from "../infrastructure/tools/CliTools.js";
import { registerCoreTools } from "../infrastructure/tools/ToolRegistry.js";
import { Storage } from "./storage.js";
import {
  Orchestrator,
  RuntimeConfigPort,
  RuntimeSessionStorePort,
} from "../infrastructure/runtime/Orchestrator.js";
import { Automation } from "../infrastructure/Automation.js";
import { createAIProvider } from "../infrastructure/ai/AIProvider.js";
import * as Config from "../infrastructure/Config.js";

class CliConfigPort implements RuntimeConfigPort {
  getAiProvider(): ProviderType {
    return "openrouter";
  }
  getApiKey(): string {
    return Config.getApiKey() || "";
  }
  getCliConfig(): Record<string, unknown> {
    return Config.getConfig();
  }
  getModel(): string {
    return Config.getModel();
  }
  getLlmFast(): string {
    return Config.getLlmFast();
  }
}

class CliSessionStorePort implements RuntimeSessionStorePort {
  async getSessions() {
    return Storage.getSessions();
  }
  async getSessionMetadata() {
    return await Storage.getSessionMetadata();
  }
  async getCurrentSessionId() {
    return await Storage.getCurrentSessionId();
  }
  async setCurrentSessionId(id: string) {
    await Storage.setCurrentSessionId(id);
  }
  async saveSessions(sessions: any) {
    await Storage.saveSessions(sessions);
  }
  async saveSessionMetadata(metadata: any) {
    await Storage.saveSessionMetadata(metadata);
  }
}

export class Adapter {
  private orchestrator: Orchestrator<Automation>;

  constructor(workingDir: string = process.cwd()) {
    const automation = new Automation(workingDir);
    registerCoreTools();
    this.orchestrator = new Orchestrator<Automation>({
      config: new CliConfigPort(),
      sessionStore: new CliSessionStorePort(),
      toolRegistrar: (auto) => registerToolDefinitions(auto, workingDir),
      providerFactory: (type, key) => createAIProvider(type, key),
      automationService: automation,
    });
  }

  public async handleMessage(text: string, callbacks?: Callbacks) {
    return this.orchestrator.handleMessage(text, callbacks);
  }
  public async createSession() {
    return this.orchestrator.createSession();
  }
  public async listSessions(): Promise<SessionMetadata[]> {
    return this.orchestrator.listSessions();
  }
  public async loadSession(id: string) {
    return this.orchestrator.loadSession(id);
  }
  public getMessages() {
    return this.orchestrator.getMessages();
  }
  public getCurrentSessionId() {
    return this.orchestrator.getCurrentSessionId();
  }
}
