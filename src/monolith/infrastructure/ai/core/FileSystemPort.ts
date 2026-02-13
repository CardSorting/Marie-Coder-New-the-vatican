/**
 * FileSystemPort - Universal interface for file operations.
 * Allows MarieToolProcessor to perform transactional operations (backups/rollbacks)
 * in both VS Code and CLI environments.
 */
export interface FileSystemPort {
  readFile(path: string, signal?: AbortSignal): Promise<string>;
  writeFile(path: string, content: string, signal?: AbortSignal): Promise<void>;
  deleteFile(path: string): Promise<void>;
  backupFile(path: string): Promise<void>;
  restoreFile(path: string): Promise<void>;
  rollbackAll(): Promise<void>;
  clearBackups(): void;
  readonly type: string;
}
