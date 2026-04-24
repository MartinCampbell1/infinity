export type TenantRole =
  | "owner"
  | "admin"
  | "operator"
  | "viewer"
  | "service"
  | "workspace_runtime";

export interface TenantScopedRecordFields {
  tenantId?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface TenantRecord {
  id: string;
  name: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface TenantUserRecord {
  id: string;
  email?: string | null;
  displayName: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface TenantProjectRecord {
  id: string;
  tenantId: string;
  projectId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantWorkspaceRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  projectId?: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
