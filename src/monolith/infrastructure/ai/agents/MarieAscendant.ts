import { AIProvider } from "../providers/AIProvider.js";
import { ConfigService } from "../../config/ConfigService.js";
import {
  AscensionTechnique,
  AscensionDecree,
  AscensionState,
  SpiritUrgency,
  AscensionStopCondition,
} from "../core/MarieAscensionTypes.js";

/**
 * MarieAscendant: FULLY LOCAL — No API calls.
 *
 * Generates AscensionDecree objects deterministically from session state.
 * Spirit Pressure, Karma, Heroic Vows, etc. are purely cosmetic UI flavor.
 * This eliminates the extra LLM call that previously occurred every turn.
 */
export class MarieAscendant {
  private lastConfidence: number = 1.2;
  private consecutiveSuccesses: number = 0;

  // Flavor text pools for visual UI styling
  private static readonly FLAVOR_REASONS: string[] = [
    "Hero signal: Steady course. Conviction holds.",
    "Flow state active. Pattern recognition nominal.",
    "Momentum building. Systems converging on solution.",
    "Adjusting trajectory. Minor course correction applied.",
    "Strategic recalibration complete. Resuming execution.",
    "Debugging instinct engaged. Investigating anomaly.",
    "Victory streak amplifying focus. Efficiency climbing.",
    "Resilience protocol active. Recovering from setback.",
    "Codebase harmony detected. Proceeding with confidence.",
    "Tactical awareness heightened. Approaching target.",
  ];

  private static readonly FLAVOR_VOWS: string[] = [
    "I will ship this feature with zero regressions.",
    "The pattern will be resolved before dusk.",
    "No bug survives the next pass.",
    "Convergence is inevitable. The code will spark joy.",
    "Every line written serves the architecture.",
  ];

  constructor(private provider: AIProvider) { }

  /**
   * LOCAL EVALUATION — No API call.
   * Derives strategy, urgency, and confidence from session state alone.
   */
  public async evaluate(
    messages: any[],
    state: AscensionState,
    options?: {
      profile?: "demo_day" | "balanced" | "recovery";
      aggression?: number;
      maxRequiredActions?: number;
    },
  ): Promise<AscensionDecree> {
    const profile = options?.profile ?? ConfigService.getAscensionProfile();
    const aggression =
      options?.aggression ?? ConfigService.getAscensionIntensity();

    // --- DETERMINISTIC STRATEGY ---
    const strategy = this.deriveStrategy(state);
    const urgency = this.deriveUrgency(state);
    let confidence = this.deriveConfidence(state, strategy, urgency);

    // Profile tuning (local math)
    confidence = this.applyProfileTuning(
      confidence,
      profile,
      aggression,
      state.totalErrorCount > 3,
      state.victoryStreak,
    );

    const isContinueDirective = this.hasContinueDirective(messages);
    if (isContinueDirective && (strategy === "EXECUTE" || strategy === "HYPE")) {
      confidence = Math.min(3.0, confidence + 0.3);
    }

    // Update persistence for next turn
    this.lastConfidence = confidence;
    if (strategy === "EXECUTE" || strategy === "HYPE") {
      this.consecutiveSuccesses++;
    } else {
      this.consecutiveSuccesses = 0;
    }

    // --- FLAVOR TEXT (Visual Only) ---
    const reason = this.pickFlavor(MarieAscendant.FLAVOR_REASONS, state);
    const heroicVow =
      state.victoryStreak >= 5
        ? this.pickFlavor(MarieAscendant.FLAVOR_VOWS, state)
        : undefined;

    // Hotspots as blockers (informational only)
    const blockedBy = Object.entries(state.errorHotspots)
      .filter(([_, c]) => c >= 3)
      .map(([f]) => f.split("/").pop() || f)
      .slice(0, 4);

    const structuralUncertainty = state.totalErrorCount > 5;
    const stopCondition: AscensionStopCondition = structuralUncertainty
      ? "structural_uncertainty"
      : "landed";

    const rawSummary = `[LOCAL] Strategy=${strategy} Urgency=${urgency} Confidence=${confidence.toFixed(2)} Streak=${state.victoryStreak} Pressure=${state.spiritPressure} Errors=${state.totalErrorCount}`;

    return {
      strategy,
      urgency,
      confidence,
      structuralUncertainty,
      isContinueDirective,
      heroicVow,
      sacrificeTriggered: false,
      reason: reason.substring(0, 220),
      requiredActions: [],
      blockedBy,
      stopCondition,
      profile,
      raw: rawSummary,
    };
  }

  // --- DETERMINISTIC DERIVATIONS ---

  private deriveStrategy(state: AscensionState): AscensionTechnique {
    // High error density → DEBUG
    if (state.totalErrorCount >= 3) return "DEBUG";
    // Strong streak → HYPE
    if (state.victoryStreak >= 8) return "HYPE";
    // Default → EXECUTE
    return "EXECUTE";
  }

  private deriveUrgency(state: AscensionState): SpiritUrgency {
    if (state.spiritPressure < 30) return "HIGH"; // Low pressure = urgent recovery
    if (state.spiritPressure > 80) return "LOW"; // High pressure = smooth sailing
    return "MEDIUM";
  }

  private deriveConfidence(
    state: AscensionState,
    strategy: AscensionTechnique,
    urgency: SpiritUrgency,
  ): number {
    let base = 1.5;

    if (strategy === "HYPE") base = 2.2;
    if (strategy === "DEBUG") base = 1.0;

    if (urgency === "HIGH") base *= 0.8;
    if (urgency === "LOW") base *= 1.1;

    // Streak bonus
    base += Math.min(0.5, state.victoryStreak * 0.05);

    // Pressure influence (cosmetic weight)
    base += (state.spiritPressure - 50) * 0.005;

    // Persistence from last turn
    base = base * 0.85 + this.lastConfidence * 0.15;

    return this.clampConfidence(base);
  }

  private applyProfileTuning(
    baseConfidence: number,
    profile: "demo_day" | "balanced" | "recovery",
    aggression: number,
    structuralUncertainty: boolean,
    victoryStreak?: number,
  ): number {
    let profileMultiplier = 1.0;
    if (profile === "demo_day") profileMultiplier = 1.2;
    if (profile === "recovery") profileMultiplier = 0.9;

    const streakBonus = Math.min(0.5, (victoryStreak || 0) * 0.05);

    let tuned =
      baseConfidence * profileMultiplier * aggression * (1 + streakBonus);
    if (structuralUncertainty) tuned *= 0.85;

    return this.clampConfidence(tuned);
  }

  private clampConfidence(value: number): number {
    if (!Number.isFinite(value)) return 1.2;
    return Math.min(3.0, Math.max(0.5, value));
  }

  private pickFlavor(pool: string[], state: AscensionState): string {
    // Deterministic but varied: use a hash of the current state
    const seed =
      state.victoryStreak * 7 +
      state.totalErrorCount * 13 +
      state.spiritPressure * 3 +
      state.toolHistory.length * 11;
    return pool[Math.abs(seed) % pool.length];
  }

  private hasContinueDirective(messages: any[]): boolean {
    const lastUser = [...messages]
      .reverse()
      .find((m) => m?.role === "user" && typeof m?.content === "string");
    if (!lastUser) return false;
    return /\bcontinue\b/i.test(lastUser.content);
  }
}
