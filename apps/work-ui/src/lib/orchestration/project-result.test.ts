import { describe, expect, test, vi } from 'vitest';

import { loadProjectResult } from './project-result';

describe('project result helpers', () => {
	test('loads assembly and verification state for an initiative', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
					json: async () => ({
						assemblies: [
							{
								id: 'assembly-001',
								initiativeId: 'initiative-001',
								taskGraphId: 'task-graph-001',
								status: 'assembled',
								artifactUris: [
									'/Users/martin/infinity/.local-state/orchestration/assemblies/initiative-001/task-graph-001/work-units/foundation.json'
								]
							}
						]
					})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					verifications: [
						{
							id: 'verification-001',
							initiativeId: 'initiative-001',
							overallStatus: 'passed',
							checks: [
								{
									name: 'assembly_present',
									status: 'passed'
								}
							]
						}
					]
				})
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
						deliveries: [
							{
								id: 'delivery-001',
								initiativeId: 'initiative-001',
								taskGraphId: 'task-graph-001',
								status: 'ready',
								localOutputPath:
									'/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-001/delivery-001',
								command:
									'open \'/Users/martin/infinity/.local-state/orchestration/deliveries/initiative-001/delivery-001\''
							}
						]
					})
			});

		await expect(
			loadProjectResult('initiative-001', {
				shellOrigin: 'https://ops.example.com',
				fetchImpl: fetchImpl as unknown as typeof fetch
			})
		).resolves.toEqual({
			assembly: expect.objectContaining({
				id: 'assembly-001',
				status: 'assembled'
			}),
			verification: expect.objectContaining({
				id: 'verification-001',
				overallStatus: 'passed'
			}),
			delivery: expect.objectContaining({
				id: 'delivery-001',
				status: 'ready'
			})
		});
	});
});
