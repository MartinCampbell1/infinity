import { describe, expect, test, vi } from 'vitest';

import { launchPlannerForBrief, loadTaskGraphForBrief } from './planner-launch';

describe('planner launch helpers', () => {
	test('loads the first task graph for a brief', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					taskGraphs: [
						{
							id: 'task-graph-initiative-001',
							initiativeId: 'initiative-001',
							briefId: 'brief-001',
							version: 1,
							nodeIds: ['work-unit-1'],
							edges: [],
							status: 'ready',
							createdAt: '2026-04-18T00:00:00.000Z',
							updatedAt: '2026-04-18T00:00:00.000Z'
						}
					]
				})
			});

		await expect(
			loadTaskGraphForBrief('brief-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toEqual(
			expect.objectContaining({
				id: 'task-graph-initiative-001',
				briefId: 'brief-001'
			})
		);
	});

	test('launches the planner for an approved brief', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				taskGraph: {
					id: 'task-graph-initiative-001',
					initiativeId: 'initiative-001',
					briefId: 'brief-001',
					version: 1,
					nodeIds: ['work-unit-1'],
					edges: [],
					status: 'ready',
					createdAt: '2026-04-18T00:00:00.000Z',
					updatedAt: '2026-04-18T00:00:00.000Z'
				},
				initiative: null,
				brief: null,
				workUnits: [],
				runnableWorkUnitIds: ['work-unit-1']
			})
		});

		await expect(
			launchPlannerForBrief('brief-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toEqual(
			expect.objectContaining({
				id: 'task-graph-initiative-001',
				briefId: 'brief-001'
			})
		);
	});
});
