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

    test('Engine executes simple tool loop', async () => {
        // 1. AI decides to call a tool (Main Loop)
        provider.queueToolCall('mock_tool', { value: 'test-input' }, 'call_1');
        
        // 2. Ascension Evaluation (Internal)
        // The engine asks the Ascendant agent to evaluate the state.
        // We need to provide a structured response for this.
        provider.queueText(`
Strategy: EXECUTE
Urgency: LOW
Confidence: 1.0
Structural Uncertainty: NO
Continue Directive: YES
Required Actions: None
Blocked By: None
Stop Condition: landed
Reason: Tool executed successfully, proceeding to completion.
        `);

        // 3. Final AI response (Main Loop Continuation)
        provider.queueText('Tool executed successfully.');

        const messages = [{ role: 'user', content: 'Please run the mock tool.' }];
        
        const result = await engine.chatLoop(
            messages,
            tracker,
            async () => {} // Mock saveHistory
        );

        // Debug: what did we actually get?
        if (result !== 'Tool executed successfully.') {
            console.log('Actual result:', result);
            // console.log('Provider history:', JSON.stringify(provider.getRecordedMessages(), null, 2));
        }

        // Verify the result
        assert.strictEqual(result, 'Tool executed successfully.');
    });
});
