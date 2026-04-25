import type {
  AssemblyRecord,
  DeliveryRecord,
  VerificationRunRecord,
} from "../control-plane/contracts/orchestration";
import { storeJsonArtifact } from "./artifacts";
import { nowIso } from "./shared";

export type ExternalDeliveryPublishResult = {
  externalPullRequestUrl: string;
  externalPullRequestId: string;
  externalPreviewUrl: string;
  externalPreviewProvider: string;
  externalPreviewDeploymentId: string;
  externalProofManifestPath: string;
  ciProofUri: string;
  ciProofProvider: string;
  ciProofId: string;
  externalDeliveryProof: Record<string, unknown>;
};

type ExternalDeliveryPublishInput = {
  deliveryId: string;
  initiativeId: string;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
  artifactStorageUri: string | null;
  signedManifestUri: string | null;
  deliveryManifestUri: string | null;
  launchManifestUri: string | null;
  hostedPreviewHtml?: string | null;
};

type GithubVercelConfig = {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBaseBranch: string;
  vercelToken: string;
  vercelProjectId: string;
  vercelGitRepoId: string;
  vercelTeamId: string | null;
  vercelTeamSlug: string | null;
};

function envValue(key: string) {
  return process.env[key]?.trim() || null;
}

function requireEnvValue(key: string) {
  const value = envValue(key);
  if (!value) {
    throw new Error(`${key} is required for live external delivery.`);
  }
  return value;
}

function configuredExternalDeliveryMode() {
  return envValue("FOUNDEROS_EXTERNAL_DELIVERY_MODE")?.toLowerCase() ?? "";
}

function isProductionLikeDeployment() {
  const deploymentEnv = envValue("FOUNDEROS_DEPLOYMENT_ENV")?.toLowerCase();
  return deploymentEnv === "production" || deploymentEnv === "staging";
}

function readGithubVercelConfig(): GithubVercelConfig {
  const repository = requireEnvValue("FOUNDEROS_GITHUB_REPOSITORY");
  const [owner, repo] = repository.split("/");
  if (!owner || !repo || repository.split("/").length !== 2) {
    throw new Error(
      "FOUNDEROS_GITHUB_REPOSITORY must be formatted as owner/repo for live external delivery."
    );
  }

  return {
    githubToken: requireEnvValue("FOUNDEROS_GITHUB_TOKEN"),
    githubOwner: owner,
    githubRepo: repo,
    githubBaseBranch: requireEnvValue("FOUNDEROS_GITHUB_BASE_BRANCH"),
    vercelToken: requireEnvValue("FOUNDEROS_VERCEL_TOKEN"),
    vercelProjectId: requireEnvValue("FOUNDEROS_VERCEL_PROJECT_ID"),
    vercelGitRepoId: requireEnvValue("FOUNDEROS_VERCEL_GIT_REPO_ID"),
    vercelTeamId: envValue("FOUNDEROS_VERCEL_TEAM_ID"),
    vercelTeamSlug: envValue("FOUNDEROS_VERCEL_TEAM_SLUG"),
  };
}

function stableNumericId(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90_000;
  }
  return 10_000 + hash;
}

function encodePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactProviderErrorDetail(value: string) {
  const secretValues = [
    envValue("FOUNDEROS_GITHUB_TOKEN"),
    envValue("FOUNDEROS_VERCEL_TOKEN"),
  ].filter((secret): secret is string => Boolean(secret && secret.length >= 8));
  let redacted = value;
  for (const secret of secretValues) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }
  return redacted.replace(
    /\b(?:github_pat|ghp|gho|ghu|ghs|ghr|vck)_[A-Za-z0-9_=-]{8,}\b/g,
    "[REDACTED]",
  );
}

async function responseJson<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : text;
    throw new Error(
      `${context} failed with ${response.status}: ${redactProviderErrorDetail(detail)}`,
    );
  }
  return payload as T;
}

async function githubRequest<T>(
  config: GithubVercelConfig,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(
    `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}${path}`,
    {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${config.githubToken}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...init.headers,
      },
    },
  );
  return responseJson<T>(response, `GitHub ${path}`);
}

async function githubRequestOrNull<T>(
  config: GithubVercelConfig,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(
    `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}${path}`,
    {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${config.githubToken}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...init.headers,
      },
    },
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status === 404) {
    return null;
  }
  if (
    response.status === 422 &&
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    String((payload as { message?: unknown }).message).includes(
      "Reference does not exist",
    )
  ) {
    return null;
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : text;
    throw new Error(
      `GitHub ${path} failed with ${response.status}: ${redactProviderErrorDetail(detail)}`,
    );
  }
  return payload as T;
}

async function vercelRequest<T>(
  config: GithubVercelConfig,
  path: string,
  init: RequestInit = {}
) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (config.vercelTeamId) {
    url.searchParams.set("teamId", config.vercelTeamId);
  } else if (config.vercelTeamSlug) {
    url.searchParams.set("slug", config.vercelTeamSlug);
  }
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      authorization: `Bearer ${config.vercelToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  return responseJson<T>(response, `Vercel ${path}`);
}

async function assertVercelProjectAccessible(config: GithubVercelConfig) {
  const project = await vercelRequest<{ id?: string }>(
    config,
    `/v9/projects/${encodeURIComponent(config.vercelProjectId)}`,
  );
  if (project.id && project.id !== config.vercelProjectId) {
    throw new Error(
      `Vercel project preflight returned ${project.id}, expected ${config.vercelProjectId}.`,
    );
  }
}

function normalizedPreviewUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

function hostedPreviewRepoPath(input: ExternalDeliveryPublishInput) {
  return `apps/shell/apps/web/public/deliveries/${input.deliveryId}/index.html`;
}

function hostedPreviewUrlPath(input: ExternalDeliveryPublishInput) {
  return `/deliveries/${input.deliveryId}/index.html`;
}

function appendUrlPath(baseUrl: string, pathname: string) {
  const parsed = new URL(normalizedPreviewUrl(baseUrl));
  parsed.pathname = pathname;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function buildExternalProofPayload(params: {
  mode: "mock" | "github_vercel";
  input: ExternalDeliveryPublishInput;
  pullRequest: Record<string, unknown>;
  preview: Record<string, unknown>;
  ci: Record<string, unknown>;
}) {
  return {
    version: 1,
    mode: params.mode,
    generatedAt: nowIso(),
    deliveryId: params.input.deliveryId,
    initiativeId: params.input.initiativeId,
    assemblyId: params.input.assembly.id,
    verificationRunId: params.input.verification.id,
    pullRequest: params.pullRequest,
    preview: params.preview,
    ci: params.ci,
    artifacts: {
      storageUri: params.input.artifactStorageUri,
      signedManifestUri: params.input.signedManifestUri,
      deliveryManifestUri: params.input.deliveryManifestUri,
      launchManifestUri: params.input.launchManifestUri,
    },
    retention: {
      policy: "immutable-delivery-proof",
      retainedArtifactRoot: params.input.artifactStorageUri,
    },
  };
}

async function storeExternalProof(params: {
  input: ExternalDeliveryPublishInput;
  proof: ReturnType<typeof buildExternalProofPayload>;
  externalPullRequestUrl: string;
  externalPullRequestId: string;
  externalPreviewUrl: string;
  externalPreviewProvider: string;
  externalPreviewDeploymentId: string;
  ciProofUri: string;
  ciProofProvider: string;
  ciProofId: string;
}): Promise<ExternalDeliveryPublishResult> {
  const storedProof = await storeJsonArtifact({
    key: `deliveries/${params.input.initiativeId}/${params.input.deliveryId}/external-delivery-proof.json`,
    payload: params.proof,
  });

  return {
    externalPullRequestUrl: params.externalPullRequestUrl,
    externalPullRequestId: params.externalPullRequestId,
    externalPreviewUrl: params.externalPreviewUrl,
    externalPreviewProvider: params.externalPreviewProvider,
    externalPreviewDeploymentId: params.externalPreviewDeploymentId,
    externalProofManifestPath: storedProof.uri,
    ciProofUri: params.ciProofUri,
    ciProofProvider: params.ciProofProvider,
    ciProofId: params.ciProofId,
    externalDeliveryProof: {
      ...params.proof,
      manifestUri: storedProof.uri,
      manifestSha256: storedProof.sha256,
    },
  };
}

function assertObjectArtifactsAvailable(
  input: ExternalDeliveryPublishInput,
  modeLabel: string
) {
  if (!input.artifactStorageUri || !input.signedManifestUri) {
    throw new Error(
      `${modeLabel} external delivery requires object artifact storage and a signed manifest.`
    );
  }
}

function assertHostedPreviewPayloadAvailable(input: ExternalDeliveryPublishInput) {
  const html = input.hostedPreviewHtml?.trim();
  if (!html) {
    throw new Error(
      "GitHub/Vercel external delivery requires hosted preview HTML content."
    );
  }
  if (
    html.includes("file://") ||
    html.includes("/Users/") ||
    html.includes("localhost") ||
    html.includes("127.0.0.1") ||
    html.includes("0.0.0.0")
  ) {
    throw new Error(
      "GitHub/Vercel external delivery hosted preview HTML must not contain local paths or local-only URLs."
    );
  }
}

async function publishMockExternalDelivery(
  input: ExternalDeliveryPublishInput
): Promise<ExternalDeliveryPublishResult> {
  assertObjectArtifactsAvailable(input, "Mock");

  const prNumber = stableNumericId(input.deliveryId);
  const externalPullRequestId = `github-pr-${input.deliveryId}`;
  const externalPreviewDeploymentId = `vercel-preview-${input.deliveryId}`;
  const ciProofId = `github-status-${input.deliveryId}`;
  const proof = buildExternalProofPayload({
    mode: "mock",
    input,
    pullRequest: {
      provider: "github",
      id: externalPullRequestId,
      number: prNumber,
      branch: `delivery/${input.deliveryId}`,
      commitSha: `mock-${input.deliveryId}`,
      url: `https://github.com/founderos/infinity/pull/${prNumber}`,
    },
    preview: {
      provider: "vercel",
      id: externalPreviewDeploymentId,
      status: "ready",
      url: `https://${input.deliveryId}.preview.infinity.example`,
    },
    ci: {
      provider: "github_commit_status",
      id: ciProofId,
      status: "passed",
      url: `https://github.com/founderos/infinity/commit/mock-${input.deliveryId}/checks`,
    },
  });

  return storeExternalProof({
    input,
    proof,
    externalPullRequestUrl: String(proof.pullRequest["url"]),
    externalPullRequestId,
    externalPreviewUrl: String(proof.preview["url"]),
    externalPreviewProvider: "vercel",
    externalPreviewDeploymentId,
    ciProofUri: String(proof.ci["url"]),
    ciProofProvider: "github_commit_status",
    ciProofId,
  });
}

async function upsertDeliveryBranch(params: {
  config: GithubVercelConfig;
  branch: string;
  commitSha: string;
}) {
  const refPath = `/git/refs/heads/${encodePath(params.branch)}`;
  const updated = await githubRequestOrNull<{ ref: string }>(
    params.config,
    refPath,
    {
      method: "PATCH",
      body: JSON.stringify({
        sha: params.commitSha,
        force: true,
      }),
    },
  );
  if (updated) {
    return updated;
  }
  return githubRequest<{ ref: string }>(params.config, "/git/refs", {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${params.branch}`,
      sha: params.commitSha,
    }),
  });
}

function pullRequestTitle(deliveryId: string) {
  return `Delivery proof ${deliveryId}`;
}

function pullRequestBody(input: ExternalDeliveryPublishInput) {
  return [
    `Delivery: ${input.deliveryId}`,
    `Artifact storage: ${input.artifactStorageUri ?? "n/a"}`,
    `Signed manifest: ${input.signedManifestUri ?? "n/a"}`,
  ].join("\n");
}

type GithubPullRequest = {
  id: number | string;
  number: number;
  html_url: string;
};

async function upsertPullRequest(params: {
  config: GithubVercelConfig;
  input: ExternalDeliveryPublishInput;
  branch: string;
}) {
  const head = `${params.config.githubOwner}:${params.branch}`;
  const query = new URLSearchParams({
    state: "open",
    head,
    base: params.config.githubBaseBranch,
  });
  const existing = await githubRequest<GithubPullRequest[]>(
    params.config,
    `/pulls?${query.toString()}`,
  );
  const body = JSON.stringify({
    title: pullRequestTitle(params.input.deliveryId),
    body: pullRequestBody(params.input),
  });
  if (existing[0]) {
    return githubRequest<GithubPullRequest>(
      params.config,
      `/pulls/${existing[0].number}`,
      {
        method: "PATCH",
        body,
      },
    );
  }
  return githubRequest<GithubPullRequest>(params.config, "/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: pullRequestTitle(params.input.deliveryId),
      head: params.branch,
      base: params.config.githubBaseBranch,
      body: pullRequestBody(params.input),
    }),
  });
}

async function publishGithubProofBranch(params: {
  config: GithubVercelConfig;
  input: ExternalDeliveryPublishInput;
}) {
  const branch = `delivery/${params.input.deliveryId}`;
  const proofPath = `delivery-proofs/${params.input.deliveryId}.json`;
  const previewPath = hostedPreviewRepoPath(params.input);
  const previewUrlPath = hostedPreviewUrlPath(params.input);
  const baseRef = await githubRequest<{ object: { sha: string } }>(
    params.config,
    `/git/ref/heads/${encodePath(params.config.githubBaseBranch)}`,
  );
  const baseCommit = await githubRequest<{
    sha: string;
    tree: { sha: string };
  }>(params.config, `/git/commits/${baseRef.object.sha}`);
  const proofContent = {
    deliveryId: params.input.deliveryId,
    initiativeId: params.input.initiativeId,
    assemblyId: params.input.assembly.id,
    verificationRunId: params.input.verification.id,
    artifactStorageUri: params.input.artifactStorageUri,
    signedManifestUri: params.input.signedManifestUri,
    deliveryManifestUri: params.input.deliveryManifestUri,
    launchManifestUri: params.input.launchManifestUri,
    hostedPreviewPath: previewPath,
    hostedPreviewUrlPath: previewUrlPath,
  };
  const proofBlob = await githubRequest<{ sha: string }>(
    params.config,
    "/git/blobs",
    {
      method: "POST",
      body: JSON.stringify({
        content: JSON.stringify(proofContent, null, 2),
        encoding: "utf-8",
      }),
    },
  );
  const previewBlob = await githubRequest<{ sha: string }>(
    params.config,
    "/git/blobs",
    {
      method: "POST",
      body: JSON.stringify({
        content: params.input.hostedPreviewHtml ?? "",
        encoding: "utf-8",
      }),
    },
  );
  const tree = await githubRequest<{ sha: string }>(
    params.config,
    "/git/trees",
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [
          {
            path: proofPath,
            mode: "100644",
            type: "blob",
            sha: proofBlob.sha,
          },
          {
            path: previewPath,
            mode: "100644",
            type: "blob",
            sha: previewBlob.sha,
          },
        ],
      }),
    },
  );
  const commit = await githubRequest<{ sha: string; html_url?: string }>(
    params.config,
    "/git/commits",
    {
      method: "POST",
      body: JSON.stringify({
        message: `Add delivery proof ${params.input.deliveryId}`,
        tree: tree.sha,
        parents: [baseCommit.sha],
      }),
    },
  );
  await upsertDeliveryBranch({
    config: params.config,
    branch,
    commitSha: commit.sha,
  });
  const pullRequest = await upsertPullRequest({
    config: params.config,
    input: params.input,
    branch,
  });

  return {
    branch,
    commitSha: commit.sha,
    commitUrl: commit.html_url ?? null,
    proofPath,
    hostedPreviewPath: previewPath,
    hostedPreviewUrlPath: previewUrlPath,
    pullRequest,
  };
}

async function publishVercelPreview(params: {
  config: GithubVercelConfig;
  input: ExternalDeliveryPublishInput;
  branch: string;
  commitSha: string;
}) {
  const created = await vercelRequest<{
    id: string;
    url?: string;
    readyState?: string;
    state?: string;
  }>(params.config, "/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: `infinity-${params.input.deliveryId}`,
      project: params.config.vercelProjectId,
      target: "preview",
      gitSource: {
        type: "github",
        repoId: params.config.vercelGitRepoId,
        ref: params.branch,
        sha: params.commitSha,
      },
      meta: {
        deliveryId: params.input.deliveryId,
        initiativeId: params.input.initiativeId,
        githubCommitSha: params.commitSha,
      },
    }),
  });
  const attempts = Number.parseInt(
    envValue("FOUNDEROS_VERCEL_DEPLOYMENT_POLL_ATTEMPTS") ?? "3",
    10,
  );
  let observed = created;
  for (let index = 0; index < Math.max(1, attempts); index += 1) {
    const state = observed.readyState ?? observed.state;
    if (state === "READY" && observed.url) {
      return observed;
    }
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel preview deployment ${created.id} failed with state ${state}.`);
    }
    observed = await vercelRequest<typeof observed>(
      params.config,
      `/v13/deployments/${created.id}`,
    );
  }
  if ((observed.readyState ?? observed.state) !== "READY" || !observed.url) {
    throw new Error(`Vercel preview deployment ${created.id} did not become READY.`);
  }
  return observed;
}

async function readGithubCiProof(params: {
  config: GithubVercelConfig;
  commitSha: string;
}) {
  const status = await githubRequest<{
    state: string;
    target_url?: string | null;
    statuses?: Array<{
      id?: number | string;
      target_url?: string | null;
      context?: string | null;
      state?: string | null;
    }>;
  }>(params.config, `/commits/${params.commitSha}/status`);
  if (status.state !== "success") {
    throw new Error(`GitHub CI status for ${params.commitSha} is ${status.state}.`);
  }
  const firstStatus = status.statuses?.[0] ?? null;
  return {
    id: String(firstStatus?.id ?? params.commitSha),
    uri:
      status.target_url ??
      firstStatus?.target_url ??
      `https://github.com/${params.config.githubOwner}/${params.config.githubRepo}/commit/${params.commitSha}/checks`,
    context: firstStatus?.context ?? "combined-status",
  };
}

async function publishGithubVercelExternalDelivery(
  input: ExternalDeliveryPublishInput
): Promise<ExternalDeliveryPublishResult> {
  assertObjectArtifactsAvailable(input, "GitHub/Vercel");
  assertHostedPreviewPayloadAvailable(input);
  const config = readGithubVercelConfig();
  await assertVercelProjectAccessible(config);
  const github = await publishGithubProofBranch({ config, input });
  const preview = await publishVercelPreview({
    config,
    input,
    branch: github.branch,
    commitSha: github.commitSha,
  });
  const ci = await readGithubCiProof({
    config,
    commitSha: github.commitSha,
  });
  const previewUrl = appendUrlPath(preview.url ?? "", github.hostedPreviewUrlPath);
  const proof = buildExternalProofPayload({
    mode: "github_vercel",
    input,
    pullRequest: {
      provider: "github",
      id: String(github.pullRequest.id),
      number: github.pullRequest.number,
      branch: github.branch,
      commitSha: github.commitSha,
      commitUrl: github.commitUrl,
      proofPath: github.proofPath,
      hostedPreviewPath: github.hostedPreviewPath,
      url: github.pullRequest.html_url,
    },
    preview: {
      provider: "vercel",
      id: preview.id,
      status: preview.readyState ?? preview.state ?? "READY",
      path: github.hostedPreviewUrlPath,
      url: previewUrl,
    },
    ci: {
      provider: "github_commit_status",
      id: ci.id,
      status: "passed",
      context: ci.context,
      url: ci.uri,
    },
  });

  return storeExternalProof({
    input,
    proof,
    externalPullRequestUrl: github.pullRequest.html_url,
    externalPullRequestId: String(github.pullRequest.id),
    externalPreviewUrl: previewUrl,
    externalPreviewProvider: "vercel",
    externalPreviewDeploymentId: preview.id,
    ciProofUri: ci.uri,
    ciProofProvider: "github_commit_status",
    ciProofId: ci.id,
  });
}

export async function publishExternalDeliveryProof(
  input: ExternalDeliveryPublishInput
): Promise<ExternalDeliveryPublishResult | null> {
  const mode = configuredExternalDeliveryMode();
  if (!mode || mode === "disabled") {
    return null;
  }
  if (mode === "mock") {
    if (isProductionLikeDeployment()) {
      throw new Error(
        "FOUNDEROS_EXTERNAL_DELIVERY_MODE=mock is only allowed for local integration tests, not production-like deployments."
      );
    }
    return publishMockExternalDelivery(input);
  }
  if (mode === "github_vercel") {
    return publishGithubVercelExternalDelivery(input);
  }
  throw new Error(
    "FOUNDEROS_EXTERNAL_DELIVERY_MODE must be disabled, mock, or github_vercel."
  );
}

export function deliveryExternalProofFields(
  proof: ExternalDeliveryPublishResult | null
): Pick<
  DeliveryRecord,
  | "externalPullRequestUrl"
  | "externalPullRequestId"
  | "externalPreviewUrl"
  | "externalPreviewProvider"
  | "externalPreviewDeploymentId"
  | "externalProofManifestPath"
  | "ciProofUri"
  | "ciProofProvider"
  | "ciProofId"
  | "externalDeliveryProof"
> {
  return {
    externalPullRequestUrl: proof?.externalPullRequestUrl ?? null,
    externalPullRequestId: proof?.externalPullRequestId ?? null,
    externalPreviewUrl: proof?.externalPreviewUrl ?? null,
    externalPreviewProvider: proof?.externalPreviewProvider ?? null,
    externalPreviewDeploymentId: proof?.externalPreviewDeploymentId ?? null,
    externalProofManifestPath: proof?.externalProofManifestPath ?? null,
    ciProofUri: proof?.ciProofUri ?? null,
    ciProofProvider: proof?.ciProofProvider ?? null,
    ciProofId: proof?.ciProofId ?? null,
    externalDeliveryProof: proof?.externalDeliveryProof ?? null,
  };
}
