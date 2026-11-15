# Faultline — Technical Decisions

Internal engineering document. Records decisions that constrain later slices,
with the reasoning and the exit path if the decision is revisited.

---

## D1 — One Next.js app with enforced server module boundaries (not a pnpm monorepo)

**Decision.** A single Next.js 16 App Router application. Server code is split
into `src/server/{hydradb,graph,domain,investigation,learning,evaluation}` with
strict one-directional imports. No package currently exists outside it.

**Why.** The specification's recommended structure assumes a separate API
process, which adds workspace build orchestration, two build pipelines, and
duplicated type plumbing before a single journey works. Next route handlers give
the same server-side boundary and Zod-validated contracts, and the slice method
values working journeys over infrastructure.

**Constraints that keep the option open.** No UI component imports from
`server/`. Every HydraDB query lives in `server/graph` or `server/hydradb`.
Domain types live in `server/domain` and are transport-agnostic. Extracting
`apps/api` later is a file move plus an HTTP client, not a rewrite.

**Revisit when.** A background worker is needed for connector sync or long
evaluations — then `src/server/evaluation` and `src/server/integrations` move to
a worker process and share the same domain package.

---

## D2 — HydraDB over its HTTP query API, behind a typed adapter

**Decision.** `src/server/hydradb/client.ts` talks to `POST
/v1/graphs/{graph_id}/query`. No Bolt driver dependency is installed.

**Why.** HTTP needs no client library, has exactly the JSON shapes documented in
`HYDRADB_INTEGRATION.md`, and lets the decoder handle HydraDB's three separate
cell encodings in one place. Bolt's native path objects would be simpler for
paths, but only paths — and adding the driver now costs a dependency and a second
decoding path.

**Cost accepted.** Manual path decoding (capitalised property tags) and manual
pagination. Both are implemented and probed.

**Revisit when.** Path-heavy screens need streaming or when query latency
dominates; a Bolt transport can implement the same interface.

---

## D3 — Caller-supplied deterministic ids derived from scope + label + external id

**Decision.** `entityId(scope, label, externalId)` = low 53 bits of a 64-bit
FNV-1a hash, never 0. Natural identifiers are stored in `external_id`. Scope is
`tenant/project/environment`.

**Why.** HydraDB requires caller-supplied ids and treats equal ids as the same
node, so ids must be stable across re-ingestion and unique across tenants.
Hashing makes ingestion idempotent without a central id allocator, and keeping
under 2^53 keeps ids exact in JavaScript.

**Collision handling.** Writes record `external_id`; the repository exposes a
verification read that compares `external_id` for a given id before trusting it.
Demo-scale collision probability is negligible, but the check exists because a
silent merge of two entities would be indistinguishable from an entity-resolution
result.

**Constraint.** An id is scoped to one label; the same external id in another
label is a different node by construction. Entity resolution (Slice 5) is
therefore about *identity across sources*, not id collision.

---

## D4 — Write discipline: labels first, then edges; never single-statement CREATE

**Decision.** Node batches: `UNWIND $rows AS row MERGE (n {id: row.id}) SET
n:Label, n.k1 = row.k1, …`, chunked at 500. Edges: per-edge `MERGE` with inline
properties for anything retryable; `UNWIND … CREATE` only for bulk edge loads
without properties. Deletes are batched `UNWIND … DETACH DELETE`.

**Why (probed).** Single `CREATE` duplicates edges on retry; `UNWIND … CREATE`
deduplicates; `UNWIND CREATE` cannot be followed by `SET`, so edge properties
must be inline in `MERGE` or a separate `MATCH … SET`. Node batches must be
written before edges, otherwise nodes exist unlabelled and label-anchored counts
silently under-report.

**Cost accepted.** Edge seeding is one request per edge. At demo scale
(tens–hundreds of edges) this is milliseconds; a bulk path without properties
exists for larger loads.

---

## D5 — Application-layer path ranking, not engine-side weights

**Decision.** `algo.SPpaths` / `algo.SSpaths` provide candidate paths; ranking
combines edge reliability, path template utility, temporal validity, evidence
freshness, and source reliability in TypeScript.

**Why.** HydraDB does expose `weightProp` / `costProp`, but the direction and
scaling semantics are unverified, and the real ranking model needs signals the
engine does not hold (freshness decay, learned path utility, contradiction
counts). Putting scoring in the app also makes it auditable — the Learning Engine
can explain a score, which an opaque engine cost cannot.

**Revisit when.** Path exploration exceeds what the app can rank inside the
query budget; then a precomputed `weight` property is written by the learning
engine and the engine only pre-filters.

---

## D6 — No control-plane database yet

**Decision.** Slice 1 uses no Postgres. Workspace/project/environment scope comes
from environment configuration; graph data carries scope keys as properties.

**Why.** Accounts, RBAC, and connector credentials are Slice 7–8 concerns. Adding
Postgres now would create a second persistence system with no feature to justify
it, and the specification explicitly forbids it becoming a second source of truth
for graph relationships.

**Revisit when.** Slice 7 introduces connector credentials (they must never live
in the graph) or Slice 8 introduces multi-user RBAC.

---

## D7 — Deterministic reasoning first, LLM adapter second

**Decision.** Slice 3's investigation engine will be a bounded state machine
whose hypothesis generation reads structured graph facts. An LLM adapter
(narration, hypothesis phrasing) is optional and configured by environment.

**Why.** The demo must run without a paid key, evaluation must be comparable
across engines, and the specification forbids the model from deciding what is
true in the graph. Building the deterministic path first also keeps evaluation
honest: improvements come from graph learning, not from prompt drift.

---

## D8 — No mock graph adapter

**Decision.** There is no in-memory graph fallback. If HydraDB is unreachable the
API returns a typed `503` and the UI shows the specific failure.

**Why.** A silent fallback would make "HydraDB is the system of record" untrue and
hide integration breakage during development. The demo requirement is satisfied
by shipping HydraDB in Compose, not by faking it.
