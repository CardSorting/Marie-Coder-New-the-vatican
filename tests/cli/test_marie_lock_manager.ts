import * as assert from 'assert';
import { MarieLockManager } from '../../src/monolith/infrastructure/ai/core/MarieLockManager.js';

async function testBasicMRSW() {
    console.log('🧪 Testing MarieLockManager Basic MRSW...');
    const lockManager = new MarieLockManager();
    const target = 'file_1.ts';

    let read1Done = false;
    let read2Done = false;
    let writeDone = false;

    const read1 = (async () => {
        await lockManager.acquireLock(target, false);
        lockManager.registerExecution(target, false, new Promise(r => setTimeout(() => { read1Done = true; r(null); }, 50)));
    })();

    const read2 = (async () => {
        await lockManager.acquireLock(target, false);
        lockManager.registerExecution(target, false, new Promise(r => setTimeout(() => { read2Done = true; r(null); }, 100)));
    })();

    // We don't await Promise.all([read1, read2]) here yet, because we want the writer to try and acquire the lock
    // while the readers are still active.
    // The readers are started, but their execution promises are not yet resolved.

    const write = (async () => {
        await lockManager.acquireLock(target, true);
        writeDone = true;
        // register execution so we can wait for it if needed
        lockManager.registerExecution(target, true, Promise.resolve());
    })();

    // Give microtasks a chance to run and block the writer
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(writeDone, false, 'Writer should be waiting for readers');

    await Promise.all([read1, read2]); // Now wait for readers to complete
    await write; // Wait for the writer directly
    assert.strictEqual(writeDone, true, 'Writer should have finished after readers');
    console.log('✅ Basic MRSW Passed!');
}

async function testWriterBlocksReaders() {
    console.log('🧪 Testing MarieLockManager Writer Blocks Readers...');
    const lockManager = new MarieLockManager();
    const target = 'file_2.ts';

    let writeStarted = false;
    let readStarted = false;

    // Start a long write
    const writePromise = new Promise(r => setTimeout(r, 100));
    await lockManager.acquireLock(target, true);
    lockManager.registerExecution(target, true, writePromise);
    writeStarted = true;

    // Try to start a read
    const read = (async () => {
        await lockManager.acquireLock(target, false);
        readStarted = true;
    })();

    assert.strictEqual(readStarted, false, 'Reader should be blocked by writer');

    await writePromise;
    await read;
    assert.strictEqual(readStarted, true, 'Reader should proceed after writer');
    console.log('✅ Writer Blocks Readers Passed!');
}

async function testReentrancy() {
    console.log('🧪 Testing MarieLockManager Re-entrancy...');
    const lockManager = new MarieLockManager();
    const target = 'file_3.ts';
    const contextId = 'task_123';

    await lockManager.acquireLock(target, true, undefined, contextId);
    lockManager.registerExecution(target, true, Promise.resolve(), contextId);

    // Re-acquire should not block
    let reacquired = false;
    await lockManager.acquireLock(target, true, undefined, contextId);
    reacquired = true;

    assert.strictEqual(reacquired, true, 'Writer should re-acquire without blocking');
    console.log('✅ Re-entrancy Passed!');
}

async function testLockTimeout() {
    console.log('🧪 Testing MarieLockManager Blocking Behavior...');
    const lockManager = new MarieLockManager();
    const target = 'file_4.ts';

    // Occupy lock with a resolvable promise
    let resolveEternal: any;
    const eternalPromise = new Promise(r => resolveEternal = r);
    await lockManager.acquireLock(target, true);
    lockManager.registerExecution(target, true, eternalPromise);

    let write2Started = false;
    const write2 = (async () => {
        await lockManager.acquireLock(target, true);
        write2Started = true;
        lockManager.registerExecution(target, true, Promise.resolve());
    })();

    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(write2Started, false, 'Second writer should be blocked');

    // Unblock to finish test
    resolveEternal();
    await write2;
    assert.strictEqual(write2Started, true, 'Second writer should proceed after unblock');
    console.log('✅ Blocking Behavior Verified!');
}

async function testCleanup() {
    console.log('🧪 Testing MarieLockManager Cleanup...');
    const lockManager = new MarieLockManager();
    const target = 'file_5.ts';

    const p = Promise.resolve();
    await lockManager.acquireLock(target, true);
    lockManager.registerExecution(target, true, p);

    assert.ok((lockManager as any).toolsInFlight.has(target), 'Target should be in flight');

    await p;
    // releaseLock is called in finally of registerExecution
    await new Promise(r => setTimeout(r, 10));

    assert.ok(!(lockManager as any).toolsInFlight.has(target), 'Target should be cleaned up');
    console.log('✅ Cleanup Passed!');
}

async function runAll() {
    try {
        await testBasicMRSW();
        await testWriterBlocksReaders();
        await testReentrancy();
        await testLockTimeout();
        await testCleanup();
        console.log('\n🌟 ALL LOCK MANAGER TESTS PASSED!');
    } catch (e) {
        console.error('\n❌ LOCK MANAGER TESTS FAILED:');
        console.error(e);
        process.exit(1);
    }
}

runAll();
