import { describe, expect, test } from 'vitest';

import {
	canCreateAssembly,
	canCreateDelivery,
	canRunVerification,
	getAssemblyBlockReason,
	getDeliveryBlockReason,
	getVerificationBlockReason
} from './execution-gates';

describe('execution gate helpers', () => {
	test('blocks assembly until the task graph is completed', () => {
		expect(canCreateAssembly({ status: 'completed' } as never)).toBe(true);
		expect(canCreateAssembly({ status: 'active' } as never)).toBe(false);
		expect(getAssemblyBlockReason(null, null)).toMatch(/shell launches the planner/i);
		expect(
			getAssemblyBlockReason(
				{ status: 'active' } as never,
				{
					batch: { status: 'blocked' }
				} as never
			)
		).toMatch(/recovery override/i);
	});

	test('blocks verification until an assembled assembly exists', () => {
		expect(canRunVerification({ status: 'assembled' } as never)).toBe(true);
		expect(canRunVerification(null)).toBe(false);
		expect(getVerificationBlockReason(null)).toMatch(/recovery override/i);
		expect(getVerificationBlockReason({ status: 'failed' } as never)).toMatch(
			/fresh assembled package/i
		);
	});

	test('blocks delivery until verification passes', () => {
		expect(canCreateDelivery({ overallStatus: 'passed' } as never)).toBe(true);
		expect(canCreateDelivery({ overallStatus: 'failed' } as never)).toBe(false);
		expect(getDeliveryBlockReason(null)).toMatch(/recovery override/i);
		expect(getDeliveryBlockReason({ overallStatus: 'failed' } as never)).toMatch(
			/fresh verification passes automatically/i
		);
	});
});
