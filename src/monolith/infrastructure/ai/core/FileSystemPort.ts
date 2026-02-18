/**
 * FileSystemPort - Universal interface for file operations.
 * Allows MarieToolProcessor to perform transactional operations (backups/rollbacks)
 * in both VS Code and CLI environments.
 */
export interface FileSystemPort {
  readFile(path: string, signal?: AbortSignal): Promise<string>;
  writeFile(
    path: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number, totalBytes?: number) => void,
  ): Promise<void>;
  appendFile(
    path: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number, totalBytes?: number) => void,
  ): Promise<void>;
  deleteFile(path: string, signal?: AbortSignal): Promise<void>;
  backupFile(path: string, signal?: AbortSignal): Promise<void>;
  restoreFile(path: string, signal?: AbortSignal): Promise<void>;
  rollbackAll(signal?: AbortSignal): Promise<void>;
  clearBackups(): void;
  readonly type: string;
}
