import { describe, expect, test } from "vitest";

import {
  DEFAULT_SHELL_PREFERENCES,
  mergeShellPreferences,
} from "./shell-preferences";

describe("mergeShellPreferences", () => {
  test("preserves untouched reviewMemory buckets on partial nested updates", () => {
    const merged = mergeShellPreferences(DEFAULT_SHELL_PREFERENCES, {
      reviewMemory: {
        linked: {
          lane: "critical",
          preset: "critical-pass",
        },
      },
    });

    expect(merged.reviewMemory.linked).toEqual({
      lane: "critical",
      preset: "critical-pass",
    });
    expect(merged.reviewMemory.global).toEqual(
      DEFAULT_SHELL_PREFERENCES.reviewMemory.global
    );
    expect(merged.reviewMemory.intakeLinked).toEqual(
      DEFAULT_SHELL_PREFERENCES.reviewMemory.intakeLinked
    );
    expect(merged.reviewMemory.orphanProject).toEqual(
      DEFAULT_SHELL_PREFERENCES.reviewMemory.orphanProject
    );
  });
});
