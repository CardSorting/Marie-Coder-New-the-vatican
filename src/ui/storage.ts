import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getDb } from "../infrastructure/Config.js";

const ROOT_DIR = path.join(os.homedir(), ".engine");

export interface SessionMetadata {
  id: string;
  title: string;
  lastModified: number;
  isPinned: boolean;
}

export class Storage {
  static ensureDir(): void {
    if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
  }

  static async getSessions(): Promise<Record<string, any[]>> {
    const db = await getDb();
    const all = await db.selectFrom("sessions").selectAll().execute();
    const grouped: Record<string, any[]> = {};
    for (const entry of all) {
      if (!grouped[entry.sessionId]) grouped[entry.sessionId] = [];
      let metadata = {};
      try {
        if (entry.metadata) metadata = JSON.parse(entry.metadata);
      } catch {
        // Use empty metadata on parse failure
      }
      grouped[entry.sessionId].push({
        role: entry.role,
        content: entry.content,
        ...metadata,
      });
    }
    return grouped;
  }

  static async saveSessions(sessions: Record<string, any[]>): Promise<void> {
    const db = await getDb();
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("sessions").execute();
      for (const [sessionId, messages] of Object.entries(sessions)) {
        for (const msg of messages) {
          const { role, content, ...metadata } = msg;
          await trx
            .insertInto("sessions")
            .values({
              sessionId,
              role: role as any,
              content:
                typeof content === "string" ? content : JSON.stringify(content),
              metadata: JSON.stringify(metadata),
            })
            .execute();
        }
      }
    });
  }

  static async getSessionMetadata(): Promise<SessionMetadata[]> {
    const db = await getDb();
    const records = await db
      .selectFrom("session_metadata")
      .selectAll()
      .orderBy("lastModified", "desc")
      .execute();
    return records.map((r) => ({
      ...r,
      isPinned: !!r.isPinned,
    })) as SessionMetadata[];
  }

  static async saveSessionMetadata(metadata: SessionMetadata[]): Promise<void> {
    const db = await getDb();
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("session_metadata").execute();
      for (const entry of metadata) {
        await trx
          .insertInto("session_metadata")
          .values({
            id: entry.id,
            title: entry.title,
            lastModified: entry.lastModified,
            isPinned: entry.isPinned ? 1 : 0,
          })
          .execute();
      }
    });
  }

  static async getCurrentSessionId(): Promise<string> {
    const db = await getDb();
    const state = await db
      .selectFrom("current_session")
      .selectAll()
      .executeTakeFirst();
    return state?.id || "default";
  }

  static async setCurrentSessionId(id: string): Promise<void> {
    const db = await getDb();
    await db.deleteFrom("current_session").execute();
    await db.insertInto("current_session").values({ id }).execute();
  }
}
