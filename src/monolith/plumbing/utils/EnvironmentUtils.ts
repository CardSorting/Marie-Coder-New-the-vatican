import { createRequire } from "module";

/**
 * Robust environment detection for Marie.
 * Distinguishes between VS Code Extension Host and CLI/Standalone modes.
 */
export function isVsCodeExtension(): boolean {
    return Boolean(
        (process.env.VSCODE_IPC_HOOK ||
            process.env.VSCODE_PID ||
            process.env.VSCODE_CWD ||
            process.env.VSCODE_NLS_CONFIG) &&
        !process.env.MARIE_FORCE_CLI
    );
}

/**
 * Isomorphic require implementation that works in both ESM and CJS.
 * Prevents build-time and runtime crashes in bundled environments like VS Code.
 */
export const nodeRequire = (() => {
    // Use globalThis to avoid shadowing/hoisting issues with 'require'
    const g = globalThis as any;
    if (typeof g.require !== "undefined") {
        return g.require;
    }

    // In ESM environments, we must create a require function using import.meta.url
    // We use an indirect eval to prevent bundlers (like esbuild) from 
    // attempting to polyfill or complain about import.meta in non-ESM output.
    try {
        const metaUrl = (0, eval)("import.meta.url");
        if (metaUrl) {
            return createRequire(metaUrl);
        }
    } catch {
        // Fallback or ignore
    }

    // Final fallback for environments where neither require nor createRequire is feasible
    return (id: string) => {
        throw new Error(`Execution Environment Error: Cannot require "${id}". Environment is incompatible with module resolution.`);
    };
})();
