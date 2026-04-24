#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def load_validation_module() -> Any:
    module_path = Path(__file__).with_name("run_infinity_validation.py")
    spec = importlib.util.spec_from_file_location("run_infinity_validation", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load validation module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def refresh_release_readiness(run_dir: Path, critic_report_path: Path) -> None:
    functional_report_path = run_dir / "functional-report.json"
    if not functional_report_path.is_file():
        return

    validation = load_validation_module()
    report = json.loads(functional_report_path.read_text(encoding="utf-8"))
    checks = [
        validation.CheckResult(
            name=str(item.get("name", "unknown")),
            status=str(item.get("status", "unknown")),
            detail=item.get("detail") if isinstance(item.get("detail"), str) else None,
        )
        for item in report.get("checks", [])
        if isinstance(item, dict)
    ]

    critic_state = json.loads(critic_report_path.read_text(encoding="utf-8"))
    critic_state["report_path"] = str(critic_report_path)
    release_layers = validation.build_release_readiness(
        functional_status=str(report.get("status", "unknown")),
        checks=checks,
        browser_e2e=report.get("browser_e2e")
        if isinstance(report.get("browser_e2e"), dict)
        else {},
        critic=critic_state,
    )

    report["release_status"] = release_layers["release_readiness"]["legacy_status"]
    report["repo_checks"] = release_layers["repo_checks"]
    report["browser_product_e2e"] = release_layers["browser_product_e2e"]
    report["critic"] = release_layers["critic"]
    report["release_readiness"] = release_layers["release_readiness"]
    report["critic_finalized_at"] = now_iso()
    functional_report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    refresh_markdown_summary(
        run_dir / "functional-report.md",
        {
            "Release status:": f"Release status: `{report['release_status']}`",
            "Release readiness:": (
                f"Release readiness: `{release_layers['release_readiness']['status']}`"
            ),
            "- critic:": f"- critic: `{release_layers['critic']['status']}`",
            "- release_readiness:": (
                f"- release_readiness: `{release_layers['release_readiness']['status']}`"
            ),
            "- blocking reasons:": (
                "- blocking reasons: "
                f"`{', '.join(release_layers['release_readiness']['blocking_reasons']) or 'none'}`"
            ),
        },
    )
    refresh_markdown_summary(
        run_dir / "final-validation-summary.md",
        {
            "Status:": f"Status: `{report['release_status']}`",
            "Critic status:": f"Critic status: `{release_layers['critic']['status']}`",
            "Release readiness:": (
                f"Release readiness: `{release_layers['release_readiness']['status']}`"
            ),
            "Release blocking reasons:": (
                "Release blocking reasons: "
                f"`{', '.join(release_layers['release_readiness']['blocking_reasons']) or 'none'}`"
            ),
        },
    )


def refresh_markdown_summary(path: Path, replacements: dict[str, str]) -> None:
    if not path.is_file():
        return

    lines = path.read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    next_lines: list[str] = []
    for line in lines:
        matched_prefix = next(
            (prefix for prefix in replacements if line.startswith(prefix)),
            None,
        )
        if matched_prefix is None:
            next_lines.append(line)
            continue
        next_lines.append(replacements[matched_prefix])
        seen.add(matched_prefix)

    missing_lines = [
        replacements[prefix] for prefix in replacements if prefix not in seen
    ]
    if missing_lines:
        if next_lines and next_lines[-1] != "":
            next_lines.append("")
        next_lines.extend(missing_lines)
    path.write_text("\n".join(next_lines) + "\n", encoding="utf-8")


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

    critic_report_path = run_dir / "critic-report-iteration-0.json"
    critic_report_path.write_text(
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
    refresh_release_readiness(run_dir, critic_report_path)

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
