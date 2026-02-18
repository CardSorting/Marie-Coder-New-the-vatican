import { useCallback, useEffect, useState } from "react";
import { Providers } from "./Providers.js";
import { ApprovalPanel } from "./components/ApprovalPanel.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { Composer } from "./components/Composer.js";
import { HeaderBar } from "./components/HeaderBar.js";
import { SessionList } from "./components/SessionList.js";
import { useWebviewState } from "./context/WebviewStateContext.js";

function AppContent() {
  const { state, actions } = useWebviewState();
  console.log("[Webview] Render AppContent", { msgCount: state.messages.length });
  console.log("[Webview] Render AppContent (Provider State)", { hasConfig: !!state.config, hasSessions: !!state.sessions, hasMessages: state.messages.length });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoadSession = useCallback(
    (id: string) => {
      actions.loadSession(id);
      setIsSidebarOpen(false);
    },
    [actions],
  );

  const handleCreateSession = useCallback(() => {
    actions.createSession();
    setIsSidebarOpen(false);
  }, [actions]);


  useEffect(() => {
    if (!isSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen]);

  return (
    <div className="app-shell">
      <aside className={`session-drawer ${isSidebarOpen ? "open" : ""}`}>
        <SessionList
          sessions={state.sessions}
          currentSessionId={state.currentSessionId}
          onLoad={handleLoadSession}
          onCreate={handleCreateSession}
          onRefresh={actions.refreshSessions}
        />
      </aside>

      {isSidebarOpen && (
        <button
          className="session-scrim"
          aria-label="Close sessions panel"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="workspace">
        <div className="workspace-glass">
          <ApprovalPanel
            pendingApproval={state.pendingApproval}
            onApprove={actions.approveTool}
          />
          <div className="header-wrap minimal">
            <button
              className={`session-toggle ${isSidebarOpen ? "is-open" : ""}`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? "Hide sessions" : "Show sessions"}
              aria-expanded={isSidebarOpen}
            >
              <span className="hamburger" aria-hidden="true">
                <span className="bar" />
                <span className="bar" />
                <span className="bar" />
              </span>
              <span className="session-toggle-label">Sessions</span>
              <span className="session-toggle-count">
                {state.sessions.length}
              </span>
            </button>
            <div className="header-stack">
              <HeaderBar
                config={state.config}
                isLoading={state.isLoading}
                availableModels={state.availableModels}
                onProvider={actions.setProvider}
                onModel={actions.setModel}
                onSetApiKey={actions.setApiKey}
                onRefreshModels={actions.getModels}
              />
            </div>
          </div>

          <ChatPanel
            messages={state.messages}
            streamingBuffer={state.streamingBuffer}
            toolStreamingBuffer={state.toolStreamingBuffer}
            activeToolName={state.activeToolName}
            pendingApproval={state.pendingApproval}
            onApprove={actions.approveTool}
            isLoading={state.isLoading}
            stageHint={state.stageHint}
            stageSummary={state.stageSummary}
          />

          <Composer
            isLoading={state.isLoading}
            stage={state.stage}
            stageHint={state.stageHint}
            pendingApproval={state.pendingApproval}
            onSend={actions.sendMessage}
          />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
