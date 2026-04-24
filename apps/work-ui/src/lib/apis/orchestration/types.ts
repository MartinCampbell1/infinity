export type InitiativePriority = 'low' | 'normal' | 'high';

export type InitiativeStatus =
	| 'draft'
	| 'clarifying'
	| 'brief_ready'
	| 'planning'
	| 'running'
	| 'assembly'
	| 'verifying'
	| 'ready'
	| 'failed'
	| 'cancelled';

export type ProjectBriefStatus =
	| 'draft'
	| 'clarifying'
	| 'reviewing'
	| 'approved'
	| 'superseded';

export type ProjectBriefClarificationEntry = {
	question: string;
	answer: string;
};

export type InitiativeRecord = {
	id: string;
	title: string;
	userRequest: string;
	status: InitiativeStatus;
	requestedBy: string;
	workspaceSessionId?: string | null;
	priority?: InitiativePriority;
	createdAt: string;
	updatedAt: string;
};

export type ProjectBriefRecord = {
	id: string;
	initiativeId: string;
	summary: string;
	goals: string[];
	nonGoals: string[];
	constraints: string[];
	assumptions: string[];
	acceptanceCriteria: string[];
	repoScope: string[];
	deliverables: string[];
	clarificationLog: ProjectBriefClarificationEntry[];
	status: ProjectBriefStatus;
	authoredBy: string;
	createdAt: string;
	updatedAt: string;
};

export type TaskGraphStatus = 'draft' | 'ready' | 'active' | 'completed' | 'failed';

export type TaskGraphRecord = {
	id: string;
	initiativeId: string;
	briefId: string;
	version: number;
	nodeIds: string[];
	edges: { from: string; to: string; kind: 'depends_on' }[];
	status: TaskGraphStatus;
	createdAt: string;
	updatedAt: string;
};

export type WorkUnitExecutor = 'droid' | 'codex' | 'human';
export type WorkUnitStatus =
	| 'queued'
	| 'ready'
	| 'dispatched'
	| 'running'
	| 'blocked'
	| 'retryable'
	| 'completed'
	| 'failed';

export type WorkUnitRecord = {
	id: string;
	taskGraphId: string;
	title: string;
	description: string;
	executorType: WorkUnitExecutor;
	scopePaths: string[];
	dependencies: string[];
	acceptanceCriteria: string[];
	estimatedComplexity?: 'small' | 'medium' | 'large';
	status: WorkUnitStatus;
	latestAttemptId?: string | null;
	createdAt: string;
	updatedAt: string;
};

export type CreateInitiativeRequest = {
	title: string;
	userRequest: string;
	requestedBy: string;
	workspaceSessionId?: string | null;
	priority?: InitiativePriority;
};

export type UpdateInitiativeRequest = Partial<
	Pick<
		InitiativeRecord,
		'title' | 'userRequest' | 'requestedBy' | 'workspaceSessionId' | 'priority' | 'status'
	>
>;

export type CreateProjectBriefRequest = {
	initiativeId: string;
	summary: string;
	goals: string[];
	nonGoals: string[];
	constraints: string[];
	assumptions: string[];
	acceptanceCriteria: string[];
	repoScope: string[];
	deliverables: string[];
	clarificationLog: ProjectBriefClarificationEntry[];
	status?: ProjectBriefStatus;
	authoredBy: string;
};

export type UpdateProjectBriefRequest = Partial<
	Pick<
		ProjectBriefRecord,
		| 'summary'
		| 'goals'
		| 'nonGoals'
		| 'constraints'
		| 'assumptions'
		| 'acceptanceCriteria'
		| 'repoScope'
		| 'deliverables'
		| 'clarificationLog'
		| 'status'
		| 'authoredBy'
	>
>;

export type CreateTaskGraphRequest = {
	briefId: string;
};

export type CreateWorkUnitRequest = {
	taskGraphId: string;
	title: string;
	description: string;
	executorType: WorkUnitExecutor;
	scopePaths: string[];
	dependencies: string[];
	acceptanceCriteria: string[];
	estimatedComplexity?: 'small' | 'medium' | 'large';
	status?: WorkUnitStatus;
};

export type UpdateWorkUnitRequest = Partial<
	Pick<
		WorkUnitRecord,
		| 'title'
		| 'description'
		| 'executorType'
		| 'scopePaths'
		| 'dependencies'
		| 'acceptanceCriteria'
		| 'estimatedComplexity'
		| 'status'
		| 'latestAttemptId'
	>
>;

export type OrchestrationDirectoryMeta = {
	generatedAt: string;
	source: 'mock' | 'postgres' | 'upstream' | 'derived';
	storageKind: 'in_memory' | 'file_backed' | 'postgres' | 'unknown';
	integrationState: 'unknown' | 'mocked' | 'wired' | 'degraded';
	canonicalTruth: 'sessionId';
	notes: string[];
};

export type InitiativesDirectoryResponse = OrchestrationDirectoryMeta & {
	initiatives: InitiativeRecord[];
};

export type InitiativeDetailResponse = OrchestrationDirectoryMeta & {
	initiative: InitiativeRecord;
	briefs: ProjectBriefRecord[];
};

export type InitiativeMutationResponse = InitiativeDetailResponse;

export type ProjectBriefsDirectoryResponse = OrchestrationDirectoryMeta & {
	briefs: ProjectBriefRecord[];
};

export type ProjectBriefDetailResponse = OrchestrationDirectoryMeta & {
	brief: ProjectBriefRecord;
	initiative: InitiativeRecord | null;
};

export type ProjectBriefMutationResponse = ProjectBriefDetailResponse & {
	taskGraph?: TaskGraphRecord | null;
};

export type TaskGraphsDirectoryResponse = OrchestrationDirectoryMeta & {
	taskGraphs: TaskGraphRecord[];
};

export type TaskGraphDetailResponse = OrchestrationDirectoryMeta & {
	taskGraph: TaskGraphRecord;
	initiative: InitiativeRecord | null;
	brief: ProjectBriefRecord | null;
	workUnits: WorkUnitRecord[];
	runnableWorkUnitIds: string[];
};

export type TaskGraphMutationResponse = TaskGraphDetailResponse;

export type WorkUnitsDirectoryResponse = OrchestrationDirectoryMeta & {
	workUnits: WorkUnitRecord[];
	runnableWorkUnitIds: string[];
};

export type WorkUnitDetailResponse = OrchestrationDirectoryMeta & {
	workUnit: WorkUnitRecord;
	taskGraph: TaskGraphRecord | null;
	runnableWorkUnitIds: string[];
};

export type WorkUnitMutationResponse = WorkUnitDetailResponse;

export type ExecutionBatchStatus =
	| 'queued'
	| 'dispatching'
	| 'running'
	| 'blocked'
	| 'completed'
	| 'failed';

export type AttemptStatus = 'started' | 'succeeded' | 'failed' | 'abandoned';

export type AttemptRecord = {
	id: string;
	workUnitId: string;
	batchId?: string | null;
	executorType: WorkUnitExecutor;
	status: AttemptStatus;
	startedAt: string;
	finishedAt?: string | null;
	summary?: string | null;
	artifactUris: string[];
	errorCode?: string | null;
	errorSummary?: string | null;
};

export type ExecutionBatchRecord = {
	id: string;
	initiativeId: string;
	taskGraphId: string;
	workUnitIds: string[];
	concurrencyLimit: number;
	status: ExecutionBatchStatus;
	startedAt?: string | null;
	finishedAt?: string | null;
};

export type SupervisorActionKind =
	| 'batch.queued'
	| 'batch.dispatched'
	| 'attempt.completed'
	| 'attempt.failed'
	| 'work_unit.reassigned';

export type SupervisorActionRecord = {
	id: string;
	batchId: string;
	initiativeId: string;
	taskGraphId: string;
	workUnitId?: string | null;
	attemptId?: string | null;
	actionKind: SupervisorActionKind;
	actorType: 'operator' | 'system';
	actorId?: string | null;
	occurredAt: string;
	summary: string;
	fromStatus?: string | null;
	toStatus?: string | null;
	payload: Record<string, unknown>;
};

export type ExecutionBatchesDirectoryResponse = OrchestrationDirectoryMeta & {
	batches: ExecutionBatchRecord[];
};

export type ExecutionBatchDetailResponse = OrchestrationDirectoryMeta & {
	batch: ExecutionBatchRecord;
	taskGraph: TaskGraphRecord | null;
	workUnits: WorkUnitRecord[];
	attempts: AttemptRecord[];
	supervisorActions: SupervisorActionRecord[];
};

export type CreateExecutionBatchRequest = {
	taskGraphId: string;
	workUnitIds?: string[];
	concurrencyLimit?: number;
};

export type ExecutionBatchMutationResponse = OrchestrationDirectoryMeta & {
	batch: ExecutionBatchRecord;
	taskGraph: TaskGraphRecord | null;
	workUnits: WorkUnitRecord[];
	attempts: AttemptRecord[];
	supervisorActions: SupervisorActionRecord[];
};

export type SupervisorActionRequest =
	| {
			actionKind: 'complete_attempt';
			batchId: string;
			attemptId: string;
			workUnitId: string;
	  }
	| {
			actionKind: 'fail_attempt';
			batchId: string;
			attemptId: string;
			workUnitId: string;
			errorSummary?: string | null;
			errorCode?: string | null;
	  }
	| {
			actionKind: 'reassign_work_unit';
			batchId: string;
			workUnitId: string;
			executorType: WorkUnitExecutor;
	  };

export type SupervisorActionMutationResponse = OrchestrationDirectoryMeta & {
	batch: ExecutionBatchRecord;
	taskGraph: TaskGraphRecord | null;
	workUnit: WorkUnitRecord;
	attempts: AttemptRecord[];
	supervisorActions: SupervisorActionRecord[];
};

export type AssemblyRecord = {
	id: string;
	initiativeId: string;
	taskGraphId: string;
	inputWorkUnitIds: string[];
	artifactUris: string[];
	outputLocation?: string | null;
	manifestPath?: string | null;
	summary: string;
	status: 'pending' | 'assembling' | 'assembled' | 'failed';
	createdAt: string;
	updatedAt: string;
};

export type VerificationCheck = {
	name: string;
	status: 'pending' | 'passed' | 'failed';
	details?: string | null;
	command?: string | null;
	exitCode?: number | null;
	stdoutSnippet?: string | null;
	stderrSnippet?: string | null;
	artifactPath?: string | null;
};

export type VerificationRunRecord = {
	id: string;
	initiativeId: string;
	assemblyId: string;
	checks: VerificationCheck[];
	overallStatus: 'pending' | 'running' | 'passed' | 'failed';
	startedAt?: string | null;
	finishedAt?: string | null;
};

export type AssembliesDirectoryResponse = OrchestrationDirectoryMeta & {
	assemblies: AssemblyRecord[];
};

export type AssemblyMutationResponse = OrchestrationDirectoryMeta & {
	assembly: AssemblyRecord;
	taskGraph: TaskGraphRecord | null;
	workUnits: WorkUnitRecord[];
};

export type VerificationRunsDirectoryResponse = OrchestrationDirectoryMeta & {
	verifications: VerificationRunRecord[];
};

export type VerificationMutationResponse = OrchestrationDirectoryMeta & {
	verification: VerificationRunRecord;
	assembly: AssemblyRecord | null;
	taskGraph: TaskGraphRecord | null;
	workUnits: WorkUnitRecord[];
	deliveryBlocked: boolean;
};

export type DeliveryRecord = {
	id: string;
	initiativeId: string;
	verificationRunId: string;
	taskGraphId?: string | null;
	resultSummary: string;
	localOutputPath?: string | null;
	manifestPath?: string | null;
	previewUrl?: string | null;
	launchManifestPath?: string | null;
	launchProofKind?: 'runnable_result' | 'attempt_scaffold' | 'synthetic_wrapper' | null;
	launchTargetLabel?: string | null;
	launchProofUrl?: string | null;
	launchProofAt?: string | null;
	externalProofManifestPath?: string | null;
	readinessTier?: 'local_solo' | 'staging' | 'production';
	handoffNotes?: string | null;
	command?: string | null;
	status: 'pending' | 'ready' | 'delivered' | 'rejected';
	deliveredAt?: string | null;
};

export type DeliveriesDirectoryResponse = OrchestrationDirectoryMeta & {
	deliveries: DeliveryRecord[];
};

export type DeliveryMutationResponse = OrchestrationDirectoryMeta & {
	delivery: DeliveryRecord;
	verification: VerificationRunRecord | null;
	assembly: AssemblyRecord | null;
};
