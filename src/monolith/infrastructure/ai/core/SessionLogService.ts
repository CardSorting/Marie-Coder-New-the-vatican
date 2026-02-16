import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { MarieStreamEvent } from "../../../domain/marie/MarieTypes.js";

export class SessionLogService {
    private static instance: SessionLogService;
    private readonly logDir: string;
    private currentLogPath: string | undefined;
    private bytesWritten: number = 0;
    private eventCount: number = 0;
    private onProgress: ((bytes: number, eventCount: number) => void) | undefined;
    
    private appendQueue: MarieStreamEvent[] = [];
    private isWriting: boolean = false;

    private constructor() {
        this.logDir = path.join(os.homedir(), ".marie", "logs", "sessions");
        this.ensureDir();
    }

    public static getInstance(): SessionLogService {
        if (!SessionLogService.instance) {
            SessionLogService.instance = new SessionLogService();
        }
        return SessionLogService.instance;
    }

    private ensureDir(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    public setProgressCallback(callback: (bytes: number, eventCount: number) => void): void {
        this.onProgress = callback;
    }

    public initializeSession(sessionId: string): void {
        this.currentLogPath = path.join(this.logDir, `${sessionId}.jsonl`);
        this.bytesWritten = 0;
        this.eventCount = 0;
        // Ensure file exists or clear it if it's a new session start
        fs.writeFileSync(this.currentLogPath, "");
    }

    public async appendEvent(event: MarieStreamEvent): Promise<void> {
        if (!this.currentLogPath) return;
        
        // Prevent infinite recursion if the persistence update itself is being logged
        if (event.type === "session_persistence_update") return;

        this.appendQueue.push(event);
        void this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.isWriting || this.appendQueue.length === 0 || !this.currentLogPath) return;

        this.isWriting = true;
        try {
            while (this.appendQueue.length > 0) {
                const batch = this.appendQueue.splice(0, this.appendQueue.length);
                const content = batch.map(e => JSON.stringify(e)).join("\n") + "\n";
                const buffer = Buffer.from(content, "utf-8");
                
                await fs.promises.appendFile(this.currentLogPath, buffer);

                this.bytesWritten += buffer.length;
                this.eventCount += batch.length;
                this.onProgress?.(this.bytesWritten, this.eventCount);
            }
        } catch (e) {
            console.error(`[SessionLogService] Failed to append events: ${e}`);
        } finally {
            this.isWriting = false;
            // Check if more events arrived during the write
            if (this.appendQueue.length > 0) {
                void this.processQueue();
            }
        }
    }

    public getBytesWritten(): number {
        return this.bytesWritten;
    }

    public getEventCount(): number {
        return this.eventCount;
    }
}
