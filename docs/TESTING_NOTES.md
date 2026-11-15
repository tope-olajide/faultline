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

## Deliberately deferred

- Unit tests for the adapter decoder — exercised by every probe above; add
  table-driven tests when it changes.
- Vitest/Playwright setup — introduced when the evaluation scorers (Slice 6) need
  regression protection.
- Load / chaos testing against HydraDB — not required at demo scale.
- Browser-based visual review — no screenshots were taken; markup and rendered
  HTML were checked, not pixels.
