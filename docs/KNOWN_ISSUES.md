# Faultline — Known Issues

Internal engineering document. Verified facts only.

| # | Area | Issue | Impact | Workaround / plan |
|---|---|---|---|---|
| K1 | Infrastructure | HydraDB container runs as uid 10001 and fails with `PermissionDenied` on a Windows bind mount | Local startup failure on Docker Desktop | Compose uses the named volume `hydradb-store` |
| K2 | Infrastructure | Git Bash rewrites absolute container paths | Confusing canonicalisation errors | Container paths only come from `docker-compose.yml` |
| K3 | HydraDB | `UNWIND … CREATE … SET r.x` is rejected | Edge properties cannot be bulk-written | Per-edge `MERGE` with inline properties |
| K4 | HydraDB | `algo.*` weight semantics unverified | Learned scoring cannot be delegated to the engine | Ranking is computed in the application layer |
| K5 | HydraDB | `next_cursor` pages are not retryable | A retry silently skips rows | Pages fetched exactly once |
| K6 | HydraDB | Incoming variable-length patterns require a fixed source id | Reverse multi-hop traversal is not a single query | Blast radius is computed in-app from one bounded edge scan |
| K7 | HydraDB | `RETURN *` and map projections (`{.*}`) are rejected | Ad-hoc projections fail | Every projection is explicit in `schema.ts` |
| K8 | Graph | Label counts are application-declared because the engine cannot enumerate labels | A new label is invisible until added to the schema | Add labels to `GRAPH_LABELS` before writing them |
| K9 | Evaluation | Benchmark has only six held-out cases and two/three candidates each | Recall@3 is saturated at 1.0; deltas have wide uncertainty | Treat results as mechanism proof, not production accuracy |
| K10 | Evaluation | Vector baseline is lexical TF-IDF, not embeddings | May understate or overstate a realistic vector DB | Documented on the evaluation screen; an embedding adapter is future work |
| K11 | Evaluation | Confidence is an uncalibrated relative score | Cannot be read as a probability | Labelled in UI and API; calibration is an open slice |
| K12 | Learning | Automated training feedback confirms only the verified cause; it does not reject distractors | Negative learning is exercised by human feedback but not by the benchmark | Documented; reject-path is verified manually |
| K13 | Learning | Seeding clears learning state | Re-seeding resets the ledger and learned weights | Intentional: seed values and ledger must stay consistent |
| K14 | Auth | No authentication; single demo scope | Not multi-tenant safe | Local demo only until the auth slice |
| K15 | Integrations | Connectors are deterministic simulators | No live external data | Adapter interface is real; live clients are future work |
| K16 | UI | No route-level loading skeletons | Slow HydraDB queries show a blank transition | Pages are server-rendered with short queries (~100–300 ms locally) |
| K17 | Tests | No committed investigation/evaluation regression suite yet | Regressions are caught by scripted live runs | Planned slice; verification steps recorded in `TESTING_NOTES.md` |

## Fixed in the takeover

| Issue | Resolution |
|---|---|
| `external_id` never persisted, identity reads returned `null` | `upsertNodes` now writes `external_id` |
| Feedback replay double-applied | Lookup key corrected to `feedback/<requestKey>` |
| `submitFeedback` used invalid Cypher and fabricated before/after state | Replaced with read-modify-write learning engine |
| Evidence crossed incident boundaries | Investigator requires `OBSERVED_DURING` linkage to the incident |
| Dead/fake routes (`/api/ask`, `/api/path-template`, `/api/entity-match`) | Removed |
| Docs claimed unimplemented slices were complete | Rewritten |
