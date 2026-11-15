# HydraDB Integration Notes

Internal engineering document. Every claim below was probed against a running
engine, not read from documentation alone.

**Engine under test:** `ghcr.io/hydra-db/hydradb:latest` — HydraDB v0.4.0,
`graph-node` binary, build commit `916637477f3f34766b4905b270bd4292109d77e6`,
Rust 1.99.0.
**Deployment:** `docker compose up -d` (`docker-compose.yml`), local object
store, plaintext development mode, single cell `cell-0`, graph `default`.

| Surface | Address | Notes |
|---|---|---|
| Bolt 5.x | `127.0.0.1:7687` | password = bearer token, any username |
| HTTP query API | `127.0.0.1:8443` | `POST /v1/graphs/{graph_id}/query`, `GET /healthz` |
| Admin | `127.0.0.1:9090` | `GET /readyz` (200 + empty body), `GET /metrics` |

Faultline uses the **HTTP query API** as its transport. A typed adapter
(`src/server/hydradb/client.ts`) is the only place that speaks it, so a Bolt
transport can be added behind the same interface without touching domain code.

---

## 1. Verified capabilities

Probed on 2026-11-15 with `npm run db:check` and manual `curl` runs.

| Shape | Result |
|---|---|
| `MERGE (a {id: N})-[:R]->(b {id: M})` run 3× | 1 edge — idempotent |
| `UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Service, n.name = row.name, n.criticality = row.crit` | Creates/updates labelled nodes with properties in one request |
| `UNWIND $rows AS row CREATE (a {id: row.src})-[:R]->(b {id: row.dst})` run 2× | Deduplicates on (src, dst, type) |
| `MATCH (s:Service {id: $id}) RETURN s.name AS name` | Label-anchored property read, one row |
| `MATCH (a {id: $id})-[:DEPENDS_ON*1..2]->(b) RETURN b.id AS id ORDER BY id` | Bounded multi-hop traversal |
| `CALL algo.SPpaths({sourceNode, targetNode, relTypes, relDirection, maxLen, pathCount}) YIELD path RETURN path` | Returns path nodes (plain ids, capitalised property tags) |
| `CALL algo.SSpaths({sourceNode, relTypes, relDirection, maxLen, pathCount}) YIELD path RETURN path` | Single-source paths |
| `MATCH (a {id: $src})-[r:TYPE]->(b) SET r.confidence_score = $v` | Relationship property write, read back as `float` |
| `UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n` | Batched delete (≤1024 items) |
| `MATCH (n:Label) RETURN count(n.id) AS n` | Label-anchored graph-wide count |
| `MATCH (a:Service)-[r:T]->(b) RETURN a.id AS src, b.id AS dst, r.confidence_score AS c` | Edge property scan, one row per edge, absent property → `{"type":"null"}` |
| `MATCH (n {id: X}) DETACH DELETE n` on a missing id | Harmless no-op |

## 2. Verified rejections (design constraints)

| Attempted | Engine response | Consequence for Faultline |
|---|---|---|
| `UNWIND $rows AS row CREATE (a {id: row.src})-[r:T]->(b {id: row.dst}) SET r.x = row.x` | `UNWIND CREATE cannot be followed by another clause` | Edge properties cannot be set in the bulk edge batch. Use per-edge `MERGE` with inline properties, or a follow-up `MATCH … SET r.x` per edge. |
| `MATCH (s:Service {id: 1}) RETURN *` | `RETURN * is not executable in Query engine` | Every projection is explicit; the repository builds projection lists from the schema. |
| `MERGE (n {id: 1}) SET n.name = 'x'` | `MERGE with following clauses is not executable` | Node property updates use `UNWIND … MERGE … SET n:Label, …` or `MATCH … SET`. |
| `RETURN p` for a path binding | Only properties / `count(*)` | Paths come from `algo.*` procedures, decoded client-side. |
| `count(DISTINCT x)` | `DISTINCT aggregate arguments are not executable` | Deduplicate client-side. |

## 3. Encoding rules the adapter implements

1. `id` is an **upsert key**, not a property. Reading it yields
   `{"type":"vertex_id"}` — not `integer`. A decoder keyed on `integer` silently
   drops every id.
2. A null cell is `{"type":"null"}` **with no `value` key**. Reading `.value`
   unconditionally is a crash waiting for the first absent property.
3. Path cells use a third convention: `node.id` is plain, `node.properties` is
   tagged with capitalised type names (`{"String":"checkout-api"}`),
   `relationships[].id` is `null` in practice.
4. Errors use `{"error":{"code","message"}}`; a malformed body (e.g. missing
   `cell_id`) returns 422 with **neither** `rows` nor `error`. The client checks
   `rows` explicitly instead of treating that as an empty result.
5. `next_cursor` is a consuming iterator. Pages are fetched exactly once and
   never retried; `page_size` is resent on every page.
6. `bookmark` (singular) enables read-your-writes. Misspelled fields are silently
   ignored with a 200, so the field name is fixed in one place.
7. Each request auto-commits. Faultline writes idempotently and records a
   learning ledger entry for every mutation it needs to reverse.

## 4. Labelling discipline

A node created only as an edge endpoint has **no label**, and label-anchored
counts then silently under-report. Faultline therefore always writes node
batches (labels + properties) before edge batches, and re-reads counts after
seeding to confirm the write landed.

## 5. Local storage caveats observed

- The container runs as uid 10001. Bind-mounting a host directory on Docker
  Desktop/Windows produced `PermissionDenied`; the compose file uses a **named
  volume** (`hydradb-store`) instead, which is durable across restarts.
- Git Bash rewrites container paths (`/data/store` →
  `C:/Program Files/Git/data/store`). Paths are supplied via `docker-compose.yml`,
  never as shell arguments.
- `GRAPH_ALLOW_PLAINTEXT=true` is required for a local plaintext node. Deployed
  instances require TLS and a real token.

## 6. Open questions to settle before later slices

- Whether `weightProp` / `costProp` in `algo.*` are interpreted as cost (lower =
  better). Until verified, path ranking is computed in the application layer.
- `algo.MSpaths` `pairwise` default and `resultLimit` interaction for blast-radius
  batches.
- Behaviour of `SET` on a relationship with a property key that already holds a
  different type.
- Whether the indexer process is required for consistent count performance at
  demo scale (currently query-node only, counts are fast).
