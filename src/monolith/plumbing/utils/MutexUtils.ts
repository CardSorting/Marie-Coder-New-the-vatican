/**
 * REFINED ROBUSTNESS: MarieMutex
 * A robust promise-based mutex with built-in timeout and queueing.
 */
export class MarieMutex {
  private queue: Promise<void> = Promise.resolve();
  private isLocked: boolean = false;

  constructor(private readonly name: string = "GenericMutex") {}

  /**
   * Acquires the lock. Returns an unlock function.
   * @param timeoutMs Maximum time to wait for the lock before throwing.
   */
  public async acquire(timeoutMs: number = 30000): Promise<() => void> {
    const previousTask = this.queue;
    let resolver: () => void;
    
    const nextTask = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    this.queue = nextTask;

    const acquirePromise = (async () => {
      await previousTask;
      this.isLocked = true;
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
        // but we throw to notify the caller we didn't get the lock.
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
      this.isLocked = false;
      resolver!();
    };
  }

  public get locked(): boolean {
    return this.isLocked;
  }
}
