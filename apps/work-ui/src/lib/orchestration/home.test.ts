import { describe, expect, test } from 'vitest';

import { buildProductHomeState, selectCurrentInitiative } from './home';
import type {
	DeliveryRecord,
	InitiativeRecord,
	ProjectBriefRecord
} from '$lib/apis/orchestration/types';
import type { InitiativeContinuitySummary } from './continuity';

describe('product home helpers', () => {
	test('prefers an active initiative over terminal ones', () => {
		const initiatives = [
			{ id: 'initiative-ready', status: 'ready' },
			{ id: 'initiative-running', status: 'running' }
		] as InitiativeRecord[];

		expect(selectCurrentInitiative(initiatives)?.id).toBe('initiative-running');
	});

	test('builds home state around the active initiative continuity', () => {
		const initiatives = [
			{ id: 'initiative-running', status: 'running' }
		] as InitiativeRecord[];
		const briefs = [
			{ id: 'brief-1', initiativeId: 'initiative-running' }
		] as ProjectBriefRecord[];
		const deliveries = [
			{ id: 'delivery-1', initiativeId: 'initiative-running' }
		] as DeliveryRecord[];
		const continuity = {
			initiative: { id: 'initiative-running' },
			briefs: [{ id: 'brief-1' }],
			taskGraphs: [],
			batches: [],
			assembly: null,
			verification: null,
			delivery: { id: 'delivery-1' },
			relatedApprovals: [{ id: 'approval-1' }],
			relatedRecoveries: [{ id: 'recovery-1' }],
			memoryAdapter: {},
			links: {
				continuityHref: '/execution/continuity/initiative-running',
				approvalsHref: '/execution/approvals',
				recoveriesHref: '/execution/recoveries'
			}
		} as InitiativeContinuitySummary;

		const state = buildProductHomeState({
			initiatives,
			briefs,
			deliveries,
			continuityByInitiative: new Map([['initiative-running', continuity]])
		});

		expect(state.currentInitiative?.id).toBe('initiative-running');
		expect(state.currentBrief?.id).toBe('brief-1');
		expect(state.latestDelivery?.id).toBe('delivery-1');
		expect(state.continuity?.relatedApprovals).toHaveLength(1);
	});
});
