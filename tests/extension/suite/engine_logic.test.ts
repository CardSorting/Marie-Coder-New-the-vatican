import assert from 'assert';
import { MarieEngine } from '../../../src/monolith/infrastructure/ai/core/MarieEngine.js';
import { ToolRegistry } from '../../../src/monolith/infrastructure/tools/ToolRegistry.js';
import { MarieProgressTracker } from '../../../src/monolith/infrastructure/ai/core/MarieProgressTracker.js';
import { MockAIProvider } from '../../mocks/MockAIProvider.js';
import { suite, setup, test } from 'mocha';

suite('MarieEngine Logic Tests', () => {
    let provider: MockAIProvider;
    let toolRegistry: ToolRegistry;
    let engine: MarieEngine;
    let tracker: MarieProgressTracker;

    setup(() => {
        provider = new MockAIProvider();
        toolRegistry = new ToolRegistry();
        
        // Register a simple mock tool
        toolRegistry.register({
            name: 'mock_tool',
            description: 'A mock tool',
            input_schema: {
                type: 'object',
                properties: {
                    value: { type: 'string' }
                },
                required: ['value']
            },
            execute: async (input: any) => {
                return `Executed mock_tool with value: ${input.value}`;
            }
        });

        // Mock approval requester (always approve)
        const approvalRequester = async () => true;

        engine = new MarieEngine(provider, toolRegistry, approvalRequester);
        
        tracker = new MarieProgressTracker({} as any, {
            runId: 'test-run',
            startedAt: Date.now(),
            steps: 0,
            tools: 0,
            objectives: [],
            activeObjectiveId: 'test',
            achieved: []
        });
    });

    test('Engine executes multi-turn tool loop and accumulates content', async () => {
        // TURN 1: AI says something and calls a tool
        provider.queueResponse({
            content: [
                { type: 'text', text: 'I am starting the work. ' },
                { type: 'tool_use', id: 'call_1', name: 'mock_tool', input: { value: 'first' } }
            ]
        });
        
        // Ascension Evaluation for Turn 1
        provider.queueText('Strategy: EXECUTE\nStop Condition: landed\nReason: First step done.');

        // TURN 2: AI says more and finishes
        provider.queueText('All finished now.');

        const messages = [{ role: 'user', content: 'Do work.' }];
        
        const result = await engine.chatLoop(
            messages,
            tracker,
            async () => {}
        );

        // Verification: result should ideally contain ALL text generated across turns
        // if we want full streaming experience. 
        // Currently MarieEngine returns finalContent of the CURRENT turn.
        // If we fixed it, it should be accumulated.
        
        assert.ok(result.includes('I am starting the work.'), 'Should contain Turn 1 text');
        assert.ok(result.includes('All finished now.'), 'Should contain Turn 2 text');
    });
});
