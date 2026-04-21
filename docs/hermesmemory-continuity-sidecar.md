# Hermes Memory Continuity Sidecar

This repository treats `hermesmemory` as a separate local-first continuity sidecar, not as part of the shell's source of truth.

Phase 7 integration boundary:

- Sidecar base URL: `HERMES_MEMORY_SIDECAR_BASE_URL`
- Default loopback target: `http://127.0.0.1:8766`
- Health endpoint: `GET /health`
- Discoverable schema: `GET /actions/schema`
- Read-first action endpoint: `POST /actions/knowledgebase`

Read-first actions Infinity should rely on:

- `status`
- `search`
- `get_page`
- `get_claim`
- `query`

Write paths remain intentionally out of the main product flow for now.

Do not couple Infinity directly to:

- sidecar DB files
- export folder layouts
- `POST /actions/run` as the canonical product API

The shell continuity page should expose this adapter configuration so operators can inspect the memory layer without treating it as the control-plane truth.
