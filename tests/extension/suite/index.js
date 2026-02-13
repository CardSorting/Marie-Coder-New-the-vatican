import path from "path";
import { fileURLToPath } from "url";
import Mocha from "mocha";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function run() {
    const mocha = new Mocha({
        ui: "bdd",
        color: true,
        timeout: 300000, // 5 minutes
    });

    const testsRoot = __dirname;
    const files = globSync("**/*.test.js", { cwd: testsRoot });

    for (const file of files) {
        mocha.addFile(path.resolve(testsRoot, file));
    }

    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
}