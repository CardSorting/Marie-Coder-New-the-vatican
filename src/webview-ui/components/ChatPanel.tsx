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
                  {stack.map((m, i) => (
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

        messages.forEach((message, index) => {
          if (message.role === "system") {
            currentStack.push(message);
          } else {
            flushStack();
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const isGrouped =
              prevMessage &&
              prevMessage.role === message.role &&
              message.timestamp - prevMessage.timestamp < 60000;

            const isLastInGroup =
              index === messages.length - 1 ||
              messages[index + 1].role !== message.role ||
              messages[index + 1].timestamp - message.timestamp >= 60000;

            const roleLabel = message.role === "user" ? "You" : "Marie";
            renderedMessages.push(
              <div
                className={`msg ${message.role} ${isGrouped ? "is-grouped" : ""} ${isLastInGroup ? "is-last" : ""}`}
                key={message.id}
                style={{ "--stagger": index % 10 } as any}
              >
                {!isGrouped && (
                  <div className="msg-meta">
                    <span className="msg-role">
                      {message.role === "user" ? (
                        <UserIcon size={14} style={{ marginRight: "4px" }} />
                      ) : (
                        <MascotIcon size={14} style={{ marginRight: "4px" }} />
                      )}
                      {roleLabel}
                    </span>
                    <span className="msg-time">{formatTime(message.timestamp)}</span>
                  </div>
                )}
                <div
                  className="markdown"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(message.content),
                  }}
                />
              </div>
            );
          }
        });
        flushStack();
        return renderedMessages;
      })()}

      {streamingBuffer && (
        <div className="msg assistant">
          <div className="msg-meta">
            <span className="msg-role">
              <MascotIcon size={14} style={{ marginRight: "4px" }} />
              Marie
            </span>
            <span className="msg-time">Typing…</span>
          </div>
          <div
            className="markdown"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(streamingBuffer),
            }}
          />
        </div>
      )}

      {toolStreamingBuffer && (
        <div className="msg assistant tool-input">
          <div className="msg-meta">
            <span className="msg-role">
              <ToolIcon size={14} style={{ marginRight: "4px" }} />
              {activeToolName || "Tool"}
            </span>
            <span className="msg-time">Receiving input…</span>
          </div>
          <details className="tool-stream-panel" open>
            <summary>Tool input stream</summary>
            <pre
              className="tool-stream"
              aria-live="polite"
              dangerouslySetInnerHTML={{
                __html: highlightToolInput(toolStreamingBuffer),
              }}
            />
          </details>
        </div>
      )}

      {pendingApproval && (
        <div className="msg assistant tool-request">
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
