import { getOrchestrationAssemblies } from '$lib/apis/orchestration/assembly';
import { getOrchestrationDeliveries } from '$lib/apis/orchestration/delivery';
import { getOrchestrationVerifications } from '$lib/apis/orchestration/verification';
import type {
	AssemblyRecord,
	DeliveryRecord,
	VerificationRunRecord
} from '$lib/apis/orchestration/types';

type ProjectResultContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

export const loadProjectResult = async (
	initiativeId: string,
	context: ProjectResultContext = {}
): Promise<{
	assembly: AssemblyRecord | null;
	verification: VerificationRunRecord | null;
	delivery: DeliveryRecord | null;
}> => {
	const [assemblies, verifications, deliveries] = await Promise.all([
		getOrchestrationAssemblies(
			{ initiativeId },
			{
				shellOrigin: context.shellOrigin,
				fetchImpl: context.fetchImpl
			}
		),
		getOrchestrationVerifications(
			{ initiativeId },
			{
				shellOrigin: context.shellOrigin,
				fetchImpl: context.fetchImpl
			}
		),
		getOrchestrationDeliveries(
			{ initiativeId },
			{
				shellOrigin: context.shellOrigin,
				fetchImpl: context.fetchImpl
			}
		)
	]);

	return {
		assembly: assemblies.assemblies[0] ?? null,
		verification: verifications.verifications[0] ?? null,
		delivery: deliveries.deliveries[0] ?? null
	};
};
