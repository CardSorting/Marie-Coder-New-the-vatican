console.log("[Webview] main.tsx entry point hit");
import { createRoot } from "react-dom/client";
console.log("[Webview] react-dom/client imported");
import App from "./App.js";
console.log("[Webview] App component imported");

import "./styles/theme.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/chat.css";
import "./styles/sessions.css";

function getRootElement(): HTMLElement {
  const existing = document.getElementById("app");
  if (existing) return existing;

  const element = document.createElement("div");
  element.id = "app";
  document.body.appendChild(element);
  return element;
}

function showFatalError(error: unknown): void {
  const app = getRootElement();
  const message =
    error instanceof Error
      ? `${error.message}\n\n${error.stack || ""}`
      : String(error);
  app.innerHTML = `<pre style="padding:12px;white-space:pre-wrap;color:var(--vscode-errorForeground);">Webview failed to render:\n${message}</pre>`;
}

try {
  console.log("[Webview] Bootstrapping React app...");
  createRoot(getRootElement()).render(<App />);
} catch (error) {
  showFatalError(error);
}
