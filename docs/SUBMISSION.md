# Faultline — Hackathon Submission Pack

**Deadline:** 9:00 AM IST, 16 November 2026

This pack contains the go-to-market assets, the Loom script and the deployment
checklist. Nothing here claims a link, post or recording already exists — fill in
the placeholders after publishing.

---

## 1. Submission checklist

| Item | Status | Where |
|---|---|---|
| Self-hosted HydraDB | Done | `docker-compose.yml`, `src/server/hydradb/` |
| Open-source repository | Done | GitHub repo (fill URL) |
| Live hosted app | **To deploy** | See §5 |
| Loom walkthrough | **To record** | Script in §3 |
| X / Twitter post | **To publish** | Copy in §2 |
| LinkedIn post | **To publish** | Copy in §2 |
| Product README | Done | `README.md` |
| Audit and technical write-up | Done | `docs/` |

---

## 2. Social copy

### X / Twitter

> Most AI incident tools retrieve text that *looks* similar and hope.
>
> Faultline investigates a real causal graph in HydraDB: services → dependencies
> → deployments → evidence → prior incidents. Every cause cites its evidence.
>
> Then engineer feedback rewires the graph, and the next investigation is ranked
> by what the last one taught it.
>
> Held-out benchmark, same 6 incidents, same evidence:
> • vector-only: 33% Top-1
> • fixed graph: 0%
> • adaptive graph: 0% → 100%
>
> Open source, self-hosted HydraDB. Demo + code below. @hydradb
>
> [live link] · [repo]

### LinkedIn

> **We built an incident investigator that learns from the fix, not from a prompt.**
>
> On-call engineers still reconstruct failures by hand across metrics, logs,
> traces, deploys and memory. Retrieval tools find similar text; they do not know
> that checkout depends on this database, that the dependency was confirmed an
> hour ago, or that the same topology failed this way last month.
>
> Faultline models that as one operational knowledge graph in self-hosted HydraDB:
> infrastructure, evidence, incidents and learned path utility. An investigation
> walks the graph, ranks candidates, attaches only evidence linked to that
> incident, and states what it still does not know.
>
> The differentiator is continual learning. Confirming or rejecting a hypothesis
> mutates the relationship's reliability and the utility of the causal path that
> produced it. Every mutation is auditable and reversible. On six held-out
> incidents the adaptive graph goes from 0% to 100% Top-1, while the vector-only
> (33%) and fixed-graph (0%) controls stay flat.
>
> It is open source and runs on the self-hosted HydraDB engine. If you run
> production infrastructure, I would like your feedback on the investigation
> model. @hydradb
>
> [live link] · [repo]

### Short alt text for screenshots

> Faultline investigation workspace: ranked root-cause hypotheses, causal graph
> path, cited evidence, similar prior incidents and an engineer feedback panel.

---

## 3. Loom script (5 minutes)

Record at 1600×1000 or larger. Have the demo incident open before recording.

**0:00–0:20 — Hook.**
"This is Faultline. It investigates production incidents on a causal graph, cites
the evidence behind every hypothesis, and learns from the engineer's verdict.
The next investigation is ranked by what the last one taught it."

**0:20–0:50 — Problem.**
"During an incident you stitch together metrics, logs, traces, deploys and the
last incident that looked like this. Search finds similar text. It cannot tell you
that checkout depends on this database, or that this path was right last month."

**0:50–2:00 — Live investigation.**
Open **Incidents → Checkout latency and 5xx spike**. Point out:
- ranked hypotheses and the explicit score inputs;
- the causal path `checkout-service → postgres-main`;
- three supporting evidence items with source, reliability and timestamp;
- the next best check and the unknowns panel;
- similar prior incidents, matched on shared services and failure family.
Say: "No model invents evidence here. The investigator is deterministic, so the
three evaluation engines see identical conditions."

**2:00–2:45 — Teach the graph.**
Select **Confirm root cause**, add a short reason, submit. Open **Learning
Engine**. Show the ledger entry with before/after confidence, support count, the
path signature and the revert control. Say: "This is a persisted mutation in
HydraDB, not a UI counter. Reload the incident and the ranking uses it."

**2:45–3:45 — Evaluation.**
Open **Evaluation Lab → Run experiment**. Walk the comparison table:
vector-only 33%, fixed graph 0%, adaptive before 0%, adaptive after 100% Top-1;
evidence precision 0 → 1. Explain the controls and the held-out split. Say:
"These are persisted measurements from the app, on six incidents the model never
trained on. The benchmark is small and synthetic; the claim is the mechanism, not
production accuracy."

**3:45–4:30 — HydraDB and the graph.**
Open **Graph Explorer** and **Services**. Show real labels, relationships,
temporal `valid_from`/`valid_to`, and the fact that removing HydraDB removes
candidate discovery, evidence attribution, causal paths and the learning
substrate. Mention self-hosted engine, not the hosted platform.

**4:30–5:00 — Close.**
"Faultline is open source. The audit, protocol and limitations are in the repo.
The next step is live connectors and entity resolution. If you run on-call, I
would like to know which evidence source you would connect first."

---

## 4. Demo path (what judges should click)

1. **Overview** — read the measured delta and the open incident.
2. **Incidents → INC-104** — inspect hypotheses, evidence and similar incidents.
3. **Confirm root cause** — then **Learning Engine** — inspect the ledger entry.
4. **Evaluation Lab → Run experiment** — compare the three engines.
5. **Services → checkout-service** — dependency map and incident history.
6. **Failure Patterns** — families and learned path utility.
7. **Graph Explorer** — the raw entities and relationships behind all of it.
8. **HydraDB Diagnostics** — readiness and compatibility probes.

If the graph is empty, open **Overview → Re-seed demo graph**, then run the
experiment once so the ledger and evaluation are populated.

---

## 5. Deployment checklist

HydraDB must run as a self-hosted service next to the app. A serverless host that
cannot reach a private HydraDB instance will not work for the full demo.

1. Provision one small VM (2 vCPU / 4 GB) with Docker.
2. Run HydraDB from the repository's compose file; expose the HTTP query port to
   the app's private network only.
3. Set the bearer token and graph/cell ids:
   `HYDRADB_HTTP_URL`, `HYDRADB_ADMIN_URL`, `HYDRADB_TOKEN`,
   `HYDRADB_GRAPH_ID`, `HYDRADB_CELL_ID`.
4. Deploy the Next.js app (`npm run build && npm run start`) with
   `FAULTLINE_TENANT`, `FAULTLINE_PROJECT`, `FAULTLINE_ENVIRONMENT` and a
   persistent `FAULTLINE_EVIDENCE_DIR`. Set `FAULTLINE_ALERT_TOKEN` only if you
   want the inbound alert endpoint enabled.
5. Seed once: `POST /api/demo/seed {"reset":true}`.
6. Run the experiment once: `POST /api/evaluation/run {}`.
7. Optional: prove intake with
   `POST /api/alerts` using `Authorization: Bearer $FAULTLINE_ALERT_TOKEN`, a
   fingerprint, title, summary, severity and an existing `serviceExternalId`.
8. Put the app behind HTTPS and your own access layer. **Faultline has no
   user authentication or RBAC**, so do not expose the demo scope publicly
   without one. The alert endpoint has its own bearer token.
9. Verify: `/` 200, investigation opens, feedback applies, ledger shows one new
   entry, evaluation returns six held-out cases.

Record the public URL and repository URL in §1 before submitting.

---

## 6. Accurate claims

Use these, not stronger ones:

- "Self-hosted HydraDB graph engine" — true.
- "Deterministic, evidence-first investigation" — true; the optional Qwen adapter
  is not on the product path.
- "Persistent, auditable, reversible learning" — true.
- "100% Top-1 on six held-out benchmark incidents after one learning round" —
  true for this synthetic benchmark; always state the size and that the vector
  baseline is lexical TF-IDF, not embeddings.
- Do **not** claim production accuracy, live Prometheus/GitHub/Kubernetes
  ingestion, entity resolution, or authentication. Those are labelled as
  outstanding in the README and audit.
