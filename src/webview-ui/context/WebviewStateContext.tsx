import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type {
  AgentStage,
  UiConfig,
  UiMessage,
  WebviewState,
} from "../types.js";
import { vscode } from "../vscode.js";

const defaultConfig: UiConfig = {
  provider: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  autonomyMode: "balanced",
  hasAnyApiKey: false,
  hasProviderApiKey: false,
};

const initialState: WebviewState = {
  messages: [],
  sessions: [],
  currentSessionId: "default",
  isLoading: false,
  streamingBuffer: "",
  toolStreamingBuffer: "",
  activeToolName: "",
  pendingApproval: null,
  config: defaultConfig,
  availableModels: [],
  stage: "plan",
  stageSummary: "Ready to plan",
  stageHint: "Describe the goal, constraints, or desired outcome to begin.",
  stageActions: [
    "Define scope",
    "List constraints",
    "Confirm success criteria",
  ],
  missionBrief: "Set a mission brief to guide the session.",
  sequenceNumber: 0,
};

const stageMeta: Record<
  AgentStage,
  { label: string; hint: string; actions: string[] }
> = {
  plan: {
    label: "Planning",
    hint: "Describe the goal, constraints, or desired outcome to begin.",
    actions: ["Define scope", "List constraints", "Confirm success criteria"],
  },
  execute: {
    label: "Executing",
    hint: "I’m running tasks. You can add clarifications or stop if needed.",
    actions: ["Approve tools", "Provide clarifications", "Pause/stop run"],
  },
  review: {
    label: "Reviewing",
    hint: "Check results, ask for tweaks, or request a summary.",
    actions: ["Request summary", "Ask for refinements", "Validate outputs"],
  },
};

function deriveStageFromMessage(
  content: string,
  current: AgentStage,
): AgentStage {
  const lower = content.toLowerCase();
  if (
    lower.includes("plan") ||
    lower.includes("approach") ||
    lower.includes("strategy")
  )
    return "plan";
  if (
    lower.includes("implement") ||
    lower.includes("execute") ||
    lower.includes("running") ||
    lower.includes("tool")
  ) {
    return "execute";
  }
  if (
    lower.includes("review") ||
    lower.includes("verify") ||
    lower.includes("final")
  )
    return "review";
  return current;
}

function applyStage(state: WebviewState, stage: AgentStage, summary?: string) {
  const meta = stageMeta[stage];
  return {
    ...state,
    stage,
    stageSummary: summary || meta.label,
    stageHint: meta.hint,
    stageActions: meta.actions,
  };
}

type WebviewActions = {
  sendMessage: (text: string) => void;
  createSession: () => void;
  refreshSessions: () => void;
  loadSession: (id: string) => void;
  clearSession: () => void;
  stopGeneration: () => void;
  approveTool: (approved: boolean) => void;
  getModels: () => void;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setApiKey: (provider: string, apiKey: string) => void;
  setAutonomyMode: (mode: string) => void;
  setStage: (stage: AgentStage) => void;
  setMissionBrief: (brief: string) => void;
};

type WebviewStateContextValue = {
  state: WebviewState;
  actions: WebviewActions;
};

const WebviewStateContext = createContext<WebviewStateContextValue | undefined>(
  undefined,
);

function newMessage(role: UiMessage["role"], content: string): UiMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

export function WebviewStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WebviewState>(initialState);

  const stateRef = useRef(state);
  const sequenceRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addMessage = useCallback((role: UiMessage["role"], content: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage(role, content)],
    }));
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data;

      // STALE STATE GUARD: Ignore any message with an older sequence number
      if (message?.sequenceNumber !== undefined) {
        if (message.sequenceNumber < sequenceRef.current) {
          console.log(`[Webview] Ignoring stale '${message.type}' update: ${message.sequenceNumber} < ${sequenceRef.current}`);
          return;
        }
        sequenceRef.current = message.sequenceNumber;
      }

      switch (message?.type) {
        case "init_state": {
          const nextSessionId = message.state?.currentSessionId || "default";
          const isSessionChanging = nextSessionId !== stateRef.current.currentSessionId;

          setState((prev) => ({
            ...prev,
            messages: Array.isArray(message.state?.messages)
              ? message.state.messages
              : [],
            config: message.state?.config || prev.config,
            sessions: Array.isArray(message.state?.sessions)
              ? message.state.sessions
              : prev.sessions,
            availableModels: Array.isArray(message.state?.availableModels)
              ? message.state.availableModels
              : prev.availableModels,
            currentSessionId: nextSessionId,
            sequenceNumber: message.state?.sequenceNumber || prev.sequenceNumber,
            // Only wipe buffers if the session actually changed to prevent streaming flicker
            streamingBuffer: isSessionChanging ? "" : prev.streamingBuffer,
            toolStreamingBuffer: isSessionChanging ? "" : prev.toolStreamingBuffer,
            activeToolName: isSessionChanging ? "" : prev.activeToolName,
            pendingApproval: isSessionChanging ? null : prev.pendingApproval,
          }));
          return;
        }

        case "sessions":
          setState((prev) => ({
            ...prev,
            sessions: Array.isArray(message.sessions) ? message.sessions : [],
            currentSessionId: message.currentSessionId || prev.currentSessionId,
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "status":
          setState((prev) => {
            const nextLoading = Boolean(message.isLoading);
            if (
              !nextLoading &&
              (prev.streamingBuffer || prev.toolStreamingBuffer)
            ) {
              return {
                ...prev,
                isLoading: false,
                streamingBuffer: "",
                toolStreamingBuffer: "",
                activeToolName: "",
                messages: [
                  ...prev.messages,
                  newMessage("assistant", prev.streamingBuffer),
                ],
                sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
              };
            }
            const nextStage: AgentStage = nextLoading ? "execute" : prev.stage;
            const summary = nextLoading ? "Executing tasks" : prev.stageSummary;
            return applyStage(
              { ...prev, isLoading: nextLoading, sequenceNumber: message.sequenceNumber || prev.sequenceNumber },
              nextStage,
              summary,
            );
          });
          return;

        case "user_echo":
          addMessage("user", String(message.text || ""));
          setState((prev) => ({
            ...applyStage(prev, "plan", "Refining the plan"),
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber
          }));
          return;

        case "message_stream":
          setState((prev) => ({
            ...prev,
            streamingBuffer: prev.streamingBuffer + String(message.chunk || ""),
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "assistant_response":
          setState((prev) => {
            if (prev.streamingBuffer) return prev;
            const content = String(message.text || "");
            const nextStage = deriveStageFromMessage(content, prev.stage);
            return applyStage(
              {
                ...prev,
                messages: [...prev.messages, newMessage("assistant", content)],
                sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
              },
              nextStage,
              stageMeta[nextStage].label,
            );
          });
          return;

        case "runtime_event": {
          const runtimeEvent = message.event;
          if (runtimeEvent?.type === "run_error") {
            addMessage(
              "system",
              `Error: ${runtimeEvent.message || "Unknown error"}`,
            );
            return;
          }
          if (runtimeEvent?.type === "reasoning") {
            // Push important reasoning as system messages for opportunistic feedback
            setState((prev) => ({
              ...prev,
              stageSummary: runtimeEvent.text || prev.stageSummary,
              sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
            }));

            // If it's a decree or a high-value thought, add to logs
            if (
              runtimeEvent.text?.includes("Decree") ||
              runtimeEvent.text?.includes("VOW") ||
              runtimeEvent.text?.includes("ZENITH")
            ) {
              addMessage("system", runtimeEvent.text);
            }
            return;
          }

          return;
        }

        case "tool_event":
          addMessage("system", `Tool: ${message.tool?.name || "unknown"}`);
          setState((prev) => ({
            ...applyStage(
              prev,
              "execute",
              `Running ${message.tool?.name || "tool"}`,
            ),
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber
          }));
          return;

        case "approval_request":
          setState((prev) => ({
            ...prev,
            pendingApproval: message.request || null,
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "tool_delta":
          setState((prev) => ({
            ...prev,
            toolStreamingBuffer:
              prev.toolStreamingBuffer +
              String(message.delta?.inputDelta || ""),
            activeToolName: String(
              message.delta?.name || prev.activeToolName || "tool",
            ),
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "models":
          setState((prev) => ({
            ...prev,
            availableModels: Array.isArray(message.models)
              ? message.models
                .map((m: any) => String(m?.id || m?.name || m))
                .filter(Boolean)
              : prev.availableModels,
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "config":
          setState((prev) => ({
            ...prev,
            config: message.config || prev.config,
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber,
          }));
          return;

        case "error":
          addMessage("system", String(message.message || "Unknown error"));
          setState((prev) => ({
            ...applyStage(prev, "review", "Review needed"),
            sequenceNumber: message.sequenceNumber || prev.sequenceNumber
          }));
          return;

        default:
          return;
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });

    return () => {

      window.removeEventListener("message", onMessage);
    };
  }, [addMessage]);

  const approveTool = useCallback((approved: boolean) => {
    const p = stateRef.current.pendingApproval;
    if (!p) return;
    vscode.postMessage({
      type: "approval_response",
      id: p.id,
      approved,
    });
    setState((prev) => ({ ...prev, pendingApproval: null }));
  }, []);

  const actions = useMemo<WebviewActions>(
    () => ({
      sendMessage: (text: string) =>
        vscode.postMessage({ type: "send_message", text }),
      createSession: () => vscode.postMessage({ type: "create_session" }),
      refreshSessions: () => vscode.postMessage({ type: "list_sessions" }),
      loadSession: (id: string) =>
        vscode.postMessage({ type: "load_session", id }),
      clearSession: () => vscode.postMessage({ type: "clear_session" }),
      stopGeneration: () => vscode.postMessage({ type: "stop_generation" }),
      approveTool,
      getModels: () => vscode.postMessage({ type: "get_models" }),
      setProvider: (provider: string) =>
        vscode.postMessage({ type: "set_provider", provider }),
      setModel: (model: string) =>
        vscode.postMessage({ type: "set_model", model }),
      setApiKey: (provider: string, apiKey: string) =>
        vscode.postMessage({ type: "set_api_key", provider, apiKey }),
      setAutonomyMode: (mode: string) =>
        vscode.postMessage({ type: "set_autonomy_mode", mode }),
      setStage: (stage: AgentStage) =>
        setState((prev) => applyStage(prev, stage, stageMeta[stage].label)),
      setMissionBrief: (brief: string) =>
        setState((prev) => ({
          ...prev,
          missionBrief: brief.trim() || stateRef.current.missionBrief,
        })),
    }),
    [approveTool],
  );


  const contextValue = useMemo(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <WebviewStateContext.Provider value={contextValue}>
      {children}
    </WebviewStateContext.Provider>
  );
}

export function useWebviewState() {
  const context = useContext(WebviewStateContext);
  if (!context) {
    throw new Error("useWebviewState must be used within WebviewStateProvider");
  }
  return context;
}
