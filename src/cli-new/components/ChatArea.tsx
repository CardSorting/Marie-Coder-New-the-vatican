import React, { useState, useEffect } from "react";
import { Box, useStdout } from "ink";
import { MessageBubble } from "./MessageBubble.js";
import { Message, StreamingState } from "../types/cli.js";

interface ChatAreaProps {
  messages: Message[];
  streamingState: StreamingState;
}

const MAX_VISIBLE_MESSAGES = 50;

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  streamingState,
}) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    rows: stdout.rows,
    columns: stdout.columns,
  });

  const [stableTimestamp] = useState(() => Date.now());

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ rows: stdout.rows, columns: stdout.columns });
    };

    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  // Only show recent messages to prevent overflow
  const visibleMessages =
    messages.length > MAX_VISIBLE_MESSAGES
      ? messages.slice(-MAX_VISIBLE_MESSAGES)
      : messages;

  // Calculate available height (reserve space for header, input, status)
  const reservedHeight = 6;
  const availableHeight = Math.max(5, dimensions.rows - reservedHeight);

  return (
    <Box flexDirection="column" height={availableHeight} overflow="hidden">
      {messages.length > MAX_VISIBLE_MESSAGES && (
        <Box marginY={0} paddingX={1}>
          <MessageBubble
            message={{
              id: "scroll-notice",
              role: "system",
              content: `... ${messages.length - MAX_VISIBLE_MESSAGES} older messages hidden ...`,
              timestamp: stableTimestamp,
            }}
          />
        </Box>
      )}

      {visibleMessages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isStreaming={
            streamingState.isActive &&
            index === visibleMessages.length - 1 &&
            message.role === "assistant"
          }
        />
      ))}

      {streamingState.isActive &&
        (streamingState.content ||
          (streamingState.toolCalls &&
            streamingState.toolCalls.length > 0)) && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingState.content,
              timestamp: stableTimestamp,
              isStreaming: true,
              toolCalls: streamingState.toolCalls,
            }}
            isStreaming={true}
          />
        )}
    </Box>
  );
};
