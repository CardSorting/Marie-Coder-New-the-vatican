import { useState, useEffect } from "react";

export function ThinkingTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    let frameId: number;

    const update = () => {
      setElapsed((performance.now() - startTime) / 1000);
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <span
      className="thinking-timer"
      style={{
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "0.9em",
        opacity: 0.7,
        marginLeft: "8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {elapsed.toFixed(1)}s
    </span>
  );
}
