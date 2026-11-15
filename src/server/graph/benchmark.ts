import { demoScope, type DemoScope } from '../config'
import { demoEntityId } from './ids'
import { upsertEdges, upsertNodes, type EdgeInput } from './repository'
import { ingestEvidence } from '../evidence/ingest'
import type { EvidenceDraft } from '../integrations/types'
import type { GraphLabel } from './schema'

/**
 * Held-out incident benchmark.
 *
 * Twelve small, fully-specified incidents across four failure families. Each case
 * carries a verified root cause and a reference set of evidence. Six cases are
 * `train` (the learning round may consult their labels) and six are `heldout`
 * (used only for measurement; never shown to the learning step).
 *
 * Ground truth is stored on the Incident node so the evaluator can score runs. It
 * is deliberately *not* read by the investigator: `investigateIncident()` only
 * queries the topology and evidence graph.
 *
 * The dataset is intentionally adversarial for static retrieval. In every case a
 * plausible distractor carries stronger per-item evidence reliability than the
 * true cause, so a fixed-weight graph ranks the distractor first. What separates
 * the families is the *path* that produced the evidence, which is exactly the
 * signal the learning engine records.
 */

export const DATASET_VERSION = 'faultline-benchmark/2026-11-15'
export type BenchmarkSplit = 'train' | 'heldout'

interface CauseRef {
  label: GraphLabel
  externalId: string
  name: string
}

interface CaseSpec {
  id: string
  title: string
  family: string
  split: BenchmarkSplit
  serviceExternalId: string
  cause: CauseRef
  distractors: CauseRef[]
  startedAt: string
  summary: string
  impact: string
  truth: { type: string; source: string; summary: string; reliability: number }
  /** Plausible alternative explanations, each with its own (stronger) evidence. */
  noise: Array<{ type: string; source: string; summary: string; reliability: number }>
  symptom: string
}

const CHECKOUT = 'service/checkout-service/production'
const INVENTORY = 'service/inventory-service/production'
const PAYMENT = 'service/payment-service/production'

const POSTGRES: CauseRef = {
  label: 'Database',
  externalId: 'database/postgres-main/production',
  name: 'postgres-main',
}
const REDIS: CauseRef = {
  label: 'Cache',
  externalId: 'cache/redis-sessions/production',
  name: 'redis-sessions',
}
const RABBIT: CauseRef = {
  label: 'Queue',
  externalId: 'queue/rabbitmq-events/production',
  name: 'rabbitmq-events',
}
const DEPLOY: CauseRef = {
  label: 'Deployment',
  externalId: 'deployment/checkout-service/2.14.3',
  name: 'checkout-service@2.14.3',
}
const INVENTORY_SVC: CauseRef = {
  label: 'Service',
  externalId: INVENTORY,
  name: 'inventory-service',
}
const PAYMENT_SVC: CauseRef = { label: 'Service', externalId: PAYMENT, name: 'payment-service' }

const CASES: CaseSpec[] = [
  {
    id: 'INC-201',
    title: 'Checkout p99 latency spike with 5xx burst',
    family: 'db_pool',
    split: 'train',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [REDIS, PAYMENT_SVC],
    startedAt: '2026-11-02T09:14:00Z',
    summary: 'Checkout p99 rose to 3.6s with a 6.1% 5xx rate for 18 minutes during the morning peak.',
    impact: 'Roughly 4,100 failed checkout attempts.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'Postgres connection wait p99 on checkout-service rose from 14ms to 1.7s while the pool held 20/20 connections.',
      reliability: 0.72,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis eviction rate on redis-sessions increased and CPU saturation reached 91% during the same window.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment provider error rate rose to 2.4% and payment retries doubled during the checkout slowdown.',
        reliability: 0.88,
      },
    ],
    symptom: 'Checkout latency alarms fired first, followed by gateway 5xx alarms four minutes later.',
  },
  {
    id: 'INC-202',
    title: 'Checkout request timeouts under peak load',
    family: 'db_pool',
    split: 'train',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [INVENTORY_SVC, PAYMENT_SVC],
    startedAt: '2026-11-03T17:41:00Z',
    summary: 'Checkout requests timed out at a 9.2% rate for 26 minutes as evening traffic ramped.',
    impact: 'Checkout conversion dropped 8.7% for the affected window.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'Database connection acquisition exceeded 1.4s at p99 on the checkout persistence path; waiting clients peaked at 38.',
      reliability: 0.73,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Inventory-service p99 latency rose to 640ms and its stock reservation queue accumulated 1,200 pending items.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment capture latency increased by 220ms and the provider reported intermittent 503 responses.',
        reliability: 0.87,
      },
    ],
    symptom: 'Gateway observed 504 responses on POST /checkout with a rising share of 2s+ requests.',
  },
  {
    id: 'INC-203',
    title: 'Checkout submit 5xx rate above SLO',
    family: 'db_pool',
    split: 'train',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [REDIS, INVENTORY_SVC],
    startedAt: '2026-11-04T12:05:00Z',
    summary: 'The checkout submit endpoint returned 5xx for 5.8% of calls over 14 minutes.',
    impact: 'Approximately 2,300 orders failed before retry succeeded.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'Checkout persistence exhibited pool exhaustion: 20/20 connections in use with 31 waiters and 1,900 failed acquisitions.',
      reliability: 0.71,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis session cache misses rose to 34% and evictions increased sharply on redis-sessions.',
        reliability: 0.89,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Inventory reservation retries tripled and inventory-service reported a 95th percentile of 720ms.',
        reliability: 0.86,
      },
    ],
    symptom: 'Synthetic checkout probes recorded consecutive failures against the submit endpoint.',
  },
  {
    id: 'INC-211',
    title: 'Checkout failures during sustained traffic',
    family: 'db_pool',
    split: 'heldout',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [PAYMENT_SVC, REDIS],
    startedAt: '2026-11-06T08:22:00Z',
    summary: 'Checkout failed 7.4% of requests for 21 minutes as traffic held above the seasonal baseline.',
    impact: 'Estimated 3,900 lost orders.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'The checkout connection pool sat at its 20-connection ceiling with 44 waiters; acquisition time reached 1.9s p99.',
      reliability: 0.74,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment authorization latency rose to 880ms p99 and the provider throttled 3.1% of capture calls.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis session writes slowed and eviction rate on redis-sessions doubled during the incident window.',
        reliability: 0.87,
      },
    ],
    symptom: 'Customer-facing checkout error rate exceeded the 2% SLO for twenty-one minutes.',
  },
  {
    id: 'INC-212',
    title: 'Elevated checkout latency after traffic ramp',
    family: 'db_pool',
    split: 'heldout',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [INVENTORY_SVC, PAYMENT_SVC],
    startedAt: '2026-11-07T18:02:00Z',
    summary: 'Checkout latency climbed to 2.9s p99 after a scheduled traffic ramp to 2.2x baseline.',
    impact: 'Latency SLO breached for 16 minutes.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'Postgres pool wait time on checkout-service increased fortyfold and connection acquisition failures reached 1,200.',
      reliability: 0.72,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Inventory-service response time degraded to 690ms p99 with a growing stock reservation backlog.',
        reliability: 0.89,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment capture retries increased 2.8x and provider latency reached 910ms p99.',
        reliability: 0.86,
      },
    ],
    symptom: 'Synthetic latency probes flagged checkout as the slowest customer-facing endpoint.',
  },
  {
    id: 'INC-213',
    title: 'Checkout error budget burn from 5xx responses',
    family: 'db_pool',
    split: 'heldout',
    serviceExternalId: CHECKOUT,
    cause: POSTGRES,
    distractors: [REDIS, PAYMENT_SVC],
    startedAt: '2026-11-08T11:36:00Z',
    summary: 'Checkout burned 61% of its monthly error budget in a single 19-minute burst.',
    impact: 'Error budget exhaustion projected for the month.',
    truth: {
      type: 'metric_anomaly',
      source: 'prometheus',
      summary:
        'Checkout persistence pool utilization pinned at 100% with sustained waiters and 2,050 failed connection acquisitions.',
      reliability: 0.73,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis session cache reported a 29% miss rate and elevated evictions on redis-sessions.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment provider 5xx responses increased to 3.7% with capture latency at 840ms p99.',
        reliability: 0.88,
      },
    ],
    symptom: 'Checkout 5xx responses tripped the burn-rate alert at 14x the sustainable threshold.',
  },
  {
    id: 'INC-241',
    title: 'Checkout cart reads stalling on session lookup',
    family: 'cache_stampede',
    split: 'train',
    serviceExternalId: CHECKOUT,
    cause: REDIS,
    distractors: [POSTGRES, DEPLOY],
    startedAt: '2026-11-05T10:18:00Z',
    summary: 'Cart reads stalled for 1.2s p99 while session cache lookups dominated the request path.',
    impact: 'Cart abandonment rose 5.4%.',
    truth: {
      type: 'trace_excerpt',
      source: 'tempo',
      summary:
        'Traces show cart reads blocking 980ms on redis-sessions GET calls after a cold-start cache flush; database time stayed under 20ms.',
      reliability: 0.73,
    },
    noise: [
      {
        type: 'trace_excerpt',
        source: 'tempo',
        summary:
          'A subset of checkout spans spent 610ms in Postgres queries on the order history path.',
        reliability: 0.91,
      },
      {
        type: 'deployment_correlation',
        source: 'github',
        summary:
          'checkout-service@2.14.3 deployed the previous day, changing cache client initialization order.',
        reliability: 0.88,
      },
    ],
    symptom: 'Cart endpoints showed the largest latency regression during the morning traffic window.',
  },
  {
    id: 'INC-251',
    title: 'Cart read latency climbing on checkout',
    family: 'cache_stampede',
    split: 'heldout',
    serviceExternalId: CHECKOUT,
    cause: REDIS,
    distractors: [POSTGRES, PAYMENT_SVC],
    startedAt: '2026-11-09T15:44:00Z',
    summary: 'Cart reads reached 1.4s p99 while the checkout submit path remained within SLO.',
    impact: 'Checkout funnel conversion dropped 4.1%.',
    truth: {
      type: 'trace_excerpt',
      source: 'tempo',
      summary:
        'Cart trace spans block on redis-sessions GET operations for up to 1.1s; storage spans in the same traces complete in 12-25ms.',
      reliability: 0.74,
    },
    noise: [
      {
        type: 'trace_excerpt',
        source: 'tempo',
        summary:
          'Checkout spans include Postgres order lookups taking 720ms at p99 during the window.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Payment capture latency increased to 760ms p99 with a 2.1% provider error rate.',
        reliability: 0.86,
      },
    ],
    symptom: 'Cart read latency alert fired while checkout submit latency stayed flat.',
  },
  {
    id: 'INC-221',
    title: 'Inventory reservation backlog and processing delay',
    family: 'queue_backlog',
    split: 'train',
    serviceExternalId: INVENTORY,
    cause: RABBIT,
    distractors: [POSTGRES],
    startedAt: '2026-11-04T06:31:00Z',
    summary: 'Inventory reservations were delayed by 11 minutes while the event bus backlog grew to 42,000 messages.',
    impact: 'Overselling risk on 3 SKUs during the flash sale.',
    truth: {
      type: 'log_pattern',
      source: 'loki',
      summary:
        'Consumer logs show repeated rabbitmq-events delivery timeouts and prefetch starvation; database query duration stayed under 30ms.',
      reliability: 0.73,
    },
    noise: [
      {
        type: 'log_pattern',
        source: 'loki',
        summary:
          'Inventory-service logged slow Postgres row locks on reservation updates during the backlog window.',
        reliability: 0.9,
      },
    ],
    symptom: 'Reservation lag alert fired when the consumer group offset fell 11 minutes behind.',
  },
  {
    id: 'INC-231',
    title: 'Inventory events delayed by consumer lag',
    family: 'queue_backlog',
    split: 'heldout',
    serviceExternalId: INVENTORY,
    cause: RABBIT,
    distractors: [POSTGRES],
    startedAt: '2026-11-10T09:12:00Z',
    summary: 'Inventory event processing lag reached 9 minutes and 31,000 unacknowledged messages.',
    impact: 'Stock availability shown to customers was stale for 14 minutes.',
    truth: {
      type: 'log_pattern',
      source: 'loki',
      summary:
        'Consumers report rabbitmq-events channel closures and redeliveries; successful database calls complete in under 25ms.',
      reliability: 0.74,
    },
    noise: [
      {
        type: 'log_pattern',
        source: 'loki',
        summary:
          'Postgres lock waits on the inventory reservation table reached 480ms during the same period.',
        reliability: 0.89,
      },
    ],
    symptom: 'Queue depth alert on rabbitmq-events fired before the inventory lag alert.',
  },
  {
    id: 'INC-261',
    title: 'Checkout errors immediately after release',
    family: 'bad_deploy',
    split: 'train',
    serviceExternalId: CHECKOUT,
    cause: DEPLOY,
    distractors: [POSTGRES, REDIS],
    startedAt: '2026-11-05T14:07:00Z',
    summary: 'Checkout 5xx errors began 6 minutes after checkout-service@2.14.3 reached full rollout.',
    impact: '4.2% of checkout attempts failed for 12 minutes.',
    truth: {
      type: 'deployment_correlation',
      source: 'github',
      summary:
        'checkout-service@2.14.3 completed rollout six minutes before onset and introduced the batched payment retry change seen in failing traces.',
      reliability: 0.74,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Postgres connection wait time increased to 340ms p99 during the same twelve-minute window.',
        reliability: 0.9,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis session evictions rose modestly on redis-sessions while checkout errors accumulated.',
        reliability: 0.87,
      },
    ],
    symptom: 'Error rate stepped up sharply at 14:13 UTC, minutes after the rollout completed.',
  },
  {
    id: 'INC-271',
    title: 'Checkout regression following production deploy',
    family: 'bad_deploy',
    split: 'heldout',
    serviceExternalId: CHECKOUT,
    cause: DEPLOY,
    distractors: [POSTGRES, REDIS],
    startedAt: '2026-11-10T16:28:00Z',
    summary: 'Checkout error rate doubled eight minutes after a production deployment finished.',
    impact: '2,700 failed checkout attempts before rollback.',
    truth: {
      type: 'deployment_correlation',
      source: 'github',
      summary:
        'The rollout of checkout-service@2.14.3 preceded the error step-change by eight minutes; failing spans begin in the changed retry path.',
      reliability: 0.73,
    },
    noise: [
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Postgres connection acquisition p99 reached 290ms while checkout errors were elevated.',
        reliability: 0.89,
      },
      {
        type: 'metric_anomaly',
        source: 'prometheus',
        summary:
          'Redis session eviction rate increased 1.7x on redis-sessions during the same window.',
        reliability: 0.86,
      },
    ],
    symptom: 'Deployment marker and the checkout error step-change align within the same eight-minute window.',
  },
]

export interface BenchmarkSummary {
  incidents: number
  train: number
  heldout: number
  evidence: number
  alerts: number
}

export function benchmarkCases(): readonly CaseSpec[] {
  return CASES
}

export function benchmarkEvidenceExternalIds(): string[] {
  return CASES.flatMap((testCase) => [
    evidenceId(testCase, 'truth'),
    ...testCase.noise.map((_, index) => evidenceId(testCase, `alt-${index}`)),
    evidenceId(testCase, 'symptom'),
  ])
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function evidenceId(testCase: CaseSpec, suffix: string): string {
  return `evidence/bench/${slug(testCase.id)}/${suffix}`
}

export function benchmarkNodeIds(scope: DemoScope = demoScope): number[] {
  const ids: number[] = []
  for (const testCase of CASES) {
    ids.push(demoEntityId('Incident', `incident/${testCase.id}`, scope))
    ids.push(demoEntityId('Alert', `alert/bench/${slug(testCase.id)}`, scope))
  }
  for (const externalId of benchmarkEvidenceExternalIds()) {
    ids.push(demoEntityId('Evidence', externalId, scope))
  }
  return ids
}

function evidenceDraftsFor(
  testCase: CaseSpec,
  incidentExternalId: string,
  serviceName: string,
): { drafts: EvidenceDraft[]; truthIds: string[] } {
  const observedAt = testCase.startedAt
  const serviceLink = {
    label: 'Service' as const,
    externalId: testCase.serviceExternalId,
    type: 'GENERATED' as const,
  }
  const incidentLink = {
    label: 'Incident' as const,
    externalId: incidentExternalId,
    type: 'OBSERVED_DURING' as const,
  }

  const truthId = evidenceId(testCase, 'truth')
  const truthDraft: EvidenceDraft = {
    externalId: truthId,
    evidenceType: testCase.truth.type,
    source: testCase.truth.source,
    sourceRecordId: `bench:${testCase.id}:truth`,
    observedAt,
    windowStart: testCase.startedAt,
    windowEnd: testCase.startedAt,
    summary: testCase.truth.summary,
    reliability: testCase.truth.reliability,
    polarity: 'supports',
    generatedBy: serviceLink,
    derivedFrom: [
      {
        label: testCase.cause.label,
        externalId: testCase.cause.externalId,
        type: 'DERIVED_FROM',
      },
    ],
    observedDuring: [incidentLink],
    payload: {
      dataset: DATASET_VERSION,
      case: testCase.id,
      split: testCase.split,
      family: testCase.family,
      reference: 'ground-truth',
    },
  }

  const noiseDrafts: EvidenceDraft[] = testCase.noise.map((noise, index) => {
    const distractor = testCase.distractors[index]
    return {
      externalId: evidenceId(testCase, `alt-${index}`),
      evidenceType: noise.type,
      source: noise.source,
      sourceRecordId: `bench:${testCase.id}:alt-${index}`,
      observedAt,
      windowStart: testCase.startedAt,
      windowEnd: testCase.startedAt,
      summary: noise.summary,
      reliability: noise.reliability,
      polarity: 'supports',
      generatedBy: serviceLink,
      derivedFrom: [
        { label: distractor.label, externalId: distractor.externalId, type: 'DERIVED_FROM' },
      ],
      observedDuring: [incidentLink],
      payload: {
        dataset: DATASET_VERSION,
        case: testCase.id,
        split: testCase.split,
        reference: `distractor-${index}`,
      },
    }
  })

  const symptomDraft: EvidenceDraft = {
    externalId: evidenceId(testCase, 'symptom'),
    evidenceType: 'trace_excerpt',
    source: 'tempo',
    sourceRecordId: `bench:${testCase.id}:symptom`,
    observedAt,
    windowStart: testCase.startedAt,
    windowEnd: testCase.startedAt,
    summary: `${serviceName} symptom: ${testCase.symptom}`,
    reliability: 0.9,
    polarity: 'neutral',
    generatedBy: serviceLink,
    observedDuring: [incidentLink],
    payload: {
      dataset: DATASET_VERSION,
      case: testCase.id,
      split: testCase.split,
      reference: 'symptom',
    },
  }

  return { drafts: [truthDraft, ...noiseDrafts, symptomDraft], truthIds: [truthId] }
}

/** Seed the benchmark incidents and their evidence into the graph. */
export async function seedBenchmarkGraph(scope: DemoScope = demoScope): Promise<BenchmarkSummary> {
  const incidents = CASES.map((testCase) => {
    const alertExternalId = `alert/bench/${slug(testCase.id)}`
    return {
      case: testCase,
      incidentExternalId: `incident/${testCase.id}`,
      alertExternalId,
      incident: {
        label: 'Incident' as const,
        externalId: `incident/${testCase.id}`,
        properties: {
          title: testCase.title,
          severity: 'high',
          status: 'Resolved',
          started_at: testCase.startedAt,
          detected_at: testCase.startedAt,
          resolved_at: testCase.startedAt,
          owner_team: 'platform-sre',
          summary: testCase.summary,
          impact: testCase.impact,
          benchmark_split: testCase.split,
          ground_truth_cause: testCase.cause.externalId,
          ground_truth_evidence: evidenceId(testCase, 'truth'),
          family: testCase.family,
          data_origin: 'benchmark',
        },
      },
      alert: {
        label: 'Alert' as const,
        externalId: alertExternalId,
        properties: {
          fingerprint: `bench:${testCase.id}`,
          name: `${testCase.family} signal for ${testCase.id}`,
          severity: 'high',
          status: 'resolved',
          started_at: testCase.startedAt,
          ended_at: testCase.startedAt,
          summary: testCase.symptom,
          data_origin: 'benchmark',
        },
      },
    }
  })

  await upsertNodes(
    incidents.flatMap((entry) => [entry.incident, entry.alert]),
    scope,
  )

  const drafts: EvidenceDraft[] = []
  for (const entry of incidents) {
    const { drafts: caseDrafts } = evidenceDraftsFor(
      entry.case,
      entry.incidentExternalId,
      entry.case.serviceExternalId.split('/')[1] ?? 'service',
    )
    drafts.push(...caseDrafts)
  }
  const ingestion = await ingestEvidence(drafts, scope)

  const edges: EdgeInput[] = []
  for (const entry of incidents) {
    edges.push({
      type: 'TRIGGERED',
      src: demoEntityId('Alert', entry.alertExternalId, scope),
      dst: demoEntityId('Incident', entry.incidentExternalId, scope),
    })
    edges.push({
      type: 'AFFECTS',
      src: demoEntityId('Incident', entry.incidentExternalId, scope),
      dst: demoEntityId('Service', entry.case.serviceExternalId, scope),
    })
  }
  await upsertEdges(edges, scope)

  return {
    incidents: incidents.length,
    train: CASES.filter((testCase) => testCase.split === 'train').length,
    heldout: CASES.filter((testCase) => testCase.split === 'heldout').length,
    evidence: ingestion.evidenceNodes,
    alerts: incidents.length,
  }
}
