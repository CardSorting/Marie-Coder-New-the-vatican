import * as vscode from "vscode";
import { Marie } from "./monolith/adapters/VscodeMarieAdapter.js";
import { JoyService } from "./monolith/services/JoyService.js";
import { JoyLogService } from "./monolith/services/JoyLogService.js";
import { ConfigService } from "./monolith/infrastructure/config/ConfigService.js";

let marie: Marie | undefined;
let joyService: JoyService | undefined;
let mariePanel: vscode.WebviewPanel | undefined;
let webviewHost: MarieWebviewHost | undefined;

type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

class MarieWebviewHost {
  private webviews = new Set<vscode.Webview>();
  private stateSubscription: (() => void) | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly marieInstance: Marie,
  ) {
    this.stateSubscription = this.marieInstance.onStateChanged((state) => {
      this.pushState(state);
    });
  }

  public attach(webview: vscode.Webview): void {
    console.log("[MarieHost] Attaching new webview");
    this.webviews.add(webview);

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview-ui"),
        vscode.Uri.joinPath(this.context.extensionUri, "assets"),
      ],
    };

    const scriptDiskPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview-ui",
      "main.js",
    );
    vscode.workspace.fs.stat(scriptDiskPath).then(
      () => undefined,
      () => {
        void vscode.window.showErrorMessage(
          "Marie webview bundle missing (dist/webview-ui/main.js). Run `npm run build` and reinstall the extension.",
        );
      },
    );

    webview.html = this.getHtml(webview);
    webview.onDidReceiveMessage((message) => this.onMessage(message));

    // Refined: push initial state ONLY to this webview immediately after attach
    this.pushInitState(webview).catch(() => undefined);
  }

  public detach(webview: vscode.Webview): void {
    this.webviews.delete(webview);
  }

  public dispose(): void {
    if (this.stateSubscription) {
      this.stateSubscription();
      this.stateSubscription = undefined;
    }
  }

  private post(message: any): void {
    for (const webview of this.webviews) {
      void webview.postMessage(message);
    }
  }

  private async pushState(runtimeState: any): Promise<void> {
    const config = this.getConfigSnapshot();
    const sessions = await this.marieInstance.listSessions();
    const uiMessages = runtimeState.messages.map((message: any, index: number) => ({
      id: `hist_${index}`,
      role: (message.role || "assistant") as UiMessage["role"],
      content: this.extractMessageText(message),
      timestamp: message.timestamp || Date.now(),
    }));

    this.post({
      type: "init_state",
      state: {
        messages: uiMessages,
        config: config,
        currentSessionId: runtimeState.currentSessionId,
        sessions: sessions,
        availableModels: await this.marieInstance.getModels(),
        sequenceNumber: runtimeState.sequenceNumber,
      },
    });
  }

  private async onMessage(message: any): Promise<void> {
    console.log("[MarieHost] Received message from webview:", message?.type);
    switch (message?.type) {
      case "ready":
        await this.pushInitState();
        return;
      case "send_message":
        await this.handleSendMessage(String(message.text || ""));
        return;
      case "stop_generation":
        this.marieInstance.stopGeneration();
        this.post({ type: "status", isLoading: false });
        return;
      case "approval_response":
        if (message.id && typeof message.approved === "boolean") {
          this.marieInstance.resolveApproval(
            String(message.id),
            Boolean(message.approved),
          );
        }
        return;
      case "create_session":
        await this.marieInstance.createSession();
        await this.pushInitState();
        return;
      case "clear_session":
        await this.marieInstance.clearCurrentSession();
        await this.pushInitState();
        return;
      case "list_sessions":
        await this.pushSessions();
        return;
      case "load_session":
        if (message.id) {
          await this.marieInstance.loadSession(String(message.id));
          await this.pushInitState();
        }
        return;
      case "delete_session":
        if (message.id) {
          await this.marieInstance.deleteSession(String(message.id));
          await this.pushInitState();
        }
        return;
      case "rename_session":
        if (message.id && message.title) {
          await this.marieInstance.renameSession(
            String(message.id),
            String(message.title),
          );
          await this.pushSessions();
        }
        return;
      case "toggle_pin_session":
        if (message.id) {
          await this.marieInstance.togglePinSession(String(message.id));
          await this.pushSessions();
        }
        return;
      case "get_models":
        // Models are now part of init_state, but we keep this for manual refreshes
        this.post({
          type: "models",
          models: await this.marieInstance.getModels(),
        });
        return;
      case "set_provider":
        await this.setProvider(String(message.provider || "anthropic"));
        return;
      case "set_model":
        await this.setModel(String(message.model || ""));
        return;
      case "set_autonomy_mode":
        await this.setAutonomyMode(String(message.mode || "balanced"));
        return;
      case "set_api_key":
        await this.setApiKey(
          String(message.provider || "anthropic"),
          String(message.apiKey || ""),
        );
        return;
      case "open_settings":
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:cardsorting.marie",
        );
        return;
      default:
        return;
    }
  }

  private async handleSendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.post({ type: "status", isLoading: true });
    this.post({ type: "user_echo", text: trimmed });

    try {
      const response = await this.marieInstance.handleMessage(trimmed, {
        onStream: (chunk) => {
          this.post({ type: "message_stream", chunk });
        },
        onTool: (tool) => {
          this.post({ type: "tool_event", tool });
        },
        onToolDelta: (delta) => {
          this.post({ type: "tool_delta", delta });
        },
        onApprovalRequest: (request) => {
          this.post({ type: "approval_request", request });
        },
        onEvent: (event) => {
          this.post({ type: "runtime_event", event });
        },
      });

      this.post({ type: "assistant_response", text: response });
    } catch (error) {
      this.post({ type: "error", message: String(error) });
    } finally {
      this.post({ type: "status", isLoading: false });
      await this.pushSessions();
    }
  }

  private async setAutonomyMode(rawMode: string): Promise<void> {
    const mode =
      rawMode === "yolo" || rawMode === "high" ? rawMode : "balanced";
    const cfg = vscode.workspace.getConfiguration("marie");
    await cfg.update("autonomyMode", mode, vscode.ConfigurationTarget.Global);
    this.marieInstance.updateSettings();
    this.post({ type: "config", config: this.getConfigSnapshot() });
  }

  private async setProvider(rawProvider: string): Promise<void> {
    const provider =
      rawProvider === "openrouter" || rawProvider === "cerebras"
        ? rawProvider
        : "anthropic";
    const cfg = vscode.workspace.getConfiguration("marie");

    // Get the current model to check if we need to reset it for the new provider
    const currentModel = ConfigService.getModel();

    // Define sensible default models for each provider
    let newModel: string;
    if (provider === "openrouter") {
      // For OpenRouter, use the OpenRouter format for Claude
      newModel = "anthropic/claude-3.5-sonnet";
    } else if (provider === "cerebras") {
      // For Cerebras, use Llama
      newModel = "llama3.1-8b";
    } else {
      // For Anthropic, use the default Claude model
      newModel = "claude-3-5-sonnet-20241022";
    }

    // Only update model if it's not already set to a compatible model for the provider
    // Check if current model would work with the new provider
    const needsModelReset = !this.isModelCompatibleWithProvider(
      currentModel,
      provider,
    );

    await cfg.update("aiProvider", provider, vscode.ConfigurationTarget.Global);
    if (needsModelReset) {
      await cfg.update("model", newModel, vscode.ConfigurationTarget.Global);
    }

    this.marieInstance.updateSettings();
    this.post({ type: "config", config: this.getConfigSnapshot() });
    this.post({ type: "models", models: await this.marieInstance.getModels() });
  }

  private isModelCompatibleWithProvider(
    model: string,
    provider: string,
  ): boolean {
    if (provider === "anthropic") {
      // Anthropic accepts claude-* models
      return model.startsWith("claude-");
    } else if (provider === "openrouter") {
      // OpenRouter accepts models in various formats (anthropic/*, openai/*, google/*, etc.)
      // or common models like llama-*
      return (
        model.includes("/") ||
        model.startsWith("llama-") ||
        model.startsWith("gpt-")
      );
    } else if (provider === "cerebras") {
      // Cerebras accepts llama-* models
      return model.startsWith("llama-");
    }
    return false;
  }

  private async setModel(rawModel: string): Promise<void> {
    const model = rawModel.trim();
    if (!model) return;

    const cfg = vscode.workspace.getConfiguration("marie");
    await cfg.update("model", model, vscode.ConfigurationTarget.Global);
    this.marieInstance.updateSettings();
    this.post({ type: "config", config: this.getConfigSnapshot() });
  }

  private async setApiKey(rawProvider: string, rawKey: string): Promise<void> {
    const provider =
      rawProvider === "openrouter" || rawProvider === "cerebras"
        ? rawProvider
        : "anthropic";
    const apiKey = rawKey.trim();
    if (!apiKey) return;

    const cfg = vscode.workspace.getConfiguration("marie");
    const settingKey =
      provider === "openrouter"
        ? "openrouterApiKey"
        : provider === "cerebras"
          ? "cerebrasApiKey"
          : "apiKey";

    await cfg.update(settingKey, apiKey, vscode.ConfigurationTarget.Global);
    this.marieInstance.updateSettings();
    this.post({ type: "config", config: this.getConfigSnapshot() });
    this.post({ type: "models", models: await this.marieInstance.getModels() });
  }

  private async pushInitState(targetWebview?: vscode.Webview): Promise<void> {
    console.log("[MarieHost] Pushing initial state...");
    const config = this.getConfigSnapshot();
    const messages = this.getUiMessages();
    const sessions = await this.marieInstance.listSessions();
    const currentSessionId = this.marieInstance.getCurrentSessionId();

    const payload = {
      type: "init_state",
      state: {
        messages: messages,
        config: config,
        currentSessionId: currentSessionId,
        sessions: sessions,
        availableModels: await this.marieInstance.getModels(),
      },
    };

    if (targetWebview) {
      void targetWebview.postMessage(payload);
    } else {
      this.post(payload);
    }
  }


  private async pushSessions(): Promise<void> {
    const sessions = await this.marieInstance.listSessions();
    this.post({
      type: "sessions",
      sessions,
      currentSessionId: this.marieInstance.getCurrentSessionId(),
    });
  }

  private getConfigSnapshot() {
    const provider = ConfigService.getAiProvider();
    const providerKey =
      provider === "openrouter"
        ? ConfigService.getOpenRouterApiKey()
        : provider === "cerebras"
          ? ConfigService.getCerebrasApiKey()
          : ConfigService.getApiKey();
    return {
      provider,
      model: ConfigService.getModel(),
      autonomyMode: ConfigService.getAutonomyMode(),
      hasAnyApiKey: Boolean(
        ConfigService.getApiKey() ||
        ConfigService.getOpenRouterApiKey() ||
        ConfigService.getCerebrasApiKey(),
      ),
      hasProviderApiKey: Boolean(providerKey),
    };
  }

  private getUiMessages(): UiMessage[] {
    return this.marieInstance
      .getMessages()
      .map((message: any, index: number) => ({
        id: `hist_${index}`,
        role: (message.role || "assistant") as UiMessage["role"],
        content: this.extractMessageText(message),
        timestamp: Date.now(),
      }));
  }

  private extractMessageText(message: any): string {
    if (typeof message?.content === "string") {
      return message.content;
    }

    if (!Array.isArray(message?.content)) {
      return String(message?.content ?? "");
    }

    const parts: string[] = [];
    for (const block of message.content) {
      if (block?.type === "text") {
        parts.push(block.text || "");
      } else if (block?.type === "tool_use") {
        parts.push(`[Tool Use: ${block.name}]`);
      } else if (block?.type === "tool_result") {
        const content =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content);
        const summary =
          content.length > 100 ? content.substring(0, 100) + "..." : content;
        parts.push(`[Tool Result: ${summary}]`);
      }
    }

    return parts.join("\n").trim() || "(empty content)";
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview-ui",
        "main.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview-ui",
        "main.css",
      ),
    );
    const nonce = `${Date.now()}${Math.random().toString(36).slice(2)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
    <link rel="stylesheet" type="text/css" href="${styleUri}" />
    <title>Marie</title>
</head>
<body>
    <div id="app" style="padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);">Loading Marie UI…</div>
    <script nonce="${nonce}">
      try {
        const el = document.getElementById('app');
        if (el) el.textContent = 'Marie script bootstrapping…';
      } catch {}
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

class MarieSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "marieView";

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    webviewHost?.attach(webviewView.webview);
    webviewHost?.["pushInitState"]?.(webviewView.webview);
    webviewView.onDidDispose(() => {

      webviewHost?.detach(webviewView.webview);
    });
  }
}

function showMarieWebview(
  context: vscode.ExtensionContext,
): vscode.WebviewPanel | undefined {
  if (mariePanel) {
    mariePanel.reveal(vscode.ViewColumn.Beside);
    return mariePanel;
  }

  mariePanel = vscode.window.createWebviewPanel(
    "marieUi",
    "Marie",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );
  webviewHost?.attach(mariePanel.webview);
  webviewHost?.["pushInitState"]?.(mariePanel.webview);


  mariePanel.onDidDispose(
    () => {
      if (mariePanel) {
        webviewHost?.detach(mariePanel.webview);
      }
      mariePanel = undefined;
    },
    null,
    context.subscriptions,
  );

  return mariePanel;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("[Marie] Activating extension...");

  // Initialize JoyLog service
  const joyLog = new JoyLogService(context);
  console.log("[Marie] JoyLogService initialized");

  // Initialize Joy service
  joyService = new JoyService(context, joyLog);
  console.log("[Marie] JoyService initialized");

  // Initialize Marie
  marie = new Marie(context, joyService);
  console.log("[Marie] Marie adapter initialized");

  webviewHost = new MarieWebviewHost(context, marie);
  console.log("[Marie] MarieWebviewHost initialized");

  // Register commands
  const disposable = vscode.commands.registerCommand("marie.start", () => {
    return showMarieWebview(context);
  });

  const sidebarProvider = vscode.window.registerWebviewViewProvider(
    MarieSidebarProvider.viewType,
    new MarieSidebarProvider(),
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(sidebarProvider);
  context.subscriptions.push(marie);

  console.log("[Marie] Commands and providers registered");

  return {
    getWebviewHtml: () =>
      webviewHost?.["getHtml"]?.call(webviewHost, {
        asWebviewUri: (uri: vscode.Uri) => uri,
        cspSource: "vscode-resource:",
      } as any),
  };
}

export function deactivate() {
  if (mariePanel) {
    mariePanel.dispose();
    mariePanel = undefined;
  }

  if (webviewHost) {
    webviewHost.dispose();
    webviewHost = undefined;
  }

  if (marie) {
    marie.dispose();
    marie = undefined;
  }
  joyService = undefined;
}
