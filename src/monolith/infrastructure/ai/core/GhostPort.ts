/**
 * Defines the interface for providing real-time previews of AI edits (Ghost Text).
 */
export interface GhostPort {
  handleDelta(toolCallId: string, name: string, delta: string): void;
}
