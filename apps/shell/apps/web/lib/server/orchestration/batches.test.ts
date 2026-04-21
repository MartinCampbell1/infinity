import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { afterEach, describe, expect, test } from "vitest";

import { getExecutionKernelAvailability } from "./batches";

const ORIGINAL_EXECUTION_KERNEL_BASE_URL = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;

afterEach(() => {
  if (ORIGINAL_EXECUTION_KERNEL_BASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = ORIGINAL_EXECUTION_KERNEL_BASE_URL;
  }
});

describe("getExecutionKernelAvailability", () => {
  test("reports the execution kernel as available when healthz responds", async () => {
    const kernelServer = createServer(
      (_request: IncomingMessage, response: ServerResponse) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            status: "ok",
            service: "execution-kernel",
            generatedAt: "2026-04-20T12:00:00.000Z",
          })
        );
      }
    );

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel health test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const availability = await getExecutionKernelAvailability();

      expect(availability).toEqual({
        available: true,
        baseUrl: `http://127.0.0.1:${address.port}`,
        detail: "execution-kernel is reachable.",
        generatedAt: "2026-04-20T12:00:00.000Z",
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("reports the execution kernel as unavailable when the port is closed", async () => {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = "http://127.0.0.1:65530";

    const availability = await getExecutionKernelAvailability();

    expect(availability.available).toBe(false);
    expect(availability.baseUrl).toBe("http://127.0.0.1:65530");
    expect(availability.detail).toContain("Kernel is offline");
    expect(availability.detail).toContain("./services/execution-kernel/scripts/run-local.sh");
    expect(availability.generatedAt).toBeNull();
  });
});
