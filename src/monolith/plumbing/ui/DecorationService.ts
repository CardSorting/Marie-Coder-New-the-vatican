import * as vscode from "vscode";

// Decoration for Creates (Blue/Cyan with Sparkle)
const createDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(0, 255, 255, 0.1)", // Light Cyan background
  isWholeLine: false,
  overviewRulerColor: "rgba(0, 255, 255, 0.8)",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " ✨ Marie Created",
    color: "rgba(0, 255, 255, 0.7)",
    margin: "0 0 0 20px",
    fontWeight: "bold",
  },
  gutterIconPath: vscode.Uri.parse(
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTggMEw5LjUgNi41TDE2IDhMOS41IDkuNUw4IDE2TDYuNSA5LjVMMCA4TDYuNSA2LjVMOCAwWiIgZmlsbD0idXJsKCNncmFkKSIvPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTYiIHkyPSIxNiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzAwZmZmZiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2ZmYjdjNSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg==",
  ), // Refined Sparkle with Sakura Gradient
  gutterIconSize: "contain",
});

// Decoration for Modifications (Green with Pencil)
const modifyDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(100, 255, 100, 0.1)", // Light Green background
  isWholeLine: false,
  overviewRulerColor: "rgba(100, 255, 100, 0.8)",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " ✏️ Marie Modified",
    color: "rgba(100, 255, 100, 0.7)",
    margin: "0 0 0 20px",
    fontWeight: "bold",
  },
  gutterIconPath: vscode.Uri.parse(
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNDJkZjc4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMgMTNWNU0zIDExTDExIDNNMTEgNWwtMi0yTDMgMTFsMiAyIi8+PC9zdmc+",
  ), // Refined Git-themed Pencil
  gutterIconSize: "contain",
});

export const DecorationService = {
  /**
   * Highlights a range with the "Created by Marie" decoration.
   */
  decorateCreation(editor: vscode.TextEditor, range: vscode.Range) {
    editor.setDecorations(createDecorationType, [range]);

    // Remove decoration after a short delay
    setTimeout(() => {
      editor.setDecorations(createDecorationType, []);
    }, 2000);
  },

  /**
   * Highlights a range with the "Modified by Marie" decoration.
   */
  decorateModification(editor: vscode.TextEditor, range: vscode.Range) {
    editor.setDecorations(modifyDecorationType, [range]);

    // Remove decoration after a short delay
    setTimeout(() => {
      editor.setDecorations(modifyDecorationType, []);
    }, 2000);
  },
};
