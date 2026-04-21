import type { ApprovalRequest } from "./approvals";
import type { ControlPlaneDirectoryMeta } from "./control-plane-meta";
import type {
  AssemblyRecord,
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
  ProjectBriefRecord,
  TaskGraphRecord,
  VerificationRunRecord,
} from "./orchestration";
import type { RecoveryIncident } from "./recoveries";

export interface HermesMemoryContinuityAdapter {
  enabled: boolean;
  baseUrl: string | null;
  healthPath: string;
  schemaPath: string;
  readActionPath: string;
  readActions: string[];
  note: string;
}

export interface InitiativeContinuityLinks {
  continuityHref: string;
  approvalsHref: string;
  recoveriesHref: string;
  taskGraphHref?: string | null;
  batchHref?: string | null;
  deliveryHref?: string | null;
}

export interface InitiativeContinuityResponse extends ControlPlaneDirectoryMeta {
  initiative: InitiativeRecord;
  briefs: ProjectBriefRecord[];
  taskGraphs: TaskGraphRecord[];
  batches: ExecutionBatchRecord[];
  assembly: AssemblyRecord | null;
  verification: VerificationRunRecord | null;
  delivery: DeliveryRecord | null;
  relatedApprovals: ApprovalRequest[];
  relatedRecoveries: RecoveryIncident[];
  memoryAdapter: HermesMemoryContinuityAdapter;
  links: InitiativeContinuityLinks;
}
