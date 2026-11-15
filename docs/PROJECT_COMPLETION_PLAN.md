# Faultline — Project Completion Plan

**Created:** 2026-11-15
**Companion to:** `COMPREHENSIVE_IMPLEMENTATION_AUDIT.md`
**Specification:** `Faultline_Full_Product_Specification.md`

This plan converts every outstanding audit finding into a vertical slice. A slice
is only `DONE` when its primary user journey works through the UI, API, domain
service and live HydraDB, and its acceptance criteria have been exercised.

Statuses: **DONE** · **IN PROGRESS** · **NOT STARTED** · **BLOCKED**

---

## Delivered in this takeover

### Slice A — Graph identity and evidence attribution — DONE

**Problem:** `external_id` was never written, so entities were unaddressable by
identity; evidence could not be attributed to a causal entity.

**Work:** persist `external_id` on every node upsert; project it in every read;
add direct `DERIVED_FROM` evidence→cause links; add evidence polarity; add
`baseline_confidence` to dependency edges.

**Acceptance:** re-seed → every Incident/Evidence/Service read returns a non-empty
`external_id`; investigation attaches eligible evidence only. **Verified.**

### Slice B — Canonical benchmark — DONE

**Problem:** no dataset existed to measure anything.

**Work:** `src/server/graph/benchmark.ts` — 12 incidents across four failure
families, six `train` and six `heldout`, each with a verified cause, a reference
evidence item, two plausible distractors and an incident-linked evidence set.
Seeded idempotently alongside the demo graph.

**Acceptance:** 13 incidents (1 demo + 12 benchmark), 52 evidence nodes, 245
relationships after a clean seed; re-seed produces identical structure.
**Verified.**

### Slice C — Investigation engine and workspace — DONE

**Problem:** no investigation existed; the product was a graph inspector.

**Work:**
- `src/server/investigation/engine.ts`: bounded dependency BFS, deployment
  correlation, evidence attachment, causal path, blast radius, uncertainty,
  next check, explicit scoring, deterministic persistence of `Investigation` and
  `Hypothesis` nodes.
- `/incidents` list and `/incidents/[id]` three-panel workspace.
- `GET /api/incidents`, `POST /api/incidents/[id]/investigate`.

**Acceptance:** opening the demo incident shows postgres-main as the leading
cause with three supporting evidence items, a causal path, a next check and an
honest confidence label. **Verified.**

### Slice D — Persistent learning and ledger — DONE

**Problem:** feedback did not change the graph auditably and double-applied.

**Work:** read-modify-write edge policy, path-template learning, `Feedback` and
`LearningUpdate` records, idempotency, rollback API, `/learning` ledger with
before/after and revert.

**Acceptance:** confirming raises support and path utility; replay applies
nothing; rejecting lowers confidence and path utility; inconclusive changes no
numbers; rollback restores the prior state. **Verified for confirm + replay;
policy for the other outcomes is implemented and shown in the ledger.**

### Slice E — Evaluation laboratory — DONE

**Problem:** no measurement, no baselines, no held-out discipline.

**Work:** three engines (TF-IDF vector, frozen fixed graph, learned adaptive
graph), held-out metrics, per-case audit, R0/R1 rounds persisted as
`EvaluationRun`, `/evaluation` screen with a run button.

**Acceptance:** adaptive Top-1 rises from 0.00 to 1.00 on held-out cases while
vector (0.333) and fixed (0.000) controls stay flat. **Verified.**

### Slice F — Product surface and documentation — DONE

Overview rewritten around the learning loop; navigation extended; README and
internal docs rewritten to match reality; dead stub routes removed.

### Slice G — Historical incident matching — DONE

**Problem:** no prior-incident reasoning existed; benchmark families were only
separate labels.

**Work:** `src/server/investigation/similar.ts` matches strictly earlier
incidents over shared `AFFECTS` services, failure family, signal class and
recency. `InvestigationResult.similarIncidents` feeds a workspace panel with
similarity, shared services and the benchmark-labelled cause. Matching never
reads the current incident's ground-truth props and never looks forward in time.

**Acceptance:** the demo incident shows prior incidents from the same families
with shared services and a stated similarity percentage. **Verified against the
live HydraDB graph.**

### Slice H — Dedicated operations screens — DONE

**Problem:** services, deployments and failure patterns were only reachable
through the graph inspector.

**Work:** `/services` with criticality, owners, live dependency/dependent counts,
incident counts and last deployment; `/services/[id]` with current and retired
dependencies, dependents, deployments, incident history and graph record;
`/deployments` with 24-hour correlation that is explicitly labelled correlation;
`/patterns` grouping incident families and showing learned path utility.
Navigation updated.

**Acceptance:** all four routes render from live HydraDB reads; service detail
links resolve; no hardcoded statistics. **Verified: pages 200, detail page reads
real entities.**

---

## Remaining work, ordered by product risk

### 1. Live connectors — NOT STARTED (highest GTM value)

**Done:** inbound alert intake is implemented and token-protected
(`POST /api/alerts`), with deterministic one-incident-per-fingerprint semantics
and real `TRIGGERED` / `AFFECTS` edges. Verified 201 create, 200 duplicate.

**Missing:** Prometheus/Loki/Tempo/GitHub/Kubernetes clients that pull live data.

**Files:** `src/server/integrations/*`.

**Acceptance:** a real Prometheus query produces an evidence node with a working
source link; connector health reflects the live call.

**Depends on:** credentials and network access to a demo stack.

### 2. Entity resolution and reversible merge/split — NOT STARTED

**Missing:** candidate detection, review UI, merge execution and audit.

**Work:** similarity over service names/repo URLs/labels; write
`EntityMatchCandidate`; merge moves edges with `SUPERSEDES` provenance; split
restores them.

**Acceptance:** a candidate pair is proposed with evidence, merged by a human,
visible in the ledger, and reversible.

### 3. Gap-driven evidence acquisition — NOT STARTED

**Missing:** active query once a gap is identified.

**Work:** map missing evidence type → connector capability; execute the smallest
query; ingest and link the result; record whether uncertainty resolved.

**Acceptance:** a gap marked “no trace evidence” triggers a Tempo query, creates
an evidence node, and lowers uncertainty.

### 4. Auth, workspaces and RBAC — NOT STARTED

**Missing:** accounts, membership, role checks, actor identity.

**Work:** control-plane store, session auth, scope middleware, actor refs on
feedback. Do not put graph relationships in the control plane.

### 5. Confidence calibration — NOT STARTED

Compute a reliability curve on held-out cases; show Brier score and calibration
status; only call the score a probability once it is calibrated.

### 6. Multi-round evaluation and regression alerts — NOT STARTED

Persist R2+ rounds, compare across rounds, flag regressions automatically, and
support replaying a specific learning round.

### 7. Automated regression suite — IN PROGRESS

Convert the live verification scripts into committed tests: adapter decoding,
investigation ranking on the seeded benchmark, feedback idempotency/rollback, and
evaluation metric determinism.

### 8. Streaming investigation stages — NOT STARTED

Emit `RECEIVED → SCOPED → EVIDENCE → HYPOTHESES → RANKED` events over SSE. The
engine already computes the stages; only transport and UI streaming are missing.

---

## Scope protection

No specified capability has been silently removed. Items still absent are listed
above with an honest status. Where a requirement depends on an external service
that is unavailable in this environment (live Prometheus/GitHub/Kubernetes, LLM
API key), the strongest local implementation is the simulator + deterministic
investigator, and the README labels it as simulated.

---

## Verification policy

For each future slice: typecheck, build, exercise the primary journey against
live HydraDB, then record the result in `TESTING_NOTES.md` and update
`BUILD_STATUS.md`. Mocks may support fast tests but never count as proof of a
HydraDB or evaluation claim.
