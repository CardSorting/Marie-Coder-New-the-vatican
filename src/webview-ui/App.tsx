import { useState } from "react"
import { Providers } from "./Providers.js"
import { ChatPanel } from "./components/ChatPanel.js"
import { Composer } from "./components/Composer.js"
import { HeaderBar } from "./components/HeaderBar.js"
import { SessionList } from "./components/SessionList.js"
import { useWebviewState } from "./context/WebviewStateContext.js"

function AppContent() {
    const { state, actions } = useWebviewState()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="app-shell">
            <aside className={`session-drawer ${isSidebarOpen ? "open" : ""}`}>
                <SessionList
                    sessions={state.sessions}
                    currentSessionId={state.currentSessionId}
                    onLoad={actions.loadSession}
                    onCreate={actions.createSession}
                    onRefresh={actions.refreshSessions}
                />
            </aside>

            <main className="workspace">
                <div className="workspace-glass">
                    <div className="header-wrap">
                        <button
                            className={`session-toggle ${isSidebarOpen ? "is-open" : ""}`}
                            onClick={() => setIsSidebarOpen((prev) => !prev)}
                            aria-label={isSidebarOpen ? "Hide sessions" : "Show sessions"}
                            aria-expanded={isSidebarOpen}>
                            <span className="hamburger" aria-hidden="true">
                                <span className="bar" />
                                <span className="bar" />
                                <span className="bar" />
                            </span>
                            <span className="session-toggle-label">Sessions</span>
                        </button>
                        <HeaderBar
                            config={state.config}
                            isLoading={state.isLoading}
                            availableModels={state.availableModels}
                            onProvider={actions.setProvider}
                            onModel={actions.setModel}
                            onOpenSettings={actions.openSettings}
                            onRefreshModels={actions.getModels}
                        />
                    </div>

                    <ChatPanel
                        messages={state.messages}
                        streamingBuffer={state.streamingBuffer}
                        pendingApproval={state.pendingApproval}
                        onApprove={actions.approveTool}
                        isLoading={state.isLoading}
                    />

                    <Composer isLoading={state.isLoading} onSend={actions.sendMessage} />
                </div>
            </main>
        </div>
    )
}

export default function App() {
    return (
        <Providers>
            <AppContent />
        </Providers>
    )
}
