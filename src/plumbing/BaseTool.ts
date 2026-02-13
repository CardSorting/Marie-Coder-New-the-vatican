export abstract class BaseTool {
    // Plumbing is mechanical. Low-level work. 🔧
    protected format(input: string): string {
        return input.trim();
    }
}
