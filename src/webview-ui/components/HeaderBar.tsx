import { useEffect, useMemo, useRef, useState } from "react"
import type { UiConfig } from "../types.js"

export function HeaderBar({
    config,
    isLoading,
    availableModels,
    onProvider,
    onModel,
    onOpenSettings,
    onRefreshModels,
}: {
    config: UiConfig
    isLoading: boolean
    availableModels: string[]
    onProvider: (provider: string) => void
    onModel: (model: string) => void
    onOpenSettings: () => void
    onRefreshModels: () => void
}) {
    const [modelDraft, setModelDraft] = useState(config.model)
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const providerRef = useRef<HTMLSelectElement | null>(null)

    useEffect(() => {
        setModelDraft(config.model)
    }, [config.model])

    const modelOptions = useMemo(() => {
        const merged = [...availableModels, config.model]
        return Array.from(new Set(merged.filter(Boolean)))
    }, [availableModels, config.model])

    const commitModel = () => {
        const next = modelDraft.trim()
        if (!next || next === config.model) return
        onModel(next)
    }

    const closeConfig = () => setIsConfigOpen(false)

    useEffect(() => {
        if (!isConfigOpen) return

        providerRef.current?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeConfig()
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [isConfigOpen])

    return (
        <>
            <header className="top">
                <div className="stack">
                    <div className="title-row">
                        <strong>Marie</strong>
                        <span className="muted">{isLoading ? "Running…" : "Ready"}</span>
                    </div>
                </div>

                <div className="header-controls">
                    <div className="config-pill-row">
                        <span className="config-pill">{config.provider}</span>
                        <span className="config-pill model" title={config.model}>{config.model}</span>
                        <span className={`config-pill ${config.hasAnyApiKey ? "ok" : "warn"}`}>
                            {config.hasAnyApiKey ? "API key connected" : "API key needed"}
                        </span>
                    </div>
                    <button className="secondary" onClick={() => setIsConfigOpen(true)}>
                        Configure AI
                    </button>
                </div>
            </header>

            {isConfigOpen && (
                <div className="modal-backdrop" onClick={closeConfig} role="presentation">
                    <section
                        className="config-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Model and provider settings"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <strong>Model & Provider</strong>
                            <button className="icon" onClick={closeConfig} aria-label="Close settings">
                                ✕
                            </button>
                        </div>

                        <div className="modal-body stack">
                            <label className="control-field">
                                <span className="muted">Provider</span>
                                <select ref={providerRef} value={config.provider} onChange={(e) => onProvider(e.target.value)}>
                                    <option value="anthropic">anthropic</option>
                                    <option value="openrouter">openrouter</option>
                                    <option value="cerebras">cerebras</option>
                                </select>
                            </label>

                            <label className="control-field">
                                <span className="muted">Model</span>
                                <input
                                    list="marie-model-options"
                                    value={modelDraft}
                                    onChange={(e) => setModelDraft(e.target.value)}
                                    onBlur={commitModel}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            commitModel()
                                        }
                                    }}
                                    placeholder="Enter model id"
                                />
                                <datalist id="marie-model-options">
                                    {modelOptions.map((model) => (
                                        <option key={model} value={model} />
                                    ))}
                                </datalist>
                            </label>

                            <div className="api-status-row">
                                <span className={`api-dot ${config.hasAnyApiKey ? "ok" : "warn"}`} />
                                <span>{config.hasAnyApiKey ? "API key is configured" : "No API key configured"}</span>
                            </div>

                            <div className="muted">
                                API keys are managed in VS Code settings per provider.
                            </div>

                            <div className="row">
                                <button className="secondary" onClick={onRefreshModels}>
                                    Refresh models
                                </button>
                                <button className="secondary" onClick={onOpenSettings}>
                                    Open VS Code settings
                                </button>
                                <button onClick={closeConfig}>Done</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </>
    )
}
