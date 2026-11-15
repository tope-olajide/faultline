# Faultline — Build Status

Internal engineering document. Statuses: **NOT STARTED** · **IN PROGRESS** ·
**IMPLEMENTED** · **VERIFIED** · **BLOCKED**.
`IMPLEMENTED` means the code exists and its slice journey has been exercised
manually; `VERIFIED` means the slice's acceptance criteria were checked and
recorded.

Last updated: 2026-11-15.

---

## Environment baseline

| Item | State |
|---|---|
| Node 24.13.0 / npm 11.6.2 | available |
| Docker 29.5.2 (Docker Desktop, WSL2 backend) | running |
| HydraDB `ghcr.io/hydra-db/hydradb:latest` (v0.4.0) | running via `docker compose` on 7687/8443/9090 |
| Graph storage | named volume `faultline_hydradb-store` (local object store) |
| Demo graph | 28 nodes, 67 relationships, 18 labels, 16 relationship types |
| Control-plane Postgres | NOT STARTED (not required by Slice 1) |

## Slice checklist

### Slice 1 — Running product foundation and HydraDB proof — VERIFIED

| Area | Work | Status |
|---|---|---|
| Infrastructure | `docker-compose.yml` runs self-hosted HydraDB, durable named volume, healthcheck | VERIFIED |
| Adapter | Typed HTTP client, cell/path decoding, pagination, bookmarks, error envelopes | VERIFIED |
| Graph | Label/relationship schema, deterministic scoped ids, node/edge repository | VERIFIED |
| Graph | Demo seed + reset (28 nodes / 67 edges), multi-hop topology, incident + evidence | VERIFIED |
| API | `/api/health`, `/api/graph/stats`, `/api/graph/nodes`, `/api/graph/nodes/:id`, `/api/graph/paths`, `/api/demo/seed`, `/api/diagnostics/probe` | VERIFIED |
| UI | App shell, design tokens, Overview, Graph Explorer, HydraDB Diagnostics | VERIFIED |
| Scripts | `setup`, `db:check` (10 probes), `db:seed`, `db:reset` | VERIFIED |
| Verification | acceptance criteria 1–7 | VERIFIED (see `TESTING_NOTES.md`) |

Acceptance results: app starts from documented commands · HydraDB queryable ·
service/database/deployment/incident/evidence read back · re-seed identical
(28/67 both runs, no duplicated relationships) · multi-hop path retrievable ·
10/10 compat probes pass · no other graph engine present.

### Slice 2 — Canonical graph and ingestion simulator — NOT STARTED

### Slice 3 — Incident lifecycle and investigation workspace — NOT STARTED

### Slice 4 — Engineer feedback and learning ledger — NOT STARTED

### Slice 5 — Adaptive path learning and graph repair — NOT STARTED

### Slice 6 — Evaluation laboratory and learning replay — NOT STARTED

### Slice 7 — Real integrations — NOT STARTED

### Slice 8 — Product polish, governance and release — NOT STARTED

---

## Feature ledger

| Feature | Status | Notes |
|---|---|---|
| Self-hosted HydraDB integration | VERIFIED | HTTP transport; Bolt unused |
| Deterministic scoped entity ids | VERIFIED | 53-bit FNV-1a over scope+label+external id |
| Idempotent node/edge writes | VERIFIED | Probed against live engine and re-seed |
| Graph inspector | VERIFIED | Properties + typed edges from live HydraDB |
| Multi-hop traversal (`algo.SPpaths`) | VERIFIED | api-gateway → checkout → postgres-main |
| Demo seed / reset | VERIFIED | 28 nodes, 67 edges, deterministic |
| Runtime compatibility probes | VERIFIED | 10 probes via `npm run db:check`; 5 in-product |
| Diagnostics UI | VERIFIED | readiness, epoch, bookmark, scope, probes |
| Alert ingestion + incident correlation | NOT STARTED | Slice 3 |
| Investigation state machine | NOT STARTED | Slice 3 |
| Streaming investigation events | NOT STARTED | Slice 3 |
| Feedback → graph learning ledger | NOT STARTED | Slice 4 |
| Path template learning | NOT STARTED | Slice 5 |
| Temporal / superseded facts | NOT STARTED | Slice 2–5 |
| Entity resolution | NOT STARTED | Slice 5 |
| Evaluation lab (3 engines, R0–R4) | NOT STARTED | Slice 6 |
| Real integrations | NOT STARTED | Slice 7 |
| Blast radius / remediation | NOT STARTED | Slice 8 |
| Auth / RBAC / audit | NOT STARTED | Slice 8 |
| Public README | NOT STARTED | Slice 8; must describe only working capability |

---

## Outstanding internal issues

See `KNOWN_ISSUES.md`. No blocking defects for Slice 1.
