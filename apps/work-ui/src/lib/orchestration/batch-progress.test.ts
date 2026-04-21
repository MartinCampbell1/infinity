import { describe, expect, test, vi } from 'vitest';

import { loadLatestBatchProgress, summarizeBatchProgress } from './batch-progress';

describe('batch progress helpers', () => {
	test('summarizes the latest batch state for the work-ui progress surface', () => {
		expect(
			summarizeBatchProgress({
				batch: {
					id: 'batch-001',
					initiativeId: 'initiative-001',
					taskGraphId: 'task-graph-001',
					status: 'blocked',
					workUnitIds: ['wu-1'],
					concurrencyLimit: 1
				},
				attempts: [
					{
						id: 'attempt-001',
						executorType: 'droid',
						status: 'failed',
						workUnitId: 'wu-1',
						startedAt: '2026-04-18T10:00:00.000Z',
						artifactUris: []
					}
				],
				supervisorActions: [
					{
						id: 'supervisor-001',
						batchId: 'batch-001',
						initiativeId: 'initiative-001',
						taskGraphId: 'task-graph-001',
						actorType: 'operator',
						occurredAt: '2026-04-18T10:01:00.000Z',
						summary: 'Attempt failed',
						actionKind: 'attempt.failed',
						payload: {}
					},
					{
						id: 'supervisor-002',
						batchId: 'batch-001',
						initiativeId: 'initiative-001',
						taskGraphId: 'task-graph-001',
						actorType: 'operator',
						occurredAt: '2026-04-18T10:02:00.000Z',
						summary: 'Work unit reassigned',
						actionKind: 'work_unit.reassigned',
						payload: {}
					}
				]
			})
		).toEqual({
			label: 'blocked',
			attempts: 1,
			failures: 1,
			supervisorActions: 2
		});
	});

	test('loads the latest batch detail for a task graph from shell-owned APIs', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					batches: [
						{
							id: 'batch-001',
							taskGraphId: 'task-graph-001',
							status: 'running',
							workUnitIds: ['wu-1'],
							concurrencyLimit: 1
						}
					]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					batch: {
						id: 'batch-001',
						taskGraphId: 'task-graph-001',
						status: 'running',
						workUnitIds: ['wu-1'],
						concurrencyLimit: 1
					},
					attempts: [],
					supervisorActions: []
				})
			});

		await expect(
			loadLatestBatchProgress('task-graph-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toEqual(
			expect.objectContaining({
				batch: expect.objectContaining({
					id: 'batch-001',
					status: 'running'
				})
			})
		);
	});

	test('returns null when batch progress lookup fails', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce({
			ok: false,
			json: async () => ({
				detail: 'shell unavailable'
			})
		});

		await expect(
			loadLatestBatchProgress('task-graph-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toBeNull();
	});
});
