import { useEffect, useMemo, useState } from "react"
import type { UiConfig } from "../types.js"

export function HeaderBar({
    config,
    isLoading,
    availableModels,
    onProvider,
    onModel,
}: {
    config: UiConfig
    isLoading: boolean
    availableModels: string[]
    onProvider: (provider: string) => void
    onModel: (model: string) => void
}) {
    const [modelDraft, setModelDraft] = useState(config.model)

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

    return (
        <header className="top">
            <div className="stack">
                <div className="title-row">
                    <strong>Marie</strong>
                    <span className="muted">{isLoading ? "Running…" : "Ready"}</span>
                </div>
            </div>

            <div className="header-controls">
                <label className="control-field">
                    <span className="muted">Provider</span>
                    <select value={config.provider} onChange={(e) => onProvider(e.target.value)}>
                        <option value="anthropic">anthropic</option>
                        <option value="openrouter">openrouter</option>
                        <option value="cerebras">cerebras</option>
                    </select>
                </label>

                <label className="control-field model-field">
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
            </div>
        </header>
    )
}
