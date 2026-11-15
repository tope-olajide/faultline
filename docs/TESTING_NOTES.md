# Faultline — Testing Notes

Internal engineering document.

Policy: lightweight verification per slice; comprehensive test, integration,
E2E, security and regression passes after the functional slices exist. A slice is
not allowed to advance with a broken primary journey, but it is also not blocked
on coverage targets.

---

## Slice 1 — verified 2026-11-15

Engine: HydraDB v0.4.0 (`ghcr.io/hydra-db/hydradb:latest`), local object store,
`graph=default`, `cell=cell-0`.

| Check | Method | Result |
|---|---|---|
| Engine readiness | `GET :9090/readyz` | 200 |
| Query endpoint | `GET :8443/healthz` | `{"status":"ok"}` |
| Type safety | `npx tsc --noEmit` | clean |
| Production build | `npm run build` | compiled, 11 routes, no errors |
| Compatibility probes | `npm run db:check` | 10/10 passed |
| In-product probes | `POST /api/diagnostics/probe` | 5/5 passed (93/49/20/8/33 ms) |
| App health | `GET /api/health` | `reachable: true`, stats present |
| Seed run 1 | `POST /api/demo/seed` | 28 nodes, 67 edges, 2.9 s |
| Seed run 2 (idempotency) | `POST /api/demo/seed` | 28 nodes, 67 edges, identical per-type counts |
| Multi-hop path | `GET /api/graph/paths` api-gateway → postgres-main, maxLen 3 | 3 paths, 3 nodes each, decoded |
| Typed neighbourhood | `GET /api/graph/nodes/:id?label=Service` | 6 edges, edge confidence + verification state present |
| Overview render | `GET /` | incident title, dependency path, health, label bars present; no error overlay |
| Graph Explorer render | `GET /graph?label=Incident`, `?label=Database&node=…` | entity table, inspector, properties, edges present |
| Diagnostics render | `GET /diagnostics` | engine surfaces, scope, probes panel present |
| Re-seed determinism | compare `byLabel` / `byRelationship` across runs | identical |

### Probe list (all executed against the live engine)

1. Single `MERGE` edge idempotent — 3 runs → 1 relationship.
2. Batched node upsert writes label + properties.
3. Batched edge `UNWIND … CREATE` deduplicates on (src, dst, type).
4. Relationship property write and read.
5. Bounded variable-length traversal reaches the target.
6. `algo.SPpaths` returns a decodable path (capitalised property tags).
7. Null cell is `{"type":"null"}` with no `value` key.
8. `RETURN *` is rejected (dialect guard).
9. `UNWIND CREATE … SET` is rejected (edge-property strategy still required).
10. Batched `DETACH DELETE` removes probe ids.

## Takeover verification — 2026-11-15

Environment: HydraDB v0.4.0 live, graph `default`, cell `cell-0`.

| Check | Method | Result |
|---|---|---|
| Type safety | `npx tsc --noEmit` | clean |
| Production build | `npm run build` | 29 routes compiled |
| Clean seed | `POST /api/demo/seed {reset:true}` | 112 nodes, 245 relationships, 12 benchmark incidents |
| Historical matching | open INC-104 | 8 earlier incidents, shared services + benchmark causes shown |
| Similar-incident time discipline | matching implementation | only incidents starting before the current one |
| Identity | read Incident/Evidence/Service | `external_id` non-empty |
| Investigation | `POST /api/incidents/:id/investigate` (INC-104) | postgres-main rank 1, 3 supporting evidence, path + next check |
| Cross-incident isolation | held-out INC-211 | only incident-linked evidence used |
| Feedback | `POST /api/feedback` confirm | +1 support, +1 path success, ledger written |
| Feedback replay | same request key | `alreadyProcessed: true`, no mutation |
| Inconclusive feedback | distinct request key | applied, all deltas 0 |
| Rollback | `POST /api/learning/revert` | support restored 8 → 7, path template restored |
| Learning ledger | `GET /learning` | update rendered with before/after and revert control |
| Evaluation | `POST /api/evaluation/run` | 6 engines/runs persisted; metrics below |
| Repeated experiment | run twice on a trained graph | R0 stays 0.000, R1 stays 1.000 (untrained round uses frozen reliability) |
| Alert intake | `POST /api/alerts` with `FAULTLINE_ALERT_TOKEN` set | 401 invalid token, 422 unknown service, 201 created incident+alert+edges, 200 duplicate by fingerprint |
| Service pages | `/services`, `/services/:id` | 200; live dependency, dependent, deployment and incident reads |
| Deployments page | `/deployments` | 200; correlation computed from timestamps, labelled as correlation |
| Failure patterns | `/patterns` | 200; 4 families, learned path utility rendered |
| Pages | `/`, `/incidents`, `/incidents/:id`, `/services`, `/services/:id`, `/deployments`, `/patterns`, `/graph`, `/evidence`, `/learning`, `/evaluation`, `/diagnostics` | all HTTP 200 |

### Measured evaluation (held-out, 6 cases)

| Engine | Round | Top-1 | Recall@3 | Evidence precision | Evidence recall | Mean latency |
|---|---|---|---|---|---|---|
| Vector-only | R0 | 0.333 | 1.000 | 0.056 | 0.167 | 257 ms |
| Fixed graph | R0 | 0.000 | 1.000 | 0.000 | 0.000 | 443 ms |
| Adaptive (untrained) | R0 | 0.000 | 1.000 | 0.000 | 0.000 | 565 ms |
| Vector-only | R1 | 0.333 | 1.000 | 0.056 | 0.167 | 147 ms |
| Fixed graph | R1 | 0.000 | 1.000 | 0.000 | 0.000 | 183 ms |
| Adaptive | R1 | **1.000** | 1.000 | **1.000** | **1.000** | 204 ms |

Training: 6/6 training incidents confirmed; templates learned for Database,
Cache, Queue and Deployment paths. Latency is wall-clock and varies with engine
warmth; Top-1, evidence precision and evidence recall are deterministic across
repeated runs on the same seed.

### Known verification gaps

- `reject`, `contributing_factor`, `stale_relationship` and `incorrect_mapping`
  were not each exercised through HTTP in this pass; the policy lives in one
  switch in `learning/engine.ts` and is rendered by the same ledger path.
- No exhaustive browser interaction suite was performed; pages were checked by
  rendered HTML, HTTP status and headless screenshots (see `docs/screenshots/`).
- Entity resolution, active gap-driven ingestion and authentication are not
  implemented and therefore not verified.

## Deliberately deferred

- Unit tests for the adapter decoder — exercised by every probe above; add
  table-driven tests when it changes.
- Vitest/Playwright setup — introduced when the evaluation scorers (Slice 6) need
  regression protection.
- Load / chaos testing against HydraDB — not required at demo scale.
- Browser-based interaction automation — screenshots were reviewed for the main
  screens, but no click-through automation was added.
