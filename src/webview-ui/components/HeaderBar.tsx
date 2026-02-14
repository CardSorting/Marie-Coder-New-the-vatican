import { useEffect, useMemo, useRef, useState } from "react";
import type { UiConfig } from "../types.js";
import { CloseIcon, SettingsIcon } from "./Icons.js";

export function HeaderBar({
  config,
  isLoading,
  availableModels,
  onProvider,
  onModel,
  onSetApiKey,
  onRefreshModels,
}: {
  config: UiConfig;
  isLoading: boolean;
  availableModels: string[];
  onProvider: (provider: string) => void;
  onModel: (model: string) => void;
  onSetApiKey: (provider: string, apiKey: string) => void;
  onRefreshModels: () => void;
}) {
  const [modelDraft, setModelDraft] = useState(config.model);
  const [providerDraft, setProviderDraft] = useState(config.provider);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "info";
  } | null>(null);
  const providerRef = useRef<HTMLSelectElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const modelSaveTimerRef = useRef<number | null>(null);

  const resetDrafts = () => {
    setModelDraft(config.model);
    setProviderDraft(config.provider);
    setApiKeyDraft("");
  };

  const showToast = (message: string, tone: "success" | "info" = "success") => {
    setToast({ message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2200);
  };

  const modelOptions = useMemo(() => {
    const merged = [...availableModels, config.model];
    return Array.from(new Set(merged.filter(Boolean)));
  }, [availableModels, config.model]);

  const closeConfig = () => {
    if (modelSaveTimerRef.current) {
      window.clearTimeout(modelSaveTimerRef.current);
      modelSaveTimerRef.current = null;
    }
    const nextModel = modelDraft.trim();
    if (nextModel && nextModel !== config.model) {
      commitModel(nextModel, false);
    }
    resetDrafts();
    setIsConfigOpen(false);
  };

  const commitModel = (next: string, toastOnSave = true) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === config.model) return;
    onModel(trimmed);
    if (toastOnSave) {
      showToast(`Model set to ${trimmed}`, "success");
    }
  };

  useEffect(() => {
    if (!isConfigOpen) return;

    providerRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeConfig();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfigOpen, closeConfig]);

  useEffect(() => {
    if (!isConfigOpen) return;
    const next = modelDraft.trim();
    if (!next || next === config.model) return;
    modelSaveTimerRef.current = window.setTimeout(() => {
      commitModel(next, true);
      modelSaveTimerRef.current = null;
    }, 600);
    return () => {
      if (modelSaveTimerRef.current) {
        window.clearTimeout(modelSaveTimerRef.current);
        modelSaveTimerRef.current = null;
      }
    };
  }, [modelDraft, config.model, isConfigOpen, commitModel]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (modelSaveTimerRef.current) {
        window.clearTimeout(modelSaveTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <header className="top">
        <div className="stack">
          <div className="title-row">
            <strong>Marie</strong>
            <span className="muted">{isLoading ? "Running…" : "Ready"}</span>
          </div>
        </div>

        <div className="header-controls minimal">
          <div className="config-pill-row">
            <span className="config-pill">{config.provider}</span>
            <span className="config-pill model" title={config.model}>
              {config.model}
            </span>
            <span
              className={`config-pill ${config.hasProviderApiKey ? "ok" : "warn"}`}
            >
              {config.hasProviderApiKey
                ? "API key connected"
                : "API key needed"}
            </span>
          </div>
          <button
            className="secondary"
            onClick={() => {
              resetDrafts();
              setIsConfigOpen(true);
            }}
          >
            <SettingsIcon size={14} style={{ marginRight: "4px" }} />
            Configure AI
          </button>
        </div>
      </header>

      {isConfigOpen && (
        <div
          className="modal-backdrop"
          onClick={closeConfig}
          role="presentation"
        >
          <section
            className="config-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Model and provider settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <strong>Model & Provider</strong>
              <button
                className="icon"
                onClick={closeConfig}
                aria-label="Close settings"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            {toast && (
              <div className={`config-toast ${toast.tone}`} role="status">
                {toast.message}
              </div>
            )}

            <div className="modal-body stack">
              <label className="control-field">
                <span className="muted">Provider</span>
                <select
                  ref={providerRef}
                  value={providerDraft}
                  onChange={(e) => {
                    const nextProvider = e.target.value;
                    setProviderDraft(nextProvider);
                    if (nextProvider !== config.provider) {
                      onProvider(nextProvider);
                      showToast(`Provider set to ${nextProvider}`, "success");
                    }
                  }}
                >
                  <option value="anthropic">anthropic</option>
                  <option value="openrouter">openrouter</option>
                  <option value="cerebras">cerebras</option>
                </select>
              </label>

              <label className="control-field">
                <span className="muted">API key</span>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder={`Enter ${providerDraft} API key`}
                />
                <div className="row">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      const key = apiKeyDraft.trim();
                      if (!key) return;
                      onSetApiKey(providerDraft, key);
                      setApiKeyDraft("");
                      showToast(`Saved ${providerDraft} API key`, "success");
                    }}
                  >
                    Save key
                  </button>
                </div>
              </label>

              <label className="control-field">
                <span className="muted">Model</span>
                <input
                  list="marie-model-options"
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitModel(modelDraft, true);
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
                <span
                  className={`api-dot ${config.hasProviderApiKey ? "ok" : "warn"}`}
                />
                <span>
                  {config.hasProviderApiKey
                    ? "API key is configured"
                    : `No API key configured for ${config.provider}`}
                </span>
              </div>

              <div className="muted">
                Keys are stored in VS Code settings for the selected provider.
              </div>

              <div className="row">
                <button
                  className="secondary"
                  onClick={() => {
                    onRefreshModels();
                    showToast("Refreshing model list…", "info");
                  }}
                >
                  Refresh models
                </button>
                <button onClick={closeConfig}>Done</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
