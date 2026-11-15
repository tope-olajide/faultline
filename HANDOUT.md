# Faultline — hackathon handout

**One line:** Faultline investigates production incidents on a HydraDB operational
knowledge graph, shows the evidence behind every hypothesis, and learns from
engineer feedback so the next investigation ranks better.

## The problem

Incident diagnosis spans metrics, logs, traces, deployments, commits, Kubernetes
events and prior incidents. Engineers rebuild the causal chain by hand. Vector
search can find similar text, but not that *this* service depends on *that*
database, that the dependency was verified an hour ago, or that a previous
incident with the same topology had a confirmed cause.

## What is built

- **Investigation workspace** — ranked hypotheses, supporting and contradicting
  evidence, causal path, blast radius, timeline, unknowns and next checks.
- **Deterministic evidence-first engine** — bounded graph traversal; no model is
  allowed to invent a cause or an edge.
- **Adaptive learning** — confirm, reject, contributing, inconclusive, stale and
  incorrect-mapping outcomes update relationship reliability and path utility,
  with an auditable ledger and rollback.
- **Evaluation lab** — vector-only, fixed-graph and adaptive-graph engines
  measured on six held-out incidents across seven metrics.

## The HydraDB role

Self-hosted `hydradb` (`ghcr.io/hydra-db/hydradb`) is the system of record.
Infrastructure, evidence, incident history and learning records are one connected
graph. The investigator traverses `DEPENDS_ON` paths, correlates deployments via
`DEPLOYS`, and attaches only evidence linked by `OBSERVED_DURING` and
`DERIVED_FROM`. Feedback mutates edge support/contradiction state and writes
`LearningUpdate` and `PathTemplate` nodes.

There is no mock graph and no fallback store. If HydraDB is down the API returns
503 and the UI says so.

## Measured result (held-out, 6 incidents)

| Engine | Before learning | After learning |
|---|---|---|
| Vector-only (TF-IDF) | 33% Top-1 | 33% Top-1 |
| Fixed graph | 0% Top-1 | 0% Top-1 |
| **Adaptive graph** | 0% Top-1 | **100% Top-1** |

Evidence precision for the leading hypothesis: 0.00 → 1.00. Controls are
unchanged. The benchmark is small and synthetic; this demonstrates the learning
mechanism, not a production accuracy guarantee.

## Stack

Next.js 16 + React 19 + TypeScript, Tailwind v4, Zod. HydraDB over its HTTP query
API with a typed adapter. Local object store for evidence payloads with SHA-256
verification and secret redaction. Deterministic simulators implement the same
adapter contract a live Prometheus/Loki/Tempo/GitHub/Kubernetes client would.

## Run it

```bash
npm install && npm run setup && npm run db:up && npm run dev
```

Seed from the Overview screen, open **Incidents → Checkout latency and 5xx
spike**, confirm the leading hypothesis, reload, then open **Evaluation Lab** and
run the experiment.

## Honest gaps

No auth/RBAC, no live external connectors or inbound alert webhooks, no entity
resolution yet, and the vector baseline is lexical rather than embedding-based.
The full audit and roadmap are in `docs/COMPREHENSIVE_IMPLEMENTATION_AUDIT.md` and
`docs/PROJECT_COMPLETION_PLAN.md`.
