"use client";

import React, { useState } from "react";

export function DeliveryProofCopyButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/58 transition hover:border-white/16 hover:text-white"
      aria-label={`Copy ${label}`}
      data-copy-proof-label={label}
      data-copy-value={value}
      onClick={() => void copyValue()}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
