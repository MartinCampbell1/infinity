import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import {
  intakeSessionIdFromExecutionSourceContext,
  routeScopeFromExecutionSourceContext,
  type ShellExecutionSourceContext,
} from "@/lib/execution-source";
import {
  buildExecutionIntakeScopeHref,
  buildSettingsScopeHref,
  type ShellRouteScope,
  type ShellSettingsParityTargets,
} from "@/lib/route-scope";

function mergeShellSettingsParityTargets(
  ...targets: Array<Partial<ShellSettingsParityTargets> | null | undefined>
) {
  const merged: ShellSettingsParityTargets = {
    discoverySessionId: "",
    discoveryIdeaId: "",
  };
  for (const target of targets) {
    if (!target) {
      continue;
    }
    if (target.discoverySessionId) {
      merged.discoverySessionId = target.discoverySessionId;
    }
    if (target.discoveryIdeaId) {
      merged.discoveryIdeaId = target.discoveryIdeaId;
    }
  }
  return merged;
}

function shellSettingsParityTargetsFromExecutionSourceContext(
  source?: Pick<ShellExecutionSourceContext, "discoveryIdeaId"> | null
) {
  return {
    discoverySessionId: "",
    discoveryIdeaId: source?.discoveryIdeaId || "",
  };
}

function shellSettingsParityTargetsFromExecutionAttentionRecord(
  record?: ShellExecutionAttentionRecord | null
) {
  return shellSettingsParityTargetsFromExecutionSourceContext(record?.source);
}

export function buildShellEntrySettingsHref(
  scope?: Partial<ShellRouteScope> | null,
  ...targets: Array<Partial<ShellSettingsParityTargets> | null | undefined>
) {
  return buildSettingsScopeHref(scope, mergeShellSettingsParityTargets(...targets));
}

export function buildExecutionSourceSettingsHref(
  source: ShellExecutionSourceContext,
  fallback?: Partial<ShellRouteScope> | null
) {
  return buildShellEntrySettingsHref(
    routeScopeFromExecutionSourceContext(source, fallback),
    shellSettingsParityTargetsFromExecutionSourceContext(source)
  );
}

export function buildExecutionAttentionSettingsHref(
  record?: ShellExecutionAttentionRecord | null,
  fallback?: Partial<ShellRouteScope> | null
) {
  if (!record) {
    return buildShellEntrySettingsHref(fallback);
  }

  return buildShellEntrySettingsHref(
    routeScopeFromExecutionSourceContext(record.source, fallback),
    shellSettingsParityTargetsFromExecutionAttentionRecord(record)
  );
}

export function buildExecutionSourceIntakeHref(
  source: ShellExecutionSourceContext,
  fallback?: Partial<ShellRouteScope> | null
) {
  const intakeSessionId = intakeSessionIdFromExecutionSourceContext(source);
  if (!intakeSessionId) {
    return null;
  }

  return buildExecutionIntakeScopeHref(
    intakeSessionId,
    routeScopeFromExecutionSourceContext(source, fallback)
  );
}
