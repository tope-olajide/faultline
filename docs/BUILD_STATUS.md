# Faultline — Build Status

Internal engineering record. Statuses: **NOT STARTED** · **IN PROGRESS** ·
**IMPLEMENTED** · **VERIFIED** · **BLOCKED**.
`VERIFIED` means the journey was exercised against live HydraDB and the result was
recorded.

Last updated: 2026-11-15 (post-audit takeover).

---

## Environment baseline

| Item | State |
|---|---|
| Node 24.13.0 / npm 11.6.2 | available |
| Docker (WSL2 backend) | running |
| HydraDB `ghcr.io/hydra-db/hydradb:latest` (v0.4.0) | running on 7687/8443/9090 |
| Graph storage | named volume `faultline_hydradb-store` |
| Seeded graph | 112 nodes · 245 relationships · 30 labels/edge types in use |
| Benchmark | 12 incidents · 6 train · 6 held-out · 46 benchmark evidence records |
| Control-plane Postgres | NOT STARTED (single demo scope) |

---

## Slice checklist

### Slice 1 — Foundation and HydraDB proof — VERIFIED

Typed HTTP adapter, deterministic ids, idempotent writes, graph inspector,
diagnostics, seed/reset. Unchanged except the `external_id` identity fix.

### Slice 2 — Canonical graph, evidence and temporal facts — VERIFIED

26 base nodes plus evidence, connector sources, a retired cache dependency,
object-store payloads with hash verification and redaction.

### Slice 3 — Investigation engine and workspace — VERIFIED

- Graph-driven candidate discovery (bounded `DEPENDS_ON` BFS + `DEPLOYS`).
- Evidence attribution with incident linkage and polarity.
- Ranking with live/baseline edge reliability and learned path utility.
- Causal path, blast radius, unknowns, next check, provenance.
- `/incidents`, `/incidents/[id]`, `POST /api/incidents/[id]/investigate`.
- Persists `Investigation` and `Hypothesis` nodes plus evidence links.

Verified on INC-104: postgres-main ranked first with three supporting evidence
items, 0.77 relative confidence, causal path and next check rendered.

### Slice 4 — Feedback, learning ledger and rollback — VERIFIED

- Read-modify-write edge policy for six outcomes.
- Path-template success/failure utility with a 0.5 prior.
- `Feedback` + `LearningUpdate` records with before/after JSON.
- Idempotent request keys (replay applies nothing).
- Rollback restores edge and path state and marks the ledger entry.
- `/learning` ledger with revert control.

Verified: confirm applied +1 support and +1 path success; replay returned
`alreadyProcessed`; ledger rendered the mutation.

### Slice 5 — Adaptive path learning and context constraints — VERIFIED

Path signatures are conditioned on the relationship sequence, the causal entity
class, the dominant evidence class and a text-derived failure context. This
prevents a database path learned from latency incidents from boosting a database
distractor in a deployment incident.

### Slice 6 — Evaluation laboratory — VERIFIED

Three engines, twelve incidents, six held-out, two rounds, seven metrics,
per-case audit persisted as `EvaluationRun`, `/evaluation` screen.

Measured (held-out, 6 cases):

| Engine | Round | Top-1 | Evidence precision |
|---|---|---|---|
| Vector-only (TF-IDF) | R0 / R1 | 0.333 | 0.056 |
| Fixed graph | R0 / R1 | 0.000 | 0.000 |
| Adaptive graph | R0 | 0.000 | 0.000 |
| Adaptive graph | R1 | **1.000** | **1.000** |

### Slice 7 — Real integrations — NOT STARTED

Simulators remain; no live Prometheus/Loki/GitHub/Kubernetes clients and no
inbound webhook endpoint.

### Slice 8 — Dedicated operations screens — VERIFIED

`/services`, `/services/[id]`, `/deployments` and `/patterns` are backed by live
reads. Service pages show criticality, ownership, current and retired
dependencies, dependents, deployments and incident history. Deployments show a
24-hour correlation explicitly labelled as correlation. Failure Patterns groups
incident families and shows learned path utility. Navigation updated.

### Slice 9 — Historical incident matching — VERIFIED

`src/server/investigation/similar.ts` matches strictly earlier incidents over
shared `AFFECTS` services, failure family, signal class and recency. The
workspace renders ranked matches with shared services and benchmark-labelled
causes. Verified on INC-104: eight earlier matches with non-zero similarity.

### Slice 10 — Auth, settings and governance — PARTIAL

Auth/RBAC, settings, integrations management and multi-round evaluation remain
outstanding (see `PROJECT_COMPLETION_PLAN.md`). The product uses a single,
explicitly labelled demo scope.

---

## Feature ledger

| Feature | Status | Notes |
|---|---|---|
| Self-hosted HydraDB integration | VERIFIED | HTTP transport |
| Deterministic scoped ids | VERIFIED | FNV-1a, 53-bit safe |
| Readable `external_id` | VERIFIED | Fixed in takeover |
| Idempotent node/edge writes | VERIFIED | Re-seed stable |
| Temporal dependencies | VERIFIED | Current vs retired |
| Evidence object store + hashing | VERIFIED | Hash re-verified on read |
| Evidence attribution + polarity | VERIFIED | Direct `DERIVED_FROM` |
| Incident list | VERIFIED | 13 incidents |
| Graph-driven investigation | VERIFIED | Deterministic, no LLM |
| Evidence-backed hypotheses | VERIFIED | Support + contradict |
| Causal path | VERIFIED | Traversal edges |
| Blast radius | VERIFIED | Reverse reachability |
| Missing-evidence detection | VERIFIED | Per investigation |
| Feedback → edge mutation | VERIFIED | Six outcomes |
| Feedback idempotency | VERIFIED | Replay applies nothing |
| Path-template learning | VERIFIED | Context-constrained |
| Learning ledger | VERIFIED | Before/after + reason |
| Rollback | VERIFIED | Edge + path restored |
| Held-out benchmark | VERIFIED | 6/6 split |
| Vector-only baseline | VERIFIED | TF-IDF, no graph |
| Fixed-graph baseline | VERIFIED | Frozen confidence |
| Adaptive evaluation | VERIFIED | 0.00 → 1.00 Top-1 |
| Services / deployments / patterns screens | VERIFIED | Live graph reads |
| Deployment–incident correlation | VERIFIED | 24h window, labelled |
| Historical incident matching | VERIFIED | Earlier incidents only |
| Entity resolution | NOT STARTED | Schema label only |
| Gap-driven connector query | NOT STARTED | Detects gaps only |
| Inbound alert webhooks | NOT STARTED | |
| Live connectors | NOT STARTED | Simulated adapters |
| Auth / RBAC / settings | NOT STARTED | |
| Streaming stages | NOT STARTED | Returns completed result |
| Automated regression suite | IN PROGRESS | Live scripted verification |

---

## Outstanding issues

See `KNOWN_ISSUES.md`. No blocking defects for the delivered journeys.
