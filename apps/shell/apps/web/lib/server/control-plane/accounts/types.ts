import type {
  AccountCapacityState,
  AccountQuotaSnapshot,
} from "../contracts/quota";

export interface ControlPlaneAccountRecord {
  id: string;
  label: string;
  authMode: AccountQuotaSnapshot["authMode"];
  provider: "openai" | "anthropic" | "mixed" | "unknown";
  quota: AccountQuotaSnapshot;
  capacity: AccountCapacityState;
}
