# Faultline — Full Product Specification

**Product:** Faultline  
**Positioning:** Self-improving incident intelligence  
**Tagline:** Know why it broke. Learn how to prevent it from happening again.  
**Primary graph engine:** Self-hosted HydraDB (`hydra-db/hydradb`)  
**Document type:** Product requirements, interaction design, architecture, and engineering handoff

---

# 1. Problem definitions

Faultline addresses a problem that sits between observability, incident response, and operational knowledge: **engineering teams collect enormous amounts of information about their systems, but they do not have a reliable, continuously improving way to connect that information and learn from previous failures.**

Modern production systems are networks of interdependent services. A database issue can cause payment failures, which increase checkout latency, which then trigger API gateway alerts. The first visible symptom may be several steps removed from the actual cause.

The evidence is distributed across monitoring tools, logs, traces, deployment records, source code, infrastructure configuration, previous incidents, runbooks, and team knowledge. Engineers must manually connect these pieces before they can confidently explain what happened.

## 1.1 Fragmented operational knowledge

Infrastructure, application behavior, deployment history, and incident history are stored in separate systems. A monitoring platform might show that checkout latency increased, GitHub might show a recent deployment, and a trace might reveal a slow database call. None of these facts alone explains the complete failure.

**Faultline's response:** create one connected operational knowledge graph representing services, resources, dependencies, deployments, evidence, incidents, historical causes, and resolutions. Use graph traversal to discover relationships that isolated keyword or vector searches can miss.

## 1.2 Symptoms are mistaken for root causes

The first alert is not necessarily the root cause. An overloaded API may be a downstream symptom of a failing database, queue, cache, or upstream service.

**Faultline's response:** separate observed symptoms from root-cause hypotheses, reconstruct possible causal paths, examine supporting and contradictory evidence, and rank explanations according to evidence quality and learned graph relationships.

## 1.3 Engineers repeatedly investigate the same failure patterns

Teams solve similar problems multiple times. Evidence, investigation paths, and corrective actions from previous incidents are buried in postmortems, issue trackers, or an engineer's memory. A new responder may repeat work that another engineer has already completed.

**Faultline's response:** connect new incidents to previous incidents, confirmed causes, resolutions, and reusable failure patterns. Retrieve relevant historical knowledge and learn from confirmed investigation outcomes.

## 1.4 Static retrieval does not improve with experience

A conventional search index or vector retrieval system may return semantically similar material, but similarity does not necessarily represent an operational dependency or a causal relationship. Similar descriptions can refer to unrelated failure mechanisms.

**Faultline's response:** make the graph itself adaptive. Learn which relationships, evidence sources, and multi-hop investigation paths have helped identify verified root causes. Strengthen useful relationships, reduce the influence of misleading ones, and discover missing relationships.

## 1.5 AI-generated explanations are difficult to trust

An AI assistant can produce a convincing explanation without proving that it is correct. Engineers need to know which logs, traces, metrics, deployments, and graph relationships support each conclusion.

**Faultline's response:** make investigations evidence-first. Every hypothesis must link to supporting evidence, contradictory evidence, relevant graph paths, timestamps, and source records. When evidence is insufficient, Faultline must say so rather than invent certainty.

## 1.6 Infrastructure changes make old knowledge unreliable

Services are renamed, dependencies change, deployments replace components, and infrastructure is reorganized. A relationship that was correct last month may be wrong today.

**Faultline's response:** preserve temporal relationships; track when facts were valid and when they were recorded; detect conflicting information; and maintain a history of graph changes. Never treat an outdated dependency as a current one.

## 1.7 Operational blind spots remain undiscovered

An investigation may fail because the graph does not know about a dependency, lacks a trace, has no deployment event, or cannot identify the team responsible for a service.

**Faultline's response:** detect evidence gaps, explain which missing information prevents the investigator from distinguishing between hypotheses, and request or retrieve the most useful additional evidence from available integrations.

## 1.8 Operational knowledge is lost when people leave

Engineering teams depend on undocumented experience. When experienced responders leave, their knowledge of unusual dependencies, failure patterns, and recovery procedures can disappear.

**Faultline's response:** preserve verified operational knowledge as graph relationships, historical incidents, reusable investigation paths, and resolutions. This knowledge belongs to the project, not to an individual engineer.

## 1.9 Teams lack proof that their incident intelligence is improving

A system may claim to learn from feedback without demonstrating that it becomes more accurate. A graph visualization or a rising count of stored relationships is not proof of improvement.

**Faultline's response:** provide a repeatable incident evaluation laboratory. Compare a vector-only baseline, a fixed HydraDB graph, and an adaptive HydraDB graph under equivalent conditions. Evaluate all of them on incidents withheld from the learning process.

**The product must demonstrate measurable improvement in root-cause ranking and evidence retrieval, not merely show that the graph has grown.**

---

# 2. Product definition and north star

Faultline is a self-improving incident intelligence platform that uses HydraDB as its operational knowledge graph to investigate production failures, reconstruct evidence-backed causal paths, and improve future investigations through verified feedback.

Its three core systems are:

1. **Incident intelligence:** detect, correlate, investigate, and explain production incidents.
2. **Adaptive causal graph:** learn useful relationships, evidence paths, temporal facts, and failure patterns.
3. **Evaluation laboratory:** prove that graph learning improves investigation performance against fixed-graph and vector-only baselines.

The AI investigator is not the differentiator. It is the interface between engineering teams and graph intelligence.

**North-star product promise:** Every incident your team resolves should make the next investigation smarter.

## 2.1 Product principles

- Evidence before explanation. An LLM may summarize and reason over retrieved evidence, but it cannot fabricate the underlying facts.
- Graph before chat. The graph is the system of record for operational relationships and learning state.
- Human feedback must change the system. Feedback is not a reaction icon or an unpersisted conversation; it creates traceable graph updates.
- Learning must be measurable. No invented accuracy improvements, fake charts, or synthetic benchmark claims presented as real results.
- Unknown is an acceptable result. The investigator can abstain, show uncertainty, or ask for missing evidence.
- Temporal truth matters. A dependency that existed during an old incident may not exist now.
- Safe by default. Integrations are read-only unless a user explicitly enables an approved write action.
- Explain every important graph change. Engineers must be able to inspect why an edge changed, who or what caused it, and how to reverse it.
- One graph, not a collection of decorative graphs. Infrastructure, evidence, incident history, and learning records must be connected in HydraDB.

## 2.2 Primary user roles

| Role | Main job in Faultline | Primary value |
|---|---|---|
| SRE / on-call engineer | Respond to alerts, investigate causes, verify evidence, resolve incidents | Lower investigation time and fewer repeated investigations |
| Platform / DevOps engineer | Understand service dependencies, deployments, Kubernetes and infrastructure changes | Better impact analysis and topology intelligence |
| Backend engineer | Trace application behavior, inspect commits, APIs, logs, traces, and failure patterns | Faster debugging with relevant code and runtime context |
| Engineering manager / CTO | Understand recurring failures, reliability trends, ownership, and engineering risk | Operational visibility and prevention priorities |
| Incident commander | Coordinate responders, decisions, timelines, and communication | Shared source of truth during an incident |

## 2.3 Core user journeys

**Journey A — An alert arrives:** alert is received, correlated with related signals, linked to affected services, and converted into an investigation. Faultline traverses HydraDB, collects evidence, ranks hypotheses, and presents a readable incident workspace.

**Journey B — An engineer corrects the investigator:** engineer rejects an incorrect hypothesis or confirms the actual cause. Faultline records the outcome, updates applicable graph relationship statistics and path quality, and shows the exact learning update.

**Journey C — A later incident occurs:** a similar but not identical incident is investigated. The graph returns more relevant evidence and ranks the previously verified failure path more appropriately. The improvement is measured on a held-out incident.

**Journey D — The graph is missing information:** Faultline explains the missing evidence, queries a permitted integration, adds the newly discovered relationship or evidence reference, and resumes the investigation.

**Journey E — The team audits learning:** an engineer opens Learning Engine, inspects graph updates, verifies their provenance, compares evaluation rounds, and rolls back a harmful update if necessary.

---

# 3. Product scope and standout differentiators

Faultline should feel like an operational intelligence workspace, not a generic chatbot. The following are the key differentiators that must be implemented as real product behavior.

## 3.1 Adaptive causal relationship learning

The system learns how useful a relationship is for incident diagnosis. Examples include:

- A deployment repeatedly precedes a particular class of failure in a service.
- A service's dependency on a database is repeatedly confirmed by traces and incident investigations.
- A specific metric anomaly is a strong indicator of a queue-consumer failure.
- A historical resolution consistently solves a recurring failure pattern.

Relationship statistics should distinguish evidence of support from evidence of contradiction. Inconclusive feedback must not be treated as negative feedback.

## 3.2 Investigation path learning

Faultline learns which multi-hop paths are valuable, not just which individual edges are useful. For example:

`Incident → Affected Service → Dependency → Database → Metric Anomaly → Confirmed Cause`

It should also recognize sequences such as:

`Deployment → Commit → Configuration Change → Service Error Spike → Incident`

A successful path is recorded as an investigation pattern. Future investigations can retrieve or prioritize relevant paths when the same context appears.

## 3.3 Graph-gap discovery and active evidence acquisition

When two hypotheses remain difficult to distinguish, Faultline should identify the evidence that would resolve the uncertainty. It should select the next best query from available integrations, fetch only the relevant evidence window, preserve its source, and connect it to the graph.

## 3.4 Temporal graph intelligence

Relationships must represent changing reality. Faultline should know that a service depended on Redis at one time, migrated to another cache later, and had a different dependency during a previous incident.

## 3.5 Graph repair and entity resolution

Faultline should identify likely duplicate identities such as `checkout-api-prod`, `checkout-service`, and a repository's canonical service name. It should propose safe entity merges and detect when a previous merge was incorrect and must be split.

## 3.6 Reproducible graph-learning replay

For every investigation, show:

1. What the graph knew before the investigation.
2. Which graph paths were explored.
3. Which evidence was retrieved.
4. Which hypotheses were generated and why.
5. Which paths or evidence were useful or misleading.
6. What an engineer confirmed, rejected, or marked inconclusive.
7. Which graph relationships, path statistics, or entities changed.
8. Whether subsequent evaluation improved or regressed.

This feature is essential to making the hackathon differentiator visible and verifiable.

## 3.7 Evaluation against real baselines

Provide three genuinely different investigation engines using the same dataset and evaluation conditions:

- **Vector-only:** semantic retrieval of evidence chunks; no graph traversal.
- **Fixed HydraDB graph:** graph traversal with static relationship weights and no feedback-driven learning.
- **Adaptive HydraDB graph:** graph traversal plus learned relationship scores, path quality, temporal context, and verified feedback.

All three must use the same LLM, prompt, evidence corpus, held-out test cases, and comparable retrieval/query budgets wherever possible. The evaluation harness must preserve actual results, including failures.

---

# 4. HydraDB-first technical architecture

## 4.1 Non-negotiable database decision

**The self-hosted HydraDB graph engine is the authoritative store for Faultline's operational knowledge graph.** Do not build the product around a vector database, Neo4j, Memgraph, or a mock graph adapter and then add HydraDB as a superficial integration.

Use the self-hosted `graph-node` service and its supported Bolt or HTTP query interface. The official `neo4j-driver` JavaScript package may be used as a Bolt client because HydraDB exposes Neo4j-compatible Bolt connectivity. Using that driver does not mean using Neo4j as the database.

The hosted HydraDB v2 context API is a distinct product surface from the self-hosted graph engine. Do not silently substitute it for the self-hosted graph engine required by this project. The project should be able to start its own HydraDB instance and query it directly.

Official technical references:

- HydraDB repository: https://github.com/hydra-db/hydradb
- Integration guide: https://github.com/hydra-db/hydradb/blob/main/USING-HYDRADB.md
- Cypher compatibility: https://github.com/hydra-db/hydradb/blob/main/cypher-compat.md
- Architecture: https://github.com/hydra-db/hydradb/blob/main/architecture.md

## 4.2 HydraDB capabilities Faultline should actively use

Use the graph engine's actual strengths rather than treating it as generic persistence:

- Typed, directed relationships between nodes.
- OpenCypher query support for graph reads and mutations.
- Bounded variable-length relationship traversal.
- Native `algo.SPpaths`, `algo.SSpaths`, and `algo.MSpaths` path procedures where their input and selection semantics fit the use case.
- The native degree procedure for topology / degree analytics where it provides a useful server-side aggregate.
- Relationship weights / costs in native path procedure configurations where supported and verified.
- Property indexes and reverse adjacency for efficient lookups and incoming relationship traversal.
- Sparse traversal and GraphBLAS-backed topology execution.
- Snapshot-consistent reads.
- Durable object-store-backed graph storage through SlateDB and S3-compatible storage.
- Independent query and indexing processes.
- Bolt 5.x connectivity and HTTP JSON / NDJSON query API.
- Built-in query telemetry and OTLP export in the current repository release, which Faultline can use to monitor its own graph-query behavior.
- The current repository release also describes an ISO GQL query surface alongside OpenCypher, an optional DataFusion execution path, and an MCP server. Keep OpenCypher as the initial application query language unless a capability test proves a GQL feature materially simplifies a query.
- The engine's MCP support can be explored as an optional agent integration surface, but the product's primary UI and domain services should call a typed internal graph adapter rather than depend on an external MCP process.

Use native path procedures to generate graph path candidates. Do not assume they provide a full arbitrary ranking model. Combine their results with application-side scoring of source reliability, evidence freshness, temporal validity, and learned path utility when needed.

## 4.3 HydraDB integration constraints the coder must obey

The current `USING-HYDRADB.md` and `cypher-compat.md` describe important behavior differences from Neo4j. These are implementation requirements, not optional optimization notes.

1. **Node IDs are supplied by the caller.** `id` is an upsert identity key, not a normal property. Use deterministic positive integer IDs and store the natural external ID separately as a property such as `external_id`.
2. **Nodes with the same ID are the same node.** Generate stable IDs from tenant / project scope, entity type, and external identifier. Use a deterministic 64-bit hash or a centrally assigned ID, and check for collisions against `external_id` before accepting the record.
3. **Do not use plain one-off `CREATE` for retryable edge writes.** A single-statement `CREATE` can create duplicate parallel relationships when repeated. Use idempotent `MERGE` or the documented batch `UNWIND ... CREATE` form.
4. **Relationship identity is not a general UUID property identity.** Batch edge deduplication is based on source, destination, and relationship type. If multiple independent observations need to be represented, create separate Evidence / Observation nodes and connect them with separate relationships.
5. **A single-node `CREATE` or `MERGE` is not supported in the ordinary write shape.** Node-only batch creation uses the documented `UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Label, ...` form. For bulk loading, write labels and node properties first, then write edges in a separate batch.
6. **HydraDB accepts a deliberate OpenCypher subset, not the entire Neo4j language.** Do not assume APOC, arbitrary expressions, arbitrary `WITH`, `RETURN *`, undirected relationship patterns, unbounded variable paths, or other unsupported constructs.
7. **Every `MATCH` should be anchored** with an ID, label, or property predicate. Every variable-length path must have an explicit upper bound.
8. **A relationship pattern carries one type and one direction.** Use separate patterns or native path procedures when a traversal must consider multiple relationship types.
9. **`RETURN` projections are restricted.** Name projected properties explicitly. Do not return an entire node or path through ordinary `RETURN`; use supported path procedures and decode their path result where necessary.
10. **`WITH` is pass-through only.** Do not rely on it for aliases, filtering, sorting, or reshaping bindings.
11. **No multi-statement transaction across requests.** Each request is auto-commit. Design every mutation to be idempotent and recoverable.
12. **Batch requests have limits.** Keep batches at or below the documented 1024-item cap; chunk operational writes to around 500–1000 items.
13. **Use bookmarks for read-your-writes across nodes.** Preserve the returned bookmark and pass the singular `bookmark` field to the next read that must observe that write. Use strong consistency only when its extra object-store read is genuinely required.
14. **Decode typed HTTP results carefully.** Node IDs arrive as `vertex_id`; null values may not include a `value` key; path values have their own encoding. Prefer Bolt for the first implementation if its driver decoding is simpler, while retaining an internal adapter boundary.
15. **Bound every traversal and result.** Use small hop limits, result limits, timeouts, and cancellation for investigative queries.
16. **The native path procedures have specific semantics.** Validate source and target IDs or string-key selectors, `maxLen` (counts edges), path limits, weights, direction, and result decoding. `MSpaths` uses string property values and may omit unreachable pairs. Never assume result order corresponds to input pair order.

The engineering team must create a HydraDB compatibility test suite before implementing the whole graph model. It should validate all write and read forms actually used by Faultline.

## 4.4 Suggested deployment topology

```text
Browser (Next.js)
       |
       v
Faultline API / BFF (Node.js + TypeScript)
       |
       +---- Auth / Workspace / Project Control Plane (PostgreSQL)
       |
       +---- Investigation Orchestrator (bounded state machine)
       |          |
       |          +---- Graph Adapter ----------------> Self-hosted HydraDB graph-node
       |          |                                      |
       |          |                                      +--> S3-compatible storage / MinIO
       |          |
       |          +---- Evidence Adapters
       |          |       +--> Prometheus / Alertmanager
       |          |       +--> OpenTelemetry / Tempo / Jaeger
       |          |       +--> Loki / Elasticsearch / OpenSearch
       |          |       +--> GitHub / CI-CD
       |          |       +--> Kubernetes
       |          |
       |          +---- Evidence Object Store ----------> S3 / MinIO / local dev storage
       |          |
       |          +---- LLM Provider Adapter -----------> Ollama or configured API provider
       |
       +---- Learning Engine
       |          +---- Graph mutation planner ----------> HydraDB
       |          +---- Learning ledger ----------------> HydraDB
       |          +---- Evaluation runner
       |
       +---- Background jobs / event queue ------------> Redis + BullMQ (optional)
       |
       +---- OTLP application telemetry ----------------> Prometheus / Grafana stack
```

### Data ownership boundaries

- **HydraDB:** all graph entities, typed relationships, temporal dependency facts, incident relationships, evidence references, investigation outcomes, failure patterns, learned path statistics, and graph-learning ledger records.
- **PostgreSQL:** user accounts, workspace membership, RBAC, project configuration, encrypted connector credential references, job scheduling metadata, notification preferences, and UI preferences. It must not become a second source of truth for graph relationships.
- **Object storage:** raw or larger evidence snapshots, trace / log excerpts, imported artifacts, and exported reports. Store object URIs and content hashes in HydraDB. Do not dump every raw log line into the graph.
- **Redis / queue:** transient jobs, event processing, locks and rate limits. Redis is not the durable graph or learning record.
- **Vector retrieval:** only a controlled evaluation baseline, not the primary production incident retrieval path. An optional `pgvector` index can live in the control-plane Postgres instance for benchmark comparison; it must be isolated and must not silently feed the adaptive graph's production answer.

## 4.5 Recommended stack

| Area | Recommended choice | Reason |
|---|---|---|
| Web app | Next.js App Router + TypeScript | Strong product UI and server-side data boundaries |
| UI | Tailwind CSS + shadcn/ui + Radix primitives | Consistent, accessible, customizable components |
| Icons | Lucide | Consistent engineering-product iconography |
| Graph database | Self-hosted HydraDB | Required system of record for graph learning |
| HydraDB connection | `neo4j-driver` over Bolt, or native HTTP adapter | Official compatible client transport |
| Backend | Node.js + TypeScript | Shared types and straightforward integrations |
| Visual graph | Sigma.js + Graphology for large topology views; React Flow for focused causal-path diagrams | Efficient graph exploration plus expressive node/edge detail |
| Graph layout | ELK.js or Dagre | Stable layered layouts for dependency and causal-path views |
| Charts | Recharts or Apache ECharts | Time series, distributions, evaluation charts |
| Telemetry | OpenTelemetry SDK / Collector | Open instrumentation standard |
| Metrics | Prometheus | Free metrics backend and PromQL |
| Traces | Jaeger or Grafana Tempo | Open-source trace storage and query |
| Logs | Grafana Loki | Open-source log aggregation |
| Dashboards | Grafana | Operational telemetry and self-observability |
| Local object storage | MinIO or HydraDB's local development storage mode | Repeatable local / self-hosted setup |
| Control plane DB | PostgreSQL | Accounts, project metadata and integration state only |
| Background jobs | BullMQ + Redis, or a simple queue abstraction | Retries and scheduled connector sync |
| LLM orchestration | Typed custom state machine; LangGraph.js is optional | Easier to constrain, audit and evaluate than an unbounded agent swarm |
| Local model option | Ollama + a compatible model | Enables local development without a paid model API |
| Tests | Vitest, Playwright, testcontainers / Docker Compose | Fast slice-level checks and realistic integration tests |
| Hosting | Docker Compose for demo; container host / Kubernetes for durable self-hosting | Reproducible deployment |

Prefer free and open-source tools. Do not add expensive services just for a polished demo. Keep all paid model use optional behind an adapter.

---

# 5. Operational knowledge graph specification

This is one connected graph inside HydraDB, not four separate graph databases. Conceptually it contains four domains.

## 5.1 Graph domains

### A. Infrastructure graph

Represents what exists and how it connects: organizations, projects, environments, services, endpoints, clusters, namespaces, workloads, databases, caches, queues, teams, repositories, deployments, commits, and configuration objects.

### B. Evidence graph

Represents what happened: alerts, incidents, events, metric anomalies, important log patterns, traces / spans, observations, evidence records, and investigation windows. Raw evidence remains in its originating system or object store; HydraDB records identity, timestamps, source metadata, relationships, and references.

### C. Historical knowledge graph

Represents what the team has learned: previous incidents, verified root causes, resolutions, runbooks, failure patterns, contributing factors, and recurrence relationships.

### D. Adaptive learning graph

Represents how Faultline improves: investigation records, feedback, path templates, edge reliability statistics, learned relationships, entity-resolution candidates, learning updates, and evaluation rounds.

## 5.2 Node types

The following labels are the recommended domain model. The first release may add more labels, but should not invent a second competing schema.

| Label | Meaning | Important properties |
|---|---|---|
| `Organization` | Tenant / company | `id`, `external_id`, `name`, `created_at` |
| `Project` | Product or system being monitored | `id`, `external_id`, `name`, `slug` |
| `Environment` | Production, staging, region, etc. | `id`, `name`, `region`, `environment_type` |
| `Team` | Responsible engineering group | `id`, `external_id`, `name`, `slack_ref` |
| `Service` | Deployable logical service | `id`, `external_id`, `name`, `language`, `criticality`, `repo_url`, `created_at` |
| `Endpoint` | API or RPC endpoint | `id`, `external_id`, `method`, `route`, `protocol` |
| `Resource` | Generic infrastructure resource | `id`, `external_id`, `resource_type`, `name`, `region` |
| `Cluster` | Compute cluster | `id`, `external_id`, `name`, `provider` |
| `Namespace` | Kubernetes namespace or equivalent | `id`, `external_id`, `name` |
| `Workload` | Deployment, StatefulSet, Job, Pod group | `id`, `external_id`, `kind`, `name`, `replicas` |
| `Database` | Database service / instance | `id`, `external_id`, `engine`, `name`, `tier` |
| `Cache` | Cache instance | `id`, `external_id`, `engine`, `name` |
| `Queue` | Message queue / topic | `id`, `external_id`, `engine`, `name` |
| `Repository` | Source repository | `id`, `external_id`, `url`, `default_branch` |
| `Deployment` | A release / deployment event | `id`, `external_id`, `version`, `environment`, `started_at`, `completed_at`, `status` |
| `Commit` | Source commit | `id`, `external_id`, `sha`, `author`, `committed_at`, `message` |
| `PullRequest` | Code review / merged change | `id`, `external_id`, `number`, `title`, `merged_at` |
| `ConfigChange` | Infrastructure / application config change | `id`, `external_id`, `key`, `change_type`, `changed_at`, `redacted_diff_ref` |
| `Alert` | Alert source event | `id`, `external_id`, `fingerprint`, `name`, `severity`, `started_at`, `ended_at` |
| `Incident` | Correlated incident | `id`, `external_id`, `title`, `severity`, `status`, `started_at`, `resolved_at` |
| `Event` | Operational event | `id`, `external_id`, `event_type`, `occurred_at`, `source` |
| `MetricSeries` | Metric identity / series reference | `id`, `external_id`, `metric_name`, `labels_hash`, `unit` |
| `LogPattern` | Clustered recurring log signature | `id`, `external_id`, `signature`, `severity`, `first_seen_at`, `last_seen_at` |
| `Trace` | Selected trace reference | `id`, `external_id`, `trace_id`, `started_at`, `duration_ms`, `status` |
| `Span` | Important span reference | `id`, `external_id`, `span_id`, `operation`, `duration_ms`, `status` |
| `Evidence` | Source-backed evidence item | `id`, `external_id`, `evidence_type`, `source`, `observed_at`, `object_uri`, `content_hash`, `summary`, `reliability` |
| `Observation` | Normalized factual observation | `id`, `external_id`, `observation_type`, `value`, `unit`, `observed_at`, `source_ref` |
| `Hypothesis` | A proposed explanation | `id`, `external_id`, `statement`, `status`, `rank`, `confidence`, `created_at` |
| `Investigation` | One investigation run | `id`, `external_id`, `started_at`, `completed_at`, `status`, `engine_version`, `prompt_version` |
| `Finding` | A verified or provisional discovery | `id`, `external_id`, `finding_type`, `statement`, `verification_status` |
| `Resolution` | A resolution or recovery action | `id`, `external_id`, `summary`, `verified_at`, `verification_method` |
| `Runbook` | Operational procedure | `id`, `external_id`, `title`, `uri`, `last_updated_at` |
| `FailurePattern` | Reusable failure class | `id`, `external_id`, `name`, `description`, `pattern_version` |
| `Feedback` | Human or verified outcome feedback | `id`, `external_id`, `outcome`, `actor_ref`, `created_at`, `reason` |
| `LearningUpdate` | Auditable graph mutation record | `id`, `external_id`, `update_type`, `before_state`, `after_state`, `reason`, `created_at`, `status` |
| `PathTemplate` | Reusable investigation path pattern | `id`, `external_id`, `signature`, `path_score`, `success_count`, `failure_count` |
| `EntityMatchCandidate` | Possible duplicate entity | `id`, `left_external_id`, `right_external_id`, `match_score`, `review_status` |
| `ConnectorSource` | Connected source identity | `id`, `external_id`, `provider`, `resource`, `last_synced_at` |
| `EvaluationRun` | Benchmark / evaluation run | `id`, `external_id`, `round`, `engine`, `dataset_version`, `started_at`, `completed_at` |

Use fewer labels when a dedicated label does not add query or product value. Do not create a node for every raw log line or every normal metric sample. Use aggregated evidence objects, anomaly windows, selected traces, and clustered log patterns.

## 5.3 Relationship types

Use directed, explicitly typed relationships. Keep relationship type names consistent and documented.

| Relationship | Direction / purpose |
|---|---|
| `CONTAINS` | Organization / project / environment containment |
| `BELONGS_TO` | Service or resource belongs to a project / environment |
| `DEPENDS_ON` | Service or component depends on another component |
| `CALLS` | Service or endpoint calls another service / endpoint |
| `RUNS_ON` | Service or workload runs on infrastructure |
| `DEPLOYED_TO` | Deployment targets an environment / workload |
| `DEPLOYS` | Deployment deploys a service / artifact |
| `INTRODUCED_BY` | Code or configuration change introduced a behavior / regression candidate |
| `CHANGED_BY` | Deployment or config change was performed by a commit / PR |
| `OWNED_BY` | Service / resource is owned by a team |
| `GENERATED` | Component generated an event, trace, log pattern, metric anomaly, or evidence |
| `OBSERVED_DURING` | Evidence occurred during an incident / investigation window |
| `AFFECTS` | Incident affects a service / resource |
| `TRIGGERED` | Alert / event triggered an incident or action |
| `CORRELATED_WITH` | Evidence items are correlated, without asserting causality |
| `SUPPORTS` | Evidence supports a hypothesis / finding |
| `CONTRADICTS` | Evidence contradicts a hypothesis / finding |
| `CAUSED_BY` | A verified causal relation; never use for an unconfirmed hypothesis |
| `POSSIBLY_CAUSED_BY` | A provisional causal candidate |
| `RESOLVED_BY` | Incident / pattern was resolved by a resolution |
| `MATCHES_PATTERN` | Incident / evidence matches a failure pattern |
| `SIMILAR_TO` | Incident similarity relationship with method / score provenance |
| `INVESTIGATED_IN` | Entity / incident participates in an investigation |
| `FOLLOWED_PATH` | Investigation followed a path template / path signature |
| `LEARNED_FROM` | Learning update / path template derived from feedback or investigation |
| `DERIVED_FROM` | Evidence / finding derived from a source record |
| `SUPERSEDES` | New temporal fact supersedes an older one |
| `HAS_EVIDENCE` | Investigation / hypothesis / finding links to Evidence |
| `MATCH_CANDIDATE` | Entity-resolution candidates before merge approval |

Do not label correlations as causes. A deployment immediately preceding an incident is a candidate relationship until supporting evidence or an engineer verifies it.

## 5.4 Relationship properties

Recommended shared properties where applicable:

```text
id                 stable edge-observation identifier where a separate edge record is required
weight             traversal cost / path cost; smaller is better if the procedure interprets it as a cost
confidence_score   estimated reliability of the relationship, 0..1
support_count      weighted positive confirmations
contradiction_count weighted negative confirmations
source             origin system or integration
source_record_id   original source's identity
source_reliability prior reliability of source type
observed_at        event time
recorded_at        time Faultline learned the fact
valid_from         time the fact became true
valid_to           time the fact stopped being true; use a documented sentinel or separate status rather than relying on unsupported null filters
last_verified_at   latest verification time
last_seen_at       latest observation time
verification_state provisional | verified | rejected | stale
tenant_key         logical isolation scope
project_key        project / system scope
environment_key    production / staging / region scope
```

Do not store sensitive tokens, raw credentials, unrestricted payloads, or unredacted secrets as node or relationship properties.

## 5.5 Identity and scope

Every graph entity must have:

- A stable integer HydraDB `id`.
- A natural `external_id` from the connected system.
- A tenant / project / environment scope.
- A stable `entity_type` or label.
- Source provenance and timestamps where applicable.

Never use a raw service name as the only identity. `checkout-api` in staging and `checkout-api` in production must be distinguishable. The graph adapter must enforce scope in all generated queries.

## 5.6 Evidence storage model

Evidence records should carry enough metadata to be useful and auditable without placing full payloads in the graph.

```json
{
  "evidence_id": "ev_...",
  "evidence_type": "metric_anomaly",
  "source": "prometheus",
  "source_record_id": "query-or-alert-reference",
  "observed_at": "ISO-8601 timestamp",
  "window_start": "ISO-8601 timestamp",
  "window_end": "ISO-8601 timestamp",
  "service_external_id": "service/checkout-api/production",
  "summary": "Database connection wait time increased sharply",
  "object_uri": "s3://faultline-evidence/...",
  "content_hash": "sha256:...",
  "redaction_status": "clean",
  "reliability": 0.9
}
```

Large log excerpts, trace payloads, screenshots, report artifacts, and source diffs belong in object storage or the source platform. HydraDB stores metadata, identifiers, relations, provenance, timestamps, and object references.

---

# 6. Feature specification

## 6.1 Workspace, project, and environment management

- Create organizations / workspaces and projects.
- Organize one project into multiple environments: production, staging, development, regional deployments, or customer-specific environments.
- Separate graph data by tenant and project scope. Use dedicated graph IDs / cells or namespaces according to the chosen HydraDB deployment configuration; do not invent cell IDs at runtime.
- Invite users and manage roles.
- Set default investigation time windows, timezone, service criticality and ownership.
- Support a built-in demo workspace that can be reset safely.
- Display current data freshness and integration health.

## 6.2 Onboarding and demo mode

The first-run experience must let a user see value before connecting real infrastructure.

**Onboarding steps:**
1. Welcome screen explaining the graph-learning concept in one clear sentence.
2. Create workspace and project.
3. Select `Explore demo environment` or `Connect my infrastructure`.
4. In demo mode, provision a seeded microservice system and sample telemetry / incident history.
5. Show an interactive system topology and a preloaded incident.
6. Run a guided investigation, ask the user to confirm / reject one hypothesis, then show the graph learning update.
7. Offer connectors as the next setup step.

Do not force a user to provide an LLM API key to explore the demo. Provide a deterministic demo investigator or configured local model route. Mark all demo information clearly as simulated.

## 6.3 Incident ingestion and detection

- Receive alerts from Alertmanager / Prometheus, Grafana webhooks, PagerDuty, Opsgenie, and generic webhooks.
- Normalize incoming alerts into a common incident event schema.
- Deduplicate repeated alert deliveries by stable fingerprint and event identity.
- Group correlated alerts into one incident using project, environment, service, alert family, time window, and graph neighborhood.
- Correlate related metrics, trace anomalies, log patterns, deployments, infrastructure events, and config changes.
- Support manual incident creation.
- Support incident severity, status, owner, service, start time, detection time, acknowledgement time, and resolution time.
- Reopen an incident and trigger incremental re-investigation when important new evidence arrives.
- Maintain a timeline of every lifecycle event.

Incident statuses: `New`, `Investigating`, `Identified`, `Mitigating`, `Monitoring`, `Resolved`, `Closed`, `Reopened`.

Severity levels: `Critical`, `High`, `Medium`, `Low`, `Informational`.

Do not conflate alert count with incident count.

## 6.4 Unified evidence ingestion

### Metrics

- Query Prometheus using PromQL for relevant service, resource, saturation, latency, throughput, and error metrics.
- Detect anomalies over a bounded incident window and compare with a baseline window.
- Store the metric identity, labels hash, anomaly interval, values / summary, query reference, and source metadata.
- Show the original time-series chart inside the evidence panel.

### Logs

- Support Loki first; add Elasticsearch / OpenSearch adapter later.
- Query logs by service, trace ID, severity, event time, and incident window.
- Group repetitive log messages into patterns / signatures before graph ingestion.
- Preserve clickable links to the original log query.
- Redact secrets, tokens, passwords, and personal data before persistence or LLM context construction.

### Traces

- Accept OTLP through OpenTelemetry Collector or query Tempo / Jaeger.
- Reconstruct trace-to-service and span-to-service relationships.
- Prioritize error spans, long-duration spans, dependency failures, and traces correlated with incident timing.
- Preserve trace ID and span ID so an engineer can open the original trace.
- Do not put every normal span into HydraDB. Retain selected incident-relevant spans and aggregated trace findings.

### GitHub and CI/CD

- Connect GitHub repositories and webhooks.
- Ingest commits, merged pull requests, release tags, workflow deployments, deployment status, changed files, and authorship metadata.
- Link deployment → commit / PR → service / repository.
- Compare the incident window with recent deployments and changes.
- Show code diffs only after sensitive data redaction.
- Add GitLab and other CI/CD integrations through the adapter interface later.

### Kubernetes and infrastructure

- Discover clusters, namespaces, workloads, pods, services, ingress, network policy, config maps, secrets metadata (never secret values), and resource ownership.
- Ingest Kubernetes events, restarts, OOM kills, scaling events, failed probes, scheduling issues, image pull failures, and rollout status.
- Map workloads to services using labels, annotations, deployment metadata, and explicit mappings.
- Support cloud provider resource adapters later.

### Other sources

- Runbooks and Markdown documents.
- Incident management tools and postmortems.
- Slack incident channels as an optional source.
- Generic signed webhooks.
- Manually uploaded JSON / CSV / Markdown evidence.

## 6.5 Service and dependency intelligence

- Auto-discover services from OpenTelemetry resource attributes, Kubernetes labels, Prometheus targets, and GitHub project configuration.
- Allow manual service creation and mapping for ambiguous identities.
- Build directed service dependency edges from spans, network flows, config, and user-provided topology.
- Keep inferred and verified dependencies distinguishable.
- Show edge provenance: where the relationship came from, when it was observed, and how often it was verified.
- Calculate direct and transitive dependency impact.
- Show upstream dependencies, downstream dependents, critical paths, owner team, environment, and recent deployments.
- Detect newly observed dependencies and dependencies no longer observed.
- Detect cycles and suspicious topology changes.
- Keep historical topology snapshots or temporal relationships so the graph can be viewed as of a chosen date.

## 6.6 Autonomous incident investigation

This is the primary user-facing intelligence workflow.

### Investigation execution stages

1. **Scope the incident:** identify affected services, severity, environment, incident start, and relevant time window.
2. **Gather initial graph context:** traverse from the alert / incident to service, dependencies, owners, deployments, infrastructure, previous incidents, and relevant evidence.
3. **Discover candidate anomalies:** query telemetry adapters for metric anomalies, error logs, failed traces, Kubernetes events, and recent code / configuration changes.
4. **Build hypotheses:** generate a small ranked set of possible causes; do not create dozens of vague candidates.
5. **Test hypotheses:** collect evidence supporting and contradicting each candidate. Run bounded follow-up queries to distinguish between competing explanations.
6. **Reconstruct causal paths:** identify the chain of graph relationships connecting the initiating event or change to the user-visible symptom.
7. **Retrieve historical patterns:** find prior incidents with matching topology, evidence pattern, temporal relationship, or verified cause.
8. **Assess blast radius:** inspect downstream and upstream services affected by the candidate cause.
9. **Identify uncertainty:** explicitly state missing evidence and the most useful next query.
10. **Produce an investigation result:** root-cause candidates, evidence, contradictions, timeline, impact, confidence, and recommended actions.
11. **Persist investigation state:** save the investigation, path signature, evidence references, hypotheses, and outcome status to HydraDB.

### Hypothesis object

Each hypothesis should include:

- Title / statement.
- Rank.
- Confidence score with a clear explanation of what it represents.
- Status: `Candidate`, `Likely`, `Confirmed`, `Rejected`, `Inconclusive`.
- Supporting evidence count and links.
- Contradictory evidence count and links.
- Graph path / causal chain.
- Related services and infrastructure.
- Time alignment with the incident.
- Source quality / freshness summary.
- Missing evidence and next best check.
- Historical matching incidents / patterns.
- Model and prompt version that generated it.

**Confidence must not be presented as a calibrated probability unless it has been calibrated on held-out data.** Until then, label it `confidence score` or `relative confidence` and provide a calibration status.

### Investigation output format

```json
{
  "incident_id": "inc_...",
  "investigation_id": "inv_...",
  "status": "completed_with_uncertainty",
  "summary": "Checkout errors were most likely caused by database connection pool exhaustion.",
  "root_cause_candidates": [
    {
      "hypothesis_id": "hyp_...",
      "rank": 1,
      "statement": "Database connection pool exhaustion in checkout persistence path",
      "confidence_score": 0.82,
      "confidence_type": "uncalibrated_relative_score",
      "supporting_evidence_ids": ["ev_metric_1", "ev_trace_2"],
      "contradicting_evidence_ids": [],
      "causal_path_ids": ["path_1"],
      "next_check": "Inspect pool wait time and active connection count"
    }
  ],
  "observed_facts": [],
  "unknowns": [],
  "timeline": [],
  "affected_services": [],
  "recommended_actions": [],
  "provenance": {
    "graph_snapshot_bookmark": "...",
    "engine_version": "...",
    "prompt_version": "..."
  }
}
```

## 6.7 Adaptive graph learning engine

This is the core hackathon feature. It must be a real, persistent system, not a UI animation.

### Learning mechanism A — Verified relationship reinforcement

Maintain support and contradiction statistics for relationships that are relevant to diagnosis. Use conservative updates and preserve provenance.

A practical initial model is a Beta-style evidence estimate:

```text
alpha_e = alpha_prior + weighted_support_e
beta_e  = beta_prior  + weighted_contradiction_e
reliability_e = alpha_e / (alpha_e + beta_e)
```

The priors prevent one early observation from dominating. Feedback is weighted by evidence quality and verification strength. A confirmed causal relationship should contribute more than a weak correlation. An inconclusive response changes neither side.

Use a separate traversal cost such as:

```text
path_cost_e = -log(max(reliability_e, epsilon))
```

This is only an initial scoring model. Verify how HydraDB's `weightProp` / `costProp` is interpreted before using it inside a native path procedure. Otherwise, use native procedures for candidate paths and calculate the full ranking in the Faultline application layer.

### Learning mechanism B — Multi-hop path quality

A path is not useful merely because each edge exists. Learn which sequences tend to lead to verified causes in a relevant incident context.

For each path template track:

- Path signature (relationship sequence and entity classes).
- Incident / failure category.
- Environment or context constraints.
- Number of times explored.
- Number of times it led to a confirmed cause.
- Number of times it was misleading or contradicted.
- Average evidence quality.
- Typical hop count and query cost.
- Last successful and failed use.

Do not globally reward a path just because it was followed during a successful investigation. Reward only the path segments that were actually verified as relevant.

### Learning mechanism C — Negative learning

- When an engineer rejects a hypothesis, record the reason and linked evidence.
- When a path leads to a false hypothesis, lower the utility of the relevant unsupported path segments in similar contexts.
- Do not punish an entire dependency edge when the edge itself is correct but the causal interpretation was wrong.
- Distinguish `not causal`, `not relevant to this incident`, `stale relationship`, `incorrect entity`, and `insufficient evidence` outcomes.
- Retain rejected hypotheses for auditing and future retrieval; do not silently delete them.

### Learning mechanism D — Gap-driven graph expansion

When the investigation cannot distinguish between candidates:

1. Record the competing hypotheses.
2. List the missing observations that would separate them.
3. Check which connectors can provide those observations.
4. Choose the smallest useful query or resource discovery operation.
5. Fetch the evidence within a bounded time / result budget.
6. Normalize, redact, deduplicate, and persist the evidence.
7. Connect it to the relevant services, incident, and investigation.
8. Resume hypothesis evaluation.
9. Record whether the new evidence resolved the uncertainty.

This is active evidence acquisition, not unrestricted internet browsing or unbounded autonomous tool use.

### Learning mechanism E — Entity resolution

Detect likely duplicates based on stable IDs, repository identity, Kubernetes labels, environment, deployment metadata, resource ARN / UID, and known aliases.

- High-confidence exact identifier matches can be automatically linked.
- Probabilistic name / topology matches should become review candidates.
- Never merge two entities based only on similar names or embeddings.
- Before a merge, show both entities, the reason, shared identifiers, conflicting properties, and edges that would be affected.
- Every merge is reversible and represented in the learning ledger.

### Learning mechanism F — Entity splitting and graph repair

When Faultline discovers that one entity represents two real services, offer a split operation. Let the user assign evidence and relationships to the correct entity. Persist a complete before / after record and support undo / rollback.

### Learning mechanism G — Temporal relationship updates

Track both:

- **Valid time:** when the relationship was true in the real system.
- **Recorded time:** when Faultline learned or stored it.

When a dependency changes, add a new temporal fact and supersede / close the old fact without destroying its history. Investigations must use the topology relevant to the incident's time window.

### Learning mechanism H — Source reliability and evidence freshness

Maintain source reliability estimates separately from causal confidence. A monitoring source may be trusted to report CPU utilization but not to assert causation. Apply freshness decay for transient observations, not for permanent identity facts.

### Learning mechanism I — Generalization

Learn reusable failure patterns across different incidents and, where appropriate, services. Avoid memorizing incident IDs or literal service names. Use normalized topologies, signal signatures, event sequences, and failure categories.

### Learning mechanism J — Learning regression detection and rollback

- Evaluate changes against a validation set before they become broadly active.
- Keep a shadow candidate state or a reversible update ledger.
- If a learning change degrades held-out metrics beyond a configurable threshold, mark it as regressed.
- Offer rollback of the affected learning update or batch.
- Preserve the record of the failed change and the rollback reason.

### Feedback types

- `Confirmed root cause`
- `Rejected hypothesis`
- `Partially correct / contributing factor`
- `Evidence is relevant but not causal`
- `Incorrect service / entity mapping`
- `Relationship is stale`
- `Insufficient evidence`
- `Resolution verified`
- `Resolution failed / issue recurred`

A one-click thumbs-up / thumbs-down can be offered only as a secondary shortcut. The meaningful feedback path must let the engineer state what they are confirming or correcting.

## 6.8 Historical incident intelligence

- Find similar incidents using multiple signals: graph neighborhood, affected service set, topology, failure pattern, evidence signatures, timing, and optional semantic similarity.
- Show why two incidents are considered similar.
- Reuse verified root causes and resolutions as candidate knowledge, not unquestionable truth.
- Detect recurring incidents and repeated service-level failure patterns.
- Group repeated issues by underlying cause.
- Show how a failure pattern has evolved over time.
- Generate a postmortem draft with timeline, impact, root cause, contributing factors, detection gaps, resolution, and prevention actions.
- Maintain links from each postmortem statement to the evidence and incident data that support it.

## 6.9 Causal graph explorer

- Explore infrastructure, evidence, incidents, deployments, and learning relationships in one graph.
- Begin from a service, incident, deployment, hypothesis, or evidence item.
- Expand one hop or a bounded number of hops.
- Filter by relationship type, node type, environment, team, time window, and verification state.
- Show directionality and relationship metadata.
- Highlight a selected causal path.
- Compare current topology with topology at an earlier timestamp.
- Search for nodes by name, ID, tag, repository, or external ID.
- Detect orphan nodes, duplicate identities, stale dependencies, cycles, and unexplained high-degree nodes.
- Export a graph selection as PNG / SVG / JSON where useful.

## 6.10 Blast-radius analysis

- Start from an incident or suspected root-cause resource.
- Traverse downstream dependency edges within a bounded depth.
- Rank impacted services by criticality, dependency distance, ownership, traffic / trace evidence, and observed failures.
- Distinguish directly affected, transitively affected, and potentially affected services.
- Show the evidence used to infer impact.
- Display critical customer-facing paths and SLO risk where configured.
- Never label a service as impacted solely because it is graph-reachable; distinguish dependency exposure from observed impact.

## 6.11 Remediation and prevention

- Suggest immediate mitigation based on verified runbooks and previous resolutions.
- Recommend rollback, config correction, scaling, restart, traffic shift, queue draining, or dependency isolation only when relevant evidence supports it.
- Link recommendations to the exact evidence and failure pattern.
- Generate a GitHub issue or pull request as an optional controlled action.
- Require explicit user approval before any write action, deployment, restart, scaling operation, or code change.
- Support a read-only mode as the default.
- Provide pre-action preview, scope, risk level, expected effect, and rollback plan.
- Verify the result through telemetry before marking remediation successful.
- Record remediation outcome and recurrence information for future learning.

## 6.12 Collaboration and incident command

- Assign incident owner and responders.
- Add comments and decisions to the incident timeline.
- Record manual facts and links supplied by responders.
- Let an engineer attach a source item to a hypothesis or mark a graph relationship as stale.
- Maintain an activity feed for status changes, assignments, evidence additions, feedback, learning changes, and remediation actions.
- Generate a shareable investigation report.
- Add Slack integration later for status notifications and investigation summaries.

## 6.13 Learning engine analytics

Provide a dedicated learning workspace, not a decorative graph counter.

Show:

- Relationship updates over time.
- Strengthened and weakened edges.
- New relationships and discovered entities.
- Stale / superseded relationships.
- Entity merge / split operations.
- Successful and misleading path templates.
- Feedback distribution by type.
- Pending human verification.
- Learning updates by incident and service.
- Validation outcomes and rollback history.
- Which specific investigations contributed to which graph updates.

Every chart must derive from persisted records. A user must be able to click a metric and inspect the underlying events.

## 6.14 Integrations management

### First-class integrations for the full build

1. OpenTelemetry / OTLP.
2. Prometheus / Alertmanager.
3. Grafana Loki.
4. Jaeger or Grafana Tempo.
5. GitHub / GitHub Actions.
6. Kubernetes.
7. Generic inbound webhook.

### Additional integration roadmap

- Elasticsearch / OpenSearch.
- GitLab CI/CD.
- Argo CD / Jenkins.
- PagerDuty / Opsgenie.
- Slack.
- Datadog / New Relic.
- Cloud provider resources.
- Jira / Linear.

Each integration requires connection status, last successful sync, last error, permission scope, selected resources, sync interval, test-connection action, pause / resume, and credential rotation. Keep secrets encrypted and never show them again after saving.

---

# 7. Incident evaluation laboratory

This feature is mandatory. It is the proof that Faultline's graph improves over repeated runs.

## 7.1 Simulated microservice environment

Build a deterministic fault laboratory with a small e-commerce / checkout architecture:

- API Gateway
- Authentication Service
- Checkout Service
- Payment Service
- Inventory Service
- Notification Worker
- PostgreSQL
- Redis
- RabbitMQ

Use the OpenTelemetry Astronomy Shop demo as an optional richer integration fixture. The core demo must also be able to run with the lighter built-in simulator and should not require a paid observability platform.

## 7.2 Fault scenarios

At minimum, implement these 12 scenarios with ground-truth cause labels and deterministic event generation:

1. Checkout latency spike caused by database connection pool exhaustion.
2. Authentication failures caused by an expired signing key.
3. Payment timeouts caused by a payment-provider timeout.
4. Inventory inconsistency caused by a failed event consumer.
5. Queue backlog caused by a crashed worker.
6. Increased API errors caused by a faulty deployment.
7. Database overload caused by an inefficient query introduced by a commit.
8. Intermittent request failures caused by network instability between services.
9. Service unavailability caused by an invalid Kubernetes configuration or failed readiness probe.
10. Cascading failure caused by an upstream dependency outage.
11. Cache miss / latency amplification caused by an incorrect cache configuration.
12. Gradual memory growth culminating in an OOM kill.

Each scenario should define:

- Fault injection mechanism.
- Ground-truth root cause.
- Affected and downstream services.
- Generated alerts, logs, metrics, traces, deployment / config facts.
- Expected causal paths.
- Misleading but plausible signals.
- Evidence that distinguishes the correct cause from alternatives.
- Expected remediation and recovery signal.

## 7.3 Prevent memorization

- Create training incidents and held-out incidents.
- Change service names, timestamps, descriptions, topology and evidence order in test variants.
- Use a hidden seed for randomized scenario parameters.
- Keep ground truth unavailable to the investigator at runtime.
- Ensure held-out incidents are never used to update the adaptive graph before their evaluation.
- Keep dataset versions immutable and record their hashes.

## 7.4 Three engines

### Engine A: Vector-only baseline

- Embed evidence chunks with one fixed embedding model.
- Retrieve nearest evidence using `pgvector` in a separate benchmark path or another small open-source vector implementation.
- Do not use graph path traversal.
- Pass retrieved evidence to the same reasoning layer used by the other engines.

### Engine B: Fixed HydraDB graph

- Use the same HydraDB graph schema and evidence.
- Traverse using the same graph query budgets and fixed edge priors.
- Do not modify weights or path utility based on incident feedback.

### Engine C: Adaptive HydraDB graph

- Use HydraDB graph traversal plus relationship reliability, path utility, temporal validity, and verified learning updates.
- Update learning state only from the training feedback stream.
- Evaluate against held-out cases.

## 7.5 Metrics

| Metric | Meaning |
|---|---|
| Root-cause Top-1 accuracy | Correct root cause is ranked first |
| Root-cause Recall@3 | Correct cause appears within top three |
| Evidence precision | Retrieved evidence that is relevant / all retrieved evidence |
| Evidence recall | Relevant available evidence that was retrieved |
| Evidence F1 | Harmonic mean of precision and recall |
| False-positive rate | Incorrect root-cause assertions / all root-cause assertions |
| Abstention quality | Whether the system correctly says evidence is insufficient |
| Calibration error | Difference between stated confidence and observed correctness, when enough labeled cases exist |
| Mean investigation latency | Time from investigation start to result |
| Query / traversal budget | Graph calls, paths explored, nodes / edges visited where measurable |
| Gap resolution rate | Evidence gaps resolved through additional acquisition |
| Learning regression rate | Evaluation batches that degrade after a graph update |

Token count and model calls may be recorded as supporting cost measures, but they are not the main proof of graph intelligence.

## 7.6 Evaluation rounds

- `R0`: initial graph, before feedback.
- `R1`: after first verified feedback batch.
- `R2`: after second batch.
- `R3`: after third batch.
- `R4`: final learning round.

Run all three engines against the same held-out test suite after every round. Show real measurements only. Do not hardcode impressive percentage improvements. If adaptive performance does not improve, show the result honestly and use it to improve the learning mechanism.

## 7.7 Graph Learning Replay

Every evaluation and investigation should have a replay view showing:

- Graph snapshot before the run.
- Incident input and known evidence.
- Traversed graph paths.
- Hypothesis ranking before feedback.
- Engineer feedback and verification evidence.
- Graph mutations with before / after values.
- Graph snapshot after the update.
- Held-out result before and after the learning round.

---

# 8. Complete UI / UX specification

The UI is a major part of the product. The implementation must look and behave like a premium engineering operations product, not a generic admin template or a generated AI dashboard.

## 8.1 Visual direction

**Design identity:** dark, precise, technical, information-dense, calm under pressure, and visually polished.

The interface should combine:

- The clarity and keyboard-first interaction quality of Linear.
- The operational density and time-series charting of Grafana / observability products.
- The dependency graph and evidence-driven RCA presentation found in Coroot.
- The incident analysis, activity history, and investigation-thread structure seen in OpenObserve.
- The reproducible fault-lab and infrastructure graph concept demonstrated by Aurora.
- The temporal provenance and evolving-relationship concept from Graphiti.

These are interaction and information-architecture inspirations, not designs to copy. Faultline should have its own coherent visual identity.

### Design must avoid

- Generic AI landing-page styling.
- Huge gradients, rainbow borders, glowing blobs, or excessive glassmorphism.
- Oversized dashboard cards that waste space.
- A giant chat panel as the main interface.
- Default shadcn dashboard layouts without custom hierarchy.
- Every status represented by a different random color.
- Graph nodes that are all identical circles with unreadable labels.
- Fake loading animations that imply investigations are running when they are not.
- Dense text dumped into one panel with no hierarchy.
- Charts without units, time ranges, legends, or empty-state handling.

## 8.2 Design tokens

Use the following palette as the initial design system. Put all values into CSS variables / Tailwind theme tokens so they can be tuned centrally.

### Core palette

| Token | Color | Use |
|---|---|---|
| `canvas` | `#090D12` | Main application background |
| `sidebar` | `#0C121A` | Persistent navigation |
| `surface` | `#111923` | Primary cards and panels |
| `surface-raised` | `#162230` | Popovers, selected cards, inspectors |
| `surface-hover` | `#1B2938` | Hover state |
| `border` | `#253447` | Dividers and panel borders |
| `border-strong` | `#34465C` | Emphasis borders |
| `text-primary` | `#E8EEF5` | Main text |
| `text-secondary` | `#A2AFBD` | Secondary text |
| `text-muted` | `#718093` | Metadata and helper text |
| `accent-blue` | `#70A7FF` | Main interactive accent |
| `accent-cyan` | `#57C7D4` | Graph / topology highlight |
| `success` | `#43C58B` | Verified / healthy / recovered |
| `warning` | `#E7AD55` | Degraded / pending / caution |
| `danger` | `#F06F78` | Critical / error / rejected |
| `violet` | `#A78BFA` | AI / learning activity marker |

No gradient is necessary. Use accent colors sparingly. Severity colors must be consistent across the entire product.

### Typography

- UI font: Geist Sans or Inter.
- Monospace: Geist Mono or IBM Plex Mono for IDs, traces, query snippets, hashes, technical values, and code.
- Main page title: 22–26px, semibold.
- Section title: 15–17px, semibold.
- Body: 13–14px.
- Table / metadata: 12–13px.
- Eyebrow labels: 10–11px, uppercase, letter-spaced modestly.
- Do not use very small text for evidence or graph metadata; readability is more important than density.

### Spacing and shape

- Use a 4px base spacing system: common gaps 4, 8, 12, 16, 20, 24, 32.
- Standard panel radius: 10px.
- Card radius: 10–12px.
- Button height: 34–38px compact, 40px primary.
- Input height: 36–40px.
- Table row height: 42–48px depending on density.
- Borders should be subtle and consistent; use shadows only for overlays and raised elements.
- Use a 12-column content grid on desktop with 16–20px gutters.

## 8.3 Application shell

### Desktop layout

- Fixed left sidebar: 248px wide, collapsible to 68px icon rail.
- Top application bar: 56px high.
- Main content area: fills remaining width and uses a 24px page padding.
- Right inspector panels are contextual and can be resized / collapsed.
- Use sticky headers for long tables and investigation workspaces.

### Sidebar structure

Top section:
- Faultline mark + wordmark.
- Workspace switcher.
- Project / environment switcher.

Navigation groups:

**WORKSPACE**
- Overview
- Incidents
- Investigations
- Services
- Deployments

**INTELLIGENCE**
- Service Map
- Failure Patterns
- Learning Engine
- Evaluations

**OPERATIONS**
- Integrations
- Evidence Sources
- Activity
- Settings

Bottom section:
- Graph / ingestion health indicator.
- Help / documentation.
- User avatar and account menu.

Active navigation should use a dark raised background, a thin blue left indicator, clear icon and text contrast. Do not use colorful pills for every navigation item.

### Top bar

Left:
- Breadcrumbs for the current project and page.
- Environment selector with a visually distinct `Production` label where applicable.

Right:
- Global search / command palette (`⌘K` / `Ctrl+K`).
- Time-range selector.
- Notification icon.
- Data freshness / connection status.
- User menu.

The global search should search incidents, services, deployments, evidence, failure patterns, and graph entities. Provide keyboard navigation and grouped results.

## 8.4 Overview dashboard

The overview must answer three questions in under ten seconds:

1. Is the system healthy?
2. What is broken or changing right now?
3. Is Faultline's intelligence learning and improving?

### Layout

**Header row:** `Overview`, current project/environment, time range, `Create incident` action.

**KPI strip:**
- Open incidents.
- Critical / high incidents.
- Services degraded.
- Mean time to resolve (selected period).
- Investigations completed.
- Graph learning updates (selected period).

KPI cards should be compact and include a value, small trend / comparison, and clear unit. Clicking one opens the corresponding filtered view.

**Main 2-column region:**

Left (roughly 7 columns):
- Active incidents table with severity, title, affected service, owner, duration, status, and last update.
- Service health / dependency overview.

Right (roughly 5 columns):
- Recent deployments and changes.
- Recent learning activity.
- Integration health / data freshness.

**Bottom region:**
- Investigation performance chart (actual root-cause ranking over evaluation rounds).
- Recurring failure patterns.
- Recent graph changes / newly discovered dependencies.

Use meaningful empty states. For a new workspace, show a clear `Start demo investigation` prompt instead of a grid of zeros.

## 8.5 Incidents list

A serious incident-management table, not a collection of giant incident cards.

Columns:
- Severity marker.
- Incident title / ID.
- Affected service(s).
- Environment.
- Status.
- Owner / assignee.
- Started at / duration.
- Latest analysis status.
- Last activity.

Interactions:
- Search and filter by status, severity, service, team, environment, owner, and date.
- Sort by severity, newest, oldest, duration, and last activity.
- Multi-select for assigning or changing incident status.
- Save filter views.
- Quick open by keyboard.
- Show a compact live indicator only for genuinely updating incidents.

## 8.6 Incident detail and investigation workspace

This is the most important screen in Faultline. It should be carefully designed and should receive more implementation effort than the overview dashboard.

### Header

- Incident title and ID.
- Severity.
- Status dropdown.
- Affected service and environment.
- Start time and duration.
- Owner / responders.
- Actions: rerun investigation, assign, add evidence, export report, resolve.

### Three-panel desktop layout

**Left context panel — approximately 250–280px**

Sections:
- Incident summary.
- Affected services.
- Severity and status.
- Timeline window.
- Recent deployments.
- Related incidents.
- Owner / team.
- Quick links to original alert and source system.

**Center investigation canvas — flexible main area**

Top tabs:
- `Analysis`
- `Causal Path`
- `Timeline`
- `Graph Context`
- `Activity`

The default Analysis tab should show:

1. A concise incident summary, no more than a few lines before expandable detail.
2. A highlighted `Most likely cause` panel with hypothesis title, relative confidence, verification state, and evidence count.
3. Ranked alternative hypotheses below it.
4. A causal path diagram connecting the relevant services / deployment / infrastructure / evidence.
5. Supporting and contradictory evidence sections.
6. `What we know` and `What remains unknown` sections.
7. The next most useful check.
8. Recommended mitigation / prevention actions.

A hypothesis row should show rank, name, confidence score, verification label, supporting evidence count, contradicting evidence count, and a compact expand control. Clicking it updates the evidence inspector, not a new page.

**Right evidence inspector — approximately 330–380px**

When a hypothesis, graph edge, or evidence item is selected, show:
- Item type and source.
- Timestamp and time window.
- Short evidence summary.
- Source reliability and freshness.
- Relationship to selected hypothesis.
- Original source link / query.
- Graph lineage / provenance.
- Actions: mark relevant, mark contradictory, attach to hypothesis, flag stale, open original.

### Investigation streaming UX

When an investigation runs, the UI must stream real stage changes:
- Scoping incident.
- Traversing dependency graph.
- Querying telemetry.
- Correlating deployments.
- Building hypotheses.
- Testing hypotheses.
- Retrieving historical patterns.
- Producing report.

Each stage should have a real backend event, start time, status and optional details. Do not fake progress percentages. If a connector times out, show the specific unavailable source and continue with the evidence already retrieved.

### Feedback UX

At the bottom of each hypothesis / conclusion, provide clear actions:
- Confirm root cause.
- Reject hypothesis.
- Mark as contributing factor.
- Mark inconclusive.
- Correct service / relationship.

A feedback dialog should request a short reason and optional supporting evidence. It should show what graph changes will be proposed before committing high-impact changes. After submission, show a `Learning update created` event with a link to Learning Engine. Do not claim the graph improved until the mutation succeeds and the evaluation result supports that claim.

## 8.7 Causal path visualization

This view must make Faultline's graph-first nature immediately obvious.

- Use a clear left-to-right flow for a selected path.
- Start with the incident / symptom and finish with the proposed root cause.
- Use distinct node shapes for service, deployment, resource, database, metric, trace, evidence, and incident.
- Label edges with concise relationship names such as `DEPENDS_ON`, `DEPLOYED_TO`, `GENERATED`, `INTRODUCED_BY`.
- Use solid lines for verified relationships and dashed lines for inferred / provisional relationships.
- Use line thickness or a small badge to encode learned relationship strength, but do not use color alone.
- Selected path should be highlighted; unrelated graph context should be dimmed.
- Clicking a node or edge opens the evidence inspector.
- Include a compact legend and a `Why this path?` explanation.
- Provide fit-to-view, zoom, pan, reset, and export.

## 8.8 Infrastructure Service Map / Graph Explorer

The service map is an exploratory workspace, not a decorative diagram.

### Default view

- Canvas fills the available width and height.
- Left floating toolbar for search, layout, filtering, and graph scope.
- Main canvas contains service / database / queue / cache / deployment nodes.
- Right-side inspector opens when an entity or relationship is selected.
- Bottom mini timeline lets users inspect topology over time.
- Mini-map appears in large graphs.

### Node visual grammar

- Service: rounded rectangle with service icon, name, health state, and compact alert count.
- Database: cylinder-like node with engine and state.
- Queue: queue / message icon with backlog badge if known.
- Cache: stacked / cache icon.
- Kubernetes workload: layered box / cluster icon.
- Deployment: compact diamond / release marker.
- Team: avatar / group marker, usually shown in ownership overlays rather than main topology.
- Incident / evidence: small circular markers attached to affected entities or displayed in a separate context layer.

### Edge visual grammar

- Solid edge: verified dependency.
- Dashed edge: inferred relationship.
- Muted edge: stale / historically valid only.
- Warning edge: currently degraded or suspected.
- Edge direction must be visible with arrowheads.
- Hover displays relationship name, provenance, last observed time, and confidence.

### Graph controls

- Search node.
- Filter node types / edge types.
- Filter team / environment / service criticality.
- Select time range / historical snapshot.
- Expand one hop / two hops.
- Show only incident-relevant subgraph.
- Show only verified / inferred / stale edges.
- Highlight dependency path between two entities.
- Show blast radius from selected entity.
- Toggle traffic / topology overlay when telemetry provides it.

### Entity inspector

Tabs:
- Overview.
- Dependencies.
- Incidents.
- Deployments.
- Evidence.
- Relationship history.

For a selected edge, display the edge's source, reliability, learned score, valid time, support / contradiction count, and learning history.

## 8.9 Learning Engine workspace

This is the signature feature screen. It should make the changing graph understandable to an engineer.

### Top summary

- Learning updates in selected period.
- Confirmed / rejected feedback count.
- Relationship confidence changes.
- Path templates improved / degraded.
- Pending graph repair decisions.
- Latest evaluation status.

Do not use a single `Graph intelligence score` unless the formula is explicit and meaningful.

### Main layout

**Learning activity feed:** chronological ledger of graph changes, each with change type, related incident, entity / edge, reason, before → after, actor, timestamp, and validation result.

**Relationship learning table:**
- Source entity.
- Relationship type.
- Target entity.
- Confidence / reliability before and after.
- Support / contradiction counts.
- Last verified.
- Status.

**Path learning panel:** list of learned path templates with success / failure counts, context and average evidence quality.

**Graph repair queue:** duplicate entity candidates, suspicious relationships, expired facts, and requested merge / split decisions.

**Rollback history:** learning batches, evaluation result, rollback reason, and restore action.

### Learning update detail drawer

Every update must show:
- Update ID and type.
- Triggering investigation / feedback.
- Human or system actor.
- Exact affected entities and relationships.
- Previous state and new state.
- Update algorithm and parameters.
- Evidence used to justify the update.
- Whether update is pending, accepted, rejected, applied, rolled back, or regressed.
- Validation result before broad activation.

## 8.10 Evaluations workspace

This page proves the hackathon's central claim.

### Header

`Evaluations` + dataset version + date range + `Run evaluation` action.

### Main comparison chart

A grouped bar or line chart comparing:
- Vector-only baseline.
- Fixed HydraDB graph.
- Adaptive HydraDB graph.

Show separate panels for Top-1 root-cause accuracy, Recall@3, evidence F1, false-positive rate, and latency. Do not compress unrelated metrics into one chart.

### Learning rounds

Show `R0` through current round. Selecting a round opens:
- Training feedback batch summary.
- Held-out test set identity / hash.
- Baseline metric table.
- Per-engine result distribution.
- Correct / incorrect / abstained case list.
- Regression / improvement report.

### Evaluation detail

Each test case should show:
- Incident prompt and input evidence.
- Ground truth (only in evaluator / reviewer mode).
- Engine's top hypotheses.
- Retrieved evidence.
- Graph paths used.
- Queries and runtime.
- Why it scored correctly or incorrectly.

The evaluation UI must use actual persisted values. Never populate chart values from hardcoded example percentages in production mode.

## 8.11 Failure Patterns library

- List of reusable operational failure patterns.
- Pattern category, affected technology, frequency, last occurrence, and verification status.
- Typical signal signature.
- Common causal graph shape.
- Common contributing factors.
- Verified resolutions and runbooks.
- Similar incidents.
- Confidence / evidence maturity.
- Pattern history and changes.

Pattern detail should show occurrences chronologically and compare how the pattern appears across services / environments.

## 8.12 Services and deployments

### Service detail

Header: service name, health, criticality, owner, environment.

Tabs:
- Overview.
- Dependency map.
- Incidents.
- Metrics.
- Traces.
- Logs.
- Deployments.
- Graph history.

Show recent health trend, SLO / error budget if configured, upstream / downstream dependencies, recurring failure patterns, recent deployments, and last graph observation.

### Deployment detail

Show version, environment, status, commit / PR, author, affected services, deployment timeline, metric changes before / after, and any correlated incidents. Clearly distinguish correlation from verified causation.

## 8.13 Integrations screens

Use a card-based integration catalogue with recognizable source icons, one-line description, connection status, and a `Configure` button.

Configuration flow:
1. Choose source.
2. Explain required permissions and data collected.
3. Enter credential / endpoint securely.
4. Select resources.
5. Test connection.
6. Preview discovered entities and data volume.
7. Confirm ingestion.
8. Show live sync status and recent errors.

Every integration should have a detail page with sync history, selected resources, permissions, last success, rate limit / error status, pause / resume, and remove action.

## 8.14 Settings and governance

- Workspace profile.
- Projects and environments.
- Team ownership.
- Roles / permissions.
- Connector credential management.
- Data retention and evidence redaction.
- Incident severity mapping.
- Investigation budgets / timeouts.
- Learning thresholds and approval policies.
- Graph retention / archival configuration.
- LLM provider and model configuration.
- Audit log.
- API keys and webhooks.

## 8.15 UX states and interaction quality

Every screen must include:

- Loading skeletons that preserve layout.
- Helpful empty states with a relevant next action.
- Error states with retry / troubleshooting guidance.
- Partial-data states when one integration is unavailable.
- Stale-data indicator and last-success timestamp.
- Confirmation dialogs for destructive or high-impact actions.
- Toasts for successful and failed operations.
- Tooltips for unfamiliar technical labels.
- Keyboard focus states and full keyboard navigation.
- Responsive behavior for laptop and tablet.
- Accessible labels, readable contrast, and status information not conveyed by color alone.

### Keyboard shortcuts

- `Ctrl/Cmd + K`: command palette.
- `/`: focus current page search when not inside an input.
- `G` then `I`: incidents.
- `G` then `S`: services.
- `G` then `L`: learning engine.
- `G` then `E`: evaluations.
- `Esc`: close drawer / modal.

## 8.16 Responsive behavior

- Desktop is the primary operational environment.
- At medium widths, sidebar collapses and the evidence inspector becomes a drawer.
- On mobile, preserve incident status, hypothesis ranking, key evidence, feedback, and timeline. Make the graph canvas a focused, touch-friendly view rather than trying to display a complex full graph at once.
- Avoid horizontal scrolling for primary incident content.

## 8.17 Motion and feedback

Motion should be subtle and functional:
- Smooth drawer and tab transitions.
- Graph path highlight animation when a path is selected.
- Brief visual confirmation after a real learning update.
- Streaming investigation stage indicators driven by backend events.
- No continuous pulsing decoration or animated gradients.

---

# 9. AI investigator design and guardrails

## 9.1 Use a bounded investigation state machine

Do not build an unbounded agent swarm. Use a typed, inspectable workflow with clear inputs, outputs, budgets, and failure modes.

Suggested states:

`RECEIVED → SCOPED → GRAPH_CONTEXT → EVIDENCE_GATHERING → HYPOTHESIS_GENERATION → HYPOTHESIS_TESTING → PATH_RECONSTRUCTION → REPORTING → AWAITING_FEEDBACK → LEARNED`

A run may branch to `NEEDS_MORE_EVIDENCE`, `PARTIAL`, `INCONCLUSIVE`, `FAILED`, or `CANCELLED`.

## 9.2 Tool boundaries

Agent tools should be narrow and typed:

- `getIncidentContext(incidentId)`
- `getServiceDependencies(serviceId, depth, timeRange)`
- `findRecentDeployments(serviceId, timeRange)`
- `queryPrometheus(metricQuery, timeRange)`
- `queryLogs(serviceId, query, timeRange)`
- `getTrace(traceId)`
- `getKubernetesEvents(resourceId, timeRange)`
- `findRelatedIncidents(context)`
- `findFailurePatterns(context)`
- `getEvidenceGap(hypothesisSet)`
- `saveInvestigationResult(result)`

The model must not execute arbitrary Cypher against production HydraDB. The backend owns query templates, query parameters, scoping, bounds, authorization, and write validation.

## 9.3 LLM responsibilities

Use the model for:
- Summarizing retrieved evidence.
- Generating candidate hypotheses from structured observations.
- Suggesting discriminating follow-up questions.
- Explaining a graph path in plain language.
- Drafting postmortems and remediation plans.

Do not use the model as the authority for:
- Whether a relationship exists.
- Whether a source event occurred.
- Whether a cause is confirmed.
- Whether the graph should be mutated.
- Whether a remediation has succeeded.

## 9.4 Investigation budgets

Configurable per run:
- Maximum number of graph queries.
- Maximum traversal depth.
- Maximum paths returned.
- Maximum telemetry queries per adapter.
- Maximum evidence items / bytes.
- Maximum wall-clock duration.
- Maximum LLM calls / tokens.
- Maximum number of hypotheses.

Show when a budget was hit and which evidence could not be collected. Prefer a bounded partial result to an uncontrolled run.

---

# 10. API and backend module boundaries

Suggested internal modules:

```text
apps/
  web/                         Next.js UI
  api/                         Node API / BFF
packages/
  domain/                      Shared domain types and schemas
  hydradb-adapter/             Typed HydraDB query / mutation adapter
  graph-model/                 Node, edge and graph schema definitions
  graph-learning/              Feedback updates, path scoring, entity repair
  investigation-engine/        State machine and investigation contracts
  evidence-normalizer/         Common event / evidence model
  integrations/
    otel/
    prometheus/
    alertmanager/
    loki/
    tempo/
    github/
    kubernetes/
    webhook/
  evaluation/                  Datasets, runners, scorers, baselines
  security/                    Redaction, credential handling, RBAC
  ui/                          Shared components / tokens
infra/
  docker/
  hydradb/
  observability/
  seed/
```

Suggested backend endpoints:

```text
GET    /api/overview
GET    /api/incidents
POST   /api/incidents
GET    /api/incidents/:id
PATCH  /api/incidents/:id
POST   /api/incidents/:id/investigate
GET    /api/investigations/:id
GET    /api/investigations/:id/events        (SSE or WebSocket)
POST   /api/investigations/:id/feedback
GET    /api/graph/subgraph
GET    /api/graph/entities/:id
GET    /api/graph/entities/:id/history
GET    /api/graph/paths
GET    /api/services
GET    /api/services/:id
GET    /api/deployments
GET    /api/failure-patterns
GET    /api/learning/updates
GET    /api/learning/updates/:id
POST   /api/learning/updates/:id/rollback
GET    /api/learning/path-templates
GET    /api/evaluations
POST   /api/evaluations/run
GET    /api/evaluations/:id
GET    /api/integrations
POST   /api/integrations/:provider/connect
POST   /api/integrations/:id/test
POST   /api/integrations/:id/sync
POST   /api/webhooks/:provider
```

Validate all requests and response objects with Zod or an equivalent runtime schema library. Use typed event payloads between the investigation state machine and UI.

---

# 11. Security, governance, and reliability

- Read-only integration permissions by default.
- Encrypt connector credentials at rest using a managed key or envelope encryption; never expose the secret to the browser after save.
- Enforce tenant, project, and environment scope in every graph query and evidence fetch.
- Redact secrets and sensitive data before graph persistence, object storage, LLM prompts, logs, or exported reports.
- Apply RBAC to incident visibility, graph edits, connector changes, learning approval, and remediation.
- Record audit events for all user actions and all learning mutations.
- Do not let the LLM choose arbitrary tenant IDs or graph scopes.
- Protect webhook endpoints with signature validation, replay protection, rate limits, and idempotency keys.
- Use idempotent ingestion based on source record ID / fingerprint and an ingestion ledger.
- Retry transient failures with bounded exponential backoff; do not retry a non-idempotent graph write blindly.
- Provide query deadlines, cancellation, page-size limits, and traversal bounds.
- Expose app health, adapter health, queue depth, ingestion freshness, HydraDB connectivity, and failed jobs.
- Provide backup / restore documentation for HydraDB's configured object store and control-plane Postgres.
- Keep graph mutation history append-only where possible; destructive graph repairs require reversible records.

---

# 12. Product analytics and success criteria

## Product success measures

- Time from alert to first useful evidence.
- Time from incident start to confirmed root cause.
- Percentage of investigations with at least one evidence-backed hypothesis.
- Percentage of hypotheses with linked source records.
- Percentage of incidents matched to a useful historical pattern.
- Repeat-incident reduction for known failure patterns.
- Percentage of feedback resulting in a valid, audited learning update.
- Percentage of learning updates that pass validation.
- Reduction in investigation query budget for similar incidents without loss of accuracy.

## Hackathon proof requirements

A successful submission should show all of the following:

1. HydraDB is running as the actual self-hosted graph engine.
2. Infrastructure, evidence, and incidents are stored as nodes and relationships in HydraDB.
3. Investigations query real graph relationships and bounded multi-hop paths.
4. Human feedback causes persisted graph changes.
5. The learning ledger shows what changed and why.
6. A second, similar but non-identical incident uses the learned graph.
7. An evaluation run compares vector-only, fixed-graph, and adaptive-graph engines.
8. Held-out results are real, reproducible, and not leaked into learning.
9. The UI exposes graph topology, investigation evidence, and graph-learning replay.
10. The product can be run from documented setup steps without private credentials by using the simulator.

---

# 13. Build plan — vertical slices with acceptance gates

Build the product in end-to-end vertical slices. Do not spend a separate long phase writing tests after all features are supposedly finished. Each slice must have its own acceptance checks and a working user-visible result before moving on.

## Slice 1 — Running product foundation and HydraDB proof

Deliver:
- Next.js app shell and premium design tokens.
- Backend API skeleton.
- Self-hosted HydraDB running locally through Docker / documented setup.
- HydraDB adapter using Bolt or HTTP.
- Health / readiness diagnostics.
- Graph compatibility tests for IDs, MERGE, batch writes, reads, bookmarks, path procedures, and unsupported query cases.
- A seeded graph visible through a small internal graph inspector.

Acceptance:
- App starts from documented commands.
- HydraDB is a real process and can be queried.
- A service, database, deployment, incident, and evidence node can be read back from HydraDB.
- Retrying the same ingestion does not duplicate relationships.
- No Neo4j or other graph database is running behind the app.

## Slice 2 — Canonical graph and ingestion simulator

Deliver:
- Node / relationship schema.
- Stable IDs and scope enforcement.
- Demo microservice topology.
- Incident / event / metric / trace / deployment evidence seed data.
- Evidence object-reference mechanism.
- Data freshness and graph stats.

Acceptance:
- The seeded system has multiple services and multi-hop dependencies.
- A user can inspect a node, an edge, its properties, source, and temporal validity.
- Re-running seed / ingestion is safe and deterministic.

## Slice 3 — Incident lifecycle and investigation workspace

Deliver:
- Incident list and detail screens.
- Alert ingestion endpoint.
- Incident grouping / deduplication.
- Investigation state machine.
- Graph-context retrieval with bounded traversal.
- Evidence collection through simulator adapters.
- Ranked hypotheses and evidence inspector.

Acceptance:
- One seeded alert creates or updates an incident.
- Faultline retrieves multi-hop context from HydraDB.
- At least two hypotheses show supporting / contradictory evidence.
- UI streams real investigation events.
- Inconclusive outcomes are supported.

## Slice 4 — Engineer feedback and learning ledger

Deliver:
- Feedback UI.
- Persisted Feedback and LearningUpdate records.
- Relationship support / contradiction statistics.
- Before / after graph state display.
- Learning update detail drawer.

Acceptance:
- Confirming and rejecting hypotheses creates distinct graph updates.
- Inconclusive feedback does not reduce edge confidence.
- Retrying feedback submission does not apply the update twice.
- An engineer can inspect exactly which edges and path templates changed.

## Slice 5 — Adaptive path learning and graph repair

Deliver:
- Path template signatures and utility statistics.
- Learned path scoring.
- Temporal relationships.
- Entity-resolution candidate detection.
- Merge / split review and rollback support.
- Gap detection and one active evidence-acquisition path.

Acceptance:
- A confirmed path is ranked differently from an unverified / rejected path under the same context.
- A stale temporal dependency is not used as a current dependency.
- An ambiguous entity match is sent for review rather than automatically merged.
- A merge / split can be reversed.

## Slice 6 — Evaluation laboratory

Deliver:
- At least 12 deterministic fault scenarios.
- Training / held-out dataset split.
- Vector-only baseline.
- Fixed graph baseline.
- Adaptive graph engine.
- Metric scorers and evaluation UI.
- Graph Learning Replay.

Acceptance:
- All three engines receive equivalent test cases and budgets.
- Held-out data is not used for learning before evaluation.
- Results are reproducible from a dataset version and seed.
- Actual results are displayed; no hardcoded performance claims.

## Slice 7 — Real integrations and operational value

Deliver:
- OpenTelemetry / OTLP ingestion.
- Prometheus / Alertmanager.
- GitHub / GitHub Actions.
- Kubernetes topology / events.
- Loki and a trace backend adapter.
- Connector management UI.
- Read-only permissions and secret handling.

Acceptance:
- At least three real data sources can feed the same HydraDB graph.
- Original evidence links open the source system.
- Failed connectors show useful error and retry states.

## Slice 8 — Product polish, governance, and release

Deliver:
- Service / deployment / failure pattern pages.
- Blast-radius analysis.
- Postmortem export.
- Remediation suggestions with approval gates.
- RBAC / audit log.
- Responsive UI and accessibility pass.
- Docker Compose deployment, README, architecture, demo seed, and Loom script.

Acceptance:
- A fresh user can run the product from the README and complete the demo without private credentials.
- Core flows work end to end.
- Security-sensitive actions require explicit approval.
- Demo proves graph learning instead of merely showing an AI explanation.

---

# 14. Recommended repository structure

```text
faultline/
  apps/
    web/
    api/
    worker/
  packages/
    domain/
    hydradb-adapter/
    graph-model/
    graph-learning/
    investigation-engine/
    evidence-normalizer/
    integrations/
      otel/
      prometheus/
      alertmanager/
      loki/
      tempo/
      github/
      kubernetes/
      webhook/
    evaluation/
    security/
    ui/
  infra/
    docker/
    hydradb/
    minio/
    postgres/
    observability/
  datasets/
    training/
    validation/
    held-out/
  docs/
    architecture.md
    graph-schema.md
    hydradb-integration.md
    learning-engine.md
    evaluation-methodology.md
    security.md
    demo-script.md
  scripts/
    seed-demo.ts
    reset-demo.ts
    run-evaluation.ts
  docker-compose.yml
  README.md
```

Keep the graph schema, query templates, and learning algorithms in dedicated packages. Do not scatter Cypher strings across UI components or LLM prompts.

---

# 15. Demo narrative for judges

The demo should tell one connected story: **Faultline learns from an incident and demonstrably improves the next investigation.**

1. Open the seeded demo workspace. Show the services and dependencies in the graph.
2. Trigger a checkout incident caused by database connection pool exhaustion.
3. Open the investigation workspace. Show initial symptoms, graph paths, evidence, and ranked hypotheses.
4. Show that the investigator's first ranking is imperfect or uncertain. Do not fake a failure; use an intentionally ambiguous seeded case.
5. An engineer rejects a misleading hypothesis and confirms the database-related path using evidence.
6. Open the Learning Engine. Inspect the exact graph relationship and path updates, including before / after state and provenance.
7. Trigger a second similar but non-identical checkout incident with different service names / timestamps / evidence order.
8. Show the adaptive graph retrieving stronger evidence or ranking the verified cause more appropriately than the initial graph.
9. Open Evaluations. Compare vector-only, fixed graph, and adaptive graph on the held-out incidents over R0–R4.
10. Open Graph Learning Replay to inspect the complete chain from incident → feedback → graph mutation → held-out result.
11. Finish by showing that the product runs on a self-hosted HydraDB instance and that the graph can be inspected directly.

The demo must not depend on an external customer's credentials, a paid observability platform, or a private dataset.

---

# 16. Open-source project and tool inspirations

Use these projects as engineering references. Reuse their patterns and tools where appropriate, but do not copy their product UI or claim their features as Faultline's original innovation.

## 16.1 Aurora — autonomous incident response and reproducible fault testing

Repository: https://github.com/arvo-ai/aurora

Useful patterns:
- Automated multi-step incident investigations.
- Infrastructure knowledge graph and blast-radius view.
- Structured postmortems with timeline, impact, cause, and remediation.
- Reproducible fault lab with known injected failure scenarios and published outcomes.
- Comparing investigation agents against the same fault cases and publishing failures as well as successes.

**What Faultline should adopt:** a reproducible incident laboratory, transparent failure results, topology-aware investigation, and clear postmortem output. Faultline should go further by making verified feedback improve the graph and by evaluating the learned graph across rounds.

## 16.2 HolmesGPT — integration-rich, read-only SRE investigation

Repository: https://github.com/holmesgpt/holmesgpt

Useful patterns:
- Querying live observability and infrastructure systems through toolsets.
- Prometheus, Grafana, Kubernetes, GitHub, and other operational integrations.
- Bounded, memory-conscious tool execution.
- Read-only defaults and opt-in write actions.
- Agentic investigation rather than relying on one static search.

**What Faultline should adopt:** a provider-neutral integration architecture, read-only defaults, bounded evidence fetching, and traceable tool execution. Faultline's graph should remain the durable operational model between investigations.

## 16.3 Graphiti — temporal graph facts and provenance

Repository: https://github.com/getzep/graphiti

Useful patterns:
- Time-aware facts and changing relationships.
- Source / episode provenance.
- Contradiction and fact invalidation concepts.
- Hybrid retrieval and graph-neighborhood enrichment.
- Evolving rather than frozen knowledge structures.

**What Faultline should adopt:** valid-time and recorded-time distinction, full fact lineage, contradiction tracking, and explicit supersession. Implement these semantics on HydraDB rather than introducing Graphiti as a second graph database.

## 16.4 Coroot — dependency-aware RCA and evidence inspection

Repository: https://github.com/coroot/coroot  
Incident docs: https://docs.coroot.com/alerting/incidents  
AI overview: https://docs.coroot.com/ai/overview

Useful patterns:
- Service dependency graph as investigation context.
- Root-cause hypotheses linked to relevant charts and evidence.
- Incident timelines and trace inspection.
- Human-verifiable results rather than a black-box AI answer.

**What Faultline should adopt:** clickable dependency paths, evidence-backed hypotheses, relevant chart drill-downs, and a clear distinction between a suspected issue and verified root cause.

## 16.5 OpenObserve — incident analysis, report history, and collaboration

Repository: https://github.com/openobserve/openobserve  
Incident docs: https://openobserve.ai/docs/user-guide/analytics/incidents/

Useful patterns:
- Dedicated Incident Analysis view.
- Investigation thread and full report.
- Re-analysis and report history.
- Activity timeline and comments.
- Investigation that consumes alerts, topology, deployments, traces, logs, and metrics.

**What Faultline should adopt:** the incident-first workspace, appendable report history, collaboration timeline, and the ability to rerun analysis when meaningful new evidence arrives.

## 16.6 OpenTelemetry Demo — realistic service topology and telemetry

Repository: https://github.com/open-telemetry/opentelemetry-demo

Useful patterns:
- Multi-service application topology.
- Real traces, metrics, and logs.
- Repeatable demo environment for observability integration.

**What Faultline should adopt:** use it as an optional realistic fixture for demonstrating service discovery, telemetry ingestion, and cross-service evidence correlation.

## 16.7 IncidentFox — another open-source AI SRE reference

Repository: https://github.com/incidentfox/incidentfox

Useful patterns:
- AI-assisted alert triage and incident investigation.
- Evidence collection and root-cause suggestions.
- Operational integration patterns.

**What Faultline should adopt:** keep the investigator grounded in actual connected operational systems and make the integration layer modular.

## 16.8 Recommended open-source components

| Component | Role in Faultline | Notes |
|---|---|---|
| HydraDB | Primary graph engine | Required; no substitute graph database |
| OpenTelemetry Collector | Standard telemetry intake | Use OTLP and resource attributes to normalize identity |
| Prometheus | Metrics / alert queries | Use for real metric evidence and demo stack |
| Grafana Loki | Log aggregation | Query only incident-relevant log windows |
| Jaeger / Grafana Tempo | Trace storage and viewing | Store trace references and selected spans in graph |
| Grafana | Supporting observability dashboard | Not a replacement for Faultline's product UI |
| MinIO | S3-compatible local object storage | Use only if required by the selected HydraDB deployment mode |
| PostgreSQL + pgvector | Control plane and optional vector baseline | Vector index must be isolated to evaluation baseline |
| Redis + BullMQ | Background job queue | Optional for a single-process demo; useful for retries and scale |
| Sigma.js + Graphology | Large interactive graph canvas | Use for system topology exploration |
| React Flow | Focused causal-path / node inspector flows | Use for path diagrams and custom nodes |
| ELK.js / Dagre | Graph layout | Keep layouts deterministic and readable |
| Recharts / Apache ECharts | Metrics / evaluation charts | Choose one for consistency |
| shadcn/ui + Radix | UI primitives | Customize heavily; do not ship the default dashboard appearance |
| Ollama | Local model runner | Optional local mode; no paid API required for demo mode |

---

# 17. Explicit non-goals and implementation traps

Do not:

- Replace HydraDB with Neo4j, Memgraph, or another graph engine.
- Use the hosted HydraDB context product instead of the self-hosted graph engine for the core architecture.
- Store every raw log line or every normal metric sample as a graph node.
- Treat vector similarity as causal evidence.
- Treat temporal correlation as proof of causation.
- Automatically confirm an LLM hypothesis.
- Allow an LLM to mutate graph state directly.
- Auto-merge entities based only on similar names.
- Penalize every edge in a path because one hypothesis was rejected.
- Treat inconclusive feedback as negative evidence.
- Hardcode benchmark metrics or claim improvement without held-out evaluation.
- Build a generic chat-first dashboard and call it incident intelligence.
- Build every listed integration before the first complete incident-to-learning loop works.
- Create an endless test-only phase; acceptance tests belong within each vertical slice.
- Use unsupported Cypher clauses or assume every Neo4j query works in HydraDB.
- Ignore HydraDB's caller-supplied IDs, relationship idempotency, batch limits, auto-commit semantics, bookmark behavior, or bounded traversal requirements.

---

# 18. Release definition of done

Faultline is not complete merely because the UI looks polished or an LLM can explain a simulated incident. The product is complete when all of the following are demonstrably working:

- A self-hosted HydraDB graph engine runs as part of the deployment.
- The application writes and reads its operational graph through HydraDB.
- Infrastructure, incidents, evidence, historical knowledge, and learning state share one connected graph model.
- The app ingests realistic telemetry and deployment context through real or simulated adapters.
- An incident investigation executes bounded graph traversals and presents source-linked hypotheses.
- Engineers can confirm, reject, partially confirm, or mark results inconclusive.
- Feedback creates durable, auditable graph mutations.
- Path learning and relationship learning affect later retrieval / ranking.
- Temporal facts and graph repair are supported.
- Learning updates can be inspected and rolled back.
- Evaluation compares vector-only, fixed graph, and adaptive graph engines.
- Held-out evaluation proves whether the adaptive approach generalizes.
- The UI has an excellent incident workspace, service map, learning engine, and evaluation centre.
- The demo can be run without private integrations or paid services.
- Setup, architecture, graph model, evaluation method, and demo steps are documented.

**Final product standard:** Faultline must not simply use HydraDB to answer questions about incidents. It must demonstrate that HydraDB is the evolving operational memory that makes subsequent investigations better, and that the improvement is visible, inspectable, and measurable.

---

# 19. Research notes and important technical caveats

1. HydraDB's repository currently describes an object-store-native graph engine built on SlateDB, with GraphBLAS-backed traversal, Bolt and HTTP interfaces, and separate query / indexing processes. Pin the exact revision used for the build and validate it through integration tests.
2. The current repository exposes a deliberate OpenCypher subset. The `USING-HYDRADB.md` guide is unusually explicit about idempotency, identity, query decoding, pagination, bookmarks, path procedures, and transaction limitations. Treat that guide as a required engineering reference.
3. The current repository's README displays the Elastic License 2.0 badge. That license is source-available but is not an OSI-approved open-source license. The hackathon describes HydraDB as open-source; confirm with organizers that the current repository license satisfies the event requirement before relying on that interpretation. Do not mislabel the license in Faultline's README.
4. The hosted HydraDB v2 documentation describes a separate context / knowledge API surface, including connectors and context ingestion. The self-hosted graph engine in `hydra-db/hydradb` exposes its own Bolt / HTTP graph-query APIs. Do not confuse their endpoints or SDKs.
5. All benchmark results must be produced by actual runs. This specification defines the evaluation design, not achieved performance.

## Primary references

- HydraDB repository: https://github.com/hydra-db/hydradb
- HydraDB usage guide: https://github.com/hydra-db/hydradb/blob/main/USING-HYDRADB.md
- HydraDB Cypher compatibility: https://github.com/hydra-db/hydradb/blob/main/cypher-compat.md
- HydraDB architecture: https://github.com/hydra-db/hydradb/blob/main/architecture.md
- HydraDB changelog: https://github.com/hydra-db/hydradb/blob/main/CHANGELOG.md
- HydraDB hosted v2 API reference: https://docs.hydradb.com/api-reference/v2
- Aurora: https://github.com/arvo-ai/aurora
- HolmesGPT: https://github.com/holmesgpt/holmesgpt
- Graphiti: https://github.com/getzep/graphiti
- Coroot: https://github.com/coroot/coroot
- Coroot incident documentation: https://docs.coroot.com/alerting/incidents
- Coroot AI overview: https://docs.coroot.com/ai/overview
- OpenObserve: https://github.com/openobserve/openobserve
- OpenObserve incident documentation: https://openobserve.ai/docs/user-guide/analytics/incidents/
- OpenTelemetry Demo: https://github.com/open-telemetry/opentelemetry-demo
- IncidentFox: https://github.com/incidentfox/incidentfox
