# Deployment Guide 🚀

This document outlines the process for building and deploying both the **MarieCoder** (NPM) and the **Marie VS Code Extension**.

---

## 📦 1. MarieCoder (NPM)

The CLI is published to NPM under the scoped name `@noorm/marie-cli`.

### **Prerequisites**
- An NPM account with access to the `@noorm` scope.
- An NPM automation token (or logged in via `npm login`).

### **Build & Publish Steps**
1.  **Build the project**:
    ```bash
    npm run build
    ```
2.  **Run Tests**:
    ```bash
    npm run test:cli
    ```
3.  **Bump Version**:
    ```bash
    npm version patch # or minor/major
    ```
4.  **Publish**:
    ```bash
    npm publish --access public
    ```

---

## 🧩 2. Marie VS Code Extension

The extension is published to the Visual Studio Marketplace under the publisher **`DreamBeesAI`**.

### **⚠️ The Naming Conflict Resolution**
`vsce` (the VS Code Extension Manager) has specific requirements that conflict with NPM's scoped package naming and some `package.json` fields. Specifically:
- `vsce` does not support scoped names like `@noorm/marie-coder` in the `name` field.
- `vsce` errors if both a `.vscodeignore` file and a `files` property in `package.json` exist.

#### **Temporary Packaging Process**
To package or publish the extension, follow these steps to temporarily adjust `package.json`:

1.  **Modify `package.json`**:
    -   Change `"name": "@noorm/marie-cli"` to `"name": "marie-coder"`.
    -   Temporarily remove or comment out the `"files": [...]` array.
    -   Ensure `"publisher": "DreamBeesAI"` is set.

2.  **Package**:
    ```bash
    npm run package:extension
    ```
    *This creates a `.vsix` file (e.g., `marie-coder-0.1.14.vsix`).*

3.  **Publish**:
    ```bash
    npx @vscode/vsce publish --packagePath <filename>.vsix
    ```

4.  **Restore `package.json`**:
    -   Revert the `"name"` back to `"@noorm/marie-cli"`.
    -   Restore the `"files"` property.

---

## 🛠️ Automated Helper (Proposed)

In the future, a script can be used to automate this "swap" to prevent manual errors:

```javascript
// Example: scripts/prepare-vsix.js
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const original = { ...pkg };

// Apply vsce-compatible changes
pkg.name = 'marie-coder';
delete pkg.files;

fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));

// Run packaging logic here...

// Finally, restore
// fs.writeFileSync('./package.json', JSON.stringify(original, null, 2));
```

---

## ✅ Post-Deployment Verification
- **CLI**: Run `npm install -g @noorm/marie-cli@latest` and verify `marie --version`.
- **VS Code**: Check the [Marketplace Dashboard](https://marketplace.visualstudio.com/manage) to ensure the new version is live.
