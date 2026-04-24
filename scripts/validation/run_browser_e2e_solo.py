#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests
from playwright.sync_api import sync_playwright

from run_infinity_validation import (
    CANONICAL_KERNEL_PORT,
    CANONICAL_SHELL_PORT,
    ROOT,
    ManagedProcess,
    ScreenshotRecord,
    ValidationFailure,
    capture_screenshot,
    now_iso,
    request_json,
    wait_for_autonomous_delivery,
    wait_http,
    with_node_memory,
    write_json,
    write_text,
)


BROWSER_E2E_ROOT = ROOT / "handoff-packets" / "browser-e2e"
DEFAULT_PROMPT = (
    "Build a tiny tip calculator for a dinner bill with bill amount and tip "
    "percent inputs, visible tip amount, and visible total with tip."
)
PLACEHOLDER_MARKERS = (
    "truthful runnable delivery bundle",
    "shell evidence wrapper",
    "localhost wrapper preview",
    "wrapper evidence",
)


def browser_run_id() -> str:
    return "browser-e2e-" + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def choose_port(preferred: int, *, span: int = 40) -> int:
    if port_available(preferred):
        return preferred
    for port in range(preferred + 1, preferred + span + 1):
        if port_available(port):
            return port
    raise ValidationFailure(
        f"No free localhost port found near {preferred}; stop conflicting services and retry."
    )


def absolute_url(origin: str, value: str | None) -> str:
    if not value:
        raise ValidationFailure("Expected URL value is empty.")
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/"):
        return origin + value
    return origin + "/" + value


def run_logged_command(
    name: str,
    command: list[str],
    cwd: Path,
    logs_dir: Path,
    *,
    env: dict[str, str] | None = None,
    timeout_seconds: int = 600,
) -> None:
    log_path = logs_dir / f"{name}.log"
    started = time.time()
    with log_path.open("w", encoding="utf-8") as log_file:
        process = subprocess.run(
            command,
            cwd=str(cwd),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            timeout=timeout_seconds,
            check=False,
        )
    duration = time.time() - started
    if process.returncode != 0:
        raise ValidationFailure(
            f"{name} failed with exit {process.returncode} after {duration:.2f}s. Log: {log_path}"
        )


def build_artifact_info(build_id_path: Path, logs_dir: Path, mode: str) -> dict[str, Any]:
    build_id = build_id_path.read_text(encoding="utf-8").strip() if build_id_path.exists() else None
    build_mtime = (
        datetime.fromtimestamp(build_id_path.stat().st_mtime, timezone.utc).isoformat()
        if build_id_path.exists()
        else None
    )
    return {
        "mode": mode,
        "build_id": build_id,
        "build_id_path": str(build_id_path),
        "build_id_mtime": build_mtime,
        "build_log_path": str(logs_dir / "shell_build.log"),
    }


def ensure_shell_build(logs_dir: Path, reuse_existing: bool) -> dict[str, Any]:
    build_id_path = ROOT / "apps" / "shell" / "apps" / "web" / ".next" / "BUILD_ID"
    if build_id_path.exists() and reuse_existing:
        return build_artifact_info(build_id_path, logs_dir, "reused")
    run_logged_command(
        "shell_build",
        ["npm", "run", "build", "--workspace", "@founderos/web"],
        ROOT,
        logs_dir,
        env=with_node_memory(None, 1280),
        timeout_seconds=900,
    )
    if not build_id_path.exists():
        raise ValidationFailure("Shell build completed without producing .next/BUILD_ID.")
    return build_artifact_info(build_id_path, logs_dir, "rebuilt")



def snapshot_api(
    method: str,
    url: str,
    api_snapshots_dir: Path,
    name: str,
    payload: dict[str, Any] | None = None,
    *,
    expected_statuses: tuple[int, ...] = (200, 201),
) -> dict[str, Any]:
    response = requests.request(method, url, json=payload, timeout=(3, 45))
    content_type = response.headers.get("content-type", "")
    try:
        response_body: Any = response.json()
    except ValueError:
        response_body = response.text
    snapshot = {
        "request": {
            "method": method,
            "url": url,
            "payload": payload,
        },
        "response": {
            "status": response.status_code,
            "content_type": content_type,
            "body": response_body,
        },
        "captured_at": now_iso(),
    }
    write_json(api_snapshots_dir / f"{name}.json", snapshot)
    if response.status_code not in expected_statuses:
        raise ValidationFailure(
            f"Unexpected status from {method} {url}: {response.status_code}. Snapshot: {api_snapshots_dir / f'{name}.json'}"
        )
    return response_body if isinstance(response_body, dict) else {"body": response_body}


def capture_dom(page, dom_snapshots_dir: Path, screen_id: str) -> None:
    write_text(dom_snapshots_dir / f"{screen_id}.html", page.content())
    body_text = page.locator("body").inner_text(timeout=10_000)
    write_text(dom_snapshots_dir / f"{screen_id}.txt", body_text)


def capture_phase(
    page,
    screen_id: str,
    screenshots: list[ScreenshotRecord],
    screenshots_dir: Path,
    dom_snapshots_dir: Path,
    *,
    scenario: str = "browser_e2e_solo",
    notes: str | None = None,
) -> None:
    capture_screenshot(
        page,
        screen_id,
        str(screenshots_dir / f"{screen_id}.png"),
        screenshots,
        page.url,
        scenario,
        notes=notes,
    )
    capture_dom(page, dom_snapshots_dir, screen_id)


def assert_visible_text(page, text: str, phase: str) -> None:
    try:
        page.get_by_text(text, exact=False).first.wait_for(timeout=20_000)
    except Exception as error:
        raise ValidationFailure(
            f"Run page did not expose `{text}` during {phase}."
        ) from error


def assert_run_page_has_task_inspection(page, phase: str) -> None:
    for text in ("Open brief", "Open task graph", "Task t", "Executor", "Attempts"):
        assert_visible_text(page, text, phase)


def assert_run_page_has_attempt_inspection(page, phase: str) -> None:
    for text in ("Open batch", "Attempt"):
        assert_visible_text(page, text, phase)


def assert_run_page_has_completed_attempt_evidence(page, phase: str) -> None:
    try:
        page.get_by_text(re.compile(r"Evidence .*\.json"), exact=False).first.wait_for(
            timeout=20_000
        )
    except Exception as error:
        raise ValidationFailure(
            f"Run page did not expose completed attempt evidence during {phase}."
        ) from error


def assert_delivery_page_has_runnable_proof(page, delivery_id: str) -> None:
    required_labels = [
        "Result summary",
        "Preview URL",
        "Manifest path",
        "Local output path",
        "Launch command",
        "Proof kind",
        "Source work units",
        "runnable_result",
    ]
    normalized_required_labels = [label.lower() for label in required_labels]
    try:
        page.wait_for_function(
            """({ deliveryId, labels }) =>
                window.location.pathname.includes(`/execution/delivery/${deliveryId}`) &&
                labels.every((label) => document.body.innerText.toLowerCase().includes(label))
            """,
            arg={"deliveryId": delivery_id, "labels": normalized_required_labels},
            timeout=20_000,
        )
    except Exception as error:
        body_text = page.locator("body").inner_text(timeout=10_000)
        normalized_body_text = body_text.lower()
        missing = [
            label
            for label, normalized_label in zip(required_labels, normalized_required_labels)
            if normalized_label not in normalized_body_text
        ]
        raise ValidationFailure(
            f"Delivery page did not expose runnable-result proof fields at {page.url}: {', '.join(missing)}. "
            f"Body excerpt: {body_text[:700]}"
        ) from error
    body_text = page.locator("body").inner_text(timeout=10_000)
    normalized_body_text = body_text.lower()
    missing = [
        label
        for label, normalized_label in zip(required_labels, normalized_required_labels)
        if normalized_label not in normalized_body_text
    ]
    if missing:
        raise ValidationFailure(
            f"Delivery page did not expose runnable-result proof fields at {page.url}: {', '.join(missing)}"
        )


def fetch_continuity_snapshot(
    shell_origin: str,
    initiative_id: str,
    api_snapshots_dir: Path,
    name: str,
) -> dict[str, Any]:
    return snapshot_api(
        "GET",
        f"{shell_origin}/api/control/orchestration/continuity/{initiative_id}",
        api_snapshots_dir,
        name,
    )


def assert_not_blocked(continuity: dict[str, Any]) -> None:
    initiative = continuity.get("initiative")
    verification = continuity.get("verification")
    delivery = continuity.get("delivery")
    recoveries = continuity.get("relatedRecoveries")
    if isinstance(initiative, dict) and initiative.get("status") in {"failed", "cancelled"}:
        raise ValidationFailure(
            f"Run entered terminal status `{initiative.get('status')}` before delivery."
        )
    if isinstance(verification, dict) and verification.get("overallStatus") == "failed":
        raise ValidationFailure("Run produced a failed verification before browser E2E delivery.")
    if isinstance(delivery, dict) and delivery.get("status") in {"blocked", "failed"}:
        raise ValidationFailure(
            f"Run produced blocked delivery status `{delivery.get('status')}`."
        )
    if isinstance(recoveries, list):
        open_recoveries = [
            recovery
            for recovery in recoveries
            if isinstance(recovery, dict)
            and recovery.get("status") in {"open", "retryable"}
        ]
        if open_recoveries:
            raise ValidationFailure(
                f"Run opened recovery incidents before delivery: {[item.get('id') for item in open_recoveries]}"
            )


def wait_for_stage(
    shell_origin: str,
    initiative_id: str,
    api_snapshots_dir: Path,
    name: str,
    predicate: Callable[[dict[str, Any]], bool],
    *,
    timeout_seconds: int = 90,
) -> dict[str, Any]:
    started = time.time()
    latest: dict[str, Any] | None = None
    while time.time() - started < timeout_seconds:
        latest = fetch_continuity_snapshot(shell_origin, initiative_id, api_snapshots_dir, name)
        assert_not_blocked(latest)
        if predicate(latest):
            return latest
        time.sleep(1)
    raise ValidationFailure(
        f"Timed out waiting for stage `{name}` for initiative {initiative_id}. Latest snapshot: {latest}"
    )


def run_id_from_url(url: str) -> str | None:
    match = re.search(r"/execution/runs/([^?/#]+)", url)
    return match.group(1) if match else None


def summarize_attempts_by_work_unit(
    shell_origin: str,
    batch_ids: list[str],
    api_snapshots_dir: Path,
) -> dict[str, list[dict[str, Any]]]:
    attempts_by_work_unit: dict[str, list[dict[str, Any]]] = {}
    for batch_id in batch_ids:
        detail = snapshot_api(
            "GET",
            f"{shell_origin}/api/control/orchestration/batches/{batch_id}",
            api_snapshots_dir,
            f"batch-{batch_id}",
        )
        for attempt in detail.get("attempts", []):
            if not isinstance(attempt, dict):
                continue
            work_unit_id = str(attempt.get("workUnitId") or "")
            if not work_unit_id:
                continue
            attempts_by_work_unit.setdefault(work_unit_id, []).append(attempt)
    return attempts_by_work_unit


def summarize_work_units(
    task_graph_detail: dict[str, Any],
    attempts_by_work_unit: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    summarized: list[dict[str, Any]] = []
    for work_unit in task_graph_detail.get("workUnits", []):
        if not isinstance(work_unit, dict):
            continue
        work_unit_id = str(work_unit.get("id") or "")
        attempts = attempts_by_work_unit.get(work_unit_id, [])
        artifact_paths: list[str] = []
        for attempt in attempts:
            for uri in attempt.get("artifactUris", []) or []:
                if isinstance(uri, str):
                    artifact_paths.append(uri)
        summarized.append(
            {
                "id": work_unit_id,
                "status": work_unit.get("status"),
                "executor": work_unit.get("executorType"),
                "attempt_ids": [
                    str(attempt.get("id"))
                    for attempt in attempts
                    if isinstance(attempt.get("id"), str)
                ],
                "artifact_paths": artifact_paths,
            }
        )
    return summarized


def artifact_paths_by_work_unit(continuity: dict[str, Any]) -> dict[str, list[str]]:
    assembly = continuity.get("assembly")
    artifact_uris = (
        assembly.get("artifactUris", [])
        if isinstance(assembly, dict)
        else []
    )
    task_graphs = continuity.get("taskGraphs", [])
    work_unit_ids: list[str] = []
    if isinstance(task_graphs, list) and task_graphs:
        node_ids = task_graphs[0].get("nodeIds", []) if isinstance(task_graphs[0], dict) else []
        work_unit_ids = [str(node_id) for node_id in node_ids if isinstance(node_id, str)]

    paths_by_unit: dict[str, list[str]] = {work_unit_id: [] for work_unit_id in work_unit_ids}
    for artifact_uri in artifact_uris:
        if not isinstance(artifact_uri, str):
            continue
        for work_unit_id in work_unit_ids:
            if work_unit_id in artifact_uri:
                paths_by_unit.setdefault(work_unit_id, []).append(artifact_uri)
                break
    return paths_by_unit


def merge_artifact_paths(
    work_units: list[dict[str, Any]],
    paths_by_unit: dict[str, list[str]],
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for work_unit in work_units:
        work_unit_id = str(work_unit.get("id") or "")
        current_paths = [
            path
            for path in work_unit.get("artifact_paths", [])
            if isinstance(path, str)
        ]
        extra_paths = paths_by_unit.get(work_unit_id, [])
        work_unit["artifact_paths"] = sorted(set(current_paths + extra_paths))
        merged.append(work_unit)
    return merged


def assert_preview_not_placeholder(preview_html: str) -> dict[str, bool]:
    normalized = preview_html.lower()
    assertions = {
        "has_tip_calculator": "tip calculator" in normalized,
        "has_bill_amount_input": 'id="bill-amount"' in normalized,
        "has_tip_percent_input": 'id="tip-percent"' in normalized,
        "has_runnable_app_marker": "__infinity_runnable_app__" in normalized,
        "not_placeholder": not any(marker in normalized for marker in PLACEHOLDER_MARKERS),
    }
    failed = [key for key, value in assertions.items() if not value]
    if failed:
        raise ValidationFailure(
            f"Preview did not satisfy runnable app DOM assertions: {failed}"
        )
    return assertions


def interact_with_tip_preview(page) -> dict[str, Any]:
    page.fill("#bill-amount", "100")
    page.fill("#tip-percent", "20")
    page.wait_for_timeout(250)
    tip_amount = page.locator("#tip-amount").inner_text(timeout=5_000).strip()
    total = page.locator("#tip-result").inner_text(timeout=5_000).strip()
    assertions = {
        "bill_amount_100_tip_20": tip_amount == "$20.00" and total == "$120.00",
    }
    if not all(assertions.values()):
        raise ValidationFailure(
            f"Preview interaction failed: tip amount={tip_amount!r}, total={total!r}."
        )
    return {
        "assertions": assertions,
        "observed": {
            "tip_amount": tip_amount,
            "total_with_tip": total,
        },
    }


def restart_shell_process(
    processes: list[ManagedProcess],
    shell_env: dict[str, str],
    logs_dir: Path,
    shell_origin: str,
) -> None:
    for process in list(processes):
        if process.name != "shell":
            continue
        process.terminate()
        processes.remove(process)
        break

    processes.append(
        ManagedProcess(
            "shell_restart",
            ["npm", "run", "start", "--workspace", "@founderos/web"],
            ROOT,
            shell_env,
            logs_dir,
        )
    )
    wait_http(f"{shell_origin}/", timeout_seconds=90)


def write_manual_checklist(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# Browser E2E Manual Checklist",
        "",
        f"Run ID: `{report.get('run_id')}`",
        f"Status: `{report.get('status')}`",
        f"Prompt: `{report.get('prompt')}`",
        "",
        "## Checks",
        "",
        "- Root `/` opened in a real browser context.",
        "- A fresh prompt was submitted through the frontdoor composer.",
        "- Primary run surface showed the created run.",
        "- Task graph, batch attempts, assembly, verification, and delivery were observed through product APIs.",
        "- Delivery page opened from the generated delivery record.",
        "- Preview opened from the generated preview URL.",
        "- Preview was rejected if it was only a generic placeholder.",
        "- Tip calculator interaction produced `$20.00` and `$120.00` for 100 at 20%.",
        "- The managed shell was restarted and the same ready delivery remained visible.",
        "",
        "## Artifacts",
        "",
        f"- Screenshots: `{report['artifacts']['screenshots_dir']}`",
        f"- DOM snapshots: `{report['artifacts']['dom_snapshots_dir']}`",
        f"- API snapshots: `{report['artifacts']['api_snapshots_dir']}`",
    ]
    write_text(path, "\n".join(lines) + "\n")


def run_browser_e2e_solo(args: argparse.Namespace) -> int:
    started_at = now_iso()
    validation_run_id = browser_run_id()
    run_dir = BROWSER_E2E_ROOT / validation_run_id
    logs_dir = run_dir / "logs"
    screenshots_dir = run_dir / "screenshots"
    dom_snapshots_dir = run_dir / "dom-snapshots"
    api_snapshots_dir = run_dir / "api-snapshots"
    for path in (logs_dir, screenshots_dir, dom_snapshots_dir, api_snapshots_dir):
        path.mkdir(parents=True, exist_ok=True)

    shell_port = choose_port(args.shell_port)
    kernel_port = choose_port(args.kernel_port)
    shell_origin = f"http://127.0.0.1:{shell_port}"
    kernel_origin = f"http://127.0.0.1:{kernel_port}"
    state_dir = Path(tempfile.mkdtemp(prefix="infinity-browser-e2e-state-"))
    prompt = f"{args.prompt.strip()} Run {validation_run_id}."

    screenshots: list[ScreenshotRecord] = []
    processes: list[ManagedProcess] = []
    report: dict[str, Any] = {
        "run_id": validation_run_id,
        "started_at": started_at,
        "finished_at": None,
        "status": "failed",
        "prompt": prompt,
        "initiative_id": None,
        "session_id": None,
        "task_graph_id": None,
        "batch_ids": [],
        "work_units": [],
        "verification": None,
        "delivery": None,
        "preview": None,
        "ui_inspection": {
            "task_graph_cards_visible": False,
            "attempt_labels_visible": False,
            "completed_attempt_evidence_visible": False,
        },
        "restart_continuity": None,
        "artifacts": {
            "screenshots_dir": str(screenshots_dir),
            "dom_snapshots_dir": str(dom_snapshots_dir),
            "api_snapshots_dir": str(api_snapshots_dir),
            "manual_checklist_path": str(run_dir / "manual-browser-checklist.md"),
            "screenshot_manifest_path": str(run_dir / "screenshot-manifest.json"),
            "logs_dir": str(logs_dir),
            "shell_build_log_path": str(logs_dir / "shell_build.log"),
            "shell_url": shell_origin,
            "kernel_url": kernel_origin,
            "state_snapshot_path": str(api_snapshots_dir / "final-control-plane-state.json"),
        },
        "port_fallbacks": {
            "shell_requested": args.shell_port,
            "shell_actual": shell_port,
            "kernel_requested": args.kernel_port,
            "kernel_actual": kernel_port,
        },
    }

    try:
        report["build"] = ensure_shell_build(
            logs_dir,
            reuse_existing=args.reuse_build and not args.force_build,
        )

        kernel_env = os.environ.copy()
        kernel_env["EXECUTION_KERNEL_ADDR"] = f"127.0.0.1:{kernel_port}"
        processes.append(
            ManagedProcess(
                "kernel",
                ["go", "run", "./cmd/execution-kernel"],
                ROOT / "services" / "execution-kernel",
                kernel_env,
                logs_dir,
            )
        )

        shell_env = os.environ.copy()
        shell_env["FOUNDEROS_EXECUTION_KERNEL_BASE_URL"] = kernel_origin
        shell_env["FOUNDEROS_CONTROL_PLANE_STATE_DIR"] = str(state_dir)
        shell_env["FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS"] = "0"
        shell_env["FOUNDEROS_WEB_PORT"] = str(shell_port)
        shell_env["FOUNDEROS_SHELL_PUBLIC_ORIGIN"] = shell_origin
        processes.append(
            ManagedProcess(
                "shell",
                ["npm", "run", "start", "--workspace", "@founderos/web"],
                ROOT,
                shell_env,
                logs_dir,
            )
        )

        wait_http(f"{kernel_origin}/healthz", timeout_seconds=90)
        wait_http(f"{shell_origin}/", timeout_seconds=90)

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 1200})
            page = context.new_page()
            try:
                page.goto(f"{shell_origin}/", wait_until="networkidle")
                page.wait_for_selector("text=Start an autonomous run", timeout=20_000)
                capture_phase(
                    page,
                    "01-root-frontdoor",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Root product entry before submitting a fresh prompt.",
                )

                page.fill("textarea", prompt)
                page.click('button:has-text("Start run")')
                initiative_id = None
                deadline = time.time() + 30
                while time.time() < deadline:
                    initiative_id = run_id_from_url(page.url)
                    if initiative_id:
                        break
                    page.wait_for_timeout(300)
                if not initiative_id:
                    raise ValidationFailure(
                        "Frontdoor prompt submit did not navigate to /execution/runs/[initiativeId]."
                    )

                report["initiative_id"] = initiative_id
                page.wait_for_load_state("networkidle")
                capture_phase(
                    page,
                    "02-primary-run-created",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Primary run surface after browser-submitted prompt.",
                )

                task_graph_continuity = wait_for_stage(
                    shell_origin,
                    initiative_id,
                    api_snapshots_dir,
                    "03-continuity-task-graph",
                    lambda continuity: bool(continuity.get("taskGraphs")),
                )
                session_id = str(
                    task_graph_continuity.get("initiative", {}).get("workspaceSessionId") or ""
                )
                report["session_id"] = session_id or None
                task_graph_id = str(task_graph_continuity["taskGraphs"][0]["id"])
                report["task_graph_id"] = task_graph_id
                page.goto(f"{shell_origin}/execution/runs/{initiative_id}", wait_until="networkidle")
                assert_run_page_has_task_inspection(page, "task graph planning")
                report["ui_inspection"]["task_graph_cards_visible"] = True
                capture_phase(
                    page,
                    "03-task-graph-visible",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes=f"Task graph {task_graph_id} exists for the run.",
                )

                work_units_continuity = wait_for_stage(
                    shell_origin,
                    initiative_id,
                    api_snapshots_dir,
                    "04-continuity-work-units",
                    lambda continuity: bool(continuity.get("batches")),
                )
                batch_ids = [
                    str(batch.get("id"))
                    for batch in work_units_continuity.get("batches", [])
                    if isinstance(batch, dict) and batch.get("id")
                ]
                report["batch_ids"] = batch_ids
                task_graph_detail = snapshot_api(
                    "GET",
                    f"{shell_origin}/api/control/orchestration/task-graphs/{task_graph_id}",
                    api_snapshots_dir,
                    "04-task-graph-detail",
                )
                attempts_by_work_unit = summarize_attempts_by_work_unit(
                    shell_origin,
                    batch_ids,
                    api_snapshots_dir,
                )
                report["work_units"] = summarize_work_units(
                    task_graph_detail,
                    attempts_by_work_unit,
                )
                if not report["work_units"]:
                    raise ValidationFailure("Task graph did not expose work units.")
                if not all(item["attempt_ids"] for item in report["work_units"]):
                    raise ValidationFailure("At least one work unit has no recorded attempt.")
                page.goto(f"{shell_origin}/execution/runs/{initiative_id}", wait_until="networkidle")
                assert_run_page_has_task_inspection(page, "work-unit attempts")
                assert_run_page_has_attempt_inspection(page, "work-unit attempts")
                report["ui_inspection"]["attempt_labels_visible"] = True
                capture_phase(
                    page,
                    "04-work-units-attempts-visible",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Run surface after work units and attempts were recorded.",
                )

                verified_continuity = wait_for_stage(
                    shell_origin,
                    initiative_id,
                    api_snapshots_dir,
                    "05-continuity-verification",
                    lambda continuity: isinstance(continuity.get("assembly"), dict)
                    and continuity["assembly"].get("status") == "assembled"
                    and isinstance(continuity.get("verification"), dict)
                    and continuity["verification"].get("overallStatus") == "passed",
                    timeout_seconds=180,
                )
                verification = verified_continuity.get("verification")
                report["verification"] = {
                    "id": verification.get("id") if isinstance(verification, dict) else None,
                    "overall_status": verification.get("overallStatus")
                    if isinstance(verification, dict)
                    else None,
                    "failed_checks": verification.get("failedChecks", [])
                    if isinstance(verification, dict)
                    else [],
                }
                page.goto(f"{shell_origin}/execution/runs/{initiative_id}", wait_until="networkidle")
                assert_run_page_has_completed_attempt_evidence(page, "assembly verification")
                report["ui_inspection"]["completed_attempt_evidence_visible"] = True
                capture_phase(
                    page,
                    "05-assembly-verification-visible",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Run surface after assembly and passed verification.",
                )

                final_continuity = wait_for_autonomous_delivery(
                    shell_origin,
                    state_dir,
                    initiative_id,
                    timeout_seconds=180,
                )
                write_json(api_snapshots_dir / "06-continuity-delivery-ready.json", final_continuity)
                assert_not_blocked(final_continuity)
                delivery = final_continuity.get("delivery")
                if not isinstance(delivery, dict):
                    raise ValidationFailure("Final continuity snapshot has no delivery record.")
                report["work_units"] = merge_artifact_paths(
                    report["work_units"],
                    artifact_paths_by_work_unit(final_continuity),
                )
                missing_artifacts = [
                    item["id"]
                    for item in report["work_units"]
                    if not item.get("artifact_paths")
                ]
                if missing_artifacts:
                    raise ValidationFailure(
                        f"Final report has work units without artifact paths: {missing_artifacts}"
                    )
                if delivery.get("status") != "ready":
                    raise ValidationFailure(f"Delivery did not become ready: {delivery.get('status')}")
                if delivery.get("launchProofKind") != "runnable_result":
                    raise ValidationFailure(
                        f"Delivery launch proof is not runnable_result: {delivery.get('launchProofKind')}"
                    )
                preview_url = absolute_url(shell_origin, str(delivery.get("previewUrl") or ""))
                report["delivery"] = {
                    "id": delivery.get("id"),
                    "status": delivery.get("status"),
                    "launch_proof_kind": delivery.get("launchProofKind"),
                    "manifest_path": delivery.get("launchManifestPath"),
                    "preview_url": preview_url,
                }

                delivery_url = (
                    f"{shell_origin}/execution/delivery/{delivery['id']}?initiative_id={initiative_id}"
                )
                page.goto(delivery_url, wait_until="domcontentloaded", timeout=60_000)
                assert_delivery_page_has_runnable_proof(page, str(delivery["id"]))
                capture_phase(
                    page,
                    "06-delivery-ready",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Delivery route opened from the generated delivery record.",
                )

                preview_response = requests.get(preview_url, timeout=(3, 30))
                write_json(
                    api_snapshots_dir / "07-preview-response.json",
                    {
                        "url": preview_url,
                        "status": preview_response.status_code,
                        "content_type": preview_response.headers.get("content-type"),
                        "body_excerpt": preview_response.text[:2000],
                        "captured_at": now_iso(),
                    },
                )
                if preview_response.status_code < 200 or preview_response.status_code >= 300:
                    raise ValidationFailure(
                        f"Preview URL returned HTTP {preview_response.status_code}: {preview_url}"
                    )
                dom_assertions = assert_preview_not_placeholder(preview_response.text)

                page.goto(preview_url, wait_until="networkidle")
                page.wait_for_selector("#bill-amount", timeout=20_000)
                interaction = interact_with_tip_preview(page)
                capture_phase(
                    page,
                    "07-preview-interacted",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Generated preview after calculator interaction.",
                )
                report["preview"] = {
                    "http_status": preview_response.status_code,
                    "dom_assertions": dom_assertions,
                    "interaction_assertions": interaction,
                }

                restart_shell_process(processes, shell_env, logs_dir, shell_origin)
                restart_continuity = fetch_continuity_snapshot(
                    shell_origin,
                    initiative_id,
                    api_snapshots_dir,
                    "08-continuity-after-restart",
                )
                restart_delivery = restart_continuity.get("delivery")
                if not isinstance(restart_delivery, dict) or restart_delivery.get("status") != "ready":
                    raise ValidationFailure(
                        "Restart continuity check did not preserve ready delivery."
                    )
                if restart_delivery.get("id") != delivery.get("id"):
                    raise ValidationFailure(
                        "Restart continuity check returned a different delivery id."
                    )
                page.goto(f"{shell_origin}/execution/runs/{initiative_id}", wait_until="domcontentloaded")
                page.wait_for_selector("text=Primary run", timeout=20_000)
                capture_phase(
                    page,
                    "08-restart-continuity",
                    screenshots,
                    screenshots_dir,
                    dom_snapshots_dir,
                    notes="Run surface after restarting the managed shell with the same state.",
                )
                report["restart_continuity"] = {
                    "checked": True,
                    "initiative_id": initiative_id,
                    "delivery_id": restart_delivery.get("id"),
                    "delivery_status": restart_delivery.get("status"),
                    "verification_status": restart_continuity.get("verification", {}).get("overallStatus")
                    if isinstance(restart_continuity.get("verification"), dict)
                    else None,
                    "api_snapshot": str(api_snapshots_dir / "08-continuity-after-restart.json"),
                }
            finally:
                context.close()
                browser.close()

        state_path = state_dir / "control-plane.state.json"
        if state_path.exists():
            shutil.copyfile(state_path, api_snapshots_dir / "final-control-plane-state.json")
        report["status"] = "passed"
    except Exception as error:
        report["error"] = str(error)
        report["status"] = "failed"
    finally:
        report["finished_at"] = now_iso()
        write_json(run_dir / "screenshot-manifest.json", [asdict(item) for item in screenshots])
        write_manual_checklist(Path(report["artifacts"]["manual_checklist_path"]), report)
        write_json(run_dir / "report.json", report)
        for process in reversed(processes):
            process.terminate()
        if not args.keep_state:
            shutil.rmtree(state_dir, ignore_errors=True)

    print(
        json.dumps(
            {
                "run_id": report["run_id"],
                "run_dir": str(run_dir),
                "status": report["status"],
                "shell_origin": shell_origin,
                "kernel_origin": kernel_origin,
                "report": str(run_dir / "report.json"),
            },
            indent=2,
        )
    )
    return 0 if report["status"] == "passed" else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the solo browser E2E validation for a fresh Infinity autonomous run."
    )
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--shell-port", type=int, default=CANONICAL_SHELL_PORT)
    parser.add_argument("--kernel-port", type=int, default=CANONICAL_KERNEL_PORT)
    parser.add_argument("--force-build", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument(
        "--reuse-build",
        action="store_true",
        help="Reuse an existing .next build. Default rebuilds before browser proof.",
    )
    parser.add_argument("--keep-state", action="store_true")
    args = parser.parse_args()
    return run_browser_e2e_solo(args)


if __name__ == "__main__":
    sys.exit(main())
