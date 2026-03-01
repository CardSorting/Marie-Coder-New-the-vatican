import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect, CompiledQuery } from "kysely";

// --- CONFIGURATION ---

let _configCache: Record<string, any> | null = null;
const CONFIG_PATH = path.join(os.homedir(), ".engine", "config.json");

export function getConfig(): Record<string, any> {
  if (_configCache) return _configCache;
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    _configCache = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) || {};
    return _configCache as any;
  } catch {
    return {};
  }
}

export function getApiKey(): string | undefined {
  return getConfig().apiKey || process.env.OPENROUTER_API_KEY;
}

export function getModel(): string {
  return getConfig().model || "google/gemini-2.0-flash-001";
}

export function getLlmFast(): string {
  return getConfig().modelFast || getModel();
}

export function getTokensPerChar(): number {
  return 0.35;
}

export function getExcludedFiles(): string[] {
  return [
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    ".git",
    ".vscode",
    ".idea",
    ".DS_Store",
  ];
}

// --- DATABASE ---

export interface Schema {
  session_metadata: {
    id: string;
    title: string;
    lastModified: number;
    isPinned: number | boolean;
  };
  sessions: {
    id?: number;
    sessionId: string;
    role: string;
    content: string;
    metadata: string;
    timestamp?: string;
  };
  current_session: {
    id: string;
  };
}

let _db: Kysely<Schema> | null = null;

export async function getDb(): Promise<Kysely<Schema>> {
  if (_db) return _db;

  const dbDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = process.env.DB_PATH || path.join(dbDir, "engine.sqlite");

  _db = new Kysely<Schema>({
    dialect: new SqliteDialect({
      database: new Database(dbPath),
    }),
  });

  // Initialize Schema
  const execute = (q: string) => _db!.executeQuery(CompiledQuery.raw(q));
  await execute("PRAGMA journal_mode = WAL;");
  await execute("PRAGMA synchronous = NORMAL;");
  await execute(
    `CREATE TABLE IF NOT EXISTS session_metadata (id TEXT PRIMARY KEY, title TEXT, lastModified BIGINT, isPinned BOOLEAN)`,
  );
  await execute(
    `CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT, role TEXT, content TEXT, metadata TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  );
  await execute(
    `CREATE TABLE IF NOT EXISTS current_session (id TEXT PRIMARY KEY)`,
  );

  return _db;
}
