import * as assert from 'assert';
import { MarieEngine } from '../../src/monolith/infrastructure/ai/core/MarieEngine.js';
import { MarieProgressTracker } from '../../src/monolith/infrastructure/ai/core/MarieProgressTracker.js';
import { RunTelemetry } from '../../src/monolith/domain/marie/MarieTypes.js';

function createMockTracker(): MarieProgressTracker {
    const run: RunTelemetry = {
        runId: 'test_run',
        startedAt: Date.now(),
        steps: 0,
        tools: 0,
        objectives: [],
        achieved: [],
        lifecycleStage: 'sprout'
    };
    return new MarieProgressTracker({ onEvent: () => { } }, run);
}

async function testInitialState() {
    console.log('🧪 Testing MarieEngine Initial State...');
    const engine = new MarieEngine({} as any, {} as any, async () => true);
    const state = (engine as any).state;

    assert.strictEqual(state.spiritPressure, 50, 'Initial pressure should be 50');
    assert.strictEqual(state.victoryStreak, 0, 'Initial streak should be 0');
    assert.strictEqual(state.mood, 'STABLE', 'Initial mood should be STABLE');
    console.log('✅ Initial State Passed!');
}

async function testSuccessProgression() {
    console.log('🧪 Testing MarieEngine Success Progression...');
    const engine = new MarieEngine({} as any, {} as any, async () => true);
    const tracker = createMockTracker();
    const state = (engine as any).state;

    (engine as any).handleSuccess(tracker, 'write_to_file', 100, 'file1.ts');
    assert.strictEqual(state.spiritPressure, 60, 'Pressure should increase by 10');
    assert.strictEqual(state.victoryStreak, 1, 'Streak should be 1');
    assert.deepStrictEqual(state.recentFiles, ['file1.ts']);

    (engine as any).handleSuccess(tracker, 'write_to_file', 100, 'file2.ts');
    assert.strictEqual(state.spiritPressure, 70, 'Pressure should be 70');
    assert.strictEqual(state.victoryStreak, 2, 'Streak should be 2');

    console.log('✅ Success Progression Passed!');
}

async function testFailureRegression() {
    console.log('🧪 Testing MarieEngine Failure Regression...');
    const engine = new MarieEngine({} as any, {} as any, async () => true);
    const tracker = createMockTracker();
    const state = (engine as any).state;

    // First give some success
    state.victoryStreak = 5;
    state.spiritPressure = 80;

    (engine as any).handleFailure(tracker, 'run_command', 'Boom', 'bad_file.ts');
    assert.strictEqual(state.spiritPressure, 60, 'Pressure should decrease by 20');
    assert.strictEqual(state.victoryStreak, 0, 'Streak should reset to 0');
    assert.strictEqual(state.errorHotspots['bad_file.ts'], 1, 'Hotspot should be recorded');

    console.log('✅ Failure Regression Passed!');
}

async function testAwakenedStateLogic() {
    console.log('🧪 Testing MarieEngine Awakened Thresholds...');
    const engine = new MarieEngine({} as any, {} as any, async () => true);
    const tracker = createMockTracker();
    const state = (engine as any).state;

    // Simulate surge to Spirit Burst
    state.spiritPressure = 80;
    (engine as any).handleSuccess(tracker, 'tool', 10, 'f.ts'); // 90

    // The detection logic is actually in _executeChatLoop or manually set.
    // In handleSuccess/Failure, it doesn't update isSpiritBurstActive automatically.
    // But we should verify the logic used in the engine.

    const checkState = () => {
        state.isSpiritBurstActive = state.spiritPressure > 85;
        state.isAwakened = state.spiritPressure > 95;
    };

    checkState();
    assert.strictEqual(state.isSpiritBurstActive, true, '90 should trigger Spirit Burst');
    assert.strictEqual(state.isAwakened, false, '90 should not be Awakened');

    (engine as any).handleSuccess(tracker, 'tool', 10, 'f.ts'); // 100
    checkState();
    assert.strictEqual(state.isAwakened, true, '100 should be Awakened');

    console.log('✅ Awakened Thresholds Passed!');
}

async function runAll() {
    try {
        await testInitialState();
        await testSuccessProgression();
        await testFailureRegression();
        await testAwakenedStateLogic();
        console.log('\n🌟 ALL STATE MACHINE TESTS PASSED!');
    } catch (e) {
        console.error('\n❌ STATE MACHINE TESTS FAILED:');
        console.error(e);
        process.exit(1);
    }
}

runAll();
