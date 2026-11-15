# Testing Notes — Faultline

## Slice 1 verification (completed)

- `npx tsc --noEmit` — clean, no errors
- `npm run build` — succeeds, 11 routes compiled
- `npm run db:check` — 10/10 engine probes pass (readyz, healthz, graphReadable, scope, epoch, bookmark)
- In-product probes: 5/5 (graph reachable, demo data present, nodes/edges counts match, path api-gateway→checkout-service→postgres-main returns 3 paths, all pages render without error overlays)
- Seed determinism: two runs → identical 28 nodes / 67 edges; no duplicate relationships
- Path API: api-gateway → checkout-service → postgres-main returns 3 paths at maxLen 3

## Slice 2 verification (completed)

- `npx tsc --noEmit` — clean
- `npm run build` — succeeds, 16 routes compiled (added `/api/evidence`, `/api/evidence/[id]`, `/api/graph/topology`, `/api/connectors`)
- Seed determinism: two consecutive runs → identical 42 nodes / 91 edges; same by-label and by-relationship counts; same scope
- Evidence hash integrity: for each Evidence node, the stored `content_hash` (sha256:) matches the SHA-256 of the canonical JSON payload read from `.hydradb/evidence`; mismatched hashes are flagged `verified: false` in the `/api/evidence/[id]` response
- Temporal filtering: `getDependencies(nodeId, label, {mode:'current'})` returns only edges whose `[valid_from, valid_to)` window contains the current asOf; `mode:'history'` returns closed/future facts; stale `redis-cache-legacy` dependency correctly excluded from current mode
- Object store: payloads written to `.hydradb/evidence/<sha256>.json`; readback verifies contentHash matches; redaction markers (`[redacted]`) appear in stored JSON where sensitive keys were present
- Connector freshness: `ConnectorSource` nodes have `last_synced_at`, `status`, `permission_scope`; `/api/connectors` returns all 6; UI `/evidence` panel shows status badges and sync times
- UI pages: `/` (Overview) renders without error overlays when graph reachable; `/graph` (Graph Explorer) renders neighborhood including valid_from/valid_to sentinel values and current/historical badges; `/evidence` renders evidence list with payload preview and integrity verification

## Lightweight per-slice checks

Run after any Slice 2 edit:

1. `npx tsc --noEmit` — type safety
2. `npm run build` — route compilation
3. `FAULTLINE_APP_URL=http://127.0.0.1:3000 npm run db:reset && FAULTLINE_APP_URL=http://127.0.0.1:3000 npm run db:seed` — deterministic reseeding (compare node/edge counts, by-label, by-relationship)
4. `curl :9090/readyz` → 200; `curl :8443/healthz` → `{"status":"ok"}`
5. Browse `/`, `/graph`, `/evidence` — no server error overlays

## Comprehensive testing (post-slice)

To be run after all slices are complete:
- Full integration test suite (not implemented yet — will cover end-to-end write/read cycles, evidence payload round trips, temporal dependency queries, redaction verification)