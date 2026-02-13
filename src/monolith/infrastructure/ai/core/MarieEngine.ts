import { AIProvider } from "../providers/AIProvider.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieSession, MarieSessionPromptProfile } from "./MarieSession.js";
import { MarieEventDispatcher } from "./MarieEventDispatcher.js";
import { MarieToolProcessor } from "./MarieToolProcessor.js";
import { MarieAscendant } from "../agents/MarieAscendant.js";
import { AscensionState, AscensionDecree } from "./MarieAscensionTypes.js";
import { MarieLockManager } from "./MarieLockManager.js";
import { MarieToolMender } from "./MarieToolMender.js";
import { MariePulseService } from "./MariePulseService.js";
import { MarieStabilityMonitor } from "./MarieStabilityMonitor.js";
import { ReasoningBudget } from "./ReasoningBudget.js";
import { ConfigService } from "../../config/ConfigService.js";
import { FileSystemPort } from "./FileSystemPort.js";
import { GhostPort } from "./GhostPort.js";

export function getPromptProfileForDepth(depth: number): MarieSessionPromptProfile {
    return depth > 0 ? 'continuation' : 'full';
}

/**
 * Entry point for the AI Engine. YOLO Supremacy Edition.
 */
export class MarieEngine {
    private static readonly CONTENT_BUFFER_MAX_BYTES = 1024 * 1024;
    private ascendant: MarieAscendant;
    private state: AscensionState;
    private lockManager: MarieLockManager;
    private toolMender: MarieToolMender;
    private pulseService: MariePulseService | undefined;
    private reasoningBudget: ReasoningBudget;
    private toolCallCounter: number = 0;
    private lastFailedFile: string | undefined;
    private contentBuffer: string = "";
    private lastContentEmit: number = 0;
    private static activeTurn: Promise<void> | null = null;
    private disposed: boolean = false;

    constructor(
        private provider: AIProvider,
        private toolRegistry: ToolRegistry,
        private approvalRequester: (name: string, input: any) => Promise<boolean>,
        private providerFactory?: (type: string) => AIProvider,
        private fs?: FileSystemPort,
        private ghostPort?: GhostPort
    ) {
        this.ascendant = new MarieAscendant(this.provider);
        this.state = this.initializeState();
        this.lockManager = new MarieLockManager();
        this.toolMender = new MarieToolMender(this.toolRegistry);
        this.reasoningBudget = new ReasoningBudget();
    }

    private initializeState(): AscensionState {
        return {
            errorHotspots: {},
            totalErrorCount: 0,
            spiritPressure: 50,
            recentFiles: [],
            toolHistory: [],
            techniqueExecutions: [],
            victoryStreak: 0,
            shakyResponseDensity: 0,
            writtenFiles: [],
            actionDiffs: {},
            wiringAlerts: [],
            mood: 'STABLE',
            isSpiritBurstActive: false,
            isAwakened: false,
            karmaBond: undefined,
            panicCoolDown: 0
        };
    }

    public async chatLoop(
        messages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>,
        signal?: AbortSignal,
        consecutiveErrorCount: number = 0,
        depth: number = 0
    ): Promise<string> {
        if (this.disposed) {
            throw new Error("MarieEngine has been disposed.");
        }

        // TURN COLLISION GUARD: Wait for any existing turn to finish
        if (MarieEngine.activeTurn) {
            console.warn("[MarieEngine] TURN COLLISION DETECTED. Waiting for previous turn to finalize...");

            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "⏳ TURN COLLISION: Another AI turn is active. Queuing reasoning loop...",
                elapsedMs: tracker.elapsedMs()
            });

            const pulse = this.ensurePulseService(tracker);
            const watchdog = pulse.startTurnWatchdog(() => {
                MarieEngine.activeTurn = null;
            });

            try {
                await MarieEngine.activeTurn;
            } finally {
                if (watchdog) clearTimeout(watchdog);
            }
        }

        let resolveTurn: () => void = () => { };
        MarieEngine.activeTurn = new Promise<void>(resolve => { resolveTurn = resolve; });

        try {
            const result = await this._executeChatLoop(messages, tracker, saveHistory, signal, consecutiveErrorCount, depth);
            // Persistence would go here if needed
            return result;
        } finally {
            resolveTurn();
            MarieEngine.activeTurn = null;
        }
    }

    private async _executeChatLoop(
        messages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>,
        signal?: AbortSignal,
        consecutiveErrorCount: number = 0,
        depth: number = 0
    ): Promise<string> {
        const pulse = this.ensurePulseService(tracker);

        if (depth > 20) { // Bumped depth for YOLO velocity
            throw new Error("Extreme Stability Alert: Maximum chatLoop depth reached. Possible infinite reasoning loop detected.");
        }

        tracker.resetReasoningBudget();
        this.lockManager = new MarieLockManager(tracker);
        const dispatcher = new MarieEventDispatcher(tracker, this.ghostPort);
        MarieStabilityMonitor.start();

        if (tracker.getRun().steps === 0 && !tracker.getRun().isResuming) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "🔥 Ascension protocol initiated. Hero's conviction rising.",
                elapsedMs: tracker.elapsedMs()
            });
        }

        // SPIRIT BURST & AWAKENING DETECTION
        const wasBurstActive = this.state.isSpiritBurstActive;
        const wasAwakened = this.state.isAwakened;

        this.state.isSpiritBurstActive = this.state.spiritPressure > 85;
        this.state.isAwakened = this.state.spiritPressure > 95;

        if (this.state.isAwakened && !wasAwakened) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "✨ AWAKENED! Ultra Instinct achieved. Full codebase sovereignty established.",
                elapsedMs: tracker.elapsedMs()
            });
        } else if (this.state.isSpiritBurstActive && !wasBurstActive) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "💥 SPIRIT BURST! Conviction is absolute. Auto-approval mandate expanded.",
                elapsedMs: tracker.elapsedMs()
            });
        }

        // Decay spirit pressure if stale
        if (Date.now() - (this.state.techniqueExecutions.slice(-1)[0]?.timestamp || 0) > 300000) {
            this.state.spiritPressure = Math.max(30, this.state.spiritPressure - 10);
        }

        const processor = new MarieToolProcessor(
            this.toolRegistry,
            tracker,
            async (name, input) => {
                // YOLO AUTO-APPROVAL: Tiered risk assessment
                if (this.shouldAutoApprove(name, input)) {
                    tracker.emitEvent({
                        type: 'checkpoint',
                        runId: tracker.getRun().runId,
                        status: 'approved',
                        toolName: name,
                        summary: { what: 'Ascension Auto-Approved', why: 'Heroic Conviction', impact: 'Maximum Speed' },
                        elapsedMs: tracker.elapsedMs()
                    });
                    return true;
                }
                return this.approvalRequester(name, input);
            },
            this.state,
            this.fs
        );

        let finalContent = "";
        const toolBuffer: Map<number, any> = new Map();
        const parsedInputCache = new Map<string, any>();
        const toolResultBlocks: any[] = [];
        let turnFailureCount = 0;
        let totalToolCount = 0;
        let lastTokenTime = Date.now();

        const MAX_TOOLS_PER_TURN = 30;

        const executeTool = async (toolCall: any) => {
            const tool = this.toolRegistry.getTool(toolCall.name);
            if (!tool) {
                this.updateShakyResponse();
                return { type: "tool_result", tool_use_id: toolCall.id, content: `Error: Tool "${toolCall.name}" not found.` };
            }

            const startTime = Date.now();
            pulse.startHeartbeat();

            try {
                let toolResult = await processor.process(toolCall, signal);

                // Buffer Hard-Cap
                if (typeof toolResult === 'string' && toolResult.length > 1024 * 1024) {
                    toolResult = toolResult.substring(0, 1024 * 1024) + "\n\n🚨 Truncated at 1MB.";
                }

                const durationMs = Date.now() - startTime;
                const targetFile = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;

                if (typeof toolResult === 'string' && toolResult.startsWith('Error')) {
                    this.handleFailure(tracker, toolCall.name, toolResult, targetFile);
                    turnFailureCount++;
                } else {
                    this.handleSuccess(tracker, toolCall.name, durationMs, targetFile);
                }

                this.toolCallCounter++;
                return { type: "tool_result", tool_use_id: toolCall.id, content: toolResult };
            } finally {
                pulse.stopHeartbeat();
            }
        };

        const promptProfile = getPromptProfileForDepth(depth);
        const session = new MarieSession(
            this.provider,
            this.toolRegistry,
            saveHistory,
            messages,
            tracker,
            this.providerFactory,
            promptProfile
        );

        try {
            const stream = session.executeLoop(messages, signal);
            for await (const event of stream) {
                const now = Date.now();
                lastTokenTime = now;
                pulse.startHeartbeat();

                if (event.type === 'content_delta') {
                    finalContent += event.text;
                    this.contentBuffer += event.text;

                    if (this.contentBuffer.length >= MarieEngine.CONTENT_BUFFER_MAX_BYTES) break;

                    if (now - this.lastContentEmit > 100) {
                        tracker.emitStream(this.contentBuffer);
                        this.contentBuffer = "";
                        this.lastContentEmit = now;
                    }
                } else if (event.type === 'tool_call_delta') {
                    let tb = toolBuffer.get(event.index);
                    if (!tb) {
                        tb = { id: event.id, name: event.name, inputString: "" };
                        toolBuffer.set(event.index, tb);
                    }
                    if (event.argumentsDelta) tb.inputString += event.argumentsDelta;

                    if (tb.name && this.isLikelyCompleteJson(tb.inputString)) {
                        const input = this.tryParseToolInput(tb.inputString, tb.name, parsedInputCache);
                        if (!input) continue;

                        toolBuffer.delete(event.index);
                        totalToolCount++;

                        if (totalToolCount > MAX_TOOLS_PER_TURN) break;

                        const target = input.path || input.targetFile || input.file || 'GLOBAL';
                        const isWrite = ['write_to_file', 'replace_file_content', 'multi_replace_file_content', 'run_command', 'delete_file'].includes(tb.name);

                        await this.lockManager.acquireLock(target, isWrite, signal, tracker.getRun().runId);
                        const result = await executeTool({ id: tb.id, name: tb.name, input });
                        toolResultBlocks.push(result);
                    }
                } else if (event.type === 'usage') {
                    tracker.getRun().usage = event.usage;
                }
            }
        } finally {
            pulse.cleanup();
        }

        if (this.contentBuffer.length > 0) {
            tracker.emitStream(this.contentBuffer);
            this.contentBuffer = "";
        }

        await this.lockManager.waitForAll();

        // Final tool processing if results were returned
        if (totalToolCount > 0) {
            messages.push({ role: "user", content: toolResultBlocks });

            // ASCENSION EVALUATION: Determine next trajectory
            const decree = await this.ascendant.evaluate(messages, this.state);
            this.state.lastDecree = decree;

            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `⚡ Protocol Decree: ${decree.strategy} @ ${decree.confidence.toFixed(2)} — ${decree.reason}`,
                elapsedMs: tracker.elapsedMs()
            });

            // ZENITH AUTONOMY: Autonomous Strategic Calibration
            this.calibrateStrategicTrajectory(decree, tracker);

            if (decree.strategy === 'PANIC') {
                this.state.panicCoolDown = 3;
                messages.push({ role: "user", content: "🚨 SYSTEM PANIC: Instability detected. Re-evaluating ascension trajectory." });
            }

            if (decree.strategy === 'LIMIT_BREAK') {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: "⚡ LIMIT BREAK! Bypassing recursive safety seals for peak momentum.",
                    elapsedMs: tracker.elapsedMs()
                });
                // Temporarily allow deeper recursion for this specific branch
                saveHistory(tracker.getRun()).catch(e => console.error("History Save Error:", e));
                return await this._executeChatLoop(messages, tracker, saveHistory, signal, turnFailureCount > 0 ? consecutiveErrorCount + 1 : 0, depth);
            }

            if (decree.heroicVow) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🗡️ HEROIC VOW: "${decree.heroicVow}". Spirit Pressure surging!`,
                    elapsedMs: tracker.elapsedMs()
                });
                this.state.spiritPressure = Math.min(100, this.state.spiritPressure + 20);
            }

            if (decree.sacrificeTriggered) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: "🕯️ HEROIC SACRIFICE! Resetting soul for a final, absolute strike.",
                    elapsedMs: tracker.elapsedMs()
                });
                this.state.spiritPressure = 50;
                decree.confidence = 3.0;
            }

            saveHistory(tracker.getRun()).catch(e => console.error("History Save Error:", e));
            return await this._executeChatLoop(messages, tracker, saveHistory, signal, turnFailureCount > 0 ? consecutiveErrorCount + 1 : 0, depth + 1);
        }

        // End of turn logic
        tracker.setObjectiveStatus('execute_plan', 'completed');
        tracker.setObjectiveStatus('deliver_result', 'completed');

        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: "✨ Convergence achieved. The pattern sparks joy.",
            elapsedMs: tracker.elapsedMs()
        });

        dispatcher.clear();
        return finalContent;
    }

    private handleSuccess(tracker: MarieProgressTracker, toolName: string, durationMs: number, filePath?: string) {
        this.state.victoryStreak++;
        this.state.totalErrorCount = 0;
        this.state.spiritPressure = Math.min(100, this.state.spiritPressure + 10);
        this.state.techniqueExecutions.push({ name: toolName, durationMs, success: true, timestamp: Date.now(), filePath });
        this.state.toolHistory.push(toolName);

        if (this.state.victoryStreak % 3 === 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `✨ Technique Mastery! ${toolName} executed perfectly. Victory Streak: ${this.state.victoryStreak}.`,
                elapsedMs: tracker.elapsedMs()
            });
        }

        if (filePath && !this.state.recentFiles.includes(filePath)) {
            this.state.recentFiles.push(filePath);
            if (this.state.recentFiles.length > 10) this.state.recentFiles.shift();

            // ZENITH AUTONOMY: Proactive Context Anchoring
            this.proactiveContextAnchoring(filePath, tracker);
        }
    }

    private handleFailure(tracker: MarieProgressTracker, toolName: string, error: string, filePath?: string) {
        this.state.victoryStreak = 0;
        this.state.spiritPressure = Math.max(0, this.state.spiritPressure - 20);
        this.state.techniqueExecutions.push({ name: toolName, durationMs: 0, success: false, timestamp: Date.now(), filePath });

        const hotspotCount = (this.state.errorHotspots[filePath || 'system'] || 0) + 1;
        if (filePath) {
            this.state.errorHotspots[filePath] = hotspotCount;
            this.state.totalErrorCount++;
        }

        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `⚠️ Technique Falter! ${toolName} failed in ${filePath || 'system'}. Resistance: ${hotspotCount}x. Regrouping...`,
            elapsedMs: tracker.elapsedMs()
        });
    }

    private updateShakyResponse() {
        this.state.shakyResponseDensity = Math.min(1, this.state.shakyResponseDensity + 0.2);
    }

    private shouldAutoApprove(toolName: string, input: any): boolean {
        const safeTools = ['read_file', 'view_file', 'list_dir', 'grep_search', 'search_web', 'get_file_diagnostics'];
        if (safeTools.includes(toolName)) return true;

        const pressure = this.state.spiritPressure;
        const streak = this.state.victoryStreak;

        // Founder's Mandate: High pressure and good streak allows auto-approval of writes
        if (pressure > 70 && streak > 5) return true;

        // UNIVERSAL SOVEREIGNTY: Awakened + streak > 10 allows all tool operations
        if (this.state.isAwakened && streak > 10) return true;

        // SPIRIT BURST MANDATE: Absolute conviction auto-approves all non-destructive content modifications
        if (this.state.isSpiritBurstActive && streak > 3) {
            const destructiveTools = ['delete_file', 'run_command'];
            if (!destructiveTools.includes(toolName)) return true;
        }

        return false;
    }

    private tryParseToolInput(rawInput: string, toolName: string, cache: Map<string, any>): any | null {
        try {
            return JSON.parse(rawInput);
        } catch {
            const repaired = this.toolMender.repairJsonString(rawInput);
            try {
                return JSON.parse(repaired);
            } catch {
                return null;
            }
        }
    }

    private isLikelyCompleteJson(input: string): boolean {
        const text = input.trim();
        if (!text || (!text.startsWith('{') && !text.startsWith('['))) return false;
        let stack = 0;
        let inString = false;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '"' && text[i - 1] !== '\\') inString = !inString;
            if (!inString) {
                if (text[i] === '{' || text[i] === '[') stack++;
                if (text[i] === '}' || text[i] === ']') stack--;
            }
        }
        return stack === 0 && text.length > 2;
    }

    public dispose(): void {
        this.disposed = true;
        this.pulseService?.cleanup();
        this.pulseService = undefined;
        this.contentBuffer = "";
    }

    private ensurePulseService(tracker: MarieProgressTracker): MariePulseService {
        if (!this.pulseService) this.pulseService = new MariePulseService(tracker);
        return this.pulseService;
    }

    private calibrateStrategicTrajectory(decree: AscensionDecree, tracker: MarieProgressTracker) {
        const run = tracker.getRun();
        if (decree.strategy === 'RESEARCH' || (decree.urgency === 'HIGH' && decree.confidence > 2.0)) {
            const oldPasses = run.totalPasses || 3;
            if (oldPasses < 10) {
                run.totalPasses = oldPasses + 1;
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: run.runId,
                    text: `🌌 ZENITH: Autonomously expanded roadmap to ${run.totalPasses} passes. Focus sharpened: ${decree.reason}`,
                    elapsedMs: tracker.elapsedMs()
                });
            }
        }
    }

    private async proactiveContextAnchoring(filePath: string, tracker: MarieProgressTracker) {
        // Only anchor critical files
        const isCritical = /Domain|Config|Service|Interface|types/i.test(filePath);
        if (isCritical) {
            try {
                const { ContextArchiveService } = await import("../../../infrastructure/ai/context/ContextArchiveService.js");
                const { readFile } = await import("../../../plumbing/filesystem/FileService.js");
                const content = await readFile(filePath);

                await ContextArchiveService.getInstance().anchor({
                    id: `proactive_${filePath.split('/').pop()}`,
                    label: `Strategic: ${filePath.split('/').pop()}`,
                    content: content.substring(0, 2000), // Cap at 2k chars
                    type: 'file_ref'
                });

                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `⚓ ZENITH: Proactively anchored \`${filePath.split('/').pop()}\` to strategic memory.`,
                    elapsedMs: tracker.elapsedMs()
                });
            } catch (e) {
                console.warn("[Zenith] Failed proactive anchoring", e);
            }
        }
    }
}
