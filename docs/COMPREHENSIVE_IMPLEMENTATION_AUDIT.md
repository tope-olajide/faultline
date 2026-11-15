# Faultline — Comprehensive Implementation Audit

**Audit date:** 2026-11-15
**Auditor role:** senior engineer taking over an in-flight product
**Source of truth:** `docs/Faultline_Full_Product_Specification.md`
**Engine under test:** self-hosted HydraDB v0.4.0 (`ghcr.io/hydra-db/hydradb:latest`), local object store, graph `default`, cell `cell-0`.

---

## 1. Method

The audit did not assume that a page, route, function name or passing mock implied
working functionality. Each capability was traced from the UI through the route
handler, the domain service, the graph adapter and into HydraDB, then exercised
against the live engine.

Checks performed:

- Read every file in `src/`, `scripts/` and `docs/`.
- Queried the live engine directly for node/edge shapes and dialect limits.
- Seeded the full dataset and compared counts across runs.
- Called every API route that backs a product journey.
- Ran the investigation engine against the demo incident and held-out benchmark cases.
- Applied a real feedback mutation and re-read the edge and ledger from HydraDB.
- Ran the full evaluation experiment and inspected per-case outcomes.
- Ran `npx tsc --noEmit` and `npm run build`.

Nothing below is marked complete on the basis of mocked tests alone.

---

## 2. Executive summary

The previous implementation had a genuinely solid **HydraDB foundation**:

- a typed HTTP adapter with correct cell/path decoding and pagination;
- deterministic scoped ids and idempotent batched node/edge writes;
- a coherent demo graph, evidence object store with hashing/redaction, and
  temporal dependency edges;
- a functional graph explorer, evidence inspector and diagnostics surface.

But the **product itself was largely absent**. The repository contained:

- no incident list or investigation workspace;
- no graph-driven investigation engine;
- a feedback route that mutated an edge without reading it, wrote fabricated
  before/after values, returned a hardcoded record and used an invalid Cypher
  projection (`RETURN r {.*}`);
- no learning ledger UI, path learning, or rollback;
- no evaluation benchmark, no baseline engines and no real metrics;
- two dead endpoints (`/api/ask`, `/api/entity-match`, `/api/path-template`) that
  were not connected to any screen and depended on an unconfigured LLM key;
- a repository identity bug: `external_id` was used for hashing but never stored,
  so every scope/identity read projected `null`;
- documentation (`BUILD_STATUS.md`) that claimed Slices 1–6 were complete while
  the code contained almost none of Slices 3–6.

The takeover rebuilt the missing product spine and corrected the identity layer.
The headline result is measured, not asserted: on six held-out incidents, the
adaptive graph’s root-cause Top-1 went from **0.00 → 1.00** after one verified
learning round, while vector-only and fixed-graph controls were unchanged.

---

## 3. Requirement-by-requirement status

Statuses: **COMPLETE** · **PARTIAL** · **MOCKED** · **INCOMPLETE** · **MISSING** · **BROKEN** · **NEEDS VERIFICATION**

### 3.1 Foundation and data model

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Self-hosted HydraDB as system of record | **COMPLETE** | Compose stack, HTTP adapter, live reads/writes verified. No fallback graph. |
| 2 | Typed graph adapter boundary | **COMPLETE** | `src/server/hydradb/client.ts`; Cypher confined to `src/server/graph/*` and services. |
| 3 | Deterministic scoped entity ids | **COMPLETE** | FNV-1a over `scope\0label\0externalId`; same id across re-seeds. |
| 4 | Idempotent node/edge writes | **COMPLETE** | Batched `UNWIND MERGE`; per-edge `MERGE`; re-seed round-trips with identical counts. |
| 5 | Identity readable from the graph | **COMPLETE** (fixed) | `external_id` is now written on every node upsert and projected by the schema. Pre-audit it was `null`. |
| 6 | Canonical schema (labels, relationship types) | **PARTIAL** | 38 labels / 30 types declared; not every label is populated. New learning/evaluation fields added. |
| 7 | Scope isolation | **PARTIAL** | Scope properties are written and ids are scoped; no auth/tenant enforcement (single demo scope). |
| 8 | Temporal relationships | **COMPLETE** | `valid_from`/`valid_to` sentinel, current vs retired dependency views, stale edge handling. |
| 9 | Evidence object store, hashing, redaction | **COMPLETE** | `local://evidence/<sha256>.json`, hash verification, recursive secret redaction. |
| 10 | Evidence attribution to causal entities | **COMPLETE** (fixed) | Evidence now has direct `DERIVED_FROM` links to the entity it describes; the investigator filters by incident linkage. |

### 3.2 Incident intelligence

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 11 | Incident list and lifecycle | **PARTIAL** | 13 incidents seeded and listed; status field exists; lifecycle transitions are not implemented as actions. |
| 12 | Alert ingestion, dedupe, correlation | **PARTIAL** | Seed writes alerts/`TRIGGERED`/`AFFECTS`; there is no inbound webhook ingestion endpoint. |
| 13 | Investigation workspace | **COMPLETE** | `/incidents/[id]` — ranked hypotheses, evidence, causal path, blast radius, timeline, provenance. |
| 14 | Graph-driven investigation engine | **COMPLETE** | `src/server/investigation/engine.ts`; bounded BFS over `DEPENDS_ON`, deployment correlation, evidence attachment, explicit scoring. |
| 15 | Evidence-backed hypotheses | **COMPLETE** | Each hypothesis carries supporting/contradicting evidence, reliability, source, timestamps. |
| 16 | Causal path reconstruction | **COMPLETE** | Path is built from real traversal edges; `algo.SPpaths` verified and used by the graph API. |
| 17 | Blast radius | **COMPLETE** | Reverse reachability over `DEPENDS_ON`; affected services at depth 0. |
| 18 | Historical incident matching | **COMPLETE** (added) | `src/server/investigation/similar.ts` matches earlier incidents on shared `AFFECTS` services, failure family, signal class and recency. The workspace shows the ranked matches with shared services and benchmark-labelled causes. |
| 19 | Missing-evidence detection and next check | **COMPLETE** | Evidence-type gaps and confidence-margin uncertainty are surfaced per investigation. |
| 20 | Re-investigation on new evidence | **PARTIAL** | Every page load re-runs and persists; there is no event-triggered workflow. |
| 21 | Automated alert webhooks | **COMPLETE** (added) | Token-protected `POST /api/alerts`; one incident per fingerprint, linked to an existing service via `AFFECTS`, alert via `TRIGGERED`. Disabled unless `FAULTLINE_ALERT_TOKEN` is set. |
| 22 | LLM narrative | **PARTIAL** | `src/server/llm/qwen.ts` exists but requires an unset key and is not on the product path. The investigator is deterministic by design. |

### 3.3 Adaptive learning

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 23 | Feedback-driven edge reliability | **COMPLETE** | `src/server/learning/engine.ts`; reads before-state, applies outcome policy, writes after-state. |
| 24 | Idempotent feedback | **COMPLETE** (fixed) | Request keys are checked against `feedback/<key>`; replay applies nothing. Pre-audit the lookup used the unprefixed id and double-applied. |
| 25 | Path-quality learning | **COMPLETE** | `PathTemplate` with success/failure counts, Beta-style utility, context-constrained signature. |
| 26 | Negative learning | **COMPLETE** | Reject / incorrect mapping / stale relationship reduce confidence and path utility; rejected hypotheses remain queryable. |
| 27 | Inconclusive ≠ negative | **COMPLETE** | No numeric mutation; feedback is still recorded. |
| 28 | Learning ledger with before/after | **COMPLETE** | `LearningUpdate` nodes + `/learning` ledger. |
| 29 | Rollback | **COMPLETE** | `/api/learning/revert` restores edge state and path counts; ledger status becomes `rolled_back`. |
| 30 | Gap-driven ingestion | **PARTIAL** | Gaps are detected and shown; no connector query is executed to fill them. |
| 31 | Entity resolution / merge / split | **MISSING** | `EntityMatchCandidate` label exists but no detection, review or reversible merge. |
| 32 | Learning affects later investigations | **COMPLETE** | Live edge confidence + path utility feed the ranking; measured 0 → 1.00 Top-1 on held-out cases. |
| 33 | Feedback provenance | **COMPLETE** | Actor, reason, incident, hypothesis, edge, path signature stored on `Feedback`. |

### 3.4 Evaluation laboratory

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 34 | Repeatable benchmark | **COMPLETE** | 12 incidents, 4 families, 6 train / 6 held-out, deterministic seed. |
| 35 | Vector-only baseline | **COMPLETE** | TF-IDF cosine over evidence summaries; no graph weights. (Lexical, not embeddings — documented.) |
| 36 | Fixed-graph baseline | **COMPLETE** | Frozen `baseline_confidence`; learning ignored. |
| 37 | Adaptive graph engine | **COMPLETE** | Live reliability + learned path utility. |
| 38 | Held-out discipline | **COMPLETE** | Training reads only `benchmark_split='train'`; scoring reads only `heldout`. |
| 39 | Real metrics | **COMPLETE** | Top-1, Recall@3, evidence precision/recall, FPR, latency, traversal efficiency — all computed from retrieval output. |
| 40 | Evaluation history / rounds | **PARTIAL** | R0 and R1 persisted per engine; no multi-round history beyond two rounds. |
| 41 | Regression detection | **PARTIAL** | Delta is displayed; no automatic regression alerting. |
| 42 | Confidence calibration | **MISSING** | Scores are explicitly labeled uncalibrated; no calibration curve. |
| 43 | Learning replay | **PARTIAL** | Ledger + per-case audit are replayable; there is no step-through replay UI. |

### 3.5 Product, UX, operations

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 44 | Polished engineering SaaS UI | **COMPLETE** (core screens) | Overview, Incidents, Workspace, Services, Deployments, Failure Patterns, Graph, Evidence, Learning, Evaluation, Diagnostics. |
| 45 | Services / deployments / patterns pages | **COMPLETE** (added) | `/services` (criticality, owners, live dependency counts, incidents, last deploy), `/services/[id]` (current/retired dependencies, dependents, deployments, incident history), `/deployments` (timestamp correlation, explicitly labelled as correlation), `/patterns` (families + learned path utility). |
| 46 | Integrations page | **PARTIAL** | Connector freshness on Overview/Evidence; no management UI. |
| 47 | Settings / onboarding / auth / RBAC | **MISSING** | Single demo scope; no accounts or roles. |
| 48 | Responsive, loading, empty, error states | **PARTIAL** | Empty/error states exist; no route-level loading skeletons. |
| 49 | Real external integrations | **MOCKED** | Six deterministic simulator adapters with real ingestion machinery. No live Prometheus/Loki/GitHub/Kubernetes clients. |
| 50 | Control-plane PostgreSQL | **MISSING** | Not implemented; not needed for the demo scope. |
| 51 | Background jobs / queue | **MISSING** | Not implemented. |
| 52 | Automated tests | **PARTIAL** | Vitest config exists; the pre-audit tests covered removed stub routes. Investigation/evaluation are verified by scripted live runs, not a committed suite. |
| 53 | Public README | **COMPLETE** (rewritten) | Accurate feature claims, measured results, setup, architecture, limitations. |
| 54 | Internal status docs | **COMPLETE** (rewritten) | This audit, completion plan, build status, testing notes, integration notes. |

---

## 4. Critical defects found and corrected

1. **`external_id` never persisted.** `upsertNodes` hashed the external id but did
   not write it. Every scope and identity read returned `null`, so the learning
   ledger and evaluator could not address edges by identity. Fixed in the
   repository; all data now re-seeds with readable ids.

2. **`submitFeedback` could not run.** It used `RETURN r {.*}` (outside HydraDB’s
   projection subset), invented before/after JSON, hardcoded the returned node id
   to `1`, and incremented counters without reading the edge. Replaced by a
   read-modify-write learning engine with a real ledger.

3. **Feedback idempotency was broken.** The replay check looked for the raw request
   key while the node was stored as `feedback/<key>`, so a retry double-applied.
   Fixed and verified by replaying the same request.

4. **Cross-incident evidence pollution.** Because the graph holds every incident,
   a candidate entity accumulated evidence from unrelated incidents. The
   investigator now requires evidence to be `OBSERVED_DURING` the incident under
   investigation.

5. **Fabricated evaluation.** The old `/api/evaluation` stored arbitrary LLM output
   as an “evaluation run”; there was no benchmark, no baseline and no metric.
   Replaced by a real harness with held-out scoring.

6. **Dead product surface.** `/api/ask`, `/api/path-template` and
   `/api/entity-match` were unreachable from the UI, untested against the engine
   and (for `/api/ask`) dependent on an unconfigured API key. Removed rather than
   left as fake features.

7. **Documentation contradicted the code.** Root `BUILD_STATUS.md` claimed Slice 6
   complete. Replaced with an honest status record.

---

## 5. Verified measurements

Run on 2026-11-15 against the live engine with the seeded benchmark.

| Engine | Split | Round | Top-1 | Recall@3 | Evidence precision | Mean latency |
|---|---|---|---|---|---|---|
| Vector-only (TF-IDF) | held-out (6) | R0 | 0.333 | 1.000 | 0.056 | ~70 ms |
| Fixed graph | held-out (6) | R0 | 0.000 | 1.000 | 0.000 | ~80 ms |
| Adaptive graph | held-out (6) | R0 | 0.000 | 1.000 | 0.000 | ~80 ms |
| Vector-only | held-out (6) | R1 | 0.333 | 1.000 | 0.056 | ~70 ms |
| Fixed graph | held-out (6) | R1 | 0.000 | 1.000 | 0.000 | ~80 ms |
| Adaptive graph | held-out (6) | R1 | **1.000** | 1.000 | **1.000** | ~115 ms |

Learning round: 6/6 training incidents confirmed the verified cause edge and
produced four path templates (`Database`, `Cache`, `Queue`, `Deployment`).

Honest interpretation: the benchmark is small and synthetic; recall@3 is
saturated because each case has only two or three candidates; the vector baseline
is lexical rather than embedding-based. The measured effect demonstrates the
learning mechanism, not a production accuracy claim.

---

## 6. Remaining gaps (not claimed as complete)

- Authentication, workspaces, RBAC, audit of human actors.
- Real connector clients and inbound alert webhooks.
- Entity-resolution detection, review and reversible merge/split.
- Historical incident similarity matching at investigation time.
- Gap-driven connector queries that actively fetch missing evidence.
- Dedicated service/deployment/failure-pattern screens.
- Confidence calibration and multi-round (R2+) evaluation history.
- Committed automated regression suite for investigation/learning/evaluation.
- Streaming investigation stages (the engine returns a completed result).
- Control-plane PostgreSQL and background job infrastructure.
