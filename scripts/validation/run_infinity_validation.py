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


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def choose_available_port(preferred: int, *, span: int = 40) -> int:
    if port_available(preferred):
        return preferred
    for port in range(preferred + 1, preferred + span + 1):
        if port_available(port):
            return port
    raise ValidationFailure(
        f"No free localhost port found near {preferred}; stop conflicting services and retry."
    )


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


def git_status_short() -> str:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout


def status_lines(status: str) -> list[str]:
    return [line for line in status.splitlines() if line.strip()]


def summarize_tracked_state(before: str, after: str) -> dict[str, Any]:
    before_lines = status_lines(before)
    after_lines = status_lines(after)
    before_set = set(before_lines)
    after_set = set(after_lines)
    return {
        "unchanged": before_lines == after_lines,
        "before_line_count": len(before_lines),
        "after_line_count": len(after_lines),
        "added_lines": sorted(after_set - before_set),
        "removed_lines": sorted(before_set - after_set),
    }


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


def mint_workspace_launch_url(shell_origin: str, session_id: str) -> str:
    response = requests.get(
        f"{shell_origin}/execution/workspace/{session_id}",
        timeout=10,
    )
    response.raise_for_status()
    match = re.search(r"<iframe[^>]+src=\"([^\"]+)\"", response.text)
    if not match:
        raise ValidationFailure("Could not derive the shell-authored work-ui launch URL from the workspace page.")
    return html.unescape(match.group(1)).replace("&amp;", "&")


def build_embedded_url(base: str, shell_origin: str, session_id: str, path: str) -> str:
    launch_url = mint_workspace_launch_url(shell_origin, session_id)
    parsed = requests.compat.urlparse(launch_url)
    return requests.compat.urlunparse(parsed._replace(path=path))


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


def assert_no_false_local_production_claims(page, screen_name: str) -> None:
    body_text = page.locator("body").inner_text().lower()
    forbidden = [
        "handoff ready",
        "handoff-ready",
        "handoff is ready",
        "handoff are ready",
        "production handoff ready",
        "production ready",
        "production-ready",
    ]
    found = [claim for claim in forbidden if claim in body_text]
    if found:
        raise ValidationFailure(
            f"{screen_name} exposes production/handoff-ready copy in local validation: {', '.join(found)}"
        )
    if "readiness tier" not in body_text or "local solo" not in body_text:
        raise ValidationFailure(
            f"{screen_name} does not show the local_solo readiness tier next to delivery proof."
        )


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
    while time.time() - started < 90:
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
        body_text = page.locator("body").inner_text(timeout=5000)
        raise ValidationFailure(
            "Start run did not navigate to either the primary run route or continuity detail. "
            f"Current URL: {page.url}. Body excerpt: {body_text[:500]}"
        )

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
    session_id = str(continuity["initiative"].get("workspaceSessionId") or "").strip()
    if not session_id:
        raise ValidationFailure(
            f"Happy path initiative {initiative_id} did not expose a workspaceSessionId for embedded work-ui routes."
        )
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
    page.wait_for_selector("text=Project brief", timeout=30000)
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
    page.wait_for_selector("text=Project run", timeout=30000)
    capture_screenshot(page, "workui_project_run", str(screenshots_dir / "workui_project_run.png"), manifest, page.url, "happy_path")
    run_stage_labels = assert_no_required_stage_labels(page, "workui_project_run")

    result_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-result/{initiative_id}")
    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Project result", timeout=30000)
    page.wait_for_selector("text=Return to shell workspace", timeout=30000)
    capture_screenshot(page, "workui_project_result_passed", str(screenshots_dir / "workui_project_result_passed.png"), manifest, page.url, "happy_path")
    result_stage_labels = assert_no_required_stage_labels(page, "workui_project_result_passed")
    assert_no_false_local_production_claims(page, "workui_project_result_passed")
    delivery_id = str(delivery["id"]).strip()
    launch_ready = str(delivery.get("launchProofKind") or "") == "runnable_result" and str(delivery.get("status") or "") == "ready"

    if require_runnable_result and not launch_ready:
        raise ValidationFailure(
            f"Happy path only reached `{launch_state['launch_kind']}` proof. A green finish gate now requires a real runnable_result delivery."
        )

    return {
        "initiative_id": initiative_id,
        "session_id": session_id,
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


def run_failure_and_recovery_path(page, shell_origin: str, work_origin: str, manifest: list[ScreenshotRecord], screenshots_dir: Path, api_snapshots_dir: Path) -> dict[str, Any]:
    initiative = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/initiatives",
        {
            "title": f"Validation Failure {int(time.time())}",
            "userRequest": "Validate blocked and retryable execution states.",
            "requestedBy": "martin",
        },
    )["initiative"]
    initiative_id = initiative["id"]
    session_id = str(initiative.get("workspaceSessionId") or "").strip()
    if not session_id:
        raise ValidationFailure(
            f"Failure-path initiative {initiative_id} did not expose a workspaceSessionId for embedded work-ui routes."
        )

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

    failed_verification = request_json(
        "POST",
        f"{shell_origin}/api/control/orchestration/verification",
        {"initiativeId": initiative_id},
        timeout=(2, 120),
    )["verification"]
    if failed_verification.get("overallStatus") != "failed":
        raise ValidationFailure(
            "Failure path expected an incomplete blocked run to create a failed verification recovery incident."
        )
    write_json(api_snapshots_dir / "failure-path-verification-failed.json", failed_verification)

    recoveries_url = (
        f"{shell_origin}/api/control/execution/recoveries"
        f"?session_id={session_id}&initiative_id={initiative_id}"
    )
    recoveries_directory = request_json("GET", recoveries_url)
    write_json(api_snapshots_dir / "failure-path-recoveries-scoped.json", recoveries_directory)
    recovery_incidents = [
        incident
        for incident in recoveries_directory.get("incidents", [])
        if isinstance(incident, dict)
        and incident.get("sessionId") == session_id
        and incident.get("projectId") == initiative_id
    ]
    if len(recovery_incidents) != 1:
        raise ValidationFailure(
            f"Failure path expected exactly one scoped recovery incident for session {session_id} and initiative {initiative_id}; got {len(recovery_incidents)}."
        )
    recovery_incident = recovery_incidents[0]
    recovery_id = str(recovery_incident.get("id") or "")
    if not recovery_id or recovery_incident.get("status") != "retryable":
        raise ValidationFailure("Failure path scoped recovery incident was not retryable.")

    shell_batch_url = f"{shell_origin}/execution/batches/{batch_id}?initiative_id={initiative_id}&task_graph_id={task_graph_id}"
    page.goto(shell_batch_url, wait_until="networkidle")
    page.wait_for_selector("text=Batch Supervision", timeout=15000)
    capture_screenshot(page, "shell_retryable_recovery", str(screenshots_dir / "shell_retryable_recovery.png"), manifest, page.url, "failure_path")

    shell_run_url = f"{shell_origin}/execution/runs/{initiative_id}?session_id={session_id}"
    page.goto(shell_run_url, wait_until="networkidle")
    page.wait_for_selector("text=Primary run", timeout=15000)
    shell_run_body = page.locator("body").inner_text(timeout=5000)
    if recovery_id not in shell_run_body and str(recovery_incident.get("summary") or "") not in shell_run_body:
        raise ValidationFailure("Blocked run page did not show the scoped recovery incident.")
    if "Force retry" not in shell_run_body:
        raise ValidationFailure("Blocked run page did not keep the recovery retry action visible.")
    capture_screenshot(page, "shell_run_blocked_recovery", str(screenshots_dir / "shell_run_blocked_recovery.png"), manifest, page.url, "failure_path")

    shell_recoveries_url = f"{shell_origin}/execution/recoveries?session_id={session_id}&initiative_id={initiative_id}"
    page.goto(shell_recoveries_url, wait_until="networkidle")
    page.wait_for_selector("text=Recoveries", timeout=15000)
    page.wait_for_selector(f"text={recovery_id}", timeout=15000)
    recoveries_body = page.locator("body").inner_text(timeout=5000)
    if "Retry" not in recoveries_body:
        raise ValidationFailure("Scoped recoveries board did not expose the retry action.")
    workspace_link = page.locator('a:has-text("Open workspace")').first
    workspace_href = workspace_link.get_attribute("href") if workspace_link.count() else None
    if not workspace_href or session_id not in workspace_href:
        raise ValidationFailure("Scoped recoveries board did not preserve the workspace link for the blocked run.")
    capture_screenshot(page, "shell_recoveries_scoped_failure", str(screenshots_dir / "shell_recoveries_scoped_failure.png"), manifest, page.url, "failure_path")

    run_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-run/{initiative_id}")
    page.goto(run_url, wait_until="networkidle")
    page.wait_for_selector("text=Project run", timeout=30000)
    capture_screenshot(page, "workui_run_blocked", str(screenshots_dir / "workui_run_blocked.png"), manifest, page.url, "failure_path")
    assert_no_required_stage_labels(page, "workui_run_blocked")
    result_url = build_embedded_url(work_origin, shell_origin, session_id, f"/project-result/{initiative_id}")
    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Project result", timeout=30000)
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

    retry_response = request_json(
        "POST",
        f"{shell_origin}/api/control/execution/recoveries/{recovery_id}",
        {"actionKind": "retry"},
        timeout=(2, 120),
    )
    write_json(api_snapshots_dir / "failure-path-recovery-retry-response.json", retry_response)
    operator_action = retry_response.get("operatorAction")
    if not isinstance(operator_action, dict) or operator_action.get("kind") != "recovery.retry_requested":
        raise ValidationFailure("Recovery retry action did not return a recovery.retry_requested audit event.")

    audits = request_json("GET", f"{shell_origin}/api/control/execution/audits")
    write_json(api_snapshots_dir / "failure-path-audit-after-retry.json", audits)
    audit_events = audits.get("events") if isinstance(audits.get("events"), list) else []
    if not any(
        isinstance(event, dict)
        and event.get("id") == operator_action.get("id")
        and event.get("targetId") == recovery_id
        and event.get("kind") == "recovery.retry_requested"
        for event in audit_events
    ):
        raise ValidationFailure("Audit API did not expose the recovery retry operator action.")

    page.goto(result_url, wait_until="networkidle")
    page.wait_for_selector("text=Return to shell workspace", timeout=30000)

    return {
        "initiative_id": initiative_id,
        "task_graph_id": task_graph_id,
        "delivery_id": delivery["id"],
        "recovery_id": recovery_id,
        "recovery_retry_audit_id": operator_action.get("id"),
        "recovered_batches": recovered_batches,
        "recovery_override_used": True,
        "recoveries_board_scoped": True,
        "workspace_link_preserved": True,
        "audit_event_verified": True,
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


def parse_json_stdout(stdout: str) -> dict[str, Any] | None:
    start = stdout.find("{")
    end = stdout.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        payload = json.loads(stdout[start : end + 1])
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def run_browser_e2e_solo_check(logs_dir: Path) -> tuple[CheckResult, dict[str, Any]]:
    command = [sys.executable, str(ROOT / "scripts" / "validation" / "run_browser_e2e_solo.py")]
    started = time.time()
    result = subprocess.run(
        command,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=1800,
        check=False,
    )
    duration = time.time() - started
    log_path = logs_dir / "browser_e2e_solo.log"
    write_text(
        log_path,
        "\n".join(
            [
                "$ " + " ".join(command),
                "",
                "## stdout",
                result.stdout,
                "",
                "## stderr",
                result.stderr,
                "",
            ]
        ),
    )

    payload = parse_json_stdout(result.stdout)
    report_path = payload.get("report") if isinstance(payload, dict) else None
    run_dir = payload.get("run_dir") if isinstance(payload, dict) else None
    browser_status = payload.get("status") if isinstance(payload, dict) else "unknown"
    record = {
        "status": browser_status,
        "run_dir": run_dir,
        "report_path": report_path,
        "log_path": str(log_path),
        "duration_seconds": round(duration, 2),
        "exit_code": result.returncode,
        "skipped_reason": None,
    }

    if result.returncode == 0 and browser_status == "passed" and report_path:
        return (
            CheckResult(
                "browser_e2e_solo",
                "passed",
                f"Browser E2E passed in {duration:.2f}s. Report: {report_path}",
            ),
            record,
        )

    detail = (
        f"Browser E2E failed with exit {result.returncode} after {duration:.2f}s. "
        f"Report: {report_path or 'not emitted'}. Log: {log_path}"
    )
    return CheckResult("browser_e2e_solo", "failed", detail), record


def skipped_browser_e2e_check(reason: str) -> tuple[CheckResult, dict[str, Any]]:
    normalized = reason.strip()
    if not normalized:
        raise ValidationFailure("--skip-browser-e2e requires a non-empty reason.")
    return (
        CheckResult("browser_e2e_solo", "skipped", normalized),
        {
            "status": "skipped",
            "run_dir": None,
            "report_path": None,
            "log_path": None,
            "duration_seconds": 0,
            "exit_code": None,
            "skipped_reason": normalized,
        },
    )


def compute_functional_status(results: list[CheckResult]) -> str:
    for result in results:
        if result.status not in {"passed", "skipped"}:
            return "failed"
    return "passed"


def summarize_repo_checks(checks: list[CheckResult]) -> dict[str, Any]:
    repo_checks = [check for check in checks if check.name != "browser_e2e_solo"]
    if not repo_checks:
        return {
            "status": "skipped",
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
        }

    failed = sum(1 for check in repo_checks if check.status == "failed")
    skipped = sum(1 for check in repo_checks if check.status == "skipped")
    passed = sum(1 for check in repo_checks if check.status == "passed")
    return {
        "status": "failed" if failed else "passed",
        "total": len(repo_checks),
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
    }


def summarize_browser_product_e2e(browser_e2e: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": browser_e2e.get("status", "unknown"),
        "report_path": browser_e2e.get("report_path"),
        "run_dir": browser_e2e.get("run_dir"),
        "skipped_reason": browser_e2e.get("skipped_reason"),
    }


def summarize_critic_gate(critic: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(critic, dict):
        return {
            "status": "missing",
            "report_path": None,
            "pass": False,
            "overall_score": None,
            "min_core_cluster_score": None,
            "unresolved_must_fix": None,
        }

    raw_critic = critic.get("critic") if isinstance(critic.get("critic"), dict) else critic
    cluster_scores = raw_critic.get("cluster_scores")
    min_cluster_score = (
        min(cluster_scores.values())
        if isinstance(cluster_scores, dict) and cluster_scores
        else critic.get("min_core_cluster_score")
    )
    findings = raw_critic.get("findings")
    unresolved_must_fix = critic.get("unresolved_must_fix")
    if unresolved_must_fix is None and isinstance(findings, list):
        unresolved_must_fix = sum(
            1
            for finding in findings
            if isinstance(finding, dict)
            and str(finding.get("severity") or "").lower() == "must_fix"
        )

    return {
        "status": critic.get("status", "unknown"),
        "report_path": critic.get("report_path"),
        "pass": bool(raw_critic.get("pass")),
        "overall_score": raw_critic.get("overall_score"),
        "min_core_cluster_score": min_cluster_score,
        "unresolved_must_fix": unresolved_must_fix,
    }


def build_release_readiness(
    *,
    functional_status: str,
    checks: list[CheckResult],
    browser_e2e: dict[str, Any],
    critic: dict[str, Any] | None,
) -> dict[str, Any]:
    repo_checks = summarize_repo_checks(checks)
    browser_product_e2e = summarize_browser_product_e2e(browser_e2e)
    critic_gate = summarize_critic_gate(critic)
    blocking_reasons: list[str] = []

    if functional_status != "passed":
        blocking_reasons.append("functional_validation_failed")
    if repo_checks["status"] == "failed":
        blocking_reasons.append("repo_checks_failed")
    if browser_product_e2e["status"] != "passed":
        blocking_reasons.append(
            "browser_product_e2e_skipped"
            if browser_product_e2e["status"] == "skipped"
            else "browser_product_e2e_not_passed"
        )
    if critic_gate["status"] != "completed_external_critic":
        blocking_reasons.append("critic_not_finalized")
    elif not critic_gate["pass"]:
        blocking_reasons.append("critic_failed")
    else:
        overall_score = critic_gate.get("overall_score")
        min_core_cluster_score = critic_gate.get("min_core_cluster_score")
        unresolved_must_fix = critic_gate.get("unresolved_must_fix")
        if not isinstance(overall_score, (int, float)) or overall_score <= 7.0:
            blocking_reasons.append("critic_score_below_threshold")
        if (
            not isinstance(min_core_cluster_score, (int, float))
            or min_core_cluster_score < 6.5
        ):
            blocking_reasons.append("critic_core_cluster_below_threshold")
        if unresolved_must_fix not in {0, None}:
            blocking_reasons.append("critic_must_fix_unresolved")

    release_status = "final_ready" if not blocking_reasons else "not_final"
    if functional_status != "passed" or browser_product_e2e["status"] == "failed":
        legacy_status = "failed"
    elif release_status == "final_ready":
        legacy_status = "passed-final-release"
    else:
        legacy_status = "functional-only"

    return {
        "repo_checks": repo_checks,
        "browser_product_e2e": browser_product_e2e,
        "critic": critic_gate,
        "release_readiness": {
            "status": release_status,
            "legacy_status": legacy_status,
            "blocking_reasons": blocking_reasons,
        },
    }


def unwrap_api_snapshot(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    response = payload.get("response")
    if isinstance(response, dict) and isinstance(response.get("body"), dict):
        return response["body"]
    return payload


def load_optional_json(path: str | None) -> Any:
    if not path:
        return None
    candidate = Path(path)
    if not candidate.exists():
        return None
    return load_json(candidate)


def checklist_line(label: str, passed: bool, evidence: str) -> str:
    status = "PASS" if passed else "NOT CHECKED"
    marker = "x" if passed else " "
    return f"- [{marker}] {label} - `{status}` - {evidence}"


def build_manual_browser_checklist(browser_e2e: dict[str, Any]) -> str:
    browser_report = load_optional_json(str(browser_e2e.get("report_path") or "")) or {}
    raw_artifacts = browser_report.get("artifacts") if isinstance(browser_report, dict) else {}
    artifacts = raw_artifacts if isinstance(raw_artifacts, dict) else {}
    screenshots_dir = Path(str(artifacts.get("screenshots_dir") or ""))
    api_snapshots_dir = Path(str(artifacts.get("api_snapshots_dir") or ""))
    continuity_path = api_snapshots_dir / "06-continuity-delivery-ready.json"
    continuity = unwrap_api_snapshot(load_optional_json(str(continuity_path)))
    work_units = browser_report.get("work_units") if isinstance(browser_report, dict) else []
    verification = browser_report.get("verification") if isinstance(browser_report, dict) else {}
    delivery = browser_report.get("delivery") if isinstance(browser_report, dict) else {}
    preview = browser_report.get("preview") if isinstance(browser_report, dict) else {}
    restart = browser_report.get("restart_continuity") if isinstance(browser_report, dict) else {}

    prompt = str(browser_report.get("prompt") or "").strip()
    initiative_id = str(browser_report.get("initiative_id") or "").strip()
    task_graph_id = str(browser_report.get("task_graph_id") or "").strip()
    frontdoor_screenshot = screenshots_dir / "01-root-frontdoor.png"
    task_graph_screenshot = screenshots_dir / "03-task-graph-visible.png"

    lines = [
        "# Manual Browser Checklist",
        "",
        f"Browser E2E status: `{browser_e2e.get('status')}`",
        f"Browser report: `{browser_e2e.get('report_path')}`",
        f"Prompt: `{prompt}`",
        f"Initiative: `{initiative_id}`",
        "",
        "This checklist is generated from the browser E2E report and API/browser snapshots.",
        "Items marked `NOT CHECKED` are release gaps unless the Browser E2E was explicitly skipped.",
        "",
        "## Evidence",
        "",
        checklist_line(
            "root frontdoor visible",
            frontdoor_screenshot.exists(),
            f"screenshot `{frontdoor_screenshot}`",
        ),
        checklist_line(
            "prompt submitted",
            bool(prompt and initiative_id),
            f"initiative `{initiative_id}` from report",
        ),
        checklist_line(
            "brief created",
            bool(isinstance(continuity.get("briefs"), list) and continuity["briefs"]),
            f"snapshot `{continuity_path}`",
        ),
        checklist_line(
            "task graph visible",
            bool(task_graph_id and task_graph_screenshot.exists()),
            f"task graph `{task_graph_id}`, screenshot `{task_graph_screenshot}`",
        ),
        checklist_line(
            "microtasks visible",
            bool(isinstance(work_units, list) and work_units),
            f"{len(work_units) if isinstance(work_units, list) else 0} work units in browser report",
        ),
        checklist_line(
            "attempts visible",
            bool(
                isinstance(work_units, list)
                and work_units
                and all(isinstance(item, dict) and item.get("attempt_ids") for item in work_units)
            ),
            "every work unit has at least one attempt id",
        ),
        checklist_line(
            "assembly visible",
            bool(isinstance(continuity.get("assembly"), dict) and continuity["assembly"].get("status") == "assembled"),
            f"snapshot `{continuity_path}`",
        ),
        checklist_line(
            "verification passed",
            bool(isinstance(verification, dict) and verification.get("overall_status") == "passed"),
            f"verification `{verification.get('id') if isinstance(verification, dict) else None}`",
        ),
        checklist_line(
            "delivery ready",
            bool(
                isinstance(delivery, dict)
                and delivery.get("status") == "ready"
                and delivery.get("launch_proof_kind") == "runnable_result"
            ),
            f"delivery `{delivery.get('id') if isinstance(delivery, dict) else None}`",
        ),
        checklist_line(
            "preview opened",
            bool(isinstance(preview, dict) and preview.get("http_status") == 200),
            f"preview status `{preview.get('http_status') if isinstance(preview, dict) else None}`",
        ),
        checklist_line(
            "generated app interacted with",
            bool(
                isinstance(preview, dict)
                and preview.get("interaction_assertions", {})
                .get("assertions", {})
                .get("bill_amount_100_tip_20")
            ),
            "tip calculator returned `$20.00` and `$120.00` for 100 at 20%",
        ),
        checklist_line(
            "restart continuity checked",
            bool(isinstance(restart, dict) and restart.get("checked") is True),
            f"restart snapshot `{restart.get('api_snapshot') if isinstance(restart, dict) else None}`",
        ),
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-static-checks", action="store_true")
    parser.add_argument("--require-runnable-result", action="store_true")
    parser.add_argument(
        "--skip-browser-e2e",
        metavar="REASON",
        help="Record a named browser-E2E skip and downgrade release status to functional-only.",
    )
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
    api_snapshots_dir = run_dir / "api-snapshots"
    logs_dir.mkdir(parents=True, exist_ok=True)
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    api_snapshots_dir.mkdir(parents=True, exist_ok=True)
    git_status_before = git_status_short()
    write_text(run_dir / "git-status-before.txt", git_status_before)

    shell_port = choose_available_port(CANONICAL_SHELL_PORT)
    work_port = choose_available_port(CANONICAL_WORK_UI_PORT)
    kernel_port = choose_available_port(CANONICAL_KERNEL_PORT)
    shell_origin = f"http://127.0.0.1:{shell_port}"
    work_origin = f"http://127.0.0.1:{work_port}"
    kernel_origin = f"http://127.0.0.1:{kernel_port}"
    port_fallbacks = {
        "shell_requested": CANONICAL_SHELL_PORT,
        "shell_actual": shell_port,
        "work_ui_requested": CANONICAL_WORK_UI_PORT,
        "work_ui_actual": work_port,
        "kernel_requested": CANONICAL_KERNEL_PORT,
        "kernel_actual": kernel_port,
    }
    state_dir = Path(tempfile.mkdtemp(prefix="infinity-validation-state-"))

    checks: list[CheckResult] = []
    scenarios: list[CheckResult] = []
    screenshots: list[ScreenshotRecord] = []
    processes: list[ManagedProcess] = []
    artifacts: list[str] = []

    try:
        def work_ui_validation_env(memory_mb: int) -> dict[str, str]:
            env = with_node_memory(None, memory_mb)
            env["PUBLIC_FOUNDEROS_SHELL_ORIGIN"] = shell_origin
            env["VITE_FOUNDEROS_SHELL_ORIGIN"] = shell_origin
            return env

        if not args.skip_static_checks:
            checks.extend(
                [
                    run_command("shell_lint", ["npm", "run", "lint", "--workspace", "@founderos/web"], ROOT, logs_dir),
                    run_command("shell_typecheck", ["npm", "run", "typecheck", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("shell_test", ["npm", "run", "test", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("shell_build", ["npm", "run", "build", "--workspace", "@founderos/web"], ROOT, logs_dir, env=with_node_memory(None, 1280)),
                    run_command("work_ui_check", ["npm", "run", "check", "--workspace", "open-webui"], ROOT, logs_dir, env=work_ui_validation_env(3072)),
                    run_command("work_ui_test", ["npm", "run", "test:frontend:ci", "--workspace", "open-webui"], ROOT, logs_dir, env=with_node_memory(None, 1024)),
                    run_command("work_ui_build", ["npm", "run", "build", "--workspace", "open-webui"], ROOT, logs_dir, env=work_ui_validation_env(4096)),
                ]
            )

        if args.skip_browser_e2e is not None:
            browser_e2e_check, browser_e2e = skipped_browser_e2e_check(args.skip_browser_e2e)
        else:
            browser_e2e_check, browser_e2e = run_browser_e2e_solo_check(logs_dir)
        checks.append(browser_e2e_check)

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
        shell_env["FOUNDEROS_WORK_UI_BASE_URL"] = work_origin
        shell_env.pop("FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON", None)
        shell_env.pop("FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON", None)
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
        work_env["VITE_FOUNDEROS_SHELL_ORIGIN"] = shell_origin
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
        wait_http(f"{shell_origin}/")
        wait_http(f"{work_origin}/")

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

            failure = run_failure_and_recovery_path(page, shell_origin, work_origin, screenshots, screenshots_dir, api_snapshots_dir)
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
            validation_approval_id = f"approval-validation-{int(time.time() * 1000)}"
            created_approval = request_json(
                "POST",
                f"{shell_origin}/api/control/execution/approvals",
                {
                    "id": validation_approval_id,
                    "sessionId": happy["session_id"],
                    "projectId": happy["initiative_id"],
                    "projectName": "Validation approval probe",
                    "requestKind": "command",
                    "title": "Validation pending approval",
                    "summary": "Approve the browser validation command before final release.",
                    "reason": "browser_e2e_pending_approval_probe",
                    "raw": {
                        "validationRunDir": str(run_dir),
                    },
                },
            )
            write_json(api_snapshots_dir / "approval-created-pending.json", created_approval)
            page.goto(shell_approvals_url, wait_until="networkidle")
            page.wait_for_selector("text=Validation pending approval", timeout=15000)
            capture_screenshot(page, "shell_pending_approval", str(screenshots_dir / "shell_pending_approval.png"), screenshots, page.url, "operator_states")
            approve_button = page.locator('button:has-text("Approve once")').first
            if not approve_button.count() or not approve_button.is_enabled():
                raise ValidationFailure("Approvals board did not expose an enabled Approve once action for the validation approval.")
            approve_button.click()
            page.wait_for_selector("text=approved", timeout=15000)
            resolved_approval = request_json(
                "GET",
                f"{shell_origin}/api/control/execution/approvals/{validation_approval_id}",
            )
            write_json(api_snapshots_dir / "approval-resolved-after-respond.json", resolved_approval)
            if resolved_approval.get("approvalRequest", {}).get("status") != "approved":
                raise ValidationFailure("Approval respond API did not resolve the validation approval to approved.")
            capture_screenshot(page, "shell_approvals", str(screenshots_dir / "shell_approvals.png"), screenshots, page.url, "shell_operator")

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
                page.wait_for_selector("text=Result summary", timeout=15000)
                assert_no_false_local_production_claims(page, "shell_delivery_ready")
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
            "failure_recovery": {
                "recovery_id": failure["recovery_id"],
                "retry_audit_id": failure["recovery_retry_audit_id"],
                "recoveries_board_scoped": failure["recoveries_board_scoped"],
                "workspace_link_preserved": failure["workspace_link_preserved"],
                "audit_event_verified": failure["audit_event_verified"],
            },
        }

        write_json(run_dir / "route-matrix.json", route_matrix)
        write_json(run_dir / "api-exposure-checklist.json", api_checklist)
        write_json(run_dir / "screenshot-manifest.json", screenshot_manifest)
        write_json(run_dir / "autonomous-proof.json", autonomous_proof)
        manual_browser_checklist = build_manual_browser_checklist(browser_e2e)
        write_text(run_dir / "manual-browser-checklist.md", manual_browser_checklist)

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

        git_status_after = git_status_short()
        write_text(run_dir / "git-status-after.txt", git_status_after)
        tracked_state = summarize_tracked_state(git_status_before, git_status_after)
        status = compute_functional_status(checks + scenarios)
        critic_report_path = run_dir / "critic-report-iteration-0.json"
        critic_state = load_optional_json(str(critic_report_path))
        if isinstance(critic_state, dict):
            critic_state["report_path"] = str(critic_report_path)
        release_layers = build_release_readiness(
            functional_status=status,
            checks=checks,
            browser_e2e=browser_e2e,
            critic=critic_state if isinstance(critic_state, dict) else None,
        )
        release_status = release_layers["release_readiness"]["legacy_status"]

        report_payload = {
            "run_id": validation_run_id,
            "generated_at": now_iso(),
            "status": status,
            "release_status": release_status,
            "repo_checks": release_layers["repo_checks"],
            "browser_product_e2e": release_layers["browser_product_e2e"],
            "critic": release_layers["critic"],
            "release_readiness": release_layers["release_readiness"],
            "tracked_state": tracked_state,
            "browser_e2e": browser_e2e,
            "port_fallbacks": port_fallbacks,
            "checks": [asdict(item) for item in checks],
            "scenarios": [asdict(item) for item in scenarios],
            "evidence": autonomous_proof,
            "artifacts": [
                "route-matrix.json",
                "api-exposure-checklist.json",
                "screenshot-manifest.json",
                "autonomous-proof.json",
                "api-snapshots/",
                "manual-browser-checklist.md",
                "critic-brief.md",
                "git-status-before.txt",
                "git-status-after.txt",
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
            f"Release status: `{release_status}`",
            f"Release readiness: `{release_layers['release_readiness']['status']}`",
            "",
            "## Release Layers",
            f"- repo_checks: `{release_layers['repo_checks']['status']}`",
            f"- browser_product_e2e: `{release_layers['browser_product_e2e']['status']}`",
            f"- critic: `{release_layers['critic']['status']}`",
            f"- release_readiness: `{release_layers['release_readiness']['status']}`",
            f"- blocking reasons: `{', '.join(release_layers['release_readiness']['blocking_reasons']) or 'none'}`",
            f"- tracked_state_unchanged: `{tracked_state['unchanged']}`",
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
        functional_md_lines.append("## Browser E2E")
        functional_md_lines.append(f"- status: `{browser_e2e['status']}`")
        if browser_e2e.get("report_path"):
            functional_md_lines.append(f"- report: `{browser_e2e['report_path']}`")
        if browser_e2e.get("skipped_reason"):
            functional_md_lines.append(f"- skipped reason: `{browser_e2e['skipped_reason']}`")
        if browser_e2e.get("log_path"):
            functional_md_lines.append(f"- log: `{browser_e2e['log_path']}`")
        functional_md_lines.append("- manual browser checklist: `manual-browser-checklist.md`")
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
        functional_md_lines.append(f"- handoff packet ready (local_solo): `{autonomous_proof['handoff_ready']}`")
        functional_md_lines.append(f"- failure recovery override used: `{autonomous_proof['failure_recovery_override_used']}`")
        write_text(run_dir / "functional-report.md", "\n".join(functional_md_lines) + "\n")

        summary_md = [
            "# Final Validation Summary",
            "",
            f"Run ID: `{validation_run_id}`",
            f"Status: `{release_status}`",
            f"Functional status: `{status}`",
            f"Browser E2E status: `{browser_e2e['status']}`",
            f"Repo checks status: `{release_layers['repo_checks']['status']}`",
            f"Critic status: `{release_layers['critic']['status']}`",
            f"Release readiness: `{release_layers['release_readiness']['status']}`",
            f"Release blocking reasons: `{', '.join(release_layers['release_readiness']['blocking_reasons']) or 'none'}`",
            f"Tracked state unchanged: `{tracked_state['unchanged']}`",
            "",
            f"- shell origin: `{shell_origin}`",
            f"- work-ui origin: `{work_origin}`",
            f"- kernel origin: `{kernel_origin}`",
            f"- state dir: `{state_dir}`",
            f"- shell port requested/actual: `{CANONICAL_SHELL_PORT}` / `{shell_port}`",
            f"- work-ui port requested/actual: `{CANONICAL_WORK_UI_PORT}` / `{work_port}`",
            f"- kernel port requested/actual: `{CANONICAL_KERNEL_PORT}` / `{kernel_port}`",
        ]
        if browser_e2e.get("report_path"):
            summary_md.append(f"- browser E2E report: `{browser_e2e['report_path']}`")
        summary_md.append("- manual browser checklist: `manual-browser-checklist.md`")
        if browser_e2e.get("skipped_reason"):
            summary_md.append(
                f"- browser E2E skipped reason: `{browser_e2e['skipped_reason']}`"
            )
        write_text(run_dir / "final-validation-summary.md", "\n".join(summary_md) + "\n")

        print(json.dumps({
            "run_id": validation_run_id,
            "run_dir": str(run_dir),
            "status": status,
            "release_status": release_status,
            "release_readiness": release_layers["release_readiness"],
            "tracked_state": tracked_state,
            "browser_e2e": browser_e2e,
            "port_fallbacks": port_fallbacks,
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
