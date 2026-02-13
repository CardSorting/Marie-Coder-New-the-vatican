import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieToolProcessor } from "./MarieToolProcessor.js";
import { AscensionState } from "./MarieAscensionTypes.js";
import { StringUtils } from "../../../plumbing/utils/StringUtils.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";

const PROACTIVE_REPAIRS: Record<string, string> = {
    "write_file": "write_to_file",
    "edit_file": "replace_file_content",
    "replace_in_file": "replace_file_content",
    "read_files": "read_file",
    "list_files": "list_dir",
    "search_files": "grep_search",
    "execute_command": "run_command",
    "get_folder_tree": "get_folder_structure",
    "multi_replace": "multi_replace_file_content",
    "multi_edit_file": "multi_replace_file_content",
    "delete_file": "discard_file", // Maps CLI to VS Code name
    "discard_file": "delete_file"  // Maps VS Code to CLI name
};

/**
 * ATMOSPHERIC SEPARATION: MarieToolMender
 * Handles fuzzy hallucination repair for tool names and file paths.
 */
export class MarieToolMender {
    constructor(
        private toolRegistry: ToolRegistry
    ) { }

    /**
     * Attempts to automatically correct minor typos in tool calls using Levenshtein similarity.
     */
    public async performFuzzyRepair(
        toolCall: any,
        error: string,
        tracker: MarieProgressTracker,
        processor: MarieToolProcessor,
        state: AscensionState,
        signal?: AbortSignal
    ): Promise<string | null> {
        // 0. Proactive Mapping (Quick lookups for common hallucinations)
        if (PROACTIVE_REPAIRS[toolCall.name]) {
            const mappedName = PROACTIVE_REPAIRS[toolCall.name];
            // Only map if the target exists in the registry
            if (this.toolRegistry.getTools().some(t => t.name === mappedName)) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🩹 PROACTIVE REPAIR: Mapping hallucinated tool: ${toolCall.name} -> ${mappedName}`,
                    elapsedMs: tracker.elapsedMs()
                });
                toolCall.name = mappedName;
                toolCall.repaired = true;
                return await processor.process(toolCall, signal);
            }
        }
        // 1. Tool Name Repair
        const registeredTools = this.toolRegistry.getTools();
        let bestToolName = '';
        let bestToolSim = 0;

        for (const t of registeredTools) {
            const sim = StringUtils.similarity(toolCall.name, t.name);
            if (sim > bestToolSim) {
                bestToolSim = sim;
                bestToolName = t.name;
            }
        }

        const bestToolMatch = bestToolName ? { name: bestToolName, similarity: bestToolSim } : null;

        if (bestToolMatch && bestToolMatch.similarity > 0.8 && bestToolMatch.name !== toolCall.name) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🩹 FUZZY REPAIR: Fixing tool name hallucination: ${toolCall.name} -> ${bestToolMatch.name}`,
                elapsedMs: tracker.elapsedMs()
            });
            toolCall.name = bestToolMatch.name;
            return await processor.process(toolCall, signal);
        }

        // 2. Path Repair (if "File not found")
        if (error.includes('ENOENT') || error.includes('not found')) {
            const problematicPath = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;
            if (problematicPath && typeof problematicPath === 'string') {
                const recentFiles = state.recentFiles || [];
                let bestPathName = '';
                let bestPathSim = 0;

                for (const f of recentFiles) {
                    const sim = StringUtils.similarity(problematicPath, f);
                    if (sim > bestPathSim) {
                        bestPathSim = sim;
                        bestPathName = f;
                    }
                }

                const bestPathMatch = bestPathName ? { path: bestPathName, similarity: bestPathSim } : null;

                if (bestPathMatch && bestPathMatch.similarity > 0.85 && bestPathMatch.path !== problematicPath) {
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: `🩹 FUZZY REPAIR: Fixing path hallucination: ${problematicPath} -> ${bestPathMatch.path}`,
                        elapsedMs: tracker.elapsedMs()
                    });

                    if (toolCall.input.path) toolCall.input.path = bestPathMatch.path;
                    if (toolCall.input.targetFile) toolCall.input.targetFile = bestPathMatch.path;
                    if (toolCall.input.file) toolCall.input.file = bestPathMatch.path;

                    return await processor.process(toolCall, signal);
                }
            }
        }

        return null;
    }

    /**
     * ATMOSPHERIC REPAIR: Fixes malformed JSON strings from the model (e.g. missing commas, unquoted keys).
     */
    public repairJsonString(json: string): string {
        const { repaired } = JsonUtils.repairJsonDetailed(json);
        try {
            JSON.parse(repaired);
            return repaired;
        } catch {
            // Failed to repair, return original so caller can handle error paths explicitly.
            return json;
        }
    }
}
