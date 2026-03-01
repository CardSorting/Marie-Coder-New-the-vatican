import { safeStringify } from "../../plumbing/Plumbing.js";

export interface AIProvider {
  createMessage(params: any): Promise<any>;
  createMessageStream(
    params: any,
    onUpdate: (event: any) => void,
    signal?: AbortSignal,
  ): Promise<any>;
}

export function createAIProvider(
  providerType: string,
  apiKey: string,
): AIProvider {
  const baseUrl = "https://openrouter.ai/api/v1";

  return {
    async createMessage(params: any): Promise<any> {
      const messages = [...(params.messages || [])];
      if (params.system && !messages.some((m: any) => m.role === "system")) {
        messages.unshift({ role: "system", content: params.system });
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/CardSorting/engine",
          "Content-Type": "application/json",
        },
        body: safeStringify({
          model: params.model,
          messages,
          tools: params.tools,
          tool_choice: params.tools ? "auto" : undefined,
          response_format: params.response_format,
        }),
      });

      if (!response.ok)
        throw new Error(`AI Provider error: ${response.status}`);
      const data = (await response.json()) as any;
      const choice = data.choices[0].message;

      if (choice.tool_calls) {
        return {
          content: choice.content || "",
          tool_calls: choice.tool_calls,
        };
      }
      return { content: choice.content || "" };
    },

    async createMessageStream(
      params: any,
      onUpdate: (e: any) => void,
      signal?: AbortSignal,
    ): Promise<any> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: safeStringify({
          model: params.model,
          messages: params.messages,
          tools: params.tools,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) throw new Error(`Stream error: ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let contentBuffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              const json = JSON.parse(line.slice(6));
              const delta = json.choices[0].delta;
              if (delta.content) {
                contentBuffer += delta.content;
                onUpdate({ type: "content_delta", text: delta.content });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { content: contentBuffer };
    },
  };
}
