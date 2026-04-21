import type {
	AssemblyRecord,
	ExecutionBatchDetailResponse,
	TaskGraphRecord,
	VerificationRunRecord
} from '$lib/apis/orchestration/types';

export const canCreateAssembly = (taskGraph: TaskGraphRecord | null) =>
	taskGraph?.status === 'completed';

export const getAssemblyBlockReason = (
	taskGraph: TaskGraphRecord | null,
	batchProgress: ExecutionBatchDetailResponse | null
) => {
	if (!taskGraph) {
		return 'Assembly is blocked until the shell launches the planner for this approved brief. Use the recovery override only if the autonomous path stalls.';
	}

	if (taskGraph.status === 'completed') {
		return null;
	}

	if (batchProgress?.batch.status === 'running' || batchProgress?.batch.status === 'dispatching') {
		return 'Assembly is blocked until the current shell batch finishes and all work units are completed.';
	}

	if (batchProgress?.batch.status === 'blocked' || batchProgress?.batch.status === 'failed') {
		return 'Assembly is blocked until the shell operator resolves the current batch and completes the remaining work units, or uses a recovery override.';
	}

	return 'Assembly is blocked until every planned work unit is completed and the local handoff package can be built automatically.';
};

export const canRunVerification = (assembly: AssemblyRecord | null) =>
	assembly?.status === 'assembled';

export const getVerificationBlockReason = (assembly: AssemblyRecord | null) => {
	if (!assembly) {
		return 'Verification is blocked until a local assembly package exists. Use the recovery override only if the shell needs help.';
	}

	if (assembly.status !== 'assembled') {
		return 'Verification is blocked until assembly produces a fresh assembled package.';
	}

	return null;
};

export const canCreateDelivery = (verification: VerificationRunRecord | null) =>
	verification?.overallStatus === 'passed';

export const getDeliveryBlockReason = (verification: VerificationRunRecord | null) => {
	if (!verification) {
		return 'Delivery is blocked until verification produces a passed handoff verdict. Use the recovery override only if the autonomous path stalls.';
	}

	if (verification.overallStatus !== 'passed') {
		return 'Delivery is blocked until a fresh verification passes automatically.';
	}

	return null;
};
