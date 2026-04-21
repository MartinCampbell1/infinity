"use client";

import {
  updateShellOperatorPreferences,
  type ShellPreferences,
  type ShellRefreshProfile,
  type ShellReviewMemoryBucket,
  type ShellReviewMemoryPreferences,
  type ShellReviewPassPreference,
  type ShellReviewPreset,
  type ShellReviewLane,
  type ShellPollSurface,
} from "@founderos/api-clients";
import { useMemo, useSyncExternalStore } from "react";

const SHELL_PREFERENCES_STORAGE_KEY = "founderos.shell.preferences";
const SHELL_PREFERENCES_CHANGE_EVENT = "founderos:shell-preferences-change";

export type {
  ShellPollSurface,
  ShellPreferences,
  ShellRefreshProfile,
  ShellReviewLane,
  ShellReviewMemoryBucket,
  ShellReviewMemoryPreferences,
  ShellReviewPassPreference,
  ShellReviewPreset,
} from "@founderos/api-clients";

export type ShellPreferencesPatch = Partial<
  Omit<ShellPreferences, "reviewMemory">
> & {
  reviewMemory?: Partial<ShellReviewMemoryPreferences>;
};

const DEFAULT_REVIEW_PASS: ShellReviewPassPreference = {
  lane: "all",
  preset: null,
};

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = {
  refreshProfile: "balanced",
  sidebarCollapsed: false,
  reviewMemory: {
    global: DEFAULT_REVIEW_PASS,
    linked: DEFAULT_REVIEW_PASS,
    intakeLinked: DEFAULT_REVIEW_PASS,
    orphanProject: DEFAULT_REVIEW_PASS,
  },
};

export function mergeShellPreferences(
  current: ShellPreferences,
  patch: ShellPreferencesPatch
): ShellPreferences {
  return normalizeShellPreferences({
    ...current,
    ...patch,
    reviewMemory:
      patch.reviewMemory === undefined
        ? current.reviewMemory
        : {
            ...current.reviewMemory,
            ...patch.reviewMemory,
          },
  });
}

const POLL_INTERVALS: Record<string, Record<ShellRefreshProfile, number>> = {
  execution_projects: {
    focused: 3_000,
    balanced: 6_000,
    minimal: 12_000,
  },
  execution_review: {
    focused: 4_000,
    balanced: 8_000,
    minimal: 15_000,
  },
  execution_project_detail: {
    focused: 3_000,
    balanced: 6_000,
    minimal: 12_000,
  },
};

function normalizeReviewPassPreference(
  value?: Partial<ShellReviewPassPreference> | null
): ShellReviewPassPreference {
  return {
    lane: value?.lane ?? DEFAULT_REVIEW_PASS.lane,
    preset: value?.preset ?? DEFAULT_REVIEW_PASS.preset,
  };
}

function normalizeReviewMemoryPreferences(
  value?: Partial<ShellReviewMemoryPreferences> | null
): ShellReviewMemoryPreferences {
  return {
    global: normalizeReviewPassPreference(value?.global),
    linked: normalizeReviewPassPreference(value?.linked),
    intakeLinked: normalizeReviewPassPreference(value?.intakeLinked),
    orphanProject: normalizeReviewPassPreference(value?.orphanProject),
  };
}

function normalizeShellPreferences(
  value?: Partial<ShellPreferences> | null
): ShellPreferences {
  return {
    refreshProfile: value?.refreshProfile ?? DEFAULT_SHELL_PREFERENCES.refreshProfile,
    sidebarCollapsed:
      value?.sidebarCollapsed ?? DEFAULT_SHELL_PREFERENCES.sidebarCollapsed,
    reviewMemory: normalizeReviewMemoryPreferences(value?.reviewMemory),
  };
}

function canUseWindow() {
  return typeof window !== "undefined";
}

function readStoredPreferences(): ShellPreferences {
  if (!canUseWindow() || typeof window.localStorage === "undefined") {
    return DEFAULT_SHELL_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(SHELL_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SHELL_PREFERENCES;
    }
    return normalizeShellPreferences(JSON.parse(raw) as Partial<ShellPreferences>);
  } catch {
    return DEFAULT_SHELL_PREFERENCES;
  }
}

function writeStoredPreferences(nextPreferences: ShellPreferences) {
  if (canUseWindow() && typeof window.localStorage !== "undefined") {
    try {
      window.localStorage.setItem(
        SHELL_PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences)
      );
    } catch {
      // Ignore local storage failures and keep the hook usable.
    }
  }

  if (canUseWindow()) {
    window.dispatchEvent(new Event(SHELL_PREFERENCES_CHANGE_EVENT));
    void updateShellOperatorPreferences(nextPreferences).catch(() => undefined);
  }

  return nextPreferences;
}

function subscribe(listener: () => void) {
  if (!canUseWindow()) {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === SHELL_PREFERENCES_STORAGE_KEY) {
      listener();
    }
  };
  const onChange = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(SHELL_PREFERENCES_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SHELL_PREFERENCES_CHANGE_EVENT, onChange);
  };
}

function getClientSnapshot() {
  return readStoredPreferences();
}

export function updateShellPreferences(
  patch: ShellPreferencesPatch
): ShellPreferences {
  const current = readStoredPreferences();
  return writeStoredPreferences(mergeShellPreferences(current, patch));
}

export function getShellPollInterval(
  surface: ShellPollSurface | string,
  refreshProfile: ShellRefreshProfile
) {
  const profileIntervals = POLL_INTERVALS[String(surface)];
  if (profileIntervals) {
    return profileIntervals[refreshProfile];
  }

  if (refreshProfile === "focused") {
    return 4_000;
  }
  if (refreshProfile === "minimal") {
    return 15_000;
  }
  return 8_000;
}

export function useShellPreferences(initialPreferences?: ShellPreferences) {
  const serverSnapshot = useMemo(
    () => normalizeShellPreferences(initialPreferences ?? DEFAULT_SHELL_PREFERENCES),
    [initialPreferences]
  );
  const getServerSnapshot = () => serverSnapshot;
  const preferences = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  return {
    preferences,
    updatePreferences: updateShellPreferences,
  };
}
