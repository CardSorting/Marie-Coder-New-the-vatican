import * as assert from 'assert';
import { MarieProgressTracker } from '../../src/monolith/infrastructure/ai/core/MarieProgressTracker.js';
import { RunTelemetry, MarieStreamEvent } from '../../src/monolith/domain/marie/MarieTypes.js';

function createMockRun(): RunTelemetry {
    return {
        runId: 'test_run',
        startedAt: Date.now(),
        steps: 0,
        tools: 0,
        objectives: [
            { id: 'obj1', label: 'Test Objective', status: 'in_progress' }
        ],
        achieved: [],
        lifecycleStage: 'sprout'
    };
}

async function testReasoningBudget() {
    console.log('🧪 Testing MarieProgressTracker Reasoning Budget...');
    const events: MarieStreamEvent[] = [];
    const tracker = new MarieProgressTracker({
        onEvent: (event) => events.push(event)
    }, createMockRun());

    // 1. Test Event Count Limit (MAX = 10)
    for (let i = 0; i < 15; i++) {
        tracker.emitEvent({
            type: 'reasoning',
            runId: 'test_run',
            text: `Reasoning ${i}`,
            elapsedMs: 0
        });
    }

    const reasoningEvents = events.filter(e => e.type === 'reasoning');
    assert.strictEqual(reasoningEvents.length, 10, 'Should cap at 10 reasoning events');

    // 2. Test Char Limit (MAX = 5000)
    tracker.resetReasoningBudget();
    events.length = 0;

    const longText = 'A'.repeat(6000);
    tracker.emitEvent({
        type: 'reasoning',
        runId: 'test_run',
        text: longText,
        elapsedMs: 0
    });

    const emittedText = (events[0] as any).text;
    assert.ok(emittedText.length <= 5020, `Should truncate text (actual length: ${emittedText.length})`);
    assert.ok(emittedText.toLowerCase().includes('truncated'), 'Should contain truncation message');

    console.log('✅ Reasoning Budget Passed!');
}

async function testThrottling() {
    console.log('🧪 Testing MarieProgressTracker Throttling...');
    const events: MarieStreamEvent[] = [];
    const tracker = new MarieProgressTracker({
        onEvent: (event) => events.push(event)
    }, createMockRun());

    // Send 35 events rapidly
    for (let i = 0; i < 35; i++) {
        tracker.emitEvent({
            type: 'content_delta',
            runId: 'test_run',
            text: '.',
            elapsedMs: 0
        });
    }

    // First 30 should pass, subsequent deltas should be dropped
    assert.strictEqual(events.length, 30, 'Should drop events exceeding 30/sec threshold');
    console.log('✅ Throttling Passed!');
}

async function testContextPressurePruning() {
    console.log('🧪 Testing MarieProgressTracker Context Pruning...');
    const events: MarieStreamEvent[] = [];
    const run = createMockRun();
    (run as any)['events'] = Array(1200).fill({ type: 'reasoning', text: 'junk' });
    (run as any)['logs'] = Array(1200).fill({ type: 'log', text: 'junk' });

    const tracker = new MarieProgressTracker({
        onEvent: (event) => events.push(event)
    }, run);

    // This should trigger pruning
    tracker.emitProgressUpdate();

    assert.ok((run as any)['events'].length < 500, 'Events should be pruned');
    assert.ok((run as any)['logs'].length < 500, 'Logs should be pruned');

    const pruningMsg = events.find(e => e.type === 'reasoning' && (e as any).text.includes('CONTEXT PRESSURE'));
    assert.ok(pruningMsg, 'Should emit reasoning event about context pressure');
    console.log('✅ Context Pruning Passed!');
}

async function testUIDeltaCompression() {
    console.log('🧪 Testing MarieProgressTracker UI Delta Compression...');
    const events: MarieStreamEvent[] = [];
    const run = createMockRun();
    const tracker = new MarieProgressTracker({
        onEvent: (event) => events.push(event)
    }, run);

    // First update should have objectives
    tracker.flush();
    assert.ok((events[0] as any).objectives, 'First update should contain objectives');

    // Second update with no changes should NOT have objectives
    tracker.flush();
    assert.strictEqual((events[1] as any).objectives, undefined, 'Identical update should omit objectives');

    // Third update with changes SHOULD have objectives
    run.objectives[0].status = 'completed';
    tracker.flush();
    assert.ok((events[2] as any).objectives, 'Changed update should contain objectives');

    console.log('✅ UI Delta Compression Passed!');
}

async function runAll() {
    try {
        await testReasoningBudget();
        await testThrottling();
        await testContextPressurePruning();
        await testUIDeltaCompression();
        console.log('\n🌟 ALL PROGRESS TRACKER TESTS PASSED!');
    } catch (e) {
        console.error('\n❌ PROGRESS TRACKER TESTS FAILED:');
        console.error(e);
        process.exit(1);
    }
}

runAll();
