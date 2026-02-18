import { FileSystemPort } from "./FileSystemPort.js";
import {
  backupFile,
  restoreFile,
  clearBackups,
  rollbackAll,
  readFile,
  writeFile,
  appendToFile,
  deleteFile,
} from "../../../plumbing/filesystem/FileService.js";

/**
 * VscodeFileSystemPort - Implementation of FileSystemPort for the VS Code extension.
 * Delegates all operations to the existing FileService which uses vscode.workspace.fs.
 */
export class VscodeFileSystemPort implements FileSystemPort {
  public readonly type = "vscode";
  async readFile(path: string, signal?: AbortSignal): Promise<string> {
    return readFile(path, undefined, undefined, signal);
  }

  async writeFile(
    path: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number, totalBytes?: number) => void,
  ): Promise<void> {
    return writeFile(path, content, signal, undefined, onProgress);
  }

  async appendFile(
    path: string,
    content: string,
    signal?: AbortSignal,
    onProgress?: (bytes: number) => void,
  ): Promise<void> {
    return appendToFile(path, content, signal, onProgress);
  }

  async deleteFile(path: string, signal?: AbortSignal): Promise<void> {
    return deleteFile(path, signal);
  }

  async backupFile(path: string, signal?: AbortSignal): Promise<void> {
    return backupFile(path, signal);
  }

  async restoreFile(path: string, signal?: AbortSignal): Promise<void> {
    return restoreFile(path, signal);
  }

  async rollbackAll(signal?: AbortSignal): Promise<void> {
    return rollbackAll(signal);
  }

  clearBackups(): void {
    clearBackups();
  }
}
