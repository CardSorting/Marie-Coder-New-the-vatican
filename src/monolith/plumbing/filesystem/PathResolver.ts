import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";

/**
 * Resolves a file path to a VS Code URI.
 * Handles absolute paths, workspace-relative paths, and home directory (~) expansion.
 */
export function resolvePath(p: string): vscode.Uri {
  let resolvedPath = p;

  // Handle home directory expansion
  if (p.startsWith("~")) {
    resolvedPath = path.join(os.homedir(), p.slice(1));
  }

  if (path.isAbsolute(resolvedPath)) {
    // Normalize for cross-platform consistency
    return vscode.Uri.file(path.normalize(resolvedPath));
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    // Use Uri.file + path.join for better compatibility
    return vscode.Uri.file(
      path.join(workspaceFolders[0].uri.fsPath, resolvedPath),
    );
  }

  // Fallback if no workspace is open
  return vscode.Uri.file(path.normalize(resolvedPath));
}
