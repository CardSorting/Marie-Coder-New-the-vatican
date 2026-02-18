/**
 * REFINED ROBUSTNESS: MarieMutex
 * A robust promise-based mutex with built-in timeout, queueing, and re-entrancy support.
 */
export class MarieMutex {
  private queue: Promise<void> = Promise.resolve();
  private isLocked: boolean = false;
  private currentContext: string | null = null;
  private lockCount: number = 0;

  constructor(private readonly name: string = "GenericMutex") {}

  /**
   * Acquires the lock. Returns an unlock function.
   * @param timeoutMs Maximum time to wait for the lock before throwing.
   * @param contextId Optional identifier for re-entrancy. If the same contextId 
   *                  tries to acquire the lock again, it will succeed immediately.
   */
  public async acquire(timeoutMs: number = 30000, contextId: string | null = null): Promise<() => void> {
    // RE-ENTRANCY CHECK
    if (contextId && this.currentContext === contextId) {
      this.lockCount++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.lockCount--;
        if (this.lockCount === 0) {
          this.currentContext = null;
        }
      };
    }

    const previousTask = this.queue;
    let resolver: () => void;
    
    const nextTask = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    this.queue = nextTask;

    const acquirePromise = (async () => {
      await previousTask;
      this.isLocked = true;
      this.currentContext = contextId;
      this.lockCount = 1;
    })();

    if (timeoutMs > 0) {
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Mutex Timeout: Failed to acquire ${this.name} in ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        await Promise.race([acquirePromise, timeoutPromise]);
      } catch (e) {
        // On timeout, we must still resolve the resolver to avoid blocking the queue permanently
        resolver!(); 
        throw e;
      } finally {
        clearTimeout(timeoutId!);
      }
    } else {
      await acquirePromise;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.lockCount--;
      if (this.lockCount === 0) {
        this.isLocked = false;
        this.currentContext = null;
        resolver!();
      }
    };
  }

  public get locked(): boolean {
    return this.isLocked;
  }
}
