export function renderMessage(msg: any): string {
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((c: any) => {
        if (c.type === "text") return c.text;
        if (c.type === "tool_result")
          return `[Tool Result: ${c.name || c.tool_use_id}]\n${c.content}`;
        if (c.type === "tool_use")
          return `[Calling Tool: ${c.name}]\n${JSON.stringify(c.input)}`;
        return JSON.stringify(c);
      })
      .join("\n");
  }
  return JSON.stringify(msg.content);
}

export async function processSessionEnd(
  sessionId: string,
  messages: any[],
): Promise<void> {
  try {
    if (messages.length < 2) return;
    const firstUserMsg = messages.find((m) => m.role === "user")?.content || "";
    let title = (
      typeof firstUserMsg === "string" ? firstUserMsg : "New Session"
    )
      .substring(0, 40)
      .trim();
    if (title.length === 40) title += "...";

    const { getDb } = await import("./Config.js");
    const db = await getDb();

    await db
      .updateTable("session_metadata")
      .set({ title, lastModified: Date.now() })
      .where("id", "=", sessionId)
      .execute();
  } catch (e) {
    console.error("[Services] Session end pass failed", e);
  }
}
