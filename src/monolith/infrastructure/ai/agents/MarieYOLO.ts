import { AIProvider } from "../providers/AIProvider.js";
import { MARIE_YOLO_SYSTEM_PROMPT } from "../../../../prompts.js";
import { ConfigService } from "../../config/ConfigService.js";
import { MarieResponse } from "../core/MarieResponse.js";
import { YoloStrategy, YoloDecision, YoloMemory, YoloUrgency, YoloStopCondition } from "../core/MarieYOLOTypes.js";

export class MarieYOLO {
    // BALANCED SUPREMACY: Conviction persistence across turns
    private lastConfidence: number = 1.2;
    private consecutiveSuccesses: number = 0;

    constructor(private provider: AIProvider) { }

    public async evaluate(
        messages: any[],
        memory: YoloMemory,
        options?: {
            profile?: 'demo_day' | 'balanced' | 'recovery';
            aggression?: number;
            maxRequiredActions?: number;
        }
    ): Promise<YoloDecision> {
        try {
            const profile = options?.profile ?? ConfigService.getYoloProfile();
            const aggression = options?.aggression ?? ConfigService.getYoloAggression();
            const maxRequiredActions = options?.maxRequiredActions ?? ConfigService.getYoloMaxRequiredActions();

            // CONSOLIDATED REASONING: YOLO now acts as Auditor, Strategist, and ISO9001
            const hotspots = Object.entries(memory.errorHotspots)
                .filter(([_, c]) => c >= 2)
                .map(([f, c]) => `${f}(${c}x)`)
                .join(', ') || 'None';

            const contextPrompt = `
[YOLO SUPREMACY CONTEXT]
Memory Snapshot:
- Flow State: ${memory.flowState}/100
- Success Streak: ${memory.successStreak}
- Total Errors: ${memory.totalErrorCount}
- Hotspots: ${hotspots}
- Recent Files: ${memory.recentFiles.slice(-5).join(', ')}
- Profile: ${profile}
- Aggression: ${aggression}

[RESPONSIBILITIES]
1. STRATEGIST: Determine the optimal trajectory.
2. AUDITOR: Verify the last turn's output for logical drift or missed requirements.
3. ISO9001: Ensure high quality and adherence to architecture.
4. QASRE: Balance velocity with stability.

Return guidance in the exact structure below:
Strategy: EXECUTE|DEBUG|RESEARCH|HYPE|PANIC
Urgency: LOW|MEDIUM|HIGH
Confidence: 0.5-3.0
Structural Uncertainty: YES|NO
Continue Directive: YES|NO
Required Actions: action1 | action2
Blocked By: blocker1 | blocker2
Stop Condition: landed|structural_uncertainty
Reason: <one concise line integrating Auditor/ISO findings>

Required Actions must be <= ${maxRequiredActions}.`;

            const providerResponse = await this.provider.createMessage({
                model: ConfigService.getModel(),
                system: MARIE_YOLO_SYSTEM_PROMPT,
                messages: [
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: contextPrompt }
                ],
                max_tokens: 900,
            });

            const raw = MarieResponse.wrap(providerResponse.content).getText().substring(0, 1200);
            return this.parseDecision(raw, messages, profile, aggression, maxRequiredActions, memory.successStreak);
        } catch (error) {
            console.error("MarieYOLO evaluation error", error);
            return {
                strategy: 'EXECUTE',
                urgency: 'MEDIUM',
                confidence: Math.max(1.2, this.lastConfidence * 0.8),
                isContinueDirective: this.hasContinueDirective(messages),
                structuralUncertainty: false,
                reason: 'Fallback: Founder maintains course safely.',
                requiredActions: [],
                blockedBy: [],
                stopCondition: 'landed',
                profile: ConfigService.getYoloProfile(),
                raw: 'Fallback decision (provider error)'
            };
        }
    }

    private parseDecision(
        raw: string,
        messages: any[],
        profile: 'demo_day' | 'balanced' | 'recovery',
        aggression: number,
        maxRequiredActions: number,
        successStreak?: number
    ): YoloDecision {
        const normalized = raw.replace(/\r/g, '');

        const strategyMatch = normalized.match(/Strategy\s*:\s*(EXECUTE|DEBUG|RESEARCH|HYPE|PANIC)/i);
        const urgencyMatch = normalized.match(/Urgency\s*:\s*(LOW|MEDIUM|HIGH)/i);
        const confidenceMatch = normalized.match(/Confidence\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
        const uncertaintyMatch = normalized.match(/Structural\s*Uncertainty\s*:\s*(YES|NO|TRUE|FALSE)/i);
        const continueMatch = normalized.match(/Continue\s*Directive\s*:\s*(YES|NO|TRUE|FALSE)/i);
        const requiredActionsMatch = normalized.match(/Required\s*Actions\s*:\s*(.+)/i);
        const blockedByMatch = normalized.match(/Blocked\s*By\s*:\s*(.+)/i);
        const stopConditionMatch = normalized.match(/Stop\s*Condition\s*:\s*(landed|structural_uncertainty)/i);
        const reasonMatch = normalized.match(/Reason\s*:\s*(.+)/i);

        const inferredStrategy = this.inferStrategy(normalized);
        const strategy = (strategyMatch?.[1]?.toUpperCase() as YoloStrategy) || inferredStrategy;
        const urgency = (urgencyMatch?.[1]?.toUpperCase() as YoloUrgency) || this.inferUrgency(normalized);
        let confidence = this.clampConfidence(Number(confidenceMatch?.[1] ?? this.inferConfidence(urgency, strategy)));
        const structuralUncertainty = this.parseBoolean(uncertaintyMatch?.[1]) || this.inferUncertainty(normalized);
        const isContinueDirective = this.parseBoolean(continueMatch?.[1]) || this.hasContinueDirective(messages) || /continue\s+immediately/i.test(normalized);

        const requiredActions = this.parseDelimitedList(requiredActionsMatch?.[1]).slice(0, maxRequiredActions);
        const blockedBy = this.parseDelimitedList(blockedByMatch?.[1]).slice(0, 4);

        const stopCondition = (stopConditionMatch?.[1]?.toLowerCase() as YoloStopCondition)
            || (structuralUncertainty ? 'structural_uncertainty' : 'landed');

        confidence = this.applyProfileTuning(confidence, profile, aggression, structuralUncertainty, successStreak);

        // BALANCED SUPREMACY: Stronger continue directive boost
        if (isContinueDirective && (strategy === 'EXECUTE' || strategy === 'HYPE')) {
            confidence = Math.min(3.0, confidence + 0.3);
        }

        // Update persistence for next turn
        this.lastConfidence = confidence;
        if (strategy === 'EXECUTE' || strategy === 'HYPE') {
            this.consecutiveSuccesses++;
        } else {
            this.consecutiveSuccesses = 0;
        }

        return {
            strategy,
            urgency,
            confidence,
            structuralUncertainty,
            isContinueDirective,
            reason: (reasonMatch?.[1] || this.defaultReason(strategy, urgency)).trim().substring(0, 220),
            requiredActions,
            blockedBy,
            stopCondition,
            profile,
            raw: normalized.substring(0, 1200)
        };
    }

    private inferStrategy(text: string): YoloStrategy {
        if (/uncertainty|unknown|unclear|ambiguous\s+structure|dependency\s+risk/i.test(text)) return 'DEBUG';
        if (/research|investigate|inspect/i.test(text)) return 'RESEARCH';
        if (/ship|launch|demo day|hype|singularity/i.test(text)) return 'HYPE';
        if (/panic|halt|assess\s+failure/i.test(text)) return 'PANIC';
        return 'EXECUTE';
    }

    private inferUrgency(text: string): YoloUrgency {
        if (/immediately|now|urgent|critical momentum|no hesitation/i.test(text)) return 'HIGH';
        if (/careful|cautious|stability/i.test(text)) return 'LOW';
        return 'MEDIUM';
    }

    private inferConfidence(urgency: YoloUrgency, strategy: YoloStrategy): number {
        if (strategy === 'HYPE') return 2.0;
        if (strategy === 'PANIC') return 0.5;
        if (urgency === 'HIGH') return 1.9;
        if (urgency === 'LOW') return 1.0;
        return 1.5;
    }

    private inferUncertainty(text: string): boolean {
        return /structural\s+uncertainty|critical unknown|not enough context|missing wiring/i.test(text);
    }

    private defaultReason(strategy: YoloStrategy, urgency: YoloUrgency): string {
        return `Founder signal: ${strategy} with ${urgency.toLowerCase()} urgency.`;
    }

    private parseBoolean(value?: string): boolean {
        if (!value) return false;
        return ['YES', 'TRUE'].includes(value.toUpperCase());
    }

    // BALANCED SUPREMACY: Higher max confidence (3.0 vs 2.5)
    private clampConfidence(value: number): number {
        if (!Number.isFinite(value)) return 1.2;
        return Math.min(3.0, Math.max(0.5, value));
    }

    private applyProfileTuning(
        baseConfidence: number,
        profile: 'demo_day' | 'balanced' | 'recovery',
        aggression: number,
        structuralUncertainty: boolean,
        successStreak?: number
    ): number {
        let profileMultiplier = 1.0;
        // BALANCED SUPREMACY: Boosted profile multipliers
        if (profile === 'demo_day') profileMultiplier = 1.2;
        if (profile === 'recovery') profileMultiplier = 0.9;

        // BALANCED SUPREMACY: Success streak amplification (+0.05 per streak, max +0.5)
        const streakBonus = Math.min(0.5, (successStreak || 0) * 0.05);

        let tuned = baseConfidence * profileMultiplier * aggression * (1 + streakBonus);
        // BALANCED SUPREMACY: Gentler structural uncertainty penalty
        if (structuralUncertainty) tuned *= 0.85;

        // BALANCED SUPREMACY: Conviction persistence (15% carryover from last turn)
        const persistenceBonus = this.lastConfidence * 0.15;
        tuned += persistenceBonus;

        return this.clampConfidence(tuned);
    }

    private parseDelimitedList(raw?: string): string[] {
        if (!raw) return [];
        if (/^none$/i.test(raw.trim())) return [];
        return raw
            .split(/[|,;]/)
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 6);
    }

    private hasContinueDirective(messages: any[]): boolean {
        const lastUser = [...messages].reverse().find(m => m?.role === 'user' && typeof m?.content === 'string');
        if (!lastUser) return false;
        return /\bcontinue\b/i.test(lastUser.content);
    }
}