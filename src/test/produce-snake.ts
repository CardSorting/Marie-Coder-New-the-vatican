import { createAIProvider } from "../infrastructure/ai/AIProvider.js";
import { Engine } from "../infrastructure/ai/Engine.js";
import { registerCoreTools } from "../infrastructure/tools/ToolRegistry.js";
import { registerToolDefinitions } from "../infrastructure/tools/CliTools.js";
import { Automation } from "../infrastructure/Automation.js";
import { getApiKey } from "../infrastructure/Config.js";

async function main() {
    const apiKey = getApiKey();

    console.log("🚀 Starting Programmatic Snake Game Demo...");

    // 1. Initialize Infrastructure
    const provider = createAIProvider("openrouter", apiKey);
    const workingDir = process.cwd();
    const automation = new Automation(workingDir);
    automation.setProvider(provider);

    // 2. Register Protocols (Tools)
    registerCoreTools();
    registerToolDefinitions(automation, workingDir);

    // 3. Setup Session
    const messages: any[] = [
        {
            role: "user",
            content: "Create a simple, beautiful snake game in 'src/ui/snake/'. Include index.html, styles.css, and snake.js. Follow the 5-step evolutionary loop. Use your tools strictly: list_files, propose_diff, and apply_change.",
        },
    ];

    const callbacks = {
        onProgress: (update: any) => {
            if (update.type === "tool_start") {
                console.log(`\n🛠️  Executing Tool: ${update.tool}`);
                console.log(`   Args: ${JSON.stringify(update.args, null, 2)}`);
            } else if (update.type === "tool_end") {
                console.log(`✅ Tool ${update.tool} completed.`);
            } else if (update.type === "content_delta") {
                process.stdout.write(update.text);
            }
        },
    };

    const runTelemetry = {
        runId: `demo_${Date.now()}`,
        startedAt: Date.now(),
    };

    // 4. Run Engine
    const engine = new Engine(provider);
    try {
        const result = await engine.chatLoop(messages, runTelemetry, callbacks);
        console.log("\n\n🏁 Demo Complete!");
        console.log("Final Response:", result);
    } catch (error) {
        console.error("\n\n❌ Demo Failed:", error);
    }
}

main().catch(console.error);
