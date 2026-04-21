import { describe, expect, test, vi } from 'vitest';

import { loadInitiativeContinuity } from './continuity';

describe('continuity helpers', () => {
	test('loads the shell-owned continuity trace for an initiative', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				initiative: { id: 'initiative-001' },
				briefs: [{ id: 'brief-001' }],
				taskGraphs: [{ id: 'task-graph-001' }],
				batches: [{ id: 'batch-001' }],
				assembly: { id: 'assembly-001' },
				verification: { id: 'verification-001', overallStatus: 'passed' },
				delivery: { id: 'delivery-001', status: 'ready' },
				relatedApprovals: [{ id: 'approval-001' }],
				relatedRecoveries: [{ id: 'recovery-001' }],
				memoryAdapter: {
					baseUrl: 'http://127.0.0.1:8766',
					healthPath: '/health'
				},
				links: {
					continuityHref: '/execution/continuity/initiative-001',
					approvalsHref: '/execution/approvals?session_id=session-001',
					recoveriesHref: '/execution/recoveries?session_id=session-001'
				}
			})
		});

		await expect(
			loadInitiativeContinuity('initiative-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toEqual(
			expect.objectContaining({
				initiative: expect.objectContaining({ id: 'initiative-001' }),
				delivery: expect.objectContaining({ id: 'delivery-001' }),
				relatedApprovals: [expect.objectContaining({ id: 'approval-001' })]
			})
		);
	});
});
