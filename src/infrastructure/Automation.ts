import { AIProvider } from "./ai/AIProvider.js";
import { Engine } from "./ai/Engine.js";
import { Callbacks, RunTelemetry, AutomationService } from "../domain/types.js";

export class Automation implements AutomationService {
  protected provider: AIProvider | undefined;

  constructor(protected readonly workingDir: string) {}

  public setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  public async executeRun(
    sessionId: string,
    messages: any[],
    callbacks: Callbacks,
    signal?: AbortSignal,
  ): Promise<RunTelemetry> {
    if (!this.provider) throw new Error("AI Provider not set");

    const run: RunTelemetry = {
      runId: `run_${Date.now()}`,
      startedAt: Date.now(),
    };
    const engine = new Engine(this.provider);

    try {
      const response = await engine.chatLoop(messages, run, callbacks, signal);
      run.success = true;
      run.completedAt = Date.now();

      messages.push({ role: "assistant", content: response });
      return run;
    } catch (error: any) {
      run.success = false;
      run.error = error.message;
      run.completedAt = Date.now();
      throw error;
    }
  }

  public dispose(): void {}
}
