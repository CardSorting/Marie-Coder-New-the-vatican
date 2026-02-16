import * as fs from "fs/promises";
import * as path from "path";
import { FileSystemPort } from "../infrastructure/ai/core/FileSystemPort.js";

/**
 * CliFileSystemPort - Implementation of FileSystemPort for the CLI environment.
 * Uses standard Node.js fs/promises for file operations.
 */
export class CliFileSystemPort implements FileSystemPort {
  public readonly type = "cli";
  private backups = new Map<string, string>();

  constructor(private workingDir: string) {}

  private resolve(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.workingDir, filePath);
  }

  async readFile(filePath: string, _signal?: AbortSignal): Promise<string> {
    try {
      return await fs.readFile(this.resolve(filePath), "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async writeFile(
    filePath: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number, totalBytes?: number) => void,
  ): Promise<void> {
    if (process.env.MARIE_DEBUG) {
      console.log(
        `[CliFS] writeFile called for ${filePath}, onProgress defined: ${!!onProgress}`,
      );
    }
    const fullPath = this.resolve(filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const buffer = Buffer.from(content, "utf-8");
      const totalBytes = buffer.length;

      if (onProgress && buffer.length > 16384) {
        const CHUNK_SIZE = 16384;
        let written = 0;
        const handle = await fs.open(fullPath, "w");
        try {
          while (written < buffer.length) {
            if (signal?.aborted) throw new Error("Aborted");
            const chunk = buffer.subarray(written, written + CHUNK_SIZE);
            await handle.write(chunk);
            written += chunk.length;
            if (process.env.MARIE_DEBUG) {
              console.log(`[CliFS] writeFile chunk: ${written}/${totalBytes}`);
            }
            onProgress(written, totalBytes);
          }
        } finally {
          await handle.close();
        }
      } else {
        await fs.writeFile(fullPath, buffer);
        onProgress?.(buffer.length, totalBytes);
      }
    } catch (error: any) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async appendFile(
    filePath: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number, totalBytes?: number) => void,
  ): Promise<void> {
    const fullPath = this.resolve(filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const buffer = Buffer.from(content, "utf-8");
      const totalBytes = buffer.length;

      if (onProgress && buffer.length > 16384) {
        const CHUNK_SIZE = 16384;
        let written = 0;
        const handle = await fs.open(fullPath, "a");
        try {
          while (written < buffer.length) {
            if (signal?.aborted) throw new Error("Aborted");
            const chunk = buffer.subarray(written, written + CHUNK_SIZE);
            await handle.write(chunk);
            written += chunk.length;
            if (process.env.MARIE_DEBUG) {
              console.log(`[CliFS] appendFile chunk: ${written}/${totalBytes}`);
            }
            onProgress(written, totalBytes);
          }
        } finally {
          await handle.close();
        }
      } else {
        await fs.appendFile(fullPath, buffer);
        onProgress?.(buffer.length, totalBytes);
      }
    } catch (error: any) {
      throw new Error(`Failed to append to file ${filePath}: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.rm(this.resolve(filePath), { force: true });
    } catch (error: any) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  async backupFile(filePath: string): Promise<void> {
    try {
      const content = await this.readFile(filePath);
      this.backups.set(filePath, content);
    } catch {
      // If file doesn't exist, we'll store null/empty to represent "delete on rollback"
      this.backups.set(filePath, "__NON_EXISTENT__");
    }
  }

  async restoreFile(filePath: string): Promise<void> {
    const content = this.backups.get(filePath);
    if (content === undefined) return;

    if (content === "__NON_EXISTENT__") {
      try {
        await this.deleteFile(filePath);
      } catch {
        // Ignore errors during restore-delete
      }
    } else {
      await this.writeFile(filePath, content);
    }
    this.backups.delete(filePath);
  }

  async rollbackAll(): Promise<void> {
    const paths = Array.from(this.backups.keys());
    for (const p of paths) {
      await this.restoreFile(p);
    }
    this.backups.clear();
  }

  clearBackups(): void {
    this.backups.clear();
  }
}
