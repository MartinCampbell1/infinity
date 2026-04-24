import process from "node:process";
import { pathToFileURL } from "node:url";

function envValue(key) {
  return process.env[key]?.trim() || null;
}

function requireEnv(key) {
  const value = envValue(key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactProviderErrorDetail(value) {
  const secretValues = [
    envValue("FOUNDEROS_VERCEL_TOKEN"),
    envValue("FOUNDEROS_GITHUB_TOKEN"),
  ].filter((secret) => secret && secret.length >= 8);
  let redacted = value;
  for (const secret of secretValues) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }
  return redacted.replace(
    /\b(?:github_pat|ghp|gho|ghu|ghs|ghr|vck)_[A-Za-z0-9_=-]{8,}\b/g,
    "[REDACTED]",
  );
}

function vercelSearchParams(extra = {}) {
  const params = new URLSearchParams(extra);
  const teamId = envValue("FOUNDEROS_VERCEL_TEAM_ID");
  const teamSlug = envValue("FOUNDEROS_VERCEL_TEAM_SLUG");
  if (teamId) {
    params.set("teamId", teamId);
  } else if (teamSlug) {
    params.set("slug", teamSlug);
  }
  return params;
}

function vercelQuery(params = {}, options = {}) {
  return options.includeTeamScope === false
    ? new URLSearchParams(params)
    : vercelSearchParams(params);
}

function vercelUrl(path, params = {}, options = {}) {
  const searchParams = vercelQuery(params, options);
  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  return `https://api.vercel.com${path}${query}`;
}

async function vercelFetch(path, params = {}, options = {}) {
  return fetch(vercelUrl(path, params, options), {
    headers: {
      authorization: `Bearer ${requireEnv("FOUNDEROS_VERCEL_TOKEN")}`,
    },
  });
}

async function vercelJson(path, params = {}) {
  const response = await vercelFetch(path, params);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : text;
    throw new Error(
      `Vercel ${path} failed with ${response.status}: ${redactProviderErrorDetail(detail)}`,
    );
  }
  return payload;
}

async function vercelProbe(path, params = {}, options = {}) {
  const response = await vercelFetch(path, params, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : text;
    return {
      ok: false,
      status: response.status,
      detail: redactProviderErrorDetail(detail),
    };
  }
  return {
    ok: true,
    status: response.status,
    payload,
  };
}

function projectLink(project) {
  return project && typeof project === "object" ? project.link ?? null : null;
}

function projectMatchesRepo(project, repoId, repoFullName) {
  const link = projectLink(project);
  if (!link || typeof link !== "object") {
    return false;
  }
  const linkedRepoId = link.repoId == null ? null : String(link.repoId);
  const linkedRepo = link.repo == null ? null : String(link.repo);
  return linkedRepoId === repoId || linkedRepo === repoFullName;
}

async function readConfiguredProject() {
  const projectId = envValue("FOUNDEROS_VERCEL_PROJECT_ID");
  if (!projectId) {
    return null;
  }
  return vercelJson(`/v9/projects/${encodeURIComponent(projectId)}`);
}

function projectLinkSummary(project) {
  const link = projectLink(project);
  if (!link || typeof link !== "object") {
    return "no Git repository link";
  }
  return `repo=${link.repo ?? "unknown"}, repoId=${link.repoId ?? "unknown"}`;
}

function collectionCount(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key].length : null;
}

function probeSummary(label, probe, key) {
  if (!probe.ok) {
    return `${label} failed with ${probe.status}: ${probe.detail}`;
  }
  const count = collectionCount(probe.payload, key);
  return count == null
    ? `${label} returned ${probe.status}.`
    : `${label} returned ${count} ${key}.`;
}

async function collectAccessDiagnostics() {
  const scopedProjects = await vercelProbe("/v9/projects", { limit: "20" });
  const personalProjects = await vercelProbe(
    "/v9/projects",
    { limit: "20" },
    { includeTeamScope: false },
  );
  const teams = await vercelProbe("/v2/teams", {}, { includeTeamScope: false });
  return [
    "Vercel access diagnostics:",
    probeSummary("scoped project listing", scopedProjects, "projects"),
    probeSummary("personal project listing", personalProjects, "projects"),
    probeSummary("team listing", teams, "teams"),
  ];
}

function printProjectCandidate(project, repoId) {
  const link = projectLink(project);
  const rootDirectory = project.rootDirectory ?? project.directoryListing ?? null;
  console.log("");
  console.log(`name: ${project.name}`);
  console.log(`id: ${project.id}`);
  console.log(`framework: ${project.framework ?? "unknown"}`);
  console.log(`rootDirectory: ${rootDirectory ?? "unknown"}`);
  console.log(`productionBranch: ${link?.productionBranch ?? "unknown"}`);
  console.log(`repo: ${link?.repo ?? "unknown"}`);
  console.log(`repoId: ${link?.repoId ?? "unknown"}`);
  console.log("suggested env:");
  console.log(`export FOUNDEROS_VERCEL_PROJECT_ID="${project.id}"`);
  console.log(`export FOUNDEROS_VERCEL_GIT_REPO_ID="${link?.repoId ?? repoId}"`);
  if (envValue("FOUNDEROS_VERCEL_TEAM_SLUG")) {
    console.log(
      `export FOUNDEROS_VERCEL_TEAM_SLUG="${envValue("FOUNDEROS_VERCEL_TEAM_SLUG")}"`,
    );
  }
  console.log(
    `export FOUNDEROS_ARTIFACT_SIGNED_URL_BASE="https://${project.name}.vercel.app/api/control/orchestration/artifacts/download"`,
  );
}

async function resolveRepoSearchCandidates(repoId, repoFullName) {
  const projectsPayload = await vercelJson("/v10/projects", {
    repoUrl: `https://github.com/${repoFullName}`,
  });
  const projects = Array.isArray(projectsPayload?.projects)
    ? projectsPayload.projects
    : [];
  return projects.filter((project) =>
    projectMatchesRepo(project, repoId, repoFullName),
  );
}

async function resolveConfiguredProject(projectId) {
  if (!projectId) {
    return {
      project: null,
      error: null,
    };
  }
  try {
    return {
      project: await readConfiguredProject(),
      error: null,
    };
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runVercelDiscovery() {
  const repoId = requireEnv("FOUNDEROS_VERCEL_GIT_REPO_ID");
  const repoFullName = requireEnv("FOUNDEROS_GITHUB_REPOSITORY");
  let candidates = [];
  let repoSearchError = null;
  try {
    candidates = await resolveRepoSearchCandidates(repoId, repoFullName);
  } catch (error) {
    repoSearchError = error instanceof Error ? error.message : String(error);
  }
  if (!candidates.length) {
    const projectId = envValue("FOUNDEROS_VERCEL_PROJECT_ID");
    const { project: configuredProject, error: configuredProjectError } =
      await resolveConfiguredProject(projectId);
    if (configuredProject && projectMatchesRepo(configuredProject, repoId, repoFullName)) {
      console.log("Found configured Vercel project by direct project preflight:");
      printProjectCandidate(configuredProject, repoId);
      return;
    }

    const projectPreflightHint = projectId
      ? configuredProject
        ? [
            `Configured Vercel project ${projectId} is readable, but its Git link does not match ${repoFullName} / repoId ${repoId}.`,
            `Observed project link: ${projectLinkSummary(configuredProject)}.`,
          ]
        : [
            `Direct preflight for configured Vercel project ${projectId} also failed.`,
            configuredProjectError ?? "No direct project preflight detail available.",
          ]
      : ["Set FOUNDEROS_VERCEL_PROJECT_ID to verify direct project access."];
    const tokenWorkspaceHint =
      projectId && !configuredProject
        ? [
            "If the project exists in the Vercel UI but direct preflight fails, create the API token in the same personal/team workspace that owns the project.",
          ]
        : [];
    const accessDiagnostics =
      projectId && !configuredProject ? await collectAccessDiagnostics() : [];
    throw new Error(
      [
        `No Vercel project linked to ${repoFullName} / repoId ${repoId}.`,
        ...(repoSearchError ? [`Repo-linked project search failed: ${repoSearchError}.`] : []),
        ...projectPreflightHint,
        ...accessDiagnostics,
        "Import the GitHub repository in Vercel first, then rerun this command.",
        ...tokenWorkspaceHint,
        "If the project is in a team, set FOUNDEROS_VERCEL_TEAM_ID or FOUNDEROS_VERCEL_TEAM_SLUG.",
      ].join("\n"),
    );
  }

  console.log(`Found ${candidates.length} Vercel project candidate(s):`);
  for (const project of candidates) {
    printProjectCandidate(project, repoId);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVercelDiscovery().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
