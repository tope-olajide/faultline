# Faultline — Development Handout

**Read this first in any new session.** It is the single entry point for how this
project is built, what exists right now, and what comes next.

Last updated: 2026-11-15 · Slice status: **1 of 8 verified**.

---

## 1. Working rules (non-negotiable)

1. **One slice at a time.** A slice is finished only when its primary user
   journey works end to end across UI, API, domain logic and HydraDB, and its
   acceptance criteria have been checked. Do not start the next slice while the
   current one has a broken journey.
2. **Commit after each completed slice, with no attribution.** No
   `Co-Authored-By` line, no "Generated with" footer, no AI attribution in the
   commit message. Do not add those trailers even if a tool suggests them.
3. **Push each completed slice** to `origin` (`https://github.com/tope-olajade/faultline.git`,
   branch `main`) once its verification passes.
4. **Build the product, not the test suite.** Light verification inside a slice
   (typecheck, build, the specific journey, targeted probes). Comprehensive
   test/E2E/security work is scheduled after the functional slices.
5. **No mock graph, ever.** HydraDB is the system of record. If it is unreachable
   the API returns 503 and the UI says so. A "temporary in-memory graph" would
   make the core claim of the product false.
6. **No fake UI.** No placeholder buttons, static graph data, hardcoded rankings,
   or invented percentages. Simulated data is allowed only in the demo dataset
   and evaluation lab, and must be labelled.
7. **Cypher lives in `src/server/graph` and `src/server/hydradb` only.** Never in
   components or route handlers.
8. **Internal status stays internal.** Development status, blockers and test
   results live in `docs/`. The public `README.md` describes only real
   capability (it is written in Slice 8, once the product exists).

---

## 2. Where the project stands

### Implemented and verified — Slice 1: foundation and HydraDB proof

| Layer | What exists |
|---|---|
| Infrastructure | `docker-compose.yml` runs self-hosted HydraDB v0.4.0 (Bolt 7687, HTTP 8443, admin 9090) with a durable named volume. `npm run setup` creates the token file and `.env.local`. |
| HydraDB adapter | `src/server/hydradb/client.ts` — typed HTTP client: cell decoding (including the path encoding and value-less null cells), paging with a consuming cursor, bookmarks, error-envelope mapping, readiness diagnostics. |
| Graph model | `src/server/graph/schema.ts` — 39 labels, 29 relationship types with allowed endpoint pairs, display properties, declared per-label property keys. `ids.ts` — deterministic 53-bit FNV-1a ids over scope+label+external id. |
| Repository | `src/server/graph/repository.ts` — idempotent node/edge upserts, batched deletes, node reads, label listing, typed neighbourhoods, `algo.SPpaths` traversal, live statistics. |
| Demo dataset | `src/server/graph/seed.ts` — checkout platform: 6 services, PostgreSQL, Redis, RabbitMQ, cluster, teams, repo, deployment, commit, alert, open incident, 4 evidence records, metric/log/trace references, 2 ranked hypotheses. 28 nodes, 67 relationships. |
| API | `/api/health`, `/api/graph/stats`, `/api/graph/nodes`, `/api/graph/nodes/:id`, `/api/graph/paths`, `/api/demo/seed`, `/api/diagnostics/probe` — all Zod-validated. |
| UI | App shell (248 px sidebar, 56 px top bar, tokens from the spec), Overview (KPIs, active incidents, dependency path, graph health, dataset controls, label/relationship distribution), Graph Explorer (label rail, entity table, property + relationship inspector), HydraDB Diagnostics (surfaces, scope, live probes, write-discipline reference). |
| Scripts | `setup`, `db:check` (10 engine probes), `db:seed`, `db:reset`, `db:up`, `db:down`, `db:logs`. |

Proof points: re-seeding twice yields identical counts (28/67) with no duplicated
relationships; a 3-node dependency path is resolved by `algo.SPpaths`; node and
edge properties round-trip; 10/10 compatibility probes pass. Full evidence in
`TESTING_NOTES.md`; engine behaviour in `HYDRADB_INTEGRATION.md`.

### Currently being implemented

**Nothing.** Slice 1 is closed. Slice 2 is the next unit of work.

### Next — Slice 2: canonical graph and ingestion simulator

Objectives (see `IMPLEMENTATION_PLAN.md` §3 Slice 2):

- Temporal relationships with `valid_from` / `valid_to` / `recorded_at` and
  supersession history (a dependency that changed over time).
- Full evidence model with object-store references (`./.hydradb/evidence`) and
  content hashes; no raw payloads in the graph.
- Simulator adapters producing metric windows, log patterns, trace references,
  Kubernetes events, deployments and config changes.
- Data-freshness panel and scope enforcement visible in the UI.
- Acceptance: multi-hop topology including one historical dependency; inspect any
  node/edge with source and temporal validity; deterministic re-ingestion; stale
  dependencies excluded from "current topology" queries.

After Slice 2: Slice 3 (incident lifecycle + investigation workspace), Slice 4
(feedback + learning ledger), Slice 5 (adaptive path learning + graph repair),
Slice 6 (evaluation lab), Slice 7 (real integrations), Slice 8 (polish, governance,
release).

---

## 3. Running it

```bash
npm install
npm run setup        # token file + .env.local
npm run db:up        # HydraDB: 7687 Bolt, 8443 HTTP, 9090 admin
npm run db:check     # 10 engine probes — must all pass
npm run dev          # http://localhost:3000
                     # seed the demo graph from the Overview page
```

Useful: `npm run db:seed` (needs the dev server running), `npm run typecheck`,
`npm run build`, `npm run db:logs`.

Environment variables are documented in `.env.example`. Defaults target the local
Compose stack; deployed instances need `HYDRADB_TOKEN` and TLS URLs.

---

## 4. File map

```
docker-compose.yml              self-hosted HydraDB
src/app/                        App Router: Overview, /graph, /diagnostics, /api/*
src/components/                 shell (sidebar, top bar), ui primitives, demo controls
src/server/config.ts            env + demo scope
src/server/hydradb/             wire types, typed HTTP client
src/server/graph/               schema, ids, repository, demo seed
src/server/health.ts            live diagnostics
src/server/diagnostics.ts       in-product compatibility probes
src/server/http.ts              error → HTTP mapping
scripts/                        setup, compat check, seed CLI
docs/                           this handout, plan, status, decisions, HydraDB notes
```

---

## 5. HydraDB rules an implementer must not forget

Full detail in `HYDRADB_INTEGRATION.md`; the short version:

- `id` is an upsert key supplied by the caller — deterministic ids, `external_id`
  as a property.
- Nodes are written **before** edges (unlabelled edge-endpoint nodes disappear
  from label-anchored counts).
- Retryable edges use `MERGE`; bulk edges use `UNWIND … CREATE`; one-off `CREATE`
  duplicates relationships.
- Edge properties cannot be set in the bulk edge batch (`UNWIND CREATE` cannot be
  followed by `SET`) — use inline `MERGE` properties or a follow-up `MATCH … SET`.
- No `RETURN *`, no expressions in `RETURN`, one relationship type per pattern,
  every traversal bounded, every `MATCH` anchored.
- Requests auto-commit; there are no multi-statement transactions. Every mutation
  must be idempotent, and learning mutations must be recorded reversibly.
- `next_cursor` page fetches are not retryable.

---

## 6. Open decisions

Tracked in `TECHNICAL_DECISIONS.md` (D1–D8) and `INTEGRATION_NOTES.md`. The two
that will surface first in Slice 2–3:

- Whether the optional `graph-indexer` process is needed for evaluation-scale
  counts.
- How far to lean on `algo.*` weights versus application-layer ranking (current
  decision: application-layer).
