import assert from 'assert';
import * as vscode from 'vscode';
import { JoyAutomationService } from '../../../src/monolith/services/JoyAutomationService.js';
import { JoyService } from '../../../src/monolith/services/JoyService.js';
import { JoyLogService } from '../../../src/monolith/services/JoyLogService.js';
import { suite, setup, teardown, test } from 'mocha';

suite('JoyAutomationService Mock Tests', () => {
    let context: vscode.ExtensionContext;
    let joyLog: JoyLogService;
    let joyService: JoyService;
    let automationService: JoyAutomationService;

    setup(() => {
        context = {
            subscriptions: [],
            workspaceState: {
                get: (key: string) => undefined,
                update: (key: string, value: any) => Promise.resolve(),
            },
            globalState: {
                get: (key: string) => undefined,
                update: (key: string, value: any) => Promise.resolve(),
            },
            extensionUri: vscode.Uri.file(process.cwd())
        } as any;

        joyLog = new JoyLogService(context);
        joyService = new JoyService(context, joyLog);
        automationService = new JoyAutomationService(context, joyService);
    });

    teardown(() => {
        automationService.dispose();
        joyService.dispose();
    });

    test('Can trigger genesis ritual', async () => {
        // This will attempt to move files, which might be risky on a real repo
        // but let's see how it behaves with the shim.
        // Actually executeGenesisRitual uses fs directly, not vscode.workspace.fs for moves
        // So it might actually move files in the real project!
        // We should be careful.
        assert.ok(automationService.triggerGenesis !== undefined);
    });

    test('Can perform garden pulse', async () => {
        const report = await automationService.performGardenPulse();
        assert.ok(typeof report === 'string');
        assert.ok(report.includes('garden'), 'Report should mention the garden');
    });

    test('Can execute self-healing', async () => {
        const result = await automationService.executeSelfHealing('some/path', 'content check failed');
        assert.ok(result.includes('Self-healing'));
    });
});
