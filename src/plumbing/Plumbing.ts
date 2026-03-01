import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";

const execAsync = promisify(exec);
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export const nodeRequire = (() => {
  const g = globalThis as any;
  if (typeof g.require !== "undefined") return g.require;
  try {
    const metaUrl = (0, eval)("import.meta.url");
    if (metaUrl) return createRequire(metaUrl);
  } catch {
    // Fallback to error return below
  }
  return (id: string) => {
    throw new Error(`Execution Environment Error: Cannot require "${id}".`);
  };
})();

// --- FS & SHELL ---

export function resolvePath(p: string): string {
  let resolved = p;
  if (p.startsWith("~")) resolved = path.join(os.homedir(), p.slice(1));
  return path.isAbsolute(resolved)
    ? path.normalize(resolved)
    : path.join(process.cwd(), resolved);
}

export async function readFile(
  filePath: string,
  startLine?: number,
  endLine?: number,
): Promise<string> {
  const fullPath = resolvePath(filePath);
  const buffer = await fs.readFile(fullPath);
  const text = textDecoder.decode(buffer);
  if (startLine !== undefined || endLine !== undefined) {
    const lines = text.split("\n");
    const start = startLine !== undefined ? Math.max(0, startLine - 1) : 0;
    const end =
      endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;
    return lines.slice(start, end).join("\n");
  }
  return text;
}

export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  const fullPath = resolvePath(filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const tmpPath = `${fullPath}.tmp.${Math.random().toString(36).substring(2, 9)}`;
  const handle = await fs.open(tmpPath, "w");
  try {
    await handle.writeFile(textEncoder.encode(content));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmpPath, fullPath);
}

export async function runCommand(
  command: string,
  cwd: string = process.cwd(),
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60000,
    });
    return stdout + (stderr ? `\nstderr: ${stderr}` : "");
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export async function gitStatus(cwd: string): Promise<string> {
  const { stdout } = await execAsync("git status --short", { cwd });
  return stdout || "Clean.";
}

export async function listFiles(dirPath: string): Promise<string> {
  const fullPath = resolvePath(dirPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  return (
    entries
      .map((e) => `${e.isDirectory() ? "DIR " : "FILE"} ${e.name}`)
      .join("\n") || "Empty."
  );
}

export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = resolvePath(filePath);
  await fs.unlink(fullPath);
}

// --- CONCURRENCY ---

export class Mutex {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly name: string = "GenericMutex") {}
  public async acquire(timeoutMs: number = 30000): Promise<() => void> {
    const previousTask = this.queue;
    let resolver: () => void;
    this.queue = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    const acquirePromise = (async () => {
      await previousTask;
    })();
    if (timeoutMs > 0) {
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Mutex Timeout: ${this.name}`));
        }, timeoutMs);
      });
      try {
        await Promise.race([acquirePromise, timeoutPromise]);
      } catch (e) {
        resolver!();
        throw e;
      } finally {
        clearTimeout(timeoutId!);
      }
    } else await acquirePromise;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        resolver!();
      }
    };
  }
}

// --- JSON & UTILS ---

export function safeStringify(obj: any, space?: string | number): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return "[Stringify Failed]";
  }
}

export function repairJson(json: string): {
  repaired: string;
  wasFixed: boolean;
} {
  let repaired = json.trim();
  if (!repaired) return { repaired: "{}", wasFixed: false };
  const stack: string[] = [];
  for (const char of repaired) {
    if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }
  let wasFixed = false;
  while (stack.length > 0) {
    const last = stack.pop();
    repaired += last === "{" ? "}" : "]";
    wasFixed = true;
  }
  return { repaired, wasFixed };
}

// --- STREAMING ---

export interface StreamTagDetector {
  process: (chunk: string) => {
    type: "content" | "incomplete" | "tag";
    text: string;
    tag?: string;
  };
  reset: () => void;
}

export function createStreamTagDetector(tags: string[]): StreamTagDetector {
  let buffer = "";
  return {
    process(chunk) {
      buffer += chunk;
      for (const tag of tags) {
        const idx = buffer.indexOf(tag);
        if (idx !== -1) {
          const content = buffer.substring(0, idx);
          buffer = buffer.substring(idx + tag.length);
          return { type: "tag", text: content, tag };
        }
      }
      return { type: "content", text: buffer };
    },
    reset() {
      buffer = "";
    },
  };
}
