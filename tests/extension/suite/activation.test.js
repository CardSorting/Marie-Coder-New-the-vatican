import assert from "assert";
import * as vscode from "vscode";

async function waitFor(condition, timeoutMs = 15000, intervalMs = 200) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await condition()) return true;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return false;
}

suite("Marie Extension Live Tests", () => {
    test("activates via extension entry point", async () => {
        const extensionId = "cardsorting.marie";
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension, `Extension ${extensionId} should be installed`);

        await extension.activate();

        const activated = await waitFor(async () => {
            const ext = vscode.extensions.getExtension(extensionId);
            return Boolean(ext?.isActive);
        });

        assert.ok(activated, "Extension should be activated");
    });

    test("webview HTML includes CSP and webview bundle references", async () => {
        const extensionId = "cardsorting.marie";
        const extension = vscode.extensions.getExtension(extensionId);
        assert.ok(extension, `Extension ${extensionId} should be installed`);

        await extension.activate();

        const api = extension.exports || {};
        assert.ok(typeof api.getWebviewHtml === "function", "Extension should expose getWebviewHtml()");

        const html = api.getWebviewHtml();
        assert.ok(html.includes("Content-Security-Policy"), "Webview HTML should include CSP");
        assert.ok(html.includes("main.js"), "Webview HTML should reference main.js bundle");
        assert.ok(html.includes("main.css"), "Webview HTML should reference main.css bundle");
    });
});