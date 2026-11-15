# Faultline Handout

## What is implemented

- **Slice 1** (complete, pushed): Compose stack + typed HydraDB adapter + schema (39 labels / 29 rel types) + deterministic entity ids (FNV-1a over scope\0label\0externalId) + repository with batch upsert / per-edge MERGE + demo seed (28 nodes / 67 edges) + API routes (11 routes) + Overview, Graph Explorer, Diagnostics screens + scripts + internal docs (`docs/TECHNICAL_DECISIONS.md`, `docs/KNOWN_ISSUES.md`, etc.)

- **Slice 2** (complete): 
  - **Security**: recursive secret-key redaction (`src/server/security/redact.ts`) applied before any payload persistence or LLM use
  - **Evidence model**: local object store (`src/server/evidence/object-store.ts`) with stable-stringify JSON, SHA-256 hash, `.hydradb/evidence` directory, `local://evidence/<hash>.json` URIs; integrity-verified readback
  - **Integrations**: 6 simulator adapters (`src/server/integrations/simulator.ts`) — prometheus, loki, tempo, github, kubernetes, config-audit — all returning `EvidenceDraft[]` plus `ConnectorState` freshness records; normalized schema in `src/server/integrations/types.ts`
  - **Ingestion**: `src/server/evidence/ingest.ts` writes payloads (redacted, hashed) to object store, then creates Evidence graph nodes + `GENERATED`/`OBSERVED_DURING`/`DERIVED_FROM` edges
  - **Temporal**: sentinel-based `OPEN_ENDED = '9999-12-31T23:59:59.999Z'` (`src/server/graph/temporal.ts`); `isCurrent()` / `currentTopologyFilter()` / `closedTopologyFilter()`; server-side `WHERE r.valid_from <= $asOf AND r.valid_to > $asOf` filtering in `getDependencies()`
  - **Schema**: `Workload` added to `RUNS_ON.to`; property keys for `Namespace`, `Workload`, `ConfigChange`, `Event`, `ConnectorSource`; `ConnectorSource` in `CONTAINS.to`; `Evidence`/`Observation`/`Alert`/`Trace` in `OBSERVED_DURING.from`; `Event` in `OBSERVED_DURING.from`; `Workload` in `POSSIBLY_CAUSED_BY.to`
  - **Seed**: retired `redis-cache-legacy` cache with closed stale DEPENDS_ON edge (valid_to 2026-10-02); current DEPENDS_ON from 2026-10-02; Namespace `prod-checkout`; Workload `checkout-service-7d9f`; ConfigChange `cache-migration-2026-10-02`; k8s Event; 5 `ConnectorSource` nodes; evidence payloads ingested into graph
  - **API routes**: `/api/evidence`, `/api/evidence/[id]`, `/api/graph/topology`, `/api/connectors`
  - **UI**: `/evidence` page (connector freshness, evidence list with payload preview + hash integrity), Overview freshness panel, Graph Explorer temporal edge display + current-vs-historical dependencies

- **Running state**: Docker Compose up, HydraDB reachable on ports 9090/8443, graph seeded, app on port 3000

## What is implemented

- **Slice 1** (complete, pushed): Compose stack + typed HydraDB adapter + schema (39 labels / 29 rel types) + deterministic entity ids (FNV-1a over scope\0label\0externalId) + repository with batch upsert / per-edge MERGE + demo seed (28 nodes / 67 edges) + API routes (11 routes) + Overview, Graph Explorer, Diagnostics screens + scripts + internal docs (`docs/TECHNICAL_DECISIONS.md`, `docs/KNOWN_ISSUES.md`, etc.)

- **Slice 2** (complete): 
  - **Security**: recursive secret-key redaction (`src/server/security/redact.ts`) applied before any payload persistence or LLM use
  - **Evidence model**: local object store (`src/server/evidence/object-store.ts`) with stable-stringify JSON, SHA-256 hash, `.hydradb/evidence` directory, `local://evidence/<hash>.json` URIs; integrity-verified readback
  - **Integrations**: 6 simulator adapters (`src/server/integrations/simulator.ts`) — prometheus, loki, tempo, github, kubernetes, config-audit — all returning `EvidenceDraft[]` plus `ConnectorState` freshness records; normalized schema in `src/server/integrations/types.ts`
  - **Ingestion**: `src/server/evidence/ingest.ts` writes payloads (redacted, hashed) to object store, then creates Evidence graph nodes + `GENERATED`/`OBSERVED_DURING`/`DERIVED_FROM` edges
  - **Temporal**: sentinel-based `OPEN_ENDED = '9999-12-31T23:59:59.999Z'` (`src/server/graph/temporal.ts`); `isCurrent()` / `currentTopologyFilter()` / `closedTopologyFilter()`; server-side `WHERE r.valid_from <= $asOf AND r.valid_to > $asOf` filtering in `getDependencies()`
  - **Schema**: `Workload` added to `RUNS_ON.to`; property keys for `Namespace`, `Workload`, `ConfigChange`, `Event`, `ConnectorSource`; `ConnectorSource` in `CONTAINS.to`; `Evidence`/`Observation`/`Alert`/`Trace` in `OBSERVED_DURING.from`; `Event` in `OBSERVED_DURING.from`; `Workload` in `POSSIBLY_CAUSED_BY.to`
  - **Seed**: retired `redis-cache-legacy` cache with closed stale DEPENDS_ON edge (valid_to 2026-10-02); current DEPENDS_ON from 2026-10-02; Namespace `prod-checkout`; Workload `checkout-service-7d9f`; ConfigChange `cache-migration-2026-10-02`; k8s Event; 5 `ConnectorSource` nodes; evidence payloads ingested into graph
  - **API routes**: `/api/evidence`, `/api/evidence/[id]`, `/api/graph/topology`, `/api/connectors`
  - **UI**: `/evidence` page (connector freshness, evidence list with payload preview + hash integrity), Overview freshness panel, Graph Explorer temporal edge display + current-vs-historical dependencies

- **Slice 3** (complete): 
  - **LLM causal reasoning**: Qwen `qwen3.8-omni-flash` via OpenAI-compatible endpoint (`src/server/llm/qwen.ts`); `POST /api/ask` taking `{question, nodeId, label?}` and returning `{analysis, confidence, suggested_edges, data_gap}`; neighbourhood context from `getNeighborhood`; deterministic ids and redaction applied before LLM prompt
  - **Running state**: Docker Compose up, HydraDB reachable on ports 9090/8443, graph seeded, app on port 3000

## What is implemented

- **Slice 1** (complete, pushed): Compose stack + typed HydraDB adapter + schema (39 labels / 29 rel types) + deterministic entity ids (FNV-1a over scope\0label\0externalId) + repository with batch upsert / per-edge MERGE + demo seed (28 nodes / 67 edges) + API routes (11 routes) + Overview, Graph Explorer, Diagnostics screens + scripts + internal docs (`docs/TECHNICAL_DECISIONS.md`, `docs/KNOWN_ISSUES.md`, etc.)

- **Slice 2** (complete): 
  - **Security**: recursive secret-key redaction (`src/server/security/redact.ts`) applied before any payload persistence or LLM use
  - **Evidence model**: local object store (`src/server/evidence/object-store.ts`) with stable-stringify JSON, SHA-256 hash, `.hydradb/evidence` directory, `local://evidence/<hash>.json` URIs; integrity-verified readback
  - **Integrations**: 6 simulator adapters (`src/server/integrations/simulator.ts`) — prometheus, loki, tempo, github, kubernetes, config-audit — all returning `EvidenceDraft[]` plus `ConnectorState` freshness records; normalized schema in `src/server/integrations/types.ts`
  - **Ingestion**: `src/server/evidence/ingest.ts` writes payloads (redacted, hashed) to object store, then creates Evidence graph nodes + `GENERATED`/`OBSERVED_DURING`/`DERIVED_FROM` edges
  - **Temporal**: sentinel-based `OPEN_ENDED = '9999-12-31T23:59:59.999Z'` (`src/server/graph/temporal.ts`); `isCurrent()` / `currentTopologyFilter()` / `closedTopologyFilter()`; server-side `WHERE r.valid_from <= $asOf AND r.valid_to > $asOf` filtering in `getDependencies()`
  - **Schema**: `Workload` added to `RUNS_ON.to`; property keys for `Namespace`, `Workload`, `ConfigChange`, `Event`, `ConnectorSource`; `ConnectorSource` in `CONTAINS.to`; `Evidence`/`Observation`/`Alert`/`Trace` in `OBSERVED_DURING.from`; `Event` in `OBSERVED_DURING.from`; `Workload` in `POSSIBLY_CAUSED_BY.to`
  - **Seed**: retired `redis-cache-legacy` cache with closed stale DEPENDS_ON edge (valid_to 2026-10-02); current DEPENDS_ON from 2026-10-02; Namespace `prod-checkout`; Workload `checkout-service-7d9f`; ConfigChange `cache-migration-2026-10-02`; k8s Event; 5 `ConnectorSource` nodes; evidence payloads ingested into graph
  - **API routes**: `/api/evidence`, `/api/evidence/[id]`, `/api/graph/topology`, `/api/connectors`
  - **UI**: `/evidence` page (connector freshness, evidence list with payload preview + hash integrity), Overview freshness panel, Graph Explorer temporal edge display + current-vs-historical dependencies

- **Slice 3** (complete): 
  - **LLM causal reasoning**: Qwen `qwen3.8-omni-flash` via OpenAI-compatible endpoint (`src/server/llm/qwen.ts`); `POST /api/ask` taking `{question, nodeId, label?}` and returning `{analysis, confidence, suggested_edges, data_gap}`; neighbourhood context from `getNeighborhood`; deterministic ids and redaction applied before LLM prompt
  - **API route**: `/api/ask` (POST) — causal reasoning endpoint; returns JSON with `analysis`, `confidence` (0.0–1.0), `suggested_edges` (max 2), and `data_gap` string
  - **New schema types**: `src/server/llm/types.ts` — `LlmMessage`, `LlmChatCompletion`, `LlmChatCompletionCreate`; `buildCausalPrompt()` prompt template
- **Slice 4** (complete): 
  - **Feedback API**: `POST /api/feedback` taking `{requestKey, outcome, actorRef, reason, linkedEvidenceId, targetEdge}` and returning `{feedback, edgeChanges}`; idempotent via requestKey deduplication
  - **Graph mutations**: `support_count` / `contradiction_count` / `confidence_score` edge properties updated per outcome
  - **LearningUpdate records**: created per feedback submission with `before_state`/`after_state` snapshots
  - **New relationship types**: `CONFIRMED_BY`, `REJECTED_BY`, `CONTRIBUTES_TO`, `STALE_RELATIONSHIP`, `INCORRECT_MAPPING` in `src/server/graph/schema.ts`
  - **New edge properties**: `confidence_score` (nudged ±0.1), `support_count`, `contradiction_count` tracked per feedback
  - **Verification**: `npx tsc --noEmit` clean; `npm run build` succeeds (23 routes); health checks pass (10/10 probes); idempotency verified (replaying same requestKey applies nothing twice)

## What is currently being implemented

*(nothing — all slices complete)*

## Working rules (no negotiation)

1. **Finish current slice before starting the next** — Slice 2 must be fully complete (UI, API, domain, HydraDB) before Slice 3 begins
2. **Commit without attributions** — no `Co-Authored-By`, no "Generated with" footer on any commit
3. **Push to GitHub** after each completed slice (`origin` = `https://github.com/tope-olajide/faultline.git`, branch `main`)
4. **HydraDB is the only graph engine** — no mock/in-memory graph fallback, no Neo4j
5. **No placeholder buttons, static graph data, or hardcoded results** — simulated data only in demo dataset/evaluation lab and must be labelled
6. **Cypher only in `src/server/graph` and `src/server/hydradb`** — no Cypher elsewhere
7. **Keep dev-status language out of the public README** — internal status lives in `docs/`
8. **Testing policy**: lightweight verification per slice; comprehensive testing after functional slices
9. **Deterministic caller-supplied ids** — low 53 bits of FNV-1a over `scope\u0000label\u0000externalId`, never 0
10. **Write discipline**: node batches (`UNWIND … MERGE … SET n:Label, props`) before edge batches; edges use per-edge `MERGE` with inline props; bulk `UNWIND … CREATE` dedupes on `(src,dst,type)`

## Notes for the next slice

- No further slices planned at this time. The project currently has 4 complete slices (Slice 1: graph schema + seed, Slice 2: evidence + temporal + integrations, Slice 3: LLM causal reasoning, Slice 4: engineer feedback and learning ledger). Future work may include Postgres control-plane, real connector adapters, and expanded UI features.