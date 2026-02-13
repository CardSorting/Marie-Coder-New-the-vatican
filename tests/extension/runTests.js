import path from "path";
import { fileURLToPath } from "url";
import { runTests } from "@vscode/test-electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");
        const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ["--disable-extensions"],
            extensionTestsEnv: {
                MARIE_EXTENSION_TESTS: "1",
            },
        });
    } catch (error) {
        console.error("Failed to run extension tests", error);
        process.exit(1);
    }
}

main();