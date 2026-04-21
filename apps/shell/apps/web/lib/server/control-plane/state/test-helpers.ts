import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { resetControlPlaneStateForTests } from "./store";

const TEMP_STATE_DIR_PREFIX = "infinity-control-plane-state-";
const CONTROL_PLANE_DB_ENV_KEYS = [
  "FOUNDEROS_CONTROL_PLANE_DATABASE_URL",
  "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL",
] as const;

export function createIsolatedControlPlaneStateDir() {
  const originalStateDir = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  const originalDbEnv = Object.fromEntries(
    CONTROL_PLANE_DB_ENV_KEYS.map((key) => [key, process.env[key]])
  ) as Record<(typeof CONTROL_PLANE_DB_ENV_KEYS)[number], string | undefined>;
  const directory = mkdtempSync(path.join(tmpdir(), TEMP_STATE_DIR_PREFIX));

  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = directory;
  for (const key of CONTROL_PLANE_DB_ENV_KEYS) {
    delete process.env[key];
  }
  resetControlPlaneStateForTests();

  return {
    directory,
    restore() {
      resetControlPlaneStateForTests();

      if (originalStateDir === undefined) {
        delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
      } else {
        process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = originalStateDir;
      }

      for (const key of CONTROL_PLANE_DB_ENV_KEYS) {
        const value = originalDbEnv[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }

      rmSync(directory, { recursive: true, force: true });
    },
  };
}
