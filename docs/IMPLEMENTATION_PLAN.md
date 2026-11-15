# Faultline — Vertical Slice Implementation Plan

Internal engineering document.
Source of truth for requirements: [`Faultline_Full_Product_Specification.md`](./Faultline_Full_Product_Specification.md).
Live progress is tracked separately in [`BUILD_STATUS.md`](./BUILD_STATUS.md).

---

## 1. Method

Faultline is built in **vertical slices**. Each slice delivers one usable user
journey across every layer it touches:

```
UI (App Router)  →  API route (Zod-validated)  →  domain service
                 →  graph adapter (typed Cypher)  →  HydraDB graph-node
                 →  evidence/object references
```

Rules that hold for every slice:

- No placeholder buttons, static graph data, or hardcoded investigation output.
  Simulated data exists only inside the demo dataset and the evaluation lab, and
  the machinery consuming it is real.
- Cypher lives only in `src/server/graph/*` and `src/server/hydradb/*`. UI and
  route handlers never build query strings.
- Every graph write is idempotent (see `docs/HYDRADB_INTEGRATION.md`), because
  HydraDB requests auto-commit and callers cannot rely on transactions.
- Every slice ends with a real end-to-end verification of its primary journey,
  then a `BUILD_STATUS.md` update. A slice that cannot complete its primary
  journey is not "done"; if blocked externally, it is recorded as `BLOCKED` and
  independent slices continue.
- Comprehensive regression, E2E, security, and deployment verification is
  scheduled after the functional slices, not woven into them.

---

## 2. Slice map and dependency order

| # | Slice | Depends on | Primary user-visible outcome |
|---|---|---|---|
| 1 | Running product foundation and HydraDB proof | — | The app runs against a real self-hosted HydraDB; seeded graph entities are readable in an inspector |
| 2 | Canonical graph and ingestion simulator | 1 | A realistic checkout topology with evidence, temporal edges, and deterministic re-seeding |
| 3 | Incident lifecycle and investigation workspace | 2 | Investigating an incident from the graph: streamed stages, ranked evidence-backed hypotheses |
| 4 | Engineer feedback and learning ledger | 3 | Confirming/rejecting a hypothesis produces an inspectable, persisted graph mutation |
| 5 | Adaptive path learning and graph repair | 4 | Learned relationship/path utility changes later rankings; merges, splits, temporal repair |
| 6 | Evaluation laboratory and learning replay | 5 | Vector-only vs fixed-graph vs adaptive-graph measured on held-out incidents across R0–R4 |
| 7 | Real integrations | 2, 3 | Prometheus/Alertmanager, GitHub, Kubernetes, Loki, OTLP feeding the same graph |
| 8 | Product polish, governance and release | 1–7 | Service/deployment/pattern pages, blast radius, remediation approval, audit, README, Compose deploy |

Ordering is dependency-driven, not a licence to defer scope. Every row above is
required for the release definition of done.

---

## 3. Slice specifications

### Slice 1 — Running product foundation and HydraDB proof

**Objective.** Prove the operational foundation is real: a self-hosted HydraDB
graph-node is the system of record, the app talks to it through a typed adapter,
and graph entities survive a round trip.

**Delivered layers**

- Next.js App Router shell with the Faultline design tokens (dark canvas,
  sidebar, top bar, workspace/project/environment switcher), primitives, and
  empty/error/loading states.
- `docker-compose.yml` running `ghcr.io/hydra-db/hydradb` with Bolt 7687, HTTP
  8443, admin 9090, durable named volume.
- `src/server/hydradb` — typed HTTP client: cell decoding (including the third
  path encoding and value-less null cells), pagination with a consuming cursor,
  bookmark pass-through, error-envelope mapping, readiness diagnostics.
- `src/server/graph` — schema (labels, relationship types, property contracts),
  deterministic id derivation, node/edge repository, graph statistics.
- Demo seed + reset: services, resources, deployment, commit, alert, incident,
  evidence, hypotheses, connected with typed relationships.
- Graph inspector: label counts, node table, node inspector with properties and
  typed edges, all read from HydraDB.
- Health/diagnostics route and `npm run db:check` compatibility script.

**Acceptance criteria (all verified manually or by script)**

1. `npm run setup`, `npm run db:up`, `npm run dev` start the product from
   documented commands.
2. `curl localhost:9090/readyz` → 200; `curl localhost:8443/healthz` →
   `{"status":"ok"}`.
3. A `Service`, `Database`, `Deployment`, `Incident`, and `Evidence` node can be
   written and read back from HydraDB.
4. Re-running seeding does not duplicate relationships, and node/edge counts are
   identical between runs.
5. A multi-hop dependency path is retrievable (`api-gateway → checkout-service →
   postgres-main`).
6. `npm run db:check` passes every probe against the live engine.
7. No other graph database is running or referenced.

### Slice 2 — Canonical graph and ingestion simulator

**Objective.** Replace the minimal seed with the canonical domain graph and a
deterministic simulator that produces incident-grade evidence.

**Delivered layers**

- Full node/relationship schema from the specification, with scope
  (`tenant_key` / `project_key` / `environment_key`) enforced on every read and
  write by the adapter.
- Temporal relationships: `valid_from` / `valid_to` / `recorded_at` with
  documented sentinel for open facts, plus a superseded-history read.
- Demo topology: API gateway, auth, checkout, payment, inventory, notification
  worker, PostgreSQL, Redis, RabbitMQ, cluster, namespaces, teams, repository.
- Evidence generation: metric anomaly windows, log patterns, trace references,
  Kubernetes events, deployments, config changes — stored as graph records with
  source URIs, content hashes, and object references.
- Local object store (`./.hydradb/evidence`) for payload snapshots referenced by
  URI + hash, never inlined into the graph.
- Data freshness panel and graph statistics derived from live counts.

**Acceptance criteria**

1. Seeded system has multiple services with multi-hop dependencies and at least
   one dependency that changed over time.
2. A user can inspect any node, edge, its properties, source, and temporal
   validity in the UI.
3. Re-running seed/ingestion is safe and byte-deterministic in structure.
4. A stale dependency is not returned by "current topology" queries.

### Slice 3 — Incident lifecycle and investigation workspace

**Objective.** The primary product journey: from alert to evidence-backed,
ranked hypotheses, produced by a bounded state machine reading the real graph.

**Delivered layers**

- Alert ingestion endpoint (normalize, fingerprint-dedupe, correlate into an
  incident via service + graph neighbourhood + time window), manual incident
  creation, status machine, timeline.
- Investigation state machine (`RECEIVED → SCOPED → GRAPH_CONTEXT →
  EVIDENCE_GATHERING → HYPOTHESIS_GENERATION → HYPOTHESIS_TESTING →
  PATH_RECONSTRUCTION → REPORTING → AWAITING_FEEDBACK`), with budgets and
  explicit `INCONCLUSIVE` / `PARTIAL` / `NEEDS_MORE_EVIDENCE` outcomes.
- Bounded graph-context retrieval and path reconstruction using `algo.Spaths` /
  bounded `MATCH` traversal.
- Hypothesis ranking with supporting/contradicting evidence and provenance
  stored in the graph.
- Incident list and three-panel investigation workspace with streamed stage
  events (SSE), evidence inspector, interim/empty/error states.

**Acceptance criteria**

1. A seeded alert creates or updates exactly one incident (no duplicates on
   replay).
2. Investigation returns multi-hop graph context from HydraDB.
3. At least two hypotheses carry supporting and contradicting evidence with
   links to source records.
4. UI streams real stage events with start times and per-stage status.
5. Abstention is reachable and rendered honestly.

### Slice 4 — Engineer feedback and learning ledger

**Objective.** Human feedback changes the graph, durably and auditable.

**Delivered layers**

- Feedback API and dialog: confirm root cause, reject, contributing factor,
  inconclusive, stale relationship, incorrect mapping, with reason and linked
  evidence.
- Learning engine mutations: Beta-style reliability update per edge
  (`support_count` / `contradiction_count` / `confidence_score`), path template
  statistics, `Feedback`, `LearningUpdate`, `Resolution` records.
- Idempotency: feedback carries a request key; replays do not double-apply.
- Learning ledger UI: feed, before/after values, provenance, actor, trigger.
- Inconclusive feedback changes no reliability numbers.

**Acceptance criteria**

1. Confirming and rejecting produce distinct, visible graph updates.
2. Inconclusive feedback leaves confidence untouched.
3. Replaying a feedback submission applies nothing twice.
4. Every update lists the exact edges and path templates it changed.

### Slice 5 — Adaptive path learning and graph repair

**Objective.** The learned graph measurably changes later retrieval.

**Delivered layers**

- Path signatures (`Service → Database → MetricSeries → Hypothesis`) with
  utility statistics and context constraints.
- Learned traversal scoring: reliability, path quality, freshness, temporal
  validity, and evidence source reliability combined in the application layer.
- Negative learning scoped to path segments, not whole edges.
- Gap detection with one active evidence-acquisition path (bounded query).
- Entity resolution candidates, merge/split review, reversible repairs.
- Temporal supersession and stale-fact handling in traversal.

**Acceptance criteria**

1. A confirmed path outranks a rejected path in the same context.
2. A stale dependency is excluded from current-topology traversal.
3. Ambiguous entity matches enter a review queue instead of auto-merging.
4. Merge and split are reversible and recorded.

### Slice 6 — Evaluation laboratory and learning replay

**Objective.** Prove improvement, or show that it did not happen.

**Delivered layers**

- 12 deterministic fault scenarios with ground truth, misleading signals, and
  expected causal paths.
- Immutable dataset versions with hashes; training/held-out split; hidden seeds;
  service-name and timestamp perturbations to prevent memorisation.
- Three engines: vector-only baseline (isolated `pgvector` or local index),
  fixed HydraDB graph, adaptive HydraDB graph — same LLM/orchestration path and
  comparable budgets.
- Scorers: Top-1, Recall@3, evidence precision/recall/F1, false-positive rate,
  abstention quality, calibration error, latency, query budget.
- Rounds R0–R4, real persisted results, regression detection, rollback.
- Graph Learning Replay per investigation and per round.

**Acceptance criteria**

1. All engines receive identical cases and budgets.
2. Held-out incidents never update the adaptive graph before evaluation.
3. Results reproduce from dataset version + seed.
4. The UI displays persisted values only.

### Slice 7 — Real integrations

**Objective.** Replace simulated evidence with real sources, read-only by
default.

**Delivered layers**

- Adapters: Prometheus/Alertmanager, GitHub, Kubernetes, Loki, Jaeger/Tempo,
  OTLP receiver, generic signed webhook — each with connection status, last
  sync/error, scopes, test action, pause/resume.
- Credential handling: encrypted at rest, never returned to the browser after
  save.
- Deduplication ledger keyed by source record id.
- Integration management UI and per-source evidence preview.

**Acceptance criteria**

1. At least three real sources feed the same graph.
2. Evidence items open the original source.
3. A failing connector surfaces a specific, actionable error and retries safely.

### Slice 8 — Product polish, governance and release

**Objective.** Ship the complete, coherent product.

**Delivered layers**

- Service, deployment, failure pattern, learning, evaluation, settings screens to
  the design specification.
- Blast-radius analysis distinguishing exposure from observed impact.
- Postmortem export, remediation suggestions with approval gates and preview.
- RBAC, audit log, retention/redaction policy surface.
- Responsive and accessibility pass; keyboard shortcuts and command palette.
- Docker Compose deployment, README, architecture/graph-schema/learning/
  evaluation docs, demo script.

**Acceptance criteria**

1. A fresh user completes the demo from the README with no private credentials.
2. All primary journeys work end to end against real persistence.
3. High-impact actions require explicit approval.

---

## 4. Cross-slice invariants

1. **HydraDB is the only graph engine.** No Neo4j, Memgraph, or mock graph is
   authoritative. The HTTP adapter is the sole transport used by the product.
2. **Ids are caller-supplied and deterministic.** `id = f(scope, label,
   external_id)`; the natural id lives in `external_id`.
3. **Writes are idempotent.** `MERGE` for single edges, `UNWIND … CREATE` for
   bulk edges, `UNWIND … MERGE … SET n:Label` for node batches (labels first).
4. **Queries are anchored and bounded.** Every `MATCH` anchors on id, label, or
   property predicate; every variable-length path declares an upper bound.
5. **One relationship type per pattern.** Multi-type traversal uses `algo.*`
   procedures.
6. **No Cypher in the UI.** Route handlers call domain services; domain services
   call the graph repository.
7. **Confidence is uncalibrated until proven otherwise.** It is labelled
   `confidence score` with an explicit calibration status.
8. **Causal claims require verification.** `POSSIBLY_CAUSED_BY` is provisional;
   only engineer-verified outcomes produce `CAUSED_BY`.
9. **Demo data is labelled as simulated** wherever it appears.

---

## 5. Known architectural risks

| Risk | Mitigation |
|---|---|
| HydraDB dialect gaps (no `WITH` reshaping, no edge-batch property writes) | Capability probes before relying on a shape; all query shapes recorded in `HYDRADB_INTEGRATION.md`; ranking done in application layer |
| Auto-commit writes make multi-step updates non-atomic | Idempotent writes + ledger records + reconciliation; learning updates are append-only and reversible |
| Path procedures return unordered, sometimes missing pairs | Join results back by endpoint ids, never by position |
| Demo must not require paid services | Deterministic local reasoning engine behind an LLM adapter; Ollama optional |
| Evaluation could be perceived as rigged | Immutable dataset hashes, held-out split, honest reporting of regressions |
| Single-app architecture could become tangled | Enforced module boundaries (`server/graph`, `server/domain`, `server/investigation`, `server/learning`, `server/evaluation`) with no cross-imports from UI |

---

## 6. Definition of done (product)

Per specification §18. Not reached until the investigation → feedback →
learning → evaluation loop is demonstrably working on held-out incidents, the
graph is inspectable, and the app builds and deploys from the README.