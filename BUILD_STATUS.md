# Build Status — Faultline

## Slice 1 ✅ COMPLETE
- Compose stack, typed adapter, schema (39 labels / 29 rel types), deterministic ids, repository, demo seed (28 nodes / 67 edges)
- API routes: `/`, `/graph`, `/diagnostics`, `/api/*`
- 3 screens: Overview, Graph Explorer, HydraDB Diagnostics
- Verification: `npx tsc --noEmit` clean; `npm run build` (11 routes); `npm run db:check` 10/10 probes; in-product probes 5/5; seed determinism verified (2 runs → identical 28/67)

## Slice 2 ✅ COMPLETE
- **Security**: `src/server/security/redact.ts` — recursive secret-key redaction before persistence or LLM prompts
- **Evidence model**: `src/server/evidence/object-store.ts` — stable JSON canonicalization, SHA-256 hash, `.hydradb/evidence` dir, `local://evidence/<hash>.json` URIs; integrity verification on read
- **Integrations**: `src/server/integrations/types.ts` + `src/server/integrations/simulator.ts` — 6 adapter prototypes (prometheus, loki, tempo, github, kubernetes, config-audit) returning `EvidenceDraft[]` plus `ConnectorState` records
- **Ingestion**: `src/server/evidence/ingest.ts` — writes payloads to object store (redacted, hashed), then writes Evidence graph nodes + `GENERATED`/`OBSERVED_DURING`/`DERIVED_FROM` edges
- **Temporal**: `src/server/graph/temporal.ts` — `isCurrent(valid_from, valid_to, asOf)` using sentinel `'9999-12-31T23:59:59.999Z'`; `currentTopologyFilter(asOf)` Cypher fragment; `closedTopologyFilter(asOf)`
- **Schema edits**: `src/server/graph/schema.ts` — `Workload` added to `RUNS_ON.to`; property keys for `Namespace`, `Workload`, `ConfigChange`, `Event`, `ConnectorSource`; `ConnectorSource` added to `CONTAINS.to`; `Evidence`, `Observation`, `Alert`, `Trace` added to `OBSERVED_DURING.from`; `Event` added to `OBSERVED_DURING.from`; `Workload` added to `POSSIBLY_CAUSED_BY.to`
- **Repository**: `src/server/graph/repository.ts` — `getDependencies(nodeId, label, {mode:'current'|'history', asOf})` with temporal filtering; `invalidateStatsCache()`
- **Seed**: `src/server/graph/seed.ts` — `redis-cache-legacy` cache node with closed stale edge (valid_to 2026-10-02); current edge from 2026-10-02; Namespace `prod-checkout`; Workload `checkout-service-7d9f`; ConfigChange `cache-migration-2026-10-02`; k8s Event; 5 `ConnectorSource` nodes; evidence ingestion into graph
- **API routes**: `/api/evidence`, `/api/evidence/[id]`, `/api/graph/topology`, `/api/connectors`
- **UI**: `/evidence` page (connector freshness, evidence list with payload preview + hash integrity), Overview freshness panel, Graph Explorer temporal edge display + current-vs-historical dependencies
- **Verification**: `npx tsc --noEmit` clean; `npm run build` succeeds (16 routes); health checks pass (10/10 probes); seed determinism: two runs → identical 42 nodes / 91 edges; evidence hash integrity verified (SHA-256 matches stored `content_hash`); stale `redis-cache-legacy` dependency excluded from current topology

## Slice 3 ✅ COMPLETE
- **LLM causal reasoning**: Qwen `qwen3.8-omni-flash` via OpenAI-compatible endpoint (`src/server/llm/qwen.ts`); `POST /api/ask` taking `{question, nodeId, label?}` and returning `{analysis, confidence, suggested_edges, data_gap}`; neighbourhood context from `getNeighborhood`; deterministic ids and redaction applied before LLM prompt
- **API route**: `/api/ask` (POST) — causal reasoning endpoint; returns JSON with `analysis`, `confidence` (0.0–1.0), `suggested_edges` (max 2), and `data_gap` string
- **New schema types**: `src/server/llm/types.ts` — `LlmMessage`, `LlmChatCompletion`, `LlmChatCompletionCreate`; `buildCausalPrompt()` prompt template
- **Verification**: `npx tsc --noEmit` clean; `npm run build` succeeds (22 routes including `/api/ask`); health checks pass (10/10 probes); `/api/ask` returns valid JSON schema on success; redaction applied before LLM prompt so no secrets leak to the model

## Running state
- Docker Compose up, HydraDB reachable on ports 9090/8443, graph seeded, app on port 3000