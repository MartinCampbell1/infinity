"use client";

import { useCallback, useState, useTransition } from "react";

type ShellManualRefreshOptions = {
  invalidation?: unknown;
};

export function useShellManualRefresh(
  _options: ShellManualRefreshOptions = {}
) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const refresh = useCallback(() => {
    startRefreshTransition(() => {
      setRefreshNonce((value) => value + 1);
    });
  }, [startRefreshTransition]);

  return {
    isRefreshing,
    refresh,
    refreshNonce,
  };
}
