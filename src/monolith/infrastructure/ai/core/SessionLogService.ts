import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class SessionLogService {
    private static instance: SessionLogService;
    private readonly logDir: string;
    private currentLogPath: string | undefined;
    private bytesWritten: number = 0;
    private onProgress: ((bytes: number) => void) | undefined;

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

    public setProgressCallback(callback: (bytes: number) => void): void {
        this.onProgress = callback;
    }

    public initializeSession(sessionId: string): void {
        this.currentLogPath = path.join(this.logDir, `${sessionId}.log`);
        this.bytesWritten = 0;
        // Ensure file exists or clear it if it's a new session start
        fs.writeFileSync(this.currentLogPath, "");
    }

    public async append(text: string): Promise<void> {
        if (!this.currentLogPath) return;
        try {
            const buffer = Buffer.from(text, "utf-8");
            await fs.promises.appendFile(this.currentLogPath, buffer);
            this.bytesWritten += buffer.length;
            this.onProgress?.(this.bytesWritten);
        } catch (e) {
            console.error(`[SessionLogService] Failed to append to log: ${e}`);
        }
    }

    public getBytesWritten(): number {
        return this.bytesWritten;
    }
}
