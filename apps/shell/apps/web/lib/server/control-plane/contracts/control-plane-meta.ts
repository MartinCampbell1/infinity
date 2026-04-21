export type ControlPlaneIntegrationState =
  | "unknown"
  | "mocked"
  | "wired"
  | "degraded";

export type ControlPlaneStorageKind =
  | "in_memory"
  | "file_backed"
  | "postgres"
  | "unknown";

export interface ControlPlaneDirectoryMeta {
  generatedAt: string;
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  notes: string[];
}
