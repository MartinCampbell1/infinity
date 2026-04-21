#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_critic_payload(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    required_top_level = {"overall_score", "cluster_scores", "findings", "pass"}
    missing = sorted(required_top_level - set(payload.keys()))
    if missing:
        raise ValueError(f"Critic JSON is missing required keys: {', '.join(missing)}")

    cluster_scores = payload["cluster_scores"]
    if not isinstance(cluster_scores, dict):
        raise ValueError("cluster_scores must be an object")

    findings = payload["findings"]
    if not isinstance(findings, list):
        raise ValueError("findings must be an array")

    return payload


def render_markdown(critic: dict) -> str:
    status = "GO" if critic.get("pass") else "NO-GO"
    return (
        "# Critic Report Iteration 0\n\n"
        f"Status: {status}\n\n"
        "```json\n"
        f"{json.dumps(critic, indent=2)}\n"
        "```\n"
    )


def render_fix_log(critic: dict) -> str:
    findings = critic.get("findings") or []
    if not findings:
        return "# Fix Log Iteration 0\n\nNo critic findings required changes.\n"

    lines = [
        "# Fix Log Iteration 0",
        "",
        "External critic findings still require changes:",
        "",
    ]
    for index, finding in enumerate(findings, start=1):
        severity = finding.get("severity", "unknown")
        screen_id = finding.get("screen_id", "unknown")
        problem = finding.get("problem", "")
        lines.append(f"{index}. [{severity}] `{screen_id}` — {problem}".rstrip())
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--critic-json", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    critic_json_path = Path(args.critic_json).resolve()

    if not run_dir.is_dir():
        raise SystemExit(f"Run dir does not exist: {run_dir}")
    if not critic_json_path.is_file():
        raise SystemExit(f"Critic JSON does not exist: {critic_json_path}")

    critic = load_critic_payload(critic_json_path)
    report_payload = {
        "status": "completed_external_critic",
        "run_id": run_dir.name,
        "generated_at": now_iso(),
        "critic": critic,
    }

    (run_dir / "critic-report-iteration-0.json").write_text(
        json.dumps(report_payload, indent=2) + "\n",
        encoding="utf-8",
    )
    (run_dir / "critic-report-iteration-0.md").write_text(
        render_markdown(critic),
        encoding="utf-8",
    )
    (run_dir / "fix-log-iteration-0.md").write_text(
        render_fix_log(critic),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "run_dir": str(run_dir),
                "critic_json": str(critic_json_path),
                "pass": bool(critic.get("pass")),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
