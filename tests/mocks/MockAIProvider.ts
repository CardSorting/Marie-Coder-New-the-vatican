import {
  AIProvider,
  AIRequestParams,
  AIStreamEvent,
  AIResponse,
} from "../../src/monolith/infrastructure/ai/providers/AIProvider.js";

export class MockAIProvider implements AIProvider {
  private responseQueue: any[] = [];
  private recordedMessages: any[] = [];

  constructor(private modelId: string = "mock-model") {}

  public queueResponse(content: any) {
    this.responseQueue.push(content);
  }

  public queueToolCall(toolName: string, input: any, id: string = "call_1") {
    this.responseQueue.push({
      content: [
        {
          type: "tool_use",
          id: id,
          name: toolName,
          input: input,
        },
      ],
      stop_reason: "tool_use",
    });
  }

  public queueText(text: string) {
    this.responseQueue.push({
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
    });
  }

  public async createMessage(options: AIRequestParams): Promise<AIResponse> {
    this.recordedMessages.push(...options.messages);

    const nextResponse = this.responseQueue.shift();
    if (!nextResponse) {
      return {
        content: [{ type: "text", text: "(Mock) No more responses queued." }],
        role: "assistant",
        timestamp: Date.now(),
      } as any;
    }

    // Return a shape that mimics Anthropic SDK response structure loosely
    // but conforms to AIResponse interface
    return {
      role: "assistant",
      timestamp: Date.now(),
      ...nextResponse,
    } as AIResponse;
  }

  public async createMessageStream(
    options: AIRequestParams,
    onUpdate: (event: AIStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<AIResponse> {
    // Mock streaming by yielding chunks
    const response = await this.createMessage(options);

    // Simulate text content
    if (Array.isArray(response.content)) {
      for (const block of response.content) {
        if (block.type === "text") {
          onUpdate({ type: "content_delta", text: block.text });
        } else if (block.type === "tool_use") {
          // Simulate tool call in chunks
          onUpdate({
            type: "tool_call_delta",
            index: 0,
            id: block.id,
            name: block.name,
            argumentsDelta: "",
          });

          // Send arguments
          onUpdate({
            type: "tool_call_delta",
            index: 0,
            argumentsDelta: JSON.stringify(block.input),
          });
        }
      }
    } else if (typeof response.content === "string") {
      onUpdate({ type: "content_delta", text: response.content });
    }

    // Simulate usage
    onUpdate({
      type: "usage",
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    });

    return response;
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  public async listModels() {
    return [
      { id: "mock-model-1", name: "Mock Model 1" },
      { id: "mock-model-2", name: "Mock Model 2" },
    ];
  }

  public getRecordedMessages() {
    return this.recordedMessages;
  }
}
