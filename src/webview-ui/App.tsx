import { useEffect, useState } from "react"
import { Providers } from "./Providers.js"
import { ChatPanel } from "./components/ChatPanel.js"
import { Composer } from "./components/Composer.js"
import { HeaderBar } from "./components/HeaderBar.js"
import { StageRail } from "./components/StageRail.js"
import { StatusPanel } from "./components/StatusPanel.js"
import { SessionList } from "./components/SessionList.js"
import { ActivityTimeline } from "./components/ActivityTimeline.js"
import { AgentPulse } from "./components/AgentPulse.js"
import { MissionBrief } from "./components/MissionBrief.js"
import { useWebviewState } from "./context/WebviewStateContext.js"

function AppContent() {
    const { state, actions } = useWebviewState()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    const handleLoadSession = (id: string) => {
        actions.loadSession(id)
        setIsSidebarOpen(false)
    }

    const handleCreateSession = () => {
        actions.createSession()
        setIsSidebarOpen(false)
    }

    useEffect(() => {
        if (!isSidebarOpen) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsSidebarOpen(false)
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [isSidebarOpen])

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
                            <span className="session-toggle-count">{state.sessions.length}</span>
                        </button>
                        <div className="header-stack">
                            <HeaderBar
                                config={state.config}
                                isLoading={state.isLoading}
                                availableModels={state.availableModels}
                                onProvider={actions.setProvider}
                                onModel={actions.setModel}
                                onOpenSettings={actions.openSettings}
                                onRefreshModels={actions.getModels}
                            />
                            <AgentPulse
                                stage={state.stage}
                                isLoading={state.isLoading}
                                pendingApproval={state.pendingApproval}
                            />
                        </div>
                    </div>

                    <StageRail stage={state.stage} onSelect={actions.setStage} />

                    <div className="status-grid">
                        <StatusPanel
                            stage={state.stage}
                            summary={state.stageSummary}
                            hint={state.stageHint}
                            actions={state.stageActions}
                            onActionClick={actions.sendMessage}
                            pendingApproval={state.pendingApproval}
                            isLoading={state.isLoading}
                        />
                        <ActivityTimeline messages={state.messages} />
                    </div>

                    <MissionBrief
                        brief={state.missionBrief}
                        onSave={(brief) => actions.setMissionBrief(brief)}
                    />

                    <ChatPanel
                        messages={state.messages}
                        streamingBuffer={state.streamingBuffer}
                        pendingApproval={state.pendingApproval}
                        onApprove={actions.approveTool}
                        isLoading={state.isLoading}
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
    )
}

export default function App() {
    return (
        <Providers>
            <AppContent />
        </Providers>
    )
}
