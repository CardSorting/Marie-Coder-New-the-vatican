import { useEffect, useRef } from "react";
import { marked } from "marked";
import type { UiMessage, ApprovalRequest } from "../types.js";
import { MascotIcon, UserIcon, ToolIcon, LoadingDots } from "./Icons.js";
import { ThinkingTimer } from "./ThinkingTimer.js";

function renderMarkdown(content: string): string {
  const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(escaped) as string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightToolInput(input: string): string {
  const escaped = escapeHtml(input);
  return escaped
    .replace(/("[^"]*")\s*:/g, '<span class="tool-key">$1</span>:')
    .replace(/:\s*("[^"]*")/g, ': <span class="tool-string">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="tool-literal">$1</span>')
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tool-number">$1</span>');
}

function summarizeActivity(content: string): string {
  const firstLine =
    content.split("\n").find((line) => line.trim()) || "Activity";
  return firstLine.length > 72 ? `${firstLine.slice(0, 72)}…` : firstLine;
}

function stageSeparatorLabel(content: string) {
  const lower = content.toLowerCase();
  if (
    lower.includes("plan") ||
    lower.includes("strategy") ||
    lower.includes("approach")
  )
    return "Plan";
  if (
    lower.includes("execute") ||
    lower.includes("implement") ||
    lower.includes("running")
  )
    return "Execute";
  if (
    lower.includes("review") ||
    lower.includes("verify") ||
    lower.includes("final")
  )
    return "Review";
  return null;
}

function formatTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatPanel({
  messages,
  streamingBuffer,
  toolStreamingBuffer,
  activeToolName,
  pendingApproval,
  onApprove,
  isLoading,
  stageHint,
  stageSummary,
}: {
  messages: UiMessage[];
  streamingBuffer: string;
  toolStreamingBuffer: string;
  activeToolName: string;
  pendingApproval: ApprovalRequest | null;
  onApprove: (approved: boolean) => void;
  isLoading: boolean;
  stageHint?: string;
  stageSummary?: string;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamingBuffer, pendingApproval]);

  return (
    <section className="feed" ref={chatRef}>
      {(() => {
        const renderedMessages: React.ReactNode[] = [];
        let currentStack: UiMessage[] = [];

        const flushStack = () => {
          if (currentStack.length === 0) return;
          const stack = [...currentStack];
          const latest = stack[stack.length - 1];
          const stageLabel = stageSeparatorLabel(latest.content);

          renderedMessages.push(
            <div key={`stack-${latest.id}`} className="activity-group stacked">
              {stageLabel && (
                <div className="stage-separator">
                  <span className="stage-line" aria-hidden="true" />
                  <span className="stage-chip">{stageLabel} Stage</span>
                  <span className="stage-line" aria-hidden="true" />
                </div>
              )}
              <details className="activity-log stacked">
                <summary>
                  <span className="activity-tag">
                    <ToolIcon size={12} style={{ marginRight: "4px" }} />
                    {stack.length > 1 ? `${stack.length} Activities` : "Activity"}
                  </span>
                  <span>{summarizeActivity(latest.content)}</span>
                  {stack.length > 1 && <span className="stack-count">+{stack.length - 1} more</span>}
                </summary>
                <div className="activity-stack-body">
                  {stack.map((m) => (
                    <div key={m.id} className="stacked-item">
                      <div className="stacked-meta">{formatTime(m.timestamp)}</div>
                      <div
                        className="markdown"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(m.content),
                        }}
                      />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
          currentStack = [];
        };

        // Combine permanent messages with active buffers for holistic grouping
        const allItems: (UiMessage | { role: "assistant", type: "buffer", content: string, tool?: string })[] = [...messages];
        if (toolStreamingBuffer) {
          allItems.push({ role: "assistant", type: "buffer", content: toolStreamingBuffer, tool: activeToolName });
        } else if (streamingBuffer) {
          allItems.push({ role: "assistant", type: "buffer", content: streamingBuffer });
        }

        allItems.forEach((item, index) => {
          if ('role' in item && item.role === "system" && !('type' in item)) {
            currentStack.push(item as UiMessage);
          } else {
            flushStack();
            const prevItem = index > 0 ? allItems[index - 1] : null;
            const isGrouped =
              prevItem &&
              prevItem.role === item.role &&
              (!('timestamp' in item) || !('timestamp' in prevItem) || (item.timestamp - prevItem.timestamp < 60000));

            const isLastInGroup =
              index === allItems.length - 1 ||
              allItems[index + 1].role !== item.role;

            const isBuffer = 'type' in item && item.type === "buffer";
            const roleLabel = item.role === "user" ? "You" : "Marie";

            renderedMessages.push(
              <div
                className={`msg ${item.role} ${isGrouped ? "is-grouped" : ""} ${isLastInGroup ? "is-last" : ""} ${isBuffer ? "is-streaming" : ""}`}
                key={'id' in item ? item.id : `buffer-${index}`}
                style={{ "--stagger": index % 10 } as any}
              >
                {!isGrouped && (
                  <div className="msg-meta sentinel">
                    <span className="sentinel-icon">
                      {item.role === "user" ? (
                        <UserIcon size={18} />
                      ) : (
                        <MascotIcon size={18} className={isBuffer ? "breathing" : ""} />
                      )}
                    </span>
                    <span className="msg-time">{isBuffer ? "Processing..." : 'timestamp' in item ? formatTime(item.timestamp) : ""}</span>
                  </div>
                )}

                {isBuffer && 'tool' in item ? (
                  <div className="tool-input-wrapper">
                    <div className="tool-header">
                      <ToolIcon size={14} style={{ marginRight: "6px" }} />
                      {item.tool || "Executing Tool"}
                    </div>
                    <pre
                      className="tool-stream"
                      dangerouslySetInnerHTML={{
                        __html: highlightToolInput(item.content),
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="markdown"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(item.content),
                    }}
                  />
                )}
              </div>
            );
          }
        });
        flushStack();
        return renderedMessages;
      })()}

      {pendingApproval && (
        <div className="msg assistant tool-request is-last">
          <div className="tool-card">
            <div className="tool-header">Tool Permission Required</div>
            <div>
              <strong>{pendingApproval.toolName}</strong>
            </div>
            <pre style={{ fontSize: "11px", marginTop: "4px", opacity: 0.8 }}>
              {JSON.stringify(pendingApproval.toolInput, null, 2)}
            </pre>
            <div className="btn-group">
              <button onClick={() => onApprove(true)}>Approve</button>
              <button className="secondary" onClick={() => onApprove(false)}>
                Deny
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && !streamingBuffer && !toolStreamingBuffer && (
        <div className="activity-inline holographic-scan">
          <LoadingDots size={24} className="premium-aura" />
          <div className="stack" style={{ gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>{stageHint || "Marie is thinking…"}</span>
            {stageSummary && (
              <span className="muted" style={{ fontSize: "0.85em" }}>
                {stageSummary}
              </span>
            )}
          </div>
          <ThinkingTimer />
        </div>
      )}
    </section>
  );
}
