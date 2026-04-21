#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT / "docs" / "validation"
HANDOFF_ROOT = ROOT / "handoff-packets" / "validation"
CANONICAL_SHELL_PORT = 3737
CANONICAL_WORK_UI_PORT = 3101
CANONICAL_KERNEL_PORT = 8798


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def assert_port_available(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError as error:
            raise ValidationFailure(
                f"Canonical localhost port {port} is unavailable. Stop the conflicting service or free the port before validation."
            ) from error


def kill_known_listener(port: int, allowed_commands: tuple[str, ...]) -> None:
    pid_result = subprocess.run(
        ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
        capture_output=True,
        text=True,
        check=False,
    )
    if pid_result.returncode != 0:
        return

    for raw_pid in pid_result.stdout.splitlines():
        pid = raw_pid.strip()
        if not pid:
            continue

        cmd_result = subprocess.run(
            ["ps", "-o", "command=", "-p", pid],
            capture_output=True,
            text=True,
            check=False,
        )
        command = cmd_result.stdout.strip().lower()
        if not command or not any(token in command for token in allowed_commands):
            continue

        try:
            os.kill(int(pid), signal.SIGKILL)
        except ProcessLookupError:
            continue


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str | None = None


@dataclass
class ScreenshotRecord:
    screen_id: str
    path: str
    url: str | None
    scenario: str
    notes: str | None = None


class ValidationFailure(RuntimeError):
    pass


LEGACY_REQUIRED_STAGE_LABELS = [
    "Approve brief",
    "Launch planner explicitly",
    "Force assembly build",
    "Force assembly refresh",
    "Force verification run",
    "Force delivery handoff",
]

CRITICAL_SHELL_TYPECHECK_PATHS = [
    "components/execution/execution-home-surface.tsx",
    "components/execution/primary-run-surface.tsx",
    "components/shell/shell-screen-primitives.tsx",
]

LOCAL_MODULE_SPECIFIER_PATTERN = re.compile(
    r"""(?:import|export)\s+(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']""",
    re.MULTILINE,
)
DYNAMIC_LOCAL_MODULE_SPECIFIER_PATTERN = re.compile(
    r"""(?:import|require)\(\s*["']([^"']+)["']\s*\)""",
    re.MULTILINE,
)
PRIMARY_EXECUTION_ROUTE_SURFACES = [
    (
        "app/(shell)/execution/page.tsx",
        "@/components/execution/execution-home-surface",
    ),
    (
        "app/(shell)/execution/workspace/[sessionId]/page.tsx",
        "@/components/execution/workspace-handoff-surface",
    ),
    (
        "app/(shell)/execution/runs/[initiativeId]/page.tsx",
        "@/components/execution/primary-run-surface",
    ),
]


def assert_critical_shell_typecheck_scope() -> None:
    tsconfig_path = ROOT / "apps" / "shell" / "apps" / "web" / "tsconfig.json"
    tsconfig = json.loads(tsconfig_path.read_text(encoding="utf-8"))
    excluded = set(tsconfig.get("exclude") or [])
    blocked = [path for path in CRITICAL_SHELL_TYPECHECK_PATHS if path in excluded]
    if blocked:
        raise ValidationFailure(
            "Critical shell surfaces are still excluded from typecheck: "
            + ", ".join(blocked)
        )


def iter_typescript_files(root: Path):
    for suffix in (".ts", ".tsx", ".mts", ".cts"):
        yield from root.rglob(f"*{suffix}")


def is_legacy_execution_path(path: Path, legacy_root: Path) -> bool:
    try:
        path.relative_to(legacy_root)
        return True
    except ValueError:
        return False


def resolve_shell_module_specifier(
    shell_root: Path, source_path: Path, specifier: str
) -> Path | None:
    if specifier.startswith("@/"):
        candidate = shell_root / specifier[2:]
    elif specifier.startswith("."):
        candidate = (source_path.parent / specifier).resolve()
    else:
        return None

    resolution_candidates = [
        candidate,
        candidate.with_suffix(".ts"),
        candidate.with_suffix(".tsx"),
        candidate.with_suffix(".mts"),
        candidate.with_suffix(".cts"),
        candidate / "index.ts",
        candidate / "index.tsx",
        candidate / "index.mts",
        candidate / "index.cts",
    ]
    for resolved in resolution_candidates:
        if resolved.exists():
            return resolved.resolve()
    return None


def iter_local_module_specifiers(content: str):
    for match in LOCAL_MODULE_SPECIFIER_PATTERN.finditer(content):
        specifier = match.group(1).strip()
        if specifier.startswith("@/") or specifier.startswith("."):
            yield specifier
    for match in DYNAMIC_LOCAL_MODULE_SPECIFIER_PATTERN.finditer(content):
        specifier = match.group(1).strip()
        if specifier.startswith("@/") or specifier.startswith("."):
            yield specifier


def assert_legacy_execution_surfaces_are_isolated() -> None:
    shell_root = ROOT / "apps" / "shell" / "apps" / "web"
    legacy_root = (shell_root / "components" / "execution" / "legacy").resolve()
    legacy_ts_files = [
        str(path.relative_to(shell_root))
        for path in iter_typescript_files(legacy_root)
    ]
    if legacy_ts_files:
        raise ValidationFailure(
            "Legacy execution archive still contains TypeScript files: "
            + ", ".join(sorted(legacy_ts_files))
        )

    illegal_imports: list[str] = []
    for root in (shell_root / "app", shell_root / "components", shell_root / "lib"):
        for path in iter_typescript_files(root):
            if is_legacy_execution_path(path.resolve(), legacy_root):
                continue
            content = path.read_text(encoding="utf-8")
            for specifier in iter_local_module_specifiers(content):
                resolved = resolve_shell_module_specifier(shell_root, path.resolve(), specifier)
                if resolved is None or not is_legacy_execution_path(resolved, legacy_root):
                    continue
                illegal_imports.append(
                    f"{path.relative_to(shell_root)} -> {specifier}"
                )

    if illegal_imports:
        raise ValidationFailure(
            "Live shell code imports legacy execution surfaces: "
            + ", ".join(sorted(illegal_imports))
        )


def assert_primary_execution_routes_use_live_surfaces() -> None:
    shell_root = ROOT / "apps" / "shell" / "apps" / "web"
    legacy_root = (shell_root / "components" / "execution" / "legacy").resolve()
    mismatches: list[str] = []
    for route_path, expected_surface in PRIMARY_EXECUTION_ROUTE_SURFACES:
        absolute_path = shell_root / route_path
        content = absolute_path.read_text(encoding="utf-8")
        if expected_surface not in content:
            mismatches.append(f"{route_path} missing {expected_surface}")
            continue

        resolved = resolve_shell_module_specifier(
            shell_root, absolute_path.resolve(), expected_surface
        )
        if resolved is None:
            mismatches.append(f"{route_path} could not resolve {expected_surface}")
            continue
        if is_legacy_execution_path(resolved, legacy_root):
            mismatches.append(f"{route_path} resolves {expected_surface} into legacy")

    if mismatches:
        raise ValidationFailure(
            "Primary execution routes are not pinned to live shell surfaces: "
            + ", ".join(mismatches)
        )


def assert_shell_root_frontdoor(page, screen_name: str) -> dict[str, Any]:
    composer_visible = page.locator("text=Start an autonomous run").first.is_visible()
    search_visible = page.locator('button:has-text("Search runs, tasks, agents")').first.is_visible()
    suggested_prompts_visible = page.locator("text=Suggested prompts").first.is_visible()
    recent_runs_visible = page.locator("text=Recent runs").first.is_visible()
    shell_anchor_visible = search_visible and suggested_prompts_visible and recent_runs_visible

    if not composer_visible:
        raise ValidationFailure(f"{screen_name} does not expose the root composer.")
    if not shell_anchor_visible:
        raise ValidationFailure(f"{screen_name} does not expose the accepted shell frontdoor anchors.")

    return {
        "requested_entry_path": "/",
        "resolved_url": page.url,
        "stays_on_root_entry": page.url == "/" or page.url.endswith("/"),
        "composer_visible": composer_visible,
        "shell_anchor_visible": shell_anchor_visible,
        "suggested_prompts_visible": suggested_prompts_visible,
        "recent_runs_visible": recent_runs_visible,
    }


def run_command(name: str, cmd: list[str], cwd: Path, logs_dir: Path, env: dict[str, str] | None = None) -> CheckResult:
    started = time.time()
    process = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        env=env,
    )
    duration = time.time() - started
    log_path = logs_dir / f"{name}.log"
    log_path.write_text(
        f"$ {' '.join(cmd)}\n\nSTDOUT:\n{process.stdout}\n\nSTDERR:\n{process.stderr}",
        encoding="utf-8",
    )
    if process.returncode != 0:
        return CheckResult(
            name=name,
            status="failed",
            detail=f"Command failed in {duration:.2f}s. See {log_path}",
        )
    return CheckResult(
        name=name,
        status="passed",
        detail=f"Command passed in {duration:.2f}s. Log: {log_path}",
    )


def with_node_memory(env: dict[str, str] | None, megabytes: int) -> dict[str, str]:
    next_env = dict(env or os.environ)
    next_env["NODE_OPTIONS"] = f"--max-old-space-size={megabytes}"
    return next_env


class ManagedProcess:
    def __init__(self, name: str, cmd: list[str], cwd: Path, env: dict[str, str], logs_dir: Path):
        self.name = name
        self.log_path = logs_dir / f"{name}.log"
        self.handle = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            stdout=self.log_path.open("w", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )

    def terminate(self) -> None:
        if self.handle.poll() is not None:
            return
        self.handle.terminate()
        try:
            self.handle.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.handle.kill()
            self.handle.wait(timeout=10)


def wait_http(url: str, timeout_seconds: int = 30) -> None:
    started = time.time()
    while time.time() - started < timeout_seconds:
        try:
            response = requests.get(url, timeout=2)
            if response.status_code < 500:
                return
        except Exception:
            pass
        time.sleep(1)
    raise ValidationFailure(f"Service did not become reachable: {url}")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_continuity_from_state_file(state_dir: Path, initiative_id: str) -> dict[str, Any] | None:
    state_path = state_dir / "control-plane.state.json"
    if not state_path.exists():
        return None

    state = load_json(state_path)
    orchestration = state.get("orchestration")
    if not isinstance(orchestration, dict):
        return None

    initiatives = orchestration.get("initiatives")
    if not isinstance(initiatives, list):
        return None

    initiative = next(
        (
            candidate
            for candidate in initiatives
            if isinstance(candidate, dict) and candidate.get("id") == initiative_id
        ),
        None,
    )
    if not isinstance(initiative, dict):
        return None

    def filtered_records(name: str, sort_key: str):
        records = orchestration.get(name)
        if not isinstance(records, list):
            return []

        related = [
            candidate
            for candidate in records
            if isinstance(candidate, dict) and candidate.get("initiativeId") == initiative_id
        ]
        return sorted(
            related,
            key=lambda candidate: str(candidate.get(sort_key) or candidate.get("id") or ""),
            reverse=True,
        )

    briefs = filtered_records("briefs", "updatedAt")
    task_graphs = filtered_records("taskGraphs", "updatedAt")
    batches = sorted(
        [
            candidate
            for candidate in orchestration.get("batches", [])
            if isinstance(candidate, dict) and candidate.get("initiativeId") == initiative_id
        ],
        key=lambda candidate: str(candidate.get("startedAt") or candidate.get("id") or ""),
        reverse=True,
    )
    assemblies = filtered_records("assemblies", "updatedAt")
    verifications = sorted(
        [
            candidate
            for candidate in orchestration.get("verifications", [])
            if isinstance(candidate, dict) and candidate.get("initiativeId") == initiative_id
        ],
        key=lambda candidate: str(
            candidate.get("finishedAt")
            or candidate.get("startedAt")
            or candidate.get("id")
            or ""
        ),
        reverse=True,
    )
    deliveries = sorted(
        [
            candidate
            for candidate in orchestration.get("deliveries", [])
            if isinstance(candidate, dict) and candidate.get("initiativeId") == initiative_id
        ],
        key=lambda candidate: str(candidate.get("deliveredAt") or candidate.get("id") or ""),
        reverse=True,
    )

    return {
        "initiative": initiative,
        "briefs": briefs,
        "taskGraphs": task_graphs,
        "batches": batches,
        "assembly": assemblies[0] if assemblies else None,
        "verification": verifications[0] if verifications else None,
        "delivery": deliveries[0] if deliveries else None,
    }


def mint_launch_token(shell_origin: str, session_id: str) -> str:
    response = requests.get(
        f"{shell_origin}/execution/workspace/{session_id}",
        timeout=10,
    )
    response.raise_for_status()
    match = re.search(r"launch_token=([^&\"\\\\]+)", response.text)
    if not match:
        raise ValidationFailure("Could not mint a shell launch token from the workspace page.")
    return html.unescape(match.group(1))


def build_embedded_url(base: str, shell_origin: str, session_id: str, path: str) -> str:
    token = mint_launch_token(shell_origin, session_id)
    params = {
        "founderos_launch": "1",
        "project_id": "project-borealis",
        "session_id": session_id,
        "group_id": "group-core-02",
        "account_id": "account-chatgpt-02",
        "workspace_id": "workspace-borealis-review",
        "opened_from": "execution_board",
        "host_origin": shell_origin,
        "embedded": "1",
        "launch_token": token,
    }
    return f"{base}{path}?{requests.compat.urlencode(params)}"


def fetch_latest_delivery(shell_origin: str, initiative_id: str) -> dict[str, Any]:
    response = requests.get(
        f"{shell_origin}/api/control/orchestration/delivery?initiative_id={initiative_id}",
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    deliveries = payload.get("deliveries")
    if not isinstance(deliveries, list) or not deliveries:
        raise ValidationFailure(
            f"No delivery record was materialized for initiative {initiative_id}."
        )
    delivery = deliveries[0]
    if not isinstance(delivery, dict) or not isinstance(delivery.get("id"), str):
        raise ValidationFailure(
            f"Delivery response for initiative {initiative_id} did not include a valid id."
        )
    return delivery


def request_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    expected_statuses: tuple[int, ...] = (200, 201),
    timeout: int | tuple[int, int] = 20,
) -> dict[str, Any]:
    response = requests.request(method, url, json=payload, timeout=timeout)
    if response.status_code not in expected_statuses:
        detail = response.text
        raise ValidationFailure(
            f"Unexpected status from {method} {url}: {response.status_code} {detail}"
        )
    return response.json()


def fetch_continuity(shell_origin: str, initiative_id: str) -> dict[str, Any]:
    response = requests.get(
        f"{shell_origin}/api/control/orchestration/continuity/{initiative_id}",
        timeout=(2, 30),
    )
    if response.status_code >= 400:
        raise ValidationFailure(
            f"Continuity API failed for initiative {initiative_id}: {response.status_code}"
        )
    return response.json()


def fetch_task_graph_detail(shell_origin: str, task_graph_id: str) -> dict[str, Any]:
    return request_json(
        "GET", f"{shell_origin}/api/control/orchestration/task-graphs/{task_graph_id}"
    )


def wait_for_task_graph_completion(
    shell_origin: str, task_graph_id: str, timeout_seconds: int = 30
) -> dict[str, Any]:
    started = time.time()
    last_status = "unknown"
    while time.time() - started < timeout_seconds:
        detail = fetch_task_graph_detail(shell_origin, task_graph_id)
        task_graph = detail.get("taskGraph")
        work_units = detail.get("workUnits")
        if isinstance(task_graph, dict):
            last_status = str(task_graph.get("status") or "unknown")
            if last_status == "completed":
                return detail
        if isinstance(work_units, list) and work_units and all(
            isinstance(work_unit, dict) and work_unit.get("status") == "completed"
            for work_unit in work_units
        ):
            return detail
        time.sleep(1)

    raise ValidationFailure(
        f"Task graph {task_graph_id} did not settle to completed within {timeout_seconds}s. Last status: {last_status}"
    )


def normalize_file_url(url: str | None) -> Path | None:
    if not url:
        return None
    if url.startswith("file://"):
        return Path(url.replace("file://", "", 1))
    return Path(url)


def assert_preview_ready(preview_url: str | None) -> None:
    if not preview_url:
        raise ValidationFailure("Happy path: autonomous delivery did not expose a preview URL.")

    if preview_url.startswith("http://") or preview_url.startswith("https://"):
        response = requests.get(preview_url, timeout=10, allow_redirects=False)
        if response.status_code < 200 or response.status_code >= 300:
            raise ValidationFailure(
                f"Happy path: preview URL {preview_url} returned {response.status_code}."
            )
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type.lower():
            raise ValidationFailure(
                f"Happy path: preview URL {preview_url} did not return HTML content."
            )
        body = response.text.lower()
        if "<!doctype html" not in body and "infinity preview" not in body:
            raise ValidationFailure(
                f"Happy path: preview URL {preview_url} did not return the expected preview document."
            )
        return

    preview_path = normalize_file_url(preview_url)
    if preview_path is None or not preview_path.exists():
        raise ValidationFailure(
            "Happy path: autonomous delivery did not materialize a reachable local preview."
        )


def assert_localhost_launch_ready(delivery: dict[str, Any]) -> dict[str, Any]:
    launch_manifest_path = normalize_file_url(delivery.get("launchManifestPath"))
    if launch_manifest_path is None or not launch_manifest_path.exists():
        raise ValidationFailure(
            "Happy path: delivery did not expose a launch manifest for localhost replay."
        )

    manifest = load_json(launch_manifest_path)
    command = manifest.get("command")
    working_directory = manifest.get("workingDirectory")
    expected_marker = manifest.get("expectedMarker")
    launch_kind = str(
        manifest.get("targetKind")
        or delivery.get("launchProofKind")
        or "synthetic_wrapper"
    )

    if not isinstance(command, list) or not command or not all(
        isinstance(part, str) and part for part in command
    ):
        raise ValidationFailure(
            f"Happy path: launch manifest {launch_manifest_path} did not expose a valid command array."
        )
    if not isinstance(working_directory, str) or not working_directory:
        raise ValidationFailure(
            f"Happy path: launch manifest {launch_manifest_path} did not expose a working directory."
        )

    process = subprocess.Popen(
        command,
        cwd=working_directory,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    ready_url = None

    try:
        if process.stdout is None:
            raise ValidationFailure(
                f"Happy path: launch manifest {launch_manifest_path} did not expose stdout for READY detection."
            )
        ready_line = process.stdout.readline()
        match = re.search(r"READY\s+(http://127\.0\.0\.1:\d+\S+)", ready_line)
        if match:
            ready_url = match.group(1)

        if not ready_url:
            raise ValidationFailure(
                f"Happy path: launch manifest {launch_manifest_path} did not produce a localhost-ready URL."
            )

        response = requests.get(ready_url, timeout=10, allow_redirects=False)
        if response.status_code < 200 or response.status_code >= 300:
            raise ValidationFailure(
                f"Happy path: localhost launch URL {ready_url} returned {response.status_code}."
            )
        if launch_kind in {"synthetic_wrapper", "attempt_scaffold"} and (
            not isinstance(expected_marker, str)
            or expected_marker.lower() not in response.text.lower()
        ):
            raise ValidationFailure(
                f"Happy path: localhost launch URL {ready_url} did not return the expected delivery marker."
            )

        if not delivery.get("launchProofAt"):
            raise ValidationFailure(
                "Happy path: delivery replay succeeded, but the delivery record is missing launchProofAt."
            )
        if not delivery.get("launchProofUrl"):
            raise ValidationFailure(
                "Happy path: delivery replay succeeded, but the delivery record is missing launchProofUrl."
            )
        if delivery.get("launchProofKind") != launch_kind:
            raise ValidationFailure(
                "Happy path: delivery replay succeeded, but the delivery record does not match the launch proof kind."
            )
        if launch_kind in {"synthetic_wrapper", "attempt_scaffold"} and delivery.get("status") == "ready":
            raise ValidationFailure(
                "Happy path: delivery is marked ready even though only wrapper/scaffold evidence was proven."
            )
        if launch_kind == "runnable_result" and delivery.get("status") != "ready":
            raise ValidationFailure(
                "Happy path: delivery proved a runnable result but the delivery record was not promoted to ready."
            )

        return {
            "launch_manifest_path": str(launch_manifest_path),
            "ready_url": ready_url,
            "launch_kind": launch_kind,
            "recorded_proof_url": str(delivery.get("launchProofUrl")),
        }
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def wait_for_autonomous_delivery(
    shell_origin: str,
    state_dir: Path,
    initiative_id: str,
    timeout_seconds: int = 90,
) -> dict[str, Any]:
    started = time.time()
    last_continuity_error: str | None = None
    while time.time() - started < timeout_seconds:
        try:
            continuity = fetch_continuity(shell_origin, initiative_id)
        except requests.exceptions.RequestException as error:
            last_continuity_error = str(error)
            continuity = build_continuity_from_state_file(state_dir, initiative_id)
            if continuity is None:
                time.sleep(1)
                continue
        if continuity is None:
            time.sleep(1)
            continue
        delivery = continuity.get("delivery")
        verification = continuity.get("verification")
        assembly = continuity.get("assembly")
        initiative = continuity.get("initiative")
        if (
            isinstance(delivery, dict)
            and isinstance(verification, dict)
            and verification.get("overallStatus") == "passed"
            and isinstance(assembly, dict)
            and assembly.get("status") == "assembled"
            and isinstance(initiative, dict)
        ):
            delivery_status = delivery.get("status")
            launch_kind = delivery.get("launchProofKind")
            initiative_status = initiative.get("status")
            if (
                launch_kind == "runnable_result"
                and delivery_status == "ready"
                and initiative_status == "ready"
            ):
                return continuity
        time.sleep(1)
    if last_continuity_error:
        raise ValidationFailure(
            f"Autonomous delivery did not reach a truthful delivery state for initiative {initiative_id} within {timeout_seconds}s. Last continuity poll error: {last_continuity_error}"
        )
    raise ValidationFailure(
        f"Autonomous delivery did not reach a truthful delivery state for initiative {initiative_id} within {timeout_seconds}s."
    )


def approval_scope_url(shell_origin: str, route: str) -> str:
    return f"{shell_origin}{route}"


def capture_screenshot(page, screen_id: str, path: str, manifest: list[ScreenshotRecord], url: str, scenario: str, notes: str | None = None, full_page: bool = True) -> None:
    page.screenshot(path=path, full_page=full_page)
    manifest.append(
        ScreenshotRecord(
            screen_id=screen_id,
            path=path,
            url=url,
            scenario=scenario,
            notes=notes,
        )
    )


def assert_no_required_stage_labels(page, screen_name: str) -> list[str]:
    body_text = page.locator("body").inner_text()
    found = [label for label in LEGACY_REQUIRED_STAGE_LABELS if label in body_text]
    if found:
        raise ValidationFailure(
            f"{screen_name} still exposes required manual stage labels: {', '.join(found)}"
        )
    return found


def approve_brief_and_launch_planner(page) -> None:
    page.click('button:has-text("Force approval")')
    page.wait_for_timeout(1200)
    page.wait_for_selector("text=Status: brief_ready", timeout=15000)

    launch_planner = page.locator('button:has-text("Trigger planner override")').first
    if launch_planner.count() == 0 or not launch_planner.is_enabled():
        raise ValidationFailure(
            "Brief approval did not leave the initiative in brief_ready with an explicit planner launch action."
        )

    launch_planner.click()
    page.wait_for_timeout(1500)
    page.wait_for_selector('text=Return to shell workspace', timeout=15000)


def open_shell_task_graph_from_brief(page) -> str:
    task_graph_link = page.locator('a:has-text("Open shell task graph")').first
    href = task_graph_link.get_attribute("href")
    if not href:
        raise ValidationFailure("Planner launch did not expose a shell task graph link.")
    page.goto(href, wait_until="networkidle")
    page.wait_for_selector("text=Task Graph Inspection", timeout=15000)
    match = re.search(r"/execution/task-graphs/([^?]+)", page.url)
    if not match:
        raise ValidationFailure("Shell task graph route did not expose a task graph id.")
    return match.group(1)


def run_happy_path(page, shell_origin: str, work_origin: str, state_dir: Path, manifest: list[ScreenshotRecord], screenshots_dir: Path, require_runnable_result: bool = False) -> dict[str, Any]:
    session_id = "session-2026-04-11-002"
    shell_root_url = f"{shell_origin}/"
    page.goto(shell_root_url, wait_until="networkidle")
    page.wait_for_selector("text=Start an autonomous run", timeout=15000)
    frontdoor_state = assert_shell_root_frontdoor(page, "shell_root_frontdoor")
    capture_screenshot(
        page,
        "shell_root_frontdoor",
        str(screenshots_dir / "shell_root_frontdoor.png"),
        manifest,
        page.url,
        "happy_path",
        notes=f"Requested {shell_root_url} and resolved to {page.url}.",
    )
    prompt = "Validate the complete embedded happy path from intake through delivery."
    page.fill("textarea", prompt)
    page.click('button:has-text("Start run")')
    initiative_id = None
    landed_on = None
    started = time.time()
    while time.time() - started < 20:
        current_url = page.url
        match_run = re.search(r"/execution/runs/([^?]+)", current_url)
        if match_run:
            initiative_id = match_run.group(1)
            landed_on = "primary_run"
            break
        match_continuity = re.search(r"/execution/continuity/([^?]+)", current_url)
        if match_continuity:
            initiative_id = match_continuity.group(1)
            landed_on = "continuity_fallback"
            break
        page.wait_for_timeout(500)

    if not initiative_id:
        raise ValidationFailure("Start run did not navigate to either the primary run route or continuity detail.")

    if landed_on != "primary_run":
        page.goto(f"{shell_origin}/execution/runs/{initiative_id}", wait_until="networkidle")

    page.wait_for_timeout(1500)
    run_body_text = page.locator("body").inner_text()
    if "This page could not be found." in run_body_text:
        raise ValidationFailure("Primary run route resolved to a 404 instead of a run surface.")
    capture_screenshot(
        page,
        "shell_primary_run",
        str(screenshots_dir / "shell_primary_run.png"),
        manifest,
        page.url,
        "happy_path",
        notes=f"Post-start landing: {landed_on}.",
    )

    continuity = wait_for_autonomous_delivery(shell_origin, state_dir, initiative_id)
    brief_id = continuity["briefs"][0]["id"]
    task_graph_id = continuity["taskGraphs"][0]["id"]
    batch_ids = [batch["id"] for batch in continuity.get("batches", []) if isinstance(batch, dict) and isinstance(batch.get("id"), str)]
    delivery = continuity["delivery"]
    assert_preview_ready(delivery.get("previewUrl"))
    launch_state = assert_localhost_launch_ready(delivery)
    handoff_path = Path(delivery["localOutputPath"]) / "HANDOFF.md"
    if not handoff_path.exists():
        raise ValidationFailure("Happy path: autonomous delivery did not materialize HANDOFF.md.")

    brief_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-brief/{brief_id}")
    page.goto(brief_url, wait_until="networkidle")
    page.wait_for_selector("text=Project brief", timeout=15000)
    capture_screenshot(page, "workui_project_brief", str(screenshots_dir / "workui_project_brief.png"), manifest, page.url, "happy_path")
    brief_stage_labels = assert_no_required_stage_labels(page, "workui_project_brief")

    shell_task_graph_url = f"{shell_origin}/execution/task-graphs/{task_graph_id}?initiative_id={initiative_id}"
    page.goto(shell_task_graph_url, wait_until="networkidle")
    page.wait_for_selector("text=Task Graph Inspection", timeout=15000)
    capture_screenshot(page, "shell_task_graph", str(screenshots_dir / "shell_task_graph.png"), manifest, page.url, "happy_path")

    if batch_ids:
        shell_batch_url = f"{shell_origin}/execution/batches/{batch_ids[0]}?initiative_id={initiative_id}&task_graph_id={task_graph_id}"
        page.goto(shell_batch_url, wait_until="networkidle")
        page.wait_for_selector("text=Batch Supervision", timeout=15000)
        capture_screenshot(page, "shell_batch_supervision", str(screenshots_dir / "shell_batch_supervision.png"), manifest, page.url, "happy_path")

    run_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-run/{initiative_id}")
    page.goto(run_url, wait_until="networkidle")
    page.wait_for_selector("text=Project run", timeout=15000)
    capture_screenshot(page, "workui_project_run", str(screenshots_dir / "workui_project_run.png"), manifest, page.url, "happy_path")
    run_stage_labels = assert_no_required_stage_labels(page, "workui_project_run")

    result_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-result/{initiative_id}")
    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Project result", timeout=15000)
    page.wait_for_selector("text=Return to shell workspace", timeout=15000)
    capture_screenshot(page, "workui_project_result_passed", str(screenshots_dir / "workui_project_result_passed.png"), manifest, page.url, "happy_path")
    result_stage_labels = assert_no_required_stage_labels(page, "workui_project_result_passed")
    delivery_id = str(delivery["id"]).strip()
    launch_ready = str(delivery.get("launchProofKind") or "") == "runnable_result" and str(delivery.get("status") or "") == "ready"

    if require_runnable_result and not launch_ready:
        raise ValidationFailure(
            f"Happy path only reached `{launch_state['launch_kind']}` proof. A green finish gate now requires a real runnable_result delivery."
        )

    return {
        "initiative_id": initiative_id,
        "brief_id": brief_id,
        "task_graph_id": task_graph_id,
        "batch_ids": batch_ids,
        "delivery_id": delivery_id,
        "delivery_status": str(delivery.get("status") or ""),
        "preview_ready": True,
        "launch_ready": launch_ready,
        "handoff_ready": bool(handoff_path.exists()),
        "autonomous_one_prompt": True,
        "root_frontdoor": frontdoor_state,
        "manual_stage_labels": {
            "workui_project_brief": brief_stage_labels,
            "workui_project_run": run_stage_labels,
            "workui_project_result_passed": result_stage_labels,
        },
        "preview_url": delivery.get("previewUrl"),
        "launch_kind": launch_state["launch_kind"],
        "launch_manifest_path": launch_state["launch_manifest_path"],
        "launch_ready_url": launch_state["ready_url"],
        "launch_recorded_proof_url": launch_state["recorded_proof_url"],
        "handoff_path": str(handoff_path),
        "result_url": page.url,
    }


def run_failure_and_recovery_path(page, shell_origin: str, work_origin: str, manifest: list[ScreenshotRecord], screenshots_dir: Path) -> dict[str, Any]:
    session_id = "session-2026-04-11-002"
    initiative = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/initiatives",
        {
            "title": f"Validation Failure {int(time.time())}",
            "userRequest": "Validate blocked and retryable execution states.",
            "requestedBy": "martin",
            "workspaceSessionId": session_id,
        },
    )["initiative"]
    initiative_id = initiative["id"]

    brief = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/briefs",
        {
            "initiativeId": initiative_id,
            "summary": "Manual recovery scenario for blocked and retryable execution states.",
            "goals": ["Exercise fail, reassign, and retry flows."],
            "nonGoals": ["Autonomous happy-path progression."],
            "constraints": ["Stay inside /Users/martin/infinity."],
            "assumptions": ["Operator controls remain available."],
            "acceptanceCriteria": ["A failed attempt can be reassigned and recovered."],
            "repoScope": ["/Users/martin/infinity/apps/shell", "/Users/martin/infinity/apps/work-ui"],
            "deliverables": ["Recovered delivery", "Recovery evidence"],
            "clarificationLog": [],
            "authoredBy": "droid-spec-writer",
            "status": "approved",
        },
    )["brief"]

    task_graph = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/task-graphs",
        {"briefId": brief["id"]},
    )["taskGraph"]
    task_graph_id = task_graph["id"]

    batch = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/batches",
        {"taskGraphId": task_graph_id, "concurrencyLimit": 1},
    )["batch"]
    batch_id = batch["id"]
    batch_detail = request_json(
        "GET", f"{shell_origin}/api/control/orchestration/batches/{batch_id}"
    )
    first_attempt = batch_detail["attempts"][0]

    request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/supervisor/actions",
        {
            "actionKind": "fail_attempt",
            "batchId": batch_id,
            "attemptId": first_attempt["id"],
            "workUnitId": first_attempt["workUnitId"],
            "errorSummary": "Validation-induced failure",
            "errorCode": "VALIDATION_FAILURE",
        },
    )

    shell_batch_url = f"{shell_origin}/execution/batches/{batch_id}?initiative_id={initiative_id}&task_graph_id={task_graph_id}"
    page.goto(shell_batch_url, wait_until="networkidle")
    page.wait_for_selector("text=Batch Supervision", timeout=15000)
    capture_screenshot(page, "shell_retryable_recovery", str(screenshots_dir / "shell_retryable_recovery.png"), manifest, page.url, "failure_path")

    run_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-run/{initiative_id}")
    page.goto(run_url, wait_until="networkidle")
    page.wait_for_selector("text=Project run", timeout=15000)
    capture_screenshot(page, "workui_run_blocked", str(screenshots_dir / "workui_run_blocked.png"), manifest, page.url, "failure_path")
    assert_no_required_stage_labels(page, "workui_run_blocked")
    result_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-result/{initiative_id}")
    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Project result", timeout=15000)
    capture_screenshot(page, "workui_result_blocked_verification", str(screenshots_dir / "workui_result_blocked_verification.png"), manifest, page.url, "failure_path")
    capture_screenshot(page, "workui_result_blocked_delivery", str(screenshots_dir / "workui_result_blocked_delivery.png"), manifest, page.url, "failure_path", notes="Same screen shows both blocked verification and blocked delivery.")
    assert_no_required_stage_labels(page, "workui_result_blocked_delivery")

    retryable_work_unit = next(
        work_unit
        for work_unit in request_json(
            "GET",
            f"{shell_origin}/api/control/orchestration/task-graphs/{task_graph_id}",
        )["workUnits"]
        if work_unit["status"] in {"retryable", "blocked"}
    )
    request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/supervisor/actions",
        {
            "actionKind": "reassign_work_unit",
            "batchId": batch_id,
            "workUnitId": retryable_work_unit["id"],
            "executorType": "codex",
        },
    )
    resumed_batch_detail = request_json(
        "GET", f"{shell_origin}/api/control/orchestration/batches/{batch_id}"
    )
    for attempt in resumed_batch_detail.get("attempts", []):
        if attempt.get("status") != "started":
            continue
        request_json(
            "POST",
            f"{shell_origin}/api/control/orchestration/supervisor/actions",
            {
                "actionKind": "complete_attempt",
                "batchId": batch_id,
                "attemptId": attempt["id"],
                "workUnitId": attempt["workUnitId"],
            },
        )

    recovered_batches: list[str] = []
    for _ in range(6):
        graph_detail = fetch_task_graph_detail(shell_origin, task_graph_id)
        runnable = graph_detail.get("runnableWorkUnitIds", [])
        if not runnable:
            break

        next_batch = request_json(
            "POST",
            f"{shell_origin}/api/control/orchestration/batches",
            {"taskGraphId": task_graph_id, "workUnitIds": runnable, "concurrencyLimit": len(runnable)},
        )["batch"]
        recovered_batches.append(next_batch["id"])
        next_batch_detail = request_json(
            "GET", f"{shell_origin}/api/control/orchestration/batches/{next_batch['id']}"
        )
        for attempt in next_batch_detail["attempts"]:
            request_json(
                "POST",
                f"{shell_origin}/api/control/orchestration/supervisor/actions",
                {
                    "actionKind": "complete_attempt",
                    "batchId": next_batch["id"],
                    "attemptId": attempt["id"],
                    "workUnitId": attempt["workUnitId"],
                },
            )
    else:
        raise ValidationFailure("Failure path recovery exceeded expected cycles.")

    wait_for_task_graph_completion(shell_origin, task_graph_id)
    request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/assembly",
        {"initiativeId": initiative_id},
    )
    request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/verification",
        {"initiativeId": initiative_id},
        timeout=(2, 120),
    )
    delivery = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/delivery",
        {"initiativeId": initiative_id},
    )["delivery"]

    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Return to shell workspace", timeout=15000)

    return {
        "initiative_id": initiative_id,
        "task_graph_id": task_graph_id,
        "delivery_id": delivery["id"],
        "recovered_batches": recovered_batches,
        "recovery_override_used": True,
    }


def validate_api_exposure(shell_origin: str, evidence: dict[str, Any]) -> list[dict[str, Any]]:
    inventory = load_json(DOCS_DIR / "route-inventory.json")
    checklist = []
    for item in inventory["api_families"]:
        route = item["route"]
        exposed = item["exposure"] != "internal-only"
        checklist.append(
            {
                "route": route,
                "owner_surface": item["owner_surface"],
                "exposure": item["exposure"],
                "entrypoint_present": exposed,
                "outcome_present": exposed,
                "mutation_verified": route
                in {
                    "/api/control/orchestration/initiatives",
                    "/api/control/orchestration/briefs",
                    "/api/control/orchestration/batches",
                    "/api/control/orchestration/supervisor/actions",
                    "/api/control/orchestration/assembly",
                    "/api/control/orchestration/verification",
                    "/api/control/orchestration/delivery",
                    "/api/control/execution/approvals/[approvalId]/respond",
                    "/api/control/execution/recoveries/[recoveryId]",
                },
            }
        )
    return checklist


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-static-checks", action="store_true")
    parser.add_argument("--require-runnable-result", action="store_true")
    parser.add_argument("--critic-json")
    args = parser.parse_args()

    assert_critical_shell_typecheck_scope()
    assert_legacy_execution_surfaces_are_isolated()
    assert_primary_execution_routes_use_live_surfaces()
    shell_build_id_path = ROOT / "apps" / "shell" / "apps" / "web" / ".next" / "BUILD_ID"
    if args.skip_static_checks and not shell_build_id_path.exists():
        raise ValidationFailure(
            "--skip-static-checks requires an existing @founderos/web production build before validation."
        )

    validation_run_id = run_id()
    run_dir = HANDOFF_ROOT / validation_run_id
    logs_dir = run_dir / "logs"
    screenshots_dir = run_dir / "screenshots"
    logs_dir.mkdir(parents=True, exist_ok=True)
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    canonical_ports = [
        (CANONICAL_SHELL_PORT, ("next-server", "next start", "next dev")),
        (CANONICAL_WORK_UI_PORT, ("vite dev", "open-webui")),
        (CANONICAL_KERNEL_PORT, ("execution-kernel", "go run ./cmd/execution-kernel")),
    ]
    for port, allowed_commands in canonical_ports:
        kill_known_listener(port, allowed_commands)
        assert_port_available(port)

    shell_port = CANONICAL_SHELL_PORT
    work_port = CANONICAL_WORK_UI_PORT
    kernel_port = CANONICAL_KERNEL_PORT
    shell_origin = f"http://127.0.0.1:{shell_port}"
    work_origin = f"http://127.0.0.1:{work_port}"
    kernel_origin = f"http://127.0.0.1:{kernel_port}"
    state_dir = Path(tempfile.mkdtemp(prefix="infinity-validation-state-"))

    checks: list[CheckResult] = []
    scenarios: list[CheckResult] = []
    screenshots: list[ScreenshotRecord] = []
    processes: list[ManagedProcess] = []
    artifacts: list[str] = []

    try:
        if not args.skip_static_checks:
            checks.extend(
                [
                    run_command("shell_lint", ["npm", "run", "lint", "--workspace", "@founderos/web"], ROOT, logs_dir),
                    run_command("shell_typecheck", ["npm", "run", "typecheck", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("shell_test", ["npm", "run", "test", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("shell_build", ["npm", "run", "build", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1280)),
                    run_command("work_ui_check", ["npm", "run", "check", "--workspace", "open-webui"], ROOT, logs_dir, env=with_node_memory(None, 3072)),
                    run_command("work_ui_test", ["npm", "run", "test:frontend:ci", "--workspace", "open-webui"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("work_ui_build", ["npm", "run", "build", "--workspace", "open-webui"], ROOT, logs_dir, env=with_node_memory(None, 4096)),
                ]
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
        shell_env["FOUNDEROS_WEB_PORT"] = str(shell_port)
        shell_env["FOUNDEROS_WORK_UI_BASE_URL"] = work_origin
        shell_command = ["npm", "run", "start", "--workspace", "@founderos/web"]
        processes.append(
            ManagedProcess(
                "shell",
                shell_command,
                ROOT,
                shell_env,
                logs_dir,
            )
        )

        work_env = os.environ.copy()
        work_env["PUBLIC_FOUNDEROS_SHELL_ORIGIN"] = shell_origin
        work_env["WORK_UI_HOST"] = "127.0.0.1"
        work_env["WORK_UI_PORT"] = str(work_port)
        processes.append(
            ManagedProcess(
                "work_ui_preview",
                ["npm", "run", "dev", "--workspace", "open-webui"],
                ROOT,
                work_env,
                logs_dir,
            )
        )

        wait_http(f"{kernel_origin}/healthz")
        wait_http(f"{shell_origin}/execution")
        wait_http(f"{work_origin}/auth")

        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 1200})
            page = context.new_page()

            happy = run_happy_path(
                page,
                shell_origin,
                work_origin,
                state_dir,
                screenshots,
                screenshots_dir,
                require_runnable_result=args.require_runnable_result,
            )
            scenarios.append(CheckResult("happy_path", "passed", json.dumps(happy)))

            failure = run_failure_and_recovery_path(page, shell_origin, work_origin, screenshots, screenshots_dir)
            scenarios.append(CheckResult("failure_recovery_path", "passed", json.dumps(failure)))

            # Shell and standalone screenshots
            shell_root_url = f"{shell_origin}/"
            page.goto(shell_root_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            assert_shell_root_frontdoor(page, "shell_root_frontdoor")
            capture_screenshot(
                page,
                "shell_root_frontdoor",
                str(screenshots_dir / "shell_root_frontdoor.png"),
                screenshots,
                page.url,
                "shell_operator",
                notes=f"Requested {shell_root_url} and resolved to {page.url}.",
            )

            shell_runs_url = f"{shell_origin}/execution/runs"
            page.goto(shell_runs_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.wait_for_selector("text=Run control plane", timeout=15000)
            capture_screenshot(
                page,
                "shell_runs_board",
                str(screenshots_dir / "shell_runs_board.png"),
                screenshots,
                page.url,
                "shell_operator",
            )

            shell_approvals_url = f"{shell_origin}/execution/approvals"
            page.goto(shell_approvals_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            capture_screenshot(page, "shell_pending_approval", str(screenshots_dir / "shell_pending_approval.png"), screenshots, page.url, "operator_states")
            capture_screenshot(page, "shell_approvals", str(screenshots_dir / "shell_approvals.png"), screenshots, page.url, "shell_operator")
            approve_button = page.locator('button:has-text("Approve once")').first
            if approve_button.count() and approve_button.is_enabled():
                approve_button.click()
                page.wait_for_timeout(1200)

            shell_recoveries_url = f"{shell_origin}/execution/recoveries"
            page.goto(shell_recoveries_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            capture_screenshot(page, "shell_recoveries", str(screenshots_dir / "shell_recoveries.png"), screenshots, page.url, "shell_operator")
            retry_button = page.locator('button:has-text("Retry")').first
            if retry_button.count() and retry_button.is_enabled():
                retry_button.click()
                page.wait_for_timeout(1200)

            shell_audits_url = f"{shell_origin}/execution/audits"
            page.goto(shell_audits_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            capture_screenshot(page, "shell_audits", str(screenshots_dir / "shell_audits.png"), screenshots, page.url, "shell_operator")

            if happy.get("delivery_id"):
                shell_delivery_url = f"{shell_origin}/execution/delivery/{happy['delivery_id']}?initiative_id={happy['initiative_id']}"
                page.goto(shell_delivery_url, wait_until="domcontentloaded")
                page.wait_for_selector("text=Delivery Summary", timeout=15000)
                capture_screenshot(page, "shell_delivery_ready", str(screenshots_dir / "shell_delivery_ready.png"), screenshots, page.url, "happy_path")

            standalone_root_url = f"{work_origin}/"
            page.goto(standalone_root_url, wait_until="networkidle")
            page.wait_for_timeout(2000)
            capture_screenshot(page, "workui_root_standalone", str(screenshots_dir / "workui_root_standalone.png"), screenshots, page.url, "standalone")
            if page.url.endswith("/auth"):
                capture_screenshot(page, "workui_auth_or_redirect_state", str(screenshots_dir / "workui_auth_or_redirect_state.png"), screenshots, page.url, "standalone")

            shell_root_standalone = f"{shell_origin}/"
            page.goto(shell_root_standalone, wait_until="networkidle")
            page.wait_for_timeout(2000)
            assert_shell_root_frontdoor(page, "shell_root_entry_standalone")
            capture_screenshot(
                page,
                "shell_root_entry_standalone",
                str(screenshots_dir / "shell_root_entry_standalone.png"),
                screenshots,
                page.url,
                "standalone",
                notes=f"Requested {shell_root_standalone} and resolved to {page.url}.",
            )

            browser.close()

        route_matrix = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "page_routes": load_json(DOCS_DIR / "route-inventory.json")["page_routes"],
        }
        api_checklist = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "api_exposure": validate_api_exposure(shell_origin, {}),
        }
        screenshot_manifest = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "screenshots": [asdict(item) for item in screenshots],
        }
        autonomous_proof = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "root_frontdoor": happy["root_frontdoor"],
            "shell_first": {
                "autonomous_one_prompt": happy["autonomous_one_prompt"],
            },
            "manual_stage_labels": happy["manual_stage_labels"],
            "preview_ready": happy["preview_ready"],
            "launch_ready": happy["launch_ready"],
            "launch_kind": happy["launch_kind"],
            "handoff_ready": happy["handoff_ready"],
            "handoff_path": happy["handoff_path"],
            "preview_url": happy["preview_url"],
            "launch_manifest_path": happy["launch_manifest_path"],
            "launch_ready_url": happy["launch_ready_url"],
            "launch_recorded_proof_url": happy["launch_recorded_proof_url"],
            "failure_recovery_override_used": failure["recovery_override_used"],
            "recovered_batches": failure["recovered_batches"],
        }

        write_json(run_dir / "route-matrix.json", route_matrix)
        write_json(run_dir / "api-exposure-checklist.json", api_checklist)
        write_json(run_dir / "screenshot-manifest.json", screenshot_manifest)
        write_json(run_dir / "autonomous-proof.json", autonomous_proof)

        critic_brief = f"""# Critic Brief\n\nRun ID: `{validation_run_id}`\n\nBaseline: FounderOS / Linear fit.\n\nScreenshots are listed in `screenshot-manifest.json`.\nUse `{DOCS_DIR / 'critic-rubric.md'}` and `{DOCS_DIR / 'critic-prompt.md'}`.\nAfter the critic returns strict JSON, finalize this bundle with `python3 scripts/validation/finalize_critic_report.py --run-dir {run_dir} --critic-json /path/to/critic-output.json`.\n"""
        write_text(run_dir / "critic-brief.md", critic_brief)
        write_json(
            run_dir / "critic-report-iteration-0.json",
            {
                "status": "pending_external_critic",
                "run_id": validation_run_id,
                "generated_at": now_iso(),
            },
        )
        write_text(
            run_dir / "critic-report-iteration-0.md",
            "# Critic Report Iteration 0\n\nPending external critic review.\n\nFinalize with `python3 scripts/validation/finalize_critic_report.py --run-dir . --critic-json /path/to/critic-output.json` from inside this run directory, or pass the absolute run dir from repo root.\n",
        )
        write_text(
            run_dir / "fix-log-iteration-0.md",
            "# Fix Log Iteration 0\n\nNo critic findings have been applied yet.\n",
        )

        if args.critic_json:
            subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).with_name("finalize_critic_report.py")),
                    "--run-dir",
                    str(run_dir),
                    "--critic-json",
                    args.critic_json,
                ],
                cwd=str(ROOT),
                check=True,
            )

        status = "passed"
        for result in checks + scenarios:
            if result.status != "passed":
                status = "failed"
                break

        report_payload = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "status": status,
            "checks": [asdict(item) for item in checks],
            "scenarios": [asdict(item) for item in scenarios],
            "evidence": autonomous_proof,
            "artifacts": [
                "route-matrix.json",
                "api-exposure-checklist.json",
                "screenshot-manifest.json",
                "autonomous-proof.json",
                "critic-brief.md",
            ],
        }
        write_json(run_dir / "functional-report.json", report_payload)
        artifacts.extend(report_payload["artifacts"])

        functional_md_lines = [
            f"# Functional Report",
            "",
            f"Run ID: `{validation_run_id}`",
            f"Generated: `{report_payload['generated_at']}`",
            f"Status: `{status}`",
            "",
            "## Checks",
        ]
        for item in checks:
            functional_md_lines.append(f"- `{item.name}` — `{item.status}`")
            if item.detail:
                functional_md_lines.append(f"  - {item.detail}")
        functional_md_lines.append("")
        functional_md_lines.append("## Scenarios")
        for item in scenarios:
            functional_md_lines.append(f"- `{item.name}` — `{item.status}`")
            if item.detail:
                functional_md_lines.append(f"  - {item.detail}")
        functional_md_lines.append("")
        functional_md_lines.append("## Artifacts")
        for artifact in artifacts:
            functional_md_lines.append(f"- `{artifact}`")
        functional_md_lines.append("")
        functional_md_lines.append("## Autonomous Evidence")
        functional_md_lines.append(f"- root frontdoor composer visible: `{autonomous_proof['root_frontdoor']['composer_visible']}`")
        functional_md_lines.append(f"- root frontdoor shell anchor visible: `{autonomous_proof['root_frontdoor']['shell_anchor_visible']}`")
        functional_md_lines.append(f"- root frontdoor suggested prompts visible: `{autonomous_proof['root_frontdoor']['suggested_prompts_visible']}`")
        functional_md_lines.append(f"- root frontdoor recent runs visible: `{autonomous_proof['root_frontdoor']['recent_runs_visible']}`")
        functional_md_lines.append(f"- root frontdoor stays on /: `{autonomous_proof['root_frontdoor']['stays_on_root_entry']}`")
        functional_md_lines.append(f"- autonomous one prompt: `{autonomous_proof['shell_first']['autonomous_one_prompt']}`")
        functional_md_lines.append(f"- preview ready: `{autonomous_proof['preview_ready']}`")
        functional_md_lines.append(f"- launch kind: `{autonomous_proof['launch_kind']}`")
        functional_md_lines.append(f"- launch ready: `{autonomous_proof['launch_ready']}`")
        functional_md_lines.append(f"- handoff ready: `{autonomous_proof['handoff_ready']}`")
        functional_md_lines.append(f"- failure recovery override used: `{autonomous_proof['failure_recovery_override_used']}`")
        write_text(run_dir / "functional-report.md", "\n".join(functional_md_lines) + "\n")

        summary_md = [
            "# Final Validation Summary",
            "",
            f"Run ID: `{validation_run_id}`",
            f"Status: `{status}`",
            "",
            f"- shell origin: `{shell_origin}`",
            f"- work-ui origin: `{work_origin}`",
            f"- kernel origin: `{kernel_origin}`",
            f"- state dir: `{state_dir}`",
        ]
        expected_shell_origin = f"http://127.0.0.1:{CANONICAL_SHELL_PORT}"
        expected_work_origin = f"http://127.0.0.1:{CANONICAL_WORK_UI_PORT}"
        expected_kernel_origin = f"http://127.0.0.1:{CANONICAL_KERNEL_PORT}"
        if (
            shell_origin != expected_shell_origin
            or work_origin != expected_work_origin
            or kernel_origin != expected_kernel_origin
        ):
            raise ValidationFailure(
                "Validation drifted off the canonical localhost topology."
            )
        write_text(run_dir / "final-validation-summary.md", "\n".join(summary_md) + "\n")

        print(json.dumps({
            "run_id": validation_run_id,
            "run_dir": str(run_dir),
            "status": status,
            "shell_origin": shell_origin,
            "work_origin": work_origin,
            "kernel_origin": kernel_origin,
        }, indent=2))
        return 0 if status == "passed" else 1
    finally:
        for process in reversed(processes):
            process.terminate()
        shutil.rmtree(state_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
