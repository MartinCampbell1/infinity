import React from "react";

import {
  buildExecutionHandoffsScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import {
  ExecutionDetailActionLink,
  ExecutionDetailEmptyState,
  ExecutionDetailKeyValueGrid,
  ExecutionDetailList,
  ExecutionDetailListItem,
  ExecutionDetailMetric,
  ExecutionDetailMetricGrid,
  ExecutionDetailPage,
  ExecutionDetailSection,
  ExecutionDetailStatusPill,
} from "../../../../../components/execution/detail-primitives";
import { getExecutionBriefHandoff } from "@/lib/execution-brief-handoffs";

function briefTitle(brief: Record<string, unknown>) {
  if (typeof brief.title === "string" && brief.title.trim().length > 0) {
    return brief.title;
  }
  return "Untitled brief";
}

function briefLines(brief: Record<string, unknown>, key: string) {
  const value = brief[key];
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "unknown";
  }

  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

type ExecutionHandoffSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ handoffId: string }>;
  searchParams?: ExecutionHandoffSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const handoff = getExecutionBriefHandoff(resolvedParams.handoffId);

  if (!handoff) {
    return (
      <ExecutionDetailEmptyState
        title="Handoff not found"
        description="The requested execution brief handoff is missing or expired from the local shell handoff store."
      />
    );
  }
  const title = briefTitle(handoff.brief);
  const summary =
    typeof handoff.brief.summary === "string" ? handoff.brief.summary : "";
  const openQuestions = briefLines(handoff.brief, "open_questions");
  const constraints = briefLines(handoff.brief, "constraints");
  const acceptanceCriteria = briefLines(handoff.brief, "acceptance_criteria");
  const tags = Array.isArray(handoff.brief.tags)
    ? handoff.brief.tags.filter(
        (tag): tag is string => typeof tag === "string" && tag.trim().length > 0
      )
    : [];

  return (
    <ExecutionDetailPage
      eyebrow="Execution"
      title={title}
      description="Execution brief handoff staged in the local shell queue. This is the shell-owned bridge between discovery output and execution intake."
    >
      <ExecutionDetailMetricGrid>
        <ExecutionDetailMetric label="Handoff" value={handoff.id} />
        <ExecutionDetailMetric
          label="Launch intent"
          value={<ExecutionDetailStatusPill value={handoff.launch_intent} />}
        />
        <ExecutionDetailMetric
          label="Source"
          value={handoff.source_session_id ?? handoff.source_plane}
          detail={`Created ${formatRelativeTime(handoff.created_at)}`}
        />
      </ExecutionDetailMetricGrid>

      <ExecutionDetailSection title="Handoff">
        <ExecutionDetailKeyValueGrid
          columns="md:grid-cols-3"
          items={[
            { label: "Brief kind", value: handoff.brief_kind },
            { label: "Default project", value: handoff.default_project_name ?? title },
            {
              label: "Launch preset",
              value: handoff.recommended_launch_preset_id ?? "not specified",
            },
            { label: "Created at", value: handoff.created_at },
            { label: "Expires at", value: handoff.expires_at },
            { label: "Source plane", value: handoff.source_plane },
          ]}
        />
      </ExecutionDetailSection>

      {summary ? (
        <ExecutionDetailSection title="Summary">
          <p className="text-sm leading-6 text-white/78">{summary}</p>
        </ExecutionDetailSection>
      ) : null}

      {tags.length > 0 ? (
        <ExecutionDetailSection title="Tags">
          <div className="flex flex-wrap gap-2 text-sm text-white/78">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </ExecutionDetailSection>
      ) : null}

      {openQuestions.length > 0 || constraints.length > 0 || acceptanceCriteria.length > 0 ? (
        <ExecutionDetailSection title="Brief detail">
          <ExecutionDetailList>
            {openQuestions.length > 0 ? (
              <ExecutionDetailListItem
                title="Open questions"
                detail={openQuestions.join(" · ")}
              />
            ) : null}
            {constraints.length > 0 ? (
              <ExecutionDetailListItem
                title="Constraints"
                detail={constraints.join(" · ")}
              />
            ) : null}
            {acceptanceCriteria.length > 0 ? (
              <ExecutionDetailListItem
                title="Acceptance criteria"
                detail={acceptanceCriteria.join(" · ")}
              />
            ) : null}
          </ExecutionDetailList>
        </ExecutionDetailSection>
      ) : null}

      <ExecutionDetailSection title="Actions">
        <div className="flex flex-wrap gap-3">
          <ExecutionDetailActionLink href={buildExecutionHandoffsScopeHref(routeScope)}>
            Back to handoffs
          </ExecutionDetailActionLink>
        </div>
      </ExecutionDetailSection>
    </ExecutionDetailPage>
  );
}
