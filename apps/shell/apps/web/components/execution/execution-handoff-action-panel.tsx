"use client";

import type {
  AutopilotLaunchPreset,
  ExecutionBriefHandoff,
} from "@founderos/api-clients";
import {
  createAutopilotProjectFromExecutionBrief,
  fetchAutopilotLaunchPresets,
} from "@founderos/api-clients";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildExecutionProjectScopeHref,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  ShellActionStateLabel,
  ShellInputField,
  ShellPillButton,
  ShellSectionCard,
  ShellSelectField,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";

function resolveLaunchPresetId(
  launchPresets: AutopilotLaunchPreset[],
  preferredPresetId: string
) {
  return launchPresets.some((preset) => preset.id === preferredPresetId)
    ? preferredPresetId
    : launchPresets[0]?.id ?? preferredPresetId;
}

export function ExecutionHandoffActionPanel({
  handoff,
  routeScope,
  title,
}: {
  handoff: ExecutionBriefHandoff;
  routeScope: ShellRouteScope;
  title: string;
}) {
  const router = useRouter();
  const [launchPresets, setLaunchPresets] = useState<AutopilotLaunchPreset[]>([]);
  const [launchPresetsError, setLaunchPresetsError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(handoff.default_project_name ?? title);
  const [projectPath, setProjectPath] = useState("");
  const [selectedLaunchPresetId, setSelectedLaunchPresetId] = useState(
    handoff.recommended_launch_preset_id ?? "team"
  );
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAutopilotLaunchPresets()
      .then((presets) => {
        if (!active) {
          return;
        }
        setLaunchPresets(presets);
        setSelectedLaunchPresetId((current) =>
          resolveLaunchPresetId(
            presets,
            current || handoff.recommended_launch_preset_id || "team"
          )
        );
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setLaunchPresetsError(
          error instanceof Error ? error.message : "Launch presets request failed."
        );
      });

    return () => {
      active = false;
    };
  }, [handoff.recommended_launch_preset_id]);

  const selectedLaunchPreset = useMemo(
    () =>
      launchPresets.find((preset) => preset.id === selectedLaunchPresetId) ?? null,
    [launchPresets, selectedLaunchPresetId]
  );

  async function createProject() {
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const createdProject = await createAutopilotProjectFromExecutionBrief({
        brief: handoff.brief,
        projectName: projectName || undefined,
        projectPath: projectPath || undefined,
        launch: handoff.launch_intent === "launch",
        launchProfile: selectedLaunchPreset?.launch_profile ?? null,
      });

      const nextScope = routeScopeFromProjectRef(
        createdProject.project_id,
        createdProject.intake_session_id ?? "",
        routeScope
      );

      setStatusMessage(createdProject.message || "Project created from handoff.");
      router.push(buildExecutionProjectScopeHref(createdProject.project_id, nextScope));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Project creation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShellSectionCard
      title="Create project"
      description="Turn this execution brief handoff into a real project and optionally launch it immediately."
      contentClassName="space-y-3"
    >
      {launchPresetsError ? (
        <ShellStatusBanner tone="danger">{launchPresetsError}</ShellStatusBanner>
      ) : null}
      {errorMessage ? (
        <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
      ) : null}
      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      <label className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Project name
        </div>
        <ShellInputField
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Project name"
        />
      </label>

      <label className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Project path
        </div>
        <ShellInputField
          value={projectPath}
          onChange={(event) => setProjectPath(event.target.value)}
          placeholder="Optional project path"
        />
      </label>

      <label className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Launch preset
        </div>
        <ShellSelectField
          value={selectedLaunchPresetId}
          onChange={(event) => setSelectedLaunchPresetId(event.target.value)}
        >
          <option value={selectedLaunchPresetId}>
            {selectedLaunchPreset?.label ??
              handoff.recommended_launch_preset_id ??
              "team"}
          </option>
          {launchPresets
            .filter((preset) => preset.id !== selectedLaunchPresetId)
            .map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
        </ShellSelectField>
      </label>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          Launch intent: {handoff.launch_intent === "launch" ? "create and launch" : "create only"}
        </span>
        {selectedLaunchPreset ? (
          <span>{selectedLaunchPreset.description}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <ShellPillButton
          type="button"
          tone="primary"
          onClick={() => void createProject()}
          disabled={busy}
        >
          <ShellActionStateLabel
            busy={busy}
            idleLabel={
              handoff.launch_intent === "launch"
                ? "Create and launch project"
                : "Create project"
            }
            busyLabel={
              handoff.launch_intent === "launch"
                ? "Create and launch project"
                : "Create project"
            }
          />
        </ShellPillButton>
      </div>
    </ShellSectionCard>
  );
}
