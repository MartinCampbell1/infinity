import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
	readControlPlaneState,
	resetControlPlaneStateForTests,
} from "../../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../../initiatives/route";
import { POST as postBriefs } from "../../briefs/route";
import { POST as postTaskGraphs } from "../../task-graphs/route";
import { POST as postBatches } from "../../batches/route";
import { GET as getBatchDetail } from "../../batches/[batchId]/route";
import { GET as getTaskGraphDetail } from "../../task-graphs/[taskGraphId]/route";
import { POST as postSupervisorAction } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_EXECUTION_KERNEL_BASE_URL = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;

let tempStateDir = "";

beforeEach(async () => {
	tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-supervisor-"));
	process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
	delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
	delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
	delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
	await resetControlPlaneStateForTests();
});

afterEach(async () => {
	await resetControlPlaneStateForTests();
	if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
		delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
	} else {
		process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = ORIGINAL_CONTROL_PLANE_STATE_DIR;
	}
	if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
		delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
	} else {
		process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL = ORIGINAL_CONTROL_PLANE_DATABASE_URL;
	}
	if (ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL === undefined) {
		delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
	} else {
		process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL =
			ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL;
	}
	if (ORIGINAL_EXECUTION_KERNEL_BASE_URL === undefined) {
		delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
	} else {
		process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = ORIGINAL_EXECUTION_KERNEL_BASE_URL;
	}
	if (tempStateDir) {
		rmSync(tempStateDir, { recursive: true, force: true });
		tempStateDir = "";
	}
});

async function createPlannedTaskGraph() {
	const initiativeResponse = await postInitiatives(
		new Request("http://localhost/api/control/orchestration/initiatives", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				title: "Atlas Factory",
				userRequest: "Build the Infinity-native project factory.",
				requestedBy: "martin",
			}),
		})
	);
	const initiativeBody = await initiativeResponse.json();
	const initiativeId = initiativeBody.initiative.id as string;

	const briefResponse = await postBriefs(
		new Request("http://localhost/api/control/orchestration/briefs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				initiativeId,
				summary: "Approved brief for the project factory.",
				goals: ["Generate a deterministic execution plan"],
				nonGoals: ["Assembly and delivery"],
				constraints: ["Stay inside /Users/martin/infinity"],
				assumptions: ["Shell and work-ui remain split"],
				acceptanceCriteria: [
					"Each work unit has scope, dependencies, and acceptance criteria",
				],
				repoScope: [
					"/Users/martin/infinity/apps/shell",
					"/Users/martin/infinity/apps/work-ui",
				],
				deliverables: ["Task graph", "Work units"],
				clarificationLog: [],
				authoredBy: "droid-spec-writer",
				status: "approved",
			}),
		})
	);
	const briefBody = await briefResponse.json();
	const briefId = briefBody.brief.id as string;

	const taskGraphResponse = await postTaskGraphs(
		new Request("http://localhost/api/control/orchestration/task-graphs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ briefId }),
		})
	);
	const taskGraphBody = await taskGraphResponse.json();

	return {
		initiativeId,
		taskGraphId: taskGraphBody.taskGraph.id as string,
	};
}

function readJsonBody(request: IncomingMessage) {
	return new Promise<Record<string, unknown>>((resolve, reject) => {
		let raw = "";
		request.setEncoding("utf8");
		request.on("data", (chunk) => {
			raw += chunk;
		});
		request.on("end", () => {
			try {
				resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
			} catch (error) {
				reject(error);
			}
		});
		request.on("error", reject);
	});
}

describe("/api/control/orchestration/supervisor/actions", () => {
	test("completes a started attempt and promotes the batch to completed", async () => {
		const { taskGraphId } = await createPlannedTaskGraph();
		let launchedBatchId = "";
		let launchedInitiativeId = "";
		let launchedWorkUnitId = "";
		let batchResumed = false;

		const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
			if (request.method === "POST" && request.url === "/api/v1/batches") {
				const body = await readJsonBody(request);
				launchedBatchId = String(body.batchId ?? "");
				launchedInitiativeId = String(body.initiativeId ?? "");
				launchedWorkUnitId = String((body.workUnits as Array<{ id: string }>)[0]?.id ?? "");
				response.writeHead(201, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: body.batchId,
							initiativeId: body.initiativeId,
							taskGraphId: body.taskGraphId,
							workUnitIds: (body.workUnits as Array<{ id: string }>).map((unit) => unit.id),
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-001",
								workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
								batchId: body.batchId,
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			if (
				request.method === "POST" &&
				request.url === "/api/v1/attempts/attempt-foundation-001/complete"
			) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "completed",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:05:00.000Z",
						},
						attempt: {
							id: "attempt-foundation-001",
							workUnitId: launchedWorkUnitId,
							batchId: launchedBatchId,
							executorType: "droid",
							status: "succeeded",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:05:00.000Z",
							summary: "completed",
							artifactUris: [],
							errorCode: null,
							errorSummary: null,
						},
					})
				);
				return;
			}

			if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "completed",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:05:00.000Z",
						},
						attempts: [
							{
								id: "attempt-foundation-001",
								workUnitId: launchedWorkUnitId,
								batchId: launchedBatchId,
								executorType: "droid",
								status: "succeeded",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: "2026-04-18T10:05:00.000Z",
								summary: "completed",
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			response.writeHead(404, { "content-type": "application/json" });
			response.end(JSON.stringify({ detail: "not found" }));
		});

		await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
		const address = kernelServer.address();
		if (!address || typeof address === "string") {
			throw new Error("Kernel test server did not bind to an ephemeral port.");
		}
		process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

		try {
			const createResponse = await postBatches(
				new Request("http://localhost/api/control/orchestration/batches", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						taskGraphId,
						concurrencyLimit: 1,
					}),
				})
			);
			const createBody = await createResponse.json();
			const batchId = createBody.batch.id as string;
			const workUnitId = createBody.workUnits[0].id as string;

			const actionResponse = await postSupervisorAction(
				new Request("http://localhost/api/control/orchestration/supervisor/actions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						actionKind: "complete_attempt",
						batchId,
						attemptId: "attempt-foundation-001",
						workUnitId,
					}),
				})
			);
			const actionBody = await actionResponse.json();

			expect(actionResponse.status).toBe(200);
			expect(actionBody.batch.status).toBe("completed");
			expect(actionBody.workUnit.status).toBe("completed");
			expect(actionBody.supervisorActions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						actionKind: "attempt.completed",
						batchId,
						workUnitId,
					}),
				])
			);

			const detailResponse = await getBatchDetail(
				new Request(`http://localhost/api/control/orchestration/batches/${batchId}`),
				{ params: Promise.resolve({ batchId }) }
			);
			const detailBody = await detailResponse.json();

			expect(detailResponse.status).toBe(200);
			expect(detailBody.batch.status).toBe("completed");
			expect(detailBody.supervisorActions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						actionKind: "attempt.completed",
					}),
				])
			);

			const taskGraphResponse = await getTaskGraphDetail(
				new Request(`http://localhost/api/control/orchestration/task-graphs/${taskGraphId}`),
				{ params: Promise.resolve({ taskGraphId }) }
			);
			const taskGraphBody = await taskGraphResponse.json();

			expect(taskGraphResponse.status).toBe(200);
			expect(taskGraphBody.taskGraph.status).toBe("active");
			expect(taskGraphBody.workUnits).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: workUnitId,
						status: "completed",
						latestAttemptId: "attempt-foundation-001",
					}),
				])
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				kernelServer.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	test("marks failed attempts retryable in shell and records reassignment auditably", async () => {
		const { taskGraphId } = await createPlannedTaskGraph();
		let launchedBatchId = "";
		let launchedInitiativeId = "";
		let launchedWorkUnitId = "";
		let batchResumed = false;

		const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
			if (request.method === "POST" && request.url === "/api/v1/batches") {
				const body = await readJsonBody(request);
				launchedBatchId = String(body.batchId ?? "");
				launchedInitiativeId = String(body.initiativeId ?? "");
				launchedWorkUnitId = String((body.workUnits as Array<{ id: string }>)[0]?.id ?? "");
				response.writeHead(201, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: body.batchId,
							initiativeId: body.initiativeId,
							taskGraphId: body.taskGraphId,
							workUnitIds: (body.workUnits as Array<{ id: string }>).map((unit) => unit.id),
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-002",
								workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
								batchId: body.batchId,
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			if (
				request.method === "POST" &&
				request.url === "/api/v1/attempts/attempt-foundation-002/fail"
			) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "blocked",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempt: {
							id: "attempt-foundation-002",
							workUnitId: launchedWorkUnitId,
							batchId: launchedBatchId,
							executorType: "droid",
							status: "failed",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:03:00.000Z",
							summary: null,
							artifactUris: [],
							errorCode: "TOOL_FAILURE",
							errorSummary: "tool crashed",
						},
					})
				);
				return;
			}

			if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: batchResumed ? "running" : "blocked",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-002",
								workUnitId: launchedWorkUnitId,
								batchId: launchedBatchId,
								executorType: "droid",
								status: batchResumed ? "started" : "failed",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: batchResumed ? null : "2026-04-18T10:03:00.000Z",
								summary: null,
								artifactUris: [],
								errorCode: batchResumed ? null : "TOOL_FAILURE",
								errorSummary: batchResumed ? null : "tool crashed",
							},
						],
					})
				);
				return;
			}

			if (request.method === "POST" && request.url === `/api/v1/batches/${launchedBatchId}/resume`) {
				batchResumed = true;
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-002",
								workUnitId: launchedWorkUnitId,
								batchId: launchedBatchId,
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:04:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			response.writeHead(404, { "content-type": "application/json" });
			response.end(JSON.stringify({ detail: "not found" }));
		});

		await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
		const address = kernelServer.address();
		if (!address || typeof address === "string") {
			throw new Error("Kernel test server did not bind to an ephemeral port.");
		}
		process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

		try {
			const createResponse = await postBatches(
				new Request("http://localhost/api/control/orchestration/batches", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						taskGraphId,
						concurrencyLimit: 1,
					}),
				})
			);
			const createBody = await createResponse.json();
			const batchId = createBody.batch.id as string;
			const workUnitId = createBody.workUnits[0].id as string;

			const failResponse = await postSupervisorAction(
				new Request("http://localhost/api/control/orchestration/supervisor/actions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						actionKind: "fail_attempt",
						batchId,
						attemptId: "attempt-foundation-002",
						workUnitId,
						errorSummary: "tool crashed",
					}),
				})
			);
			const failBody = await failResponse.json();

			expect(failResponse.status).toBe(200);
			expect(failBody.batch.status).toBe("blocked");
			expect(failBody.workUnit.status).toBe("retryable");
			expect(failBody.supervisorActions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						actionKind: "attempt.failed",
						batchId,
						workUnitId,
						toStatus: "retryable",
					}),
				])
			);

			const reassignResponse = await postSupervisorAction(
				new Request("http://localhost/api/control/orchestration/supervisor/actions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						actionKind: "reassign_work_unit",
						batchId,
						workUnitId,
						executorType: "codex",
					}),
				})
			);
			const reassignBody = await reassignResponse.json();

			expect(reassignResponse.status).toBe(200);
			expect(reassignBody.workUnit.executorType).toBe("codex");
			expect(reassignBody.batch.status).toBe("running");
			expect(reassignBody.supervisorActions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						actionKind: "work_unit.reassigned",
						batchId,
						workUnitId,
					}),
				])
			);
			expect(batchResumed).toBe(true);
		} finally {
			await new Promise<void>((resolve, reject) =>
				kernelServer.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	test("rejects supervisor actions when the work unit does not belong to the launched batch", async () => {
		const { taskGraphId } = await createPlannedTaskGraph();

		const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
			if (request.method === "POST" && request.url === "/api/v1/batches") {
				const body = await readJsonBody(request);
				response.writeHead(201, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: body.batchId,
							initiativeId: body.initiativeId,
							taskGraphId: body.taskGraphId,
							workUnitIds: (body.workUnits as Array<{ id: string }>).map((unit) => unit.id),
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-003",
								workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
								batchId: body.batchId,
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: "batch-supervisor-003",
							initiativeId: "initiative-ignored",
							taskGraphId,
							workUnitIds: ["work-unit-foundation"],
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-foundation-003",
								workUnitId: "work-unit-foundation",
								batchId: "batch-supervisor-003",
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			response.writeHead(404, { "content-type": "application/json" });
			response.end(JSON.stringify({ detail: "not found" }));
		});

		await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
		const address = kernelServer.address();
		if (!address || typeof address === "string") {
			throw new Error("Kernel test server did not bind to an ephemeral port.");
		}
		process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

		try {
			const createResponse = await postBatches(
				new Request("http://localhost/api/control/orchestration/batches", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						taskGraphId,
						concurrencyLimit: 1,
					}),
				})
			);
			const createBody = await createResponse.json();
			const batchId = createBody.batch.id as string;
			const validWorkUnitId = createBody.workUnits[0].id as string;

			const taskGraphResponse = await getTaskGraphDetail(
				new Request(`http://localhost/api/control/orchestration/task-graphs/${taskGraphId}`),
				{ params: Promise.resolve({ taskGraphId }) }
			);
			const taskGraphBody = await taskGraphResponse.json();
			const foreignWorkUnitId = taskGraphBody.workUnits.find(
				(unit: { id: string }) => unit.id !== validWorkUnitId
			)?.id as string;

			const actionResponse = await postSupervisorAction(
				new Request("http://localhost/api/control/orchestration/supervisor/actions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						actionKind: "complete_attempt",
						batchId,
						attemptId: "attempt-foundation-003",
						workUnitId: foreignWorkUnitId,
					}),
				})
			);
			const actionBody = await actionResponse.json();

			expect(actionResponse.status).toBe(400);
			expect(actionBody.detail).toMatch(/does not belong to batch/i);
		} finally {
			await new Promise<void>((resolve, reject) =>
				kernelServer.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	test("creates a durable secret pause when a failed attempt needs credentials", async () => {
		const { taskGraphId, initiativeId } = await createPlannedTaskGraph();
		let launchedBatchId = "";
		let launchedInitiativeId = "";
		let launchedWorkUnitId = "";

		const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
			if (request.method === "POST" && request.url === "/api/v1/batches") {
				const body = await readJsonBody(request);
				launchedBatchId = String(body.batchId ?? "");
				launchedInitiativeId = String(body.initiativeId ?? "");
				launchedWorkUnitId = String((body.workUnits as Array<{ id: string }>)[0]?.id ?? "");
				response.writeHead(201, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: body.batchId,
							initiativeId: body.initiativeId,
							taskGraphId: body.taskGraphId,
							workUnitIds: (body.workUnits as Array<{ id: string }>).map((unit) => unit.id),
							concurrencyLimit: 1,
							status: "running",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: null,
						},
						attempts: [
							{
								id: "attempt-secret-001",
								workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
								batchId: body.batchId,
								executorType: "droid",
								status: "started",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: null,
								summary: null,
								artifactUris: [],
								errorCode: null,
								errorSummary: null,
							},
						],
					})
				);
				return;
			}

			if (
				request.method === "POST" &&
				request.url === "/api/v1/attempts/attempt-secret-001/fail"
			) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "blocked",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:03:00.000Z",
						},
						attempt: {
							id: "attempt-secret-001",
							workUnitId: launchedWorkUnitId,
							batchId: launchedBatchId,
							executorType: "droid",
							status: "failed",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:03:00.000Z",
							summary: null,
							artifactUris: [],
							errorCode: "AUTH_REQUIRED",
							errorSummary: "Credential required before continuing",
						},
					})
				);
				return;
			}

			if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						batch: {
							id: launchedBatchId,
							initiativeId: launchedInitiativeId,
							taskGraphId,
							workUnitIds: [launchedWorkUnitId],
							concurrencyLimit: 1,
							status: "blocked",
							startedAt: "2026-04-18T10:00:00.000Z",
							finishedAt: "2026-04-18T10:03:00.000Z",
						},
						attempts: [
							{
								id: "attempt-secret-001",
								workUnitId: launchedWorkUnitId,
								batchId: launchedBatchId,
								executorType: "droid",
								status: "failed",
								startedAt: "2026-04-18T10:00:00.000Z",
								finishedAt: "2026-04-18T10:03:00.000Z",
								summary: null,
								artifactUris: [],
								errorCode: "AUTH_REQUIRED",
								errorSummary: "Credential required before continuing",
							},
						],
					})
				);
				return;
			}

			response.writeHead(404, { "content-type": "application/json" });
			response.end(JSON.stringify({ detail: "not found" }));
		});

		await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
		const address = kernelServer.address();
		if (!address || typeof address === "string") {
			throw new Error("Kernel test server did not bind to an ephemeral port.");
		}
		process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

		try {
			const createResponse = await postBatches(
				new Request("http://localhost/api/control/orchestration/batches", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						taskGraphId,
						concurrencyLimit: 1,
					}),
				})
			);
			const createBody = await createResponse.json();
			const batchId = createBody.batch.id as string;
			const workUnitId = createBody.workUnits[0].id as string;

			const failResponse = await postSupervisorAction(
				new Request("http://localhost/api/control/orchestration/supervisor/actions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						actionKind: "fail_attempt",
						batchId,
						attemptId: "attempt-secret-001",
						workUnitId,
						errorCode: "AUTH_REQUIRED",
						errorSummary: "Credential required before continuing",
					}),
				})
			);

			expect(failResponse.status).toBe(200);
			const state = await readControlPlaneState();
			const run = state.orchestration.runs.find((candidate) => candidate.initiativeId === initiativeId);
			const pause = state.orchestration.secretPauses[0] ?? null;
			const blockedEvent = state.orchestration.runEvents.find((candidate) => candidate.kind === "run.blocked");

			expect(run?.currentStage).toBe("blocked");
			expect(run?.health).toBe("blocked");
			expect(pause?.kind).toBe("credential_required");
			expect(pause?.message).toMatch(/credential required/i);
			expect(blockedEvent?.payload).toEqual(
				expect.objectContaining({
					kind: "credential_required",
				})
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				kernelServer.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});
});
