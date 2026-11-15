# Faultline — Known Issues

Internal engineering document. Verified facts only; speculative risks belong in
`IMPLEMENTATION_PLAN.md` §5.

| # | Area | Issue | Impact | Workaround / plan |
|---|---|---|---|---|
| K1 | Infrastructure | HydraDB container runs as uid 10001 and fails with `PermissionDenied` when `LOCAL_PATH` is a Windows bind mount | Local startup failure on Docker Desktop/Windows | Compose uses the named volume `hydradb-store`; do not switch to a host bind mount without fixing ownership |
| K2 | Infrastructure | Git Bash rewrites absolute container paths in commands | Confusing `UnableToCanonicalize C:/Program Files/Git/...` errors | Container paths only ever come from `docker-compose.yml` |
| K3 | HydraDB | `UNWIND … CREATE … SET r.x` is rejected, so edge properties cannot be bulk-written | Edge seeding is one request per edge | Bulk `CREATE` for property-less loads; `MERGE` inline properties otherwise |
| K4 | HydraDB | `algo.*` weight semantics unverified | Cannot delegate learned scoring to the engine | Rank in the application layer (D5) |
| K5 | HydraDB | Nodes created only as edge endpoints carry no label, and label-anchored counts silently under-report | Wrong statistics if write order is broken | Label batches always precede edge batches; seed re-reads counts |
| K6 | HydraDB | `next_cursor` page fetches are not retryable | A retried page silently skips rows | Pages fetched exactly once, no retry loop on paged reads |
| K7 | Graph | Search is application-side filtering until a supported text predicate is verified (`CONTAINS` is not in the documented subset) | Search scans a bounded result set | Bounded scans now; property index + exact-match query once verified |
| K8 | UI | Only Overview, Graph Explorer and HydraDB Diagnostics exist | Most specified screens are not built yet | Each screen ships with its slice; the sidebar only lists routes that exist, so there are no dead links or placeholder pages |
| K9 | Tests | No automated test suite yet (probes are scripts, not unit tests) | Regressions are caught manually during slices | Slice acceptance checks are recorded in `TESTING_NOTES.md`; full suite scheduled after functional slices |
| K10 | Auth | No authentication; single demo scope | Not multi-tenant safe | Slice 8 (RBAC/audit). Local demo only until then |
