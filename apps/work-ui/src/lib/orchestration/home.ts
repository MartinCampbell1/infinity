import { getOrchestrationBriefs } from '$lib/apis/orchestration/briefs';
import { loadInitiativeContinuity, type InitiativeContinuitySummary } from '$lib/orchestration/continuity';
import { getOrchestrationDeliveries } from '$lib/apis/orchestration/delivery';
import { getOrchestrationInitiatives } from '$lib/apis/orchestration/initiatives';
import type {
	DeliveryRecord,
	InitiativeRecord,
	ProjectBriefRecord
} from '$lib/apis/orchestration/types';

type ProductHomeContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

export type ProductHomeState = {
	currentInitiative: InitiativeRecord | null;
	currentBrief: ProjectBriefRecord | null;
	latestDelivery: DeliveryRecord | null;
	continuity: InitiativeContinuitySummary | null;
};

const ACTIVE_INITIATIVE_STATUSES = new Set([
	'clarifying',
	'brief_ready',
	'planning',
	'running',
	'assembly',
	'verifying'
]);

export const selectCurrentInitiative = (initiatives: InitiativeRecord[]) =>
	initiatives.find((initiative) => ACTIVE_INITIATIVE_STATUSES.has(initiative.status)) ??
	initiatives[0] ??
	null;

export const buildProductHomeState = ({
	initiatives,
	briefs,
	deliveries,
	continuityByInitiative
}: {
	initiatives: InitiativeRecord[];
	briefs: ProjectBriefRecord[];
	deliveries: DeliveryRecord[];
	continuityByInitiative: Map<string, InitiativeContinuitySummary>;
}): ProductHomeState => {
	const currentInitiative = selectCurrentInitiative(initiatives);
	const currentBrief = currentInitiative
		? briefs.find((brief) => brief.initiativeId === currentInitiative.id) ?? briefs[0] ?? null
		: briefs[0] ?? null;
	const latestDelivery = currentInitiative
		? deliveries.find((delivery) => delivery.initiativeId === currentInitiative.id) ??
			deliveries[0] ??
			null
		: deliveries[0] ?? null;
	const continuity = currentInitiative
		? continuityByInitiative.get(currentInitiative.id) ?? null
		: null;

	return {
		currentInitiative,
		currentBrief,
		latestDelivery,
		continuity
	};
};

export const loadProductHomeState = async (
	context: ProductHomeContext = {}
): Promise<ProductHomeState> => {
	const [initiativesResponse, briefsResponse, deliveriesResponse] = await Promise.all([
		getOrchestrationInitiatives({
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		}),
		getOrchestrationBriefs({
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		}),
		getOrchestrationDeliveries(undefined, {
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		})
	]);

	const currentInitiative = selectCurrentInitiative(initiativesResponse.initiatives);
	const continuity = currentInitiative
		? await loadInitiativeContinuity(currentInitiative.id, {
				shellOrigin: context.shellOrigin,
				fetchImpl: context.fetchImpl
			}).catch(() => null)
		: null;

	return buildProductHomeState({
		initiatives: initiativesResponse.initiatives,
		briefs: briefsResponse.briefs,
		deliveries: deliveriesResponse.deliveries,
		continuityByInitiative: new Map(
			currentInitiative && continuity ? [[currentInitiative.id, continuity]] : []
		)
	});
};
