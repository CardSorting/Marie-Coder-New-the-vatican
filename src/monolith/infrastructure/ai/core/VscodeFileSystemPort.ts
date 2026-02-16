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
  ): Promise<void> {
    return writeFile(path, content, signal);
  }

  async appendFile(
    path: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return appendToFile(path, content, signal);
  }

  async deleteFile(path: string): Promise<void> {
    return deleteFile(path);
  }

  async backupFile(path: string): Promise<void> {
    return backupFile(path);
  }

  async restoreFile(path: string): Promise<void> {
    return restoreFile(path);
  }

  async rollbackAll(): Promise<void> {
    return rollbackAll();
  }

  clearBackups(): void {
    clearBackups();
  }
}
