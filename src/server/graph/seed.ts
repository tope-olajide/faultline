import type { DemoScope } from '../config'
import { demoScope, scopeKey } from '../config'
import { demoEntityId } from './ids'
import { OPEN_ENDED, type RelationshipType } from './schema'
import {
  deleteNodes,
  graphStats,
  invalidateStatsCache,
  listNodes,
  upsertEdges,
  upsertNodes,
  type EdgeInput,
  type NodeInput,
  type PropertyMap,
} from './repository'
import { collectSimulatedEvidence, simulatedConnectors, SCENARIO } from '../integrations/simulator'
import { ingestEvidence } from '../evidence/ingest'
import { benchmarkNodeIds, seedBenchmarkGraph, type BenchmarkSummary } from './benchmark'

/**
 * Demo dataset — a deterministic checkout platform with one open incident.
 *
 * Slice 2 adds temporal facts (a retired cache dependency), the topology entities
 * behind them (namespace, workload, config change, event), connector sources, a
 * third hypothesis that the Kubernetes observation refutes, and evidence payloads
 * that are written into the local object store and referenced from the graph.
 */

const SCOPE_NOTE: PropertyMap = { data_origin: 'demo-simulator' } as PropertyMap

interface SeedNode extends NodeInput {
  key: string
  purpose: string
}

interface SeedEdge {
  from: string
  to: string
  type: RelationshipType
  properties?: PropertyMap
}

const T = {
  incidentStart: '2026-11-14T15:21:00Z',
  incidentDetected: '2026-11-14T15:23:00Z',
  windowStart: '2026-11-14T15:11:00Z',
  windowEnd: '2026-11-14T15:26:00Z',
  deployStart: '2026-11-13T13:10:00Z',
  deployEnd: '2026-11-13T13:16:00Z',
  commitAt: '2026-11-13T12:48:00Z',
  alertStart: '2026-11-14T15:21:00Z',
  logFirst: '2026-11-14T15:17:00Z',
  logLast: '2026-11-14T15:29:00Z',
}

function dependencyEdge(
  observedAt: string,
  options: {
    verificationState?: 'verified' | 'provisional'
    confidence?: number
    source?: string
    validFrom?: string
    validTo?: string
    lastSeenAt?: string
  } = {},
): PropertyMap {
  const confidence = options.confidence ?? 0.93
  return {
    confidence_score: confidence,
    // Frozen prior used by the fixed-graph evaluation baseline. Learning only
    // mutates `confidence_score`, so the baseline stays reproducible.
    baseline_confidence: confidence,
    support_count: options.verificationState === 'provisional' ? 1 : 4,
    contradiction_count: 0,
    verification_state: options.verificationState ?? 'verified',
    source: options.source ?? 'otel-traces',
    observed_at: observedAt,
    valid_from: options.validFrom ?? '2026-09-01T00:00:00Z',
    valid_to: options.validTo ?? OPEN_ENDED,
    last_verified_at: observedAt,
    last_seen_at: options.lastSeenAt ?? observedAt,
    weight: 1,
  }
}

const baseNodes: SeedNode[] = [
  {
    key: 'project',
    label: 'Project',
    externalId: 'project/checkout-platform',
    purpose: 'Monitored product',
    properties: { name: 'Checkout Platform', slug: 'checkout-platform' },
  },
  {
    key: 'environment',
    label: 'Environment',
    externalId: 'environment/production',
    purpose: 'Production environment',
    properties: { name: 'Production', environment_type: 'production', region: 'us-east-1' },
  },
  {
    key: 'team-platform',
    label: 'Team',
    externalId: 'team/platform-sre',
    purpose: 'Owning SRE team',
    properties: { name: 'Platform SRE', slack_ref: '#platform-sre' },
  },
  {
    key: 'team-payments',
    label: 'Team',
    externalId: 'team/payments-core',
    purpose: 'Owning payments team',
    properties: { name: 'Payments Core', slack_ref: '#payments-core' },
  },
  {
    key: 'cluster',
    label: 'Cluster',
    externalId: 'cluster/prod-us-east-1',
    purpose: 'Compute cluster',
    properties: { name: 'prod-us-east-1', provider: 'aws' },
  },
  {
    key: 'namespace',
    label: 'Namespace',
    externalId: 'namespace/prod-checkout',
    purpose: 'Kubernetes namespace for checkout workloads',
    properties: { name: 'prod-checkout', cluster: 'prod-us-east-1' },
  },
  {
    key: 'workload',
    label: 'Workload',
    externalId: 'workload/checkout-service-7d9f',
    purpose: 'Checkout deployment workload',
    properties: {
      kind: 'Deployment',
      name: 'checkout-service',
      replicas: 6,
      image: 'checkout-service:2.14.3',
      namespace: 'prod-checkout',
    },
  },
  {
    key: 'svc-gateway',
    label: 'Service',
    externalId: 'service/api-gateway/production',
    purpose: 'Public edge service',
    properties: {
      name: 'api-gateway',
      language: 'go',
      criticality: 'critical',
      repo_url: 'github.com/faultline-demo/api-gateway',
      owner_team: 'platform-sre',
      created_at: '2024-02-11T09:00:00Z',
      summary: 'Terminates customer traffic and routes checkout requests.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'svc-auth',
    label: 'Service',
    externalId: 'service/auth-service/production',
    purpose: 'Session and token service',
    properties: {
      name: 'auth-service',
      language: 'typescript',
      criticality: 'high',
      repo_url: 'github.com/faultline-demo/auth-service',
      owner_team: 'platform-sre',
      created_at: '2024-02-11T09:05:00Z',
      summary: 'Issues and validates customer session tokens.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'svc-checkout',
    label: 'Service',
    externalId: 'service/checkout-service/production',
    purpose: 'Checkout orchestration',
    properties: {
      name: 'checkout-service',
      language: 'typescript',
      criticality: 'critical',
      repo_url: 'github.com/faultline-demo/checkout-platform',
      owner_team: 'platform-sre',
      created_at: '2024-03-02T11:20:00Z',
      summary: 'Coordinates cart, payment, and inventory calls for checkout.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'svc-payment',
    label: 'Service',
    externalId: 'service/payment-service/production',
    purpose: 'Payment processing',
    properties: {
      name: 'payment-service',
      language: 'java',
      criticality: 'critical',
      repo_url: 'github.com/faultline-demo/payment-service',
      owner_team: 'payments-core',
      created_at: '2024-03-02T11:24:00Z',
      summary: 'Authorizes and captures payments against the provider.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'svc-inventory',
    label: 'Service',
    externalId: 'service/inventory-service/production',
    purpose: 'Stock reservation',
    properties: {
      name: 'inventory-service',
      language: 'go',
      criticality: 'high',
      repo_url: 'github.com/faultline-demo/inventory-service',
      owner_team: 'platform-sre',
      created_at: '2024-04-18T08:40:00Z',
      summary: 'Reserves stock and publishes reservation events.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'svc-notifications',
    label: 'Service',
    externalId: 'service/notification-worker/production',
    purpose: 'Async notification consumer',
    properties: {
      name: 'notification-worker',
      language: 'python',
      criticality: 'medium',
      repo_url: 'github.com/faultline-demo/notification-worker',
      owner_team: 'platform-sre',
      created_at: '2024-05-06T15:10:00Z',
      summary: 'Consumes order events and sends customer notifications.',
      ...SCOPE_NOTE,
    },
  },
  {
    key: 'db',
    label: 'Database',
    externalId: 'database/postgres-main/production',
    purpose: 'Primary relational store',
    properties: { name: 'postgres-main', engine: 'postgresql-16', tier: 'db.r6g.xlarge' },
  },
  {
    key: 'cache',
    label: 'Cache',
    externalId: 'cache/redis-sessions/production',
    purpose: 'Session and cart cache',
    properties: { name: 'redis-sessions', engine: 'redis-7.2', tier: 'cache.r6g.large' },
  },
  {
    key: 'cache-legacy',
    label: 'Cache',
    externalId: 'cache/redis-cache-legacy/production',
    purpose: 'Retired cache backend (historical dependency only)',
    properties: { name: 'redis-cache-legacy', engine: 'redis-6.2', tier: 'cache.r5.large' },
  },
  {
    key: 'queue',
    label: 'Queue',
    externalId: 'queue/rabbitmq-events/production',
    purpose: 'Order event bus',
    properties: { name: 'rabbitmq-events', engine: 'rabbitmq-3.13', backlog: '1240' },
  },
  {
    key: 'repository',
    label: 'Repository',
    externalId: 'repository/checkout-platform',
    purpose: 'Source repository',
    properties: { url: 'github.com/faultline-demo/checkout-platform', default_branch: 'main' },
  },
  {
    key: 'deployment',
    label: 'Deployment',
    externalId: 'deployment/checkout-service/2.14.3',
    purpose: 'Deployment preceding the incident',
    properties: {
      version: 'checkout-service@2.14.3',
      environment: 'production',
      status: 'succeeded',
      started_at: T.deployStart,
      completed_at: T.deployEnd,
      deployed_by: 'github-actions',
      change_summary: 'Batched order lookups in the payment retry path.',
    },
  },
  {
    key: 'commit',
    label: 'Commit',
    externalId: 'commit/9f2c1ab',
    purpose: 'Change shipped by the deployment',
    properties: {
      sha: '9f2c1ab',
      author: 'priya.raman',
      committed_at: T.commitAt,
      message: 'perf(checkout): batch order lookups in the payment retry path',
    },
  },
  {
    key: 'alert',
    label: 'Alert',
    externalId: 'alert/checkout-p99-latency',
    purpose: 'First visible symptom',
    properties: {
      fingerprint: 'checkout-p99-latency:production',
      name: 'Checkout p99 latency above 2s',
      severity: 'critical',
      status: 'firing',
      started_at: T.alertStart,
      ended_at: '',
      summary: 'p99 latency 4.8s for 9 minutes on the checkout route.',
    },
  },
  {
    key: 'incident',
    label: 'Incident',
    externalId: 'incident/INC-104',
    purpose: 'Open incident under investigation',
    properties: {
      title: 'Checkout latency and 5xx spike on the payment path',
      severity: 'critical',
      status: 'Investigating',
      started_at: T.incidentStart,
      detected_at: T.incidentDetected,
      resolved_at: '',
      owner_team: 'platform-sre',
      summary:
        'Checkout p99 exceeded 2s with a 7.4% 5xx rate. Gateway and payment-service alerts fired five minutes later.',
      impact: 'Checkout conversion down an estimated 12% for 21 minutes.',
      benchmark_split: 'demo',
      ground_truth_cause: 'database/postgres-main/production',
      ground_truth_evidence:
        'evidence/ev-metric-pool-wait,evidence/ev-trace-db-timeout,evidence/ev-log-pool-exhausted',
      family: 'db_pool',
    },
  },
  {
    key: 'metric-pool',
    label: 'MetricSeries',
    externalId: 'metric/pg-pool-wait-seconds',
    purpose: 'Metric identity behind the anomaly',
    properties: { metric_name: 'pg_pool_wait_seconds', labels_hash: 'sha1:6b2f1d', unit: 'seconds' },
  },
  {
    key: 'log-pattern',
    label: 'LogPattern',
    externalId: 'logpattern/pgx-pool-saturated',
    purpose: 'Clustered recurring log signature',
    properties: {
      signature: 'pgx: acquired=false wait=1.94s pool_size=20 saturated',
      severity: 'error',
      first_seen_at: T.logFirst,
      last_seen_at: T.logLast,
      occurrences: 2410,
    },
  },
  {
    key: 'trace',
    label: 'Trace',
    externalId: 'trace/4f8a91c2d7e3',
    purpose: 'Representative slow trace',
    properties: {
      trace_id: '4f8a91c2d7e3',
      started_at: '2026-11-14T15:24:41Z',
      duration_ms: 4870,
      status: 'error',
    },
  },
  {
    key: 'config-change',
    label: 'ConfigChange',
    externalId: 'configchange/cache-migration-2026-10-02',
    purpose: 'Cache backend migration',
    properties: {
      key: 'CACHE_BACKEND',
      change_type: 'update',
      changed_at: '2026-10-02T10:04:00Z',
      summary: 'CACHE_BACKEND moved from redis-cache-legacy to redis-sessions.',
      actor: 'priya.raman',
      redacted_diff_ref: 'config-audit:CACHE_BACKEND@2026-10-02',
    },
  },
  {
    key: 'event-pods',
    label: 'Event',
    externalId: 'event/evt-checkout-pods-ready',
    purpose: 'Pod health observation during the incident',
    properties: {
      event_type: 'pod_health_observation',
      occurred_at: '2026-11-14T15:18:00Z',
      source: 'kubernetes',
      severity: 'info',
      summary: 'All 6 checkout-service pods stayed Ready with zero restarts during the window.',
    },
  },
  {
    key: 'hyp-pool',
    label: 'Hypothesis',
    externalId: 'hypothesis/hyp-db-pool-exhaustion',
    purpose: 'Ranked hypothesis 1',
    properties: {
      statement: 'PostgreSQL connection pool exhaustion on the checkout persistence path',
      status: 'Candidate',
      rank: 1,
      confidence: 0.78,
      confidence_type: 'uncalibrated_relative_score',
      created_at: '2026-11-14T15:26:10Z',
      next_check: 'Read pg_stat_activity and pool saturation for checkout-service',
      rationale:
        'Pool wait time, trace blocking, and log pattern all point at exhausted connections; the deployment predates onset by 26 hours.',
    },
  },
  {
    key: 'hyp-deploy',
    label: 'Hypothesis',
    externalId: 'hypothesis/hyp-deploy-regression',
    purpose: 'Ranked hypothesis 2',
    properties: {
      statement: 'Regression introduced by the checkout-service 2.14.3 batched lookups',
      status: 'Candidate',
      rank: 2,
      confidence: 0.41,
      confidence_type: 'uncalibrated_relative_score',
      created_at: '2026-11-14T15:26:10Z',
      next_check: 'Compare batched lookup query plan and pool size before/after 2.14.3',
      rationale:
        'The change touches the retry path, but the deploy is 26h old and the service handled peak traffic in between without pool saturation.',
    },
  },
  {
    key: 'hyp-pods',
    label: 'Hypothesis',
    externalId: 'hypothesis/hyp-pod-crash-loop',
    purpose: 'Ranked hypothesis 3 (refuted by Kubernetes observation)',
    properties: {
      statement: 'Node pressure or crash-looping checkout pods',
      status: 'Candidate',
      rank: 3,
      confidence: 0.12,
      confidence_type: 'uncalibrated_relative_score',
      created_at: '2026-11-14T15:26:10Z',
      next_check: 'Verify pod restarts and node pressure metrics',
      rationale:
        'Plausible given the latency, but the Kubernetes observation shows all pods Ready with zero restarts during the window.',
    },
  },
]

// Connector sources come from the simulator so the graph mirrors what ingestion uses.
const connectorNodes: SeedNode[] = simulatedConnectors().map((connector) => ({
  key: `connector-${connector.provider}`,
  label: 'ConnectorSource',
  externalId: connector.externalId,
  purpose: `${connector.provider} connector`,
  properties: {
    provider: connector.provider,
    resource: connector.resource,
    last_synced_at: connector.lastSyncedAt,
    status: connector.status,
    permission_scope: connector.permissionScope,
    ...(connector.lastError ? { last_error: connector.lastError } : {}),
  },
}))

const nodes: SeedNode[] = [...baseNodes, ...connectorNodes]

const edges: SeedEdge[] = [
  { from: 'project', to: 'environment', type: 'CONTAINS' },
  { from: 'project', to: 'namespace', type: 'CONTAINS' },
  { from: 'cluster', to: 'namespace', type: 'CONTAINS' },
  { from: 'namespace', to: 'workload', type: 'CONTAINS' },

  { from: 'svc-gateway', to: 'project', type: 'BELONGS_TO' },
  { from: 'svc-auth', to: 'project', type: 'BELONGS_TO' },
  { from: 'svc-checkout', to: 'project', type: 'BELONGS_TO' },
  { from: 'svc-payment', to: 'project', type: 'BELONGS_TO' },
  { from: 'svc-inventory', to: 'project', type: 'BELONGS_TO' },
  { from: 'svc-notifications', to: 'project', type: 'BELONGS_TO' },

  { from: 'svc-gateway', to: 'team-platform', type: 'OWNED_BY' },
  { from: 'svc-auth', to: 'team-platform', type: 'OWNED_BY' },
  { from: 'svc-checkout', to: 'team-platform', type: 'OWNED_BY' },
  { from: 'svc-payment', to: 'team-payments', type: 'OWNED_BY' },
  { from: 'svc-inventory', to: 'team-platform', type: 'OWNED_BY' },
  { from: 'svc-notifications', to: 'team-platform', type: 'OWNED_BY' },

  { from: 'svc-gateway', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-auth', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-checkout', to: 'workload', type: 'RUNS_ON' },
  { from: 'svc-payment', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-inventory', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-notifications', to: 'cluster', type: 'RUNS_ON' },
  { from: 'db', to: 'cluster', type: 'RUNS_ON' },
  { from: 'cache', to: 'cluster', type: 'RUNS_ON' },
  { from: 'cache-legacy', to: 'cluster', type: 'RUNS_ON' },
  { from: 'queue', to: 'cluster', type: 'RUNS_ON' },
  { from: 'workload', to: 'cluster', type: 'RUNS_ON' },

  {
    from: 'svc-gateway',
    to: 'svc-auth',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-gateway',
    to: 'svc-checkout',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'svc-payment',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'svc-inventory',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:24:41Z', { confidence: 0.97 }),
  },
  {
    from: 'svc-checkout',
    to: 'cache',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'cache-legacy',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:24:00Z', {
      verificationState: 'provisional',
      confidence: 0.62,
      source: 'config-audit',
      validFrom: '2024-03-02T11:20:00Z',
      validTo: '2026-10-02T10:04:00Z',
      lastSeenAt: '2026-10-02T10:03:00Z',
    }),
  },
  {
    from: 'svc-payment',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:22:00Z', { confidence: 0.9 }),
  },
  {
    from: 'svc-payment',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:22:00Z'),
  },
  {
    from: 'svc-inventory',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:22:00Z', { confidence: 0.86 }),
  },
  {
    from: 'svc-inventory',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:22:00Z', {
      verificationState: 'provisional',
      confidence: 0.42,
      source: 'inferred-topology',
    }),
  },
  {
    from: 'svc-auth',
    to: 'cache',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-notifications',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('2026-11-14T15:22:00Z'),
  },

  { from: 'repository', to: 'commit', type: 'CONTAINS' },
  {
    from: 'deployment',
    to: 'svc-checkout',
    type: 'DEPLOYS',
    properties: {
      confidence_score: 0.95,
      baseline_confidence: 0.95,
      support_count: 2,
      contradiction_count: 0,
      verification_state: 'verified',
      source: 'github-deployments',
    },
  },
  { from: 'deployment', to: 'environment', type: 'DEPLOYED_TO' },
  { from: 'deployment', to: 'commit', type: 'CHANGED_BY' },

  { from: 'svc-checkout', to: 'alert', type: 'GENERATED' },
  { from: 'alert', to: 'incident', type: 'TRIGGERED' },
  { from: 'incident', to: 'svc-checkout', type: 'AFFECTS' },
  { from: 'incident', to: 'svc-payment', type: 'AFFECTS' },
  { from: 'incident', to: 'svc-gateway', type: 'AFFECTS' },

  { from: 'svc-checkout', to: 'log-pattern', type: 'GENERATED' },
  { from: 'svc-checkout', to: 'trace', type: 'GENERATED' },
  { from: 'db', to: 'metric-pool', type: 'GENERATED' },
  { from: 'workload', to: 'event-pods', type: 'GENERATED' },

  { from: 'project', to: 'connector-prometheus', type: 'CONTAINS' },
  { from: 'project', to: 'connector-loki', type: 'CONTAINS' },
  { from: 'project', to: 'connector-tempo', type: 'CONTAINS' },
  { from: 'project', to: 'connector-github', type: 'CONTAINS' },
  { from: 'project', to: 'connector-kubernetes', type: 'CONTAINS' },
  { from: 'project', to: 'connector-config-audit', type: 'CONTAINS' },

  { from: 'svc-checkout', to: 'config-change', type: 'INTRODUCED_BY' },
  { from: 'config-change', to: 'commit', type: 'CHANGED_BY' },

  { from: 'hyp-pool', to: 'db', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-pool', to: 'svc-checkout', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-deploy', to: 'deployment', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-deploy', to: 'commit', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-pods', to: 'workload', type: 'POSSIBLY_CAUSED_BY' },

  { from: 'event-pods', to: 'incident', type: 'OBSERVED_DURING' },
]

export interface SeedSummary {
  scope: string
  nodes: number
  edges: number
  nodeRequests: number
  edgeRequests: number
  deleted: number
  durationMs: number
  byLabel: Record<string, number>
  byRelationship: Record<string, number>
  totals: { nodes: number; relationships: number }
  bookmark: string | null
  benchmark: BenchmarkSummary
}

export function demoNodeIds(scope: DemoScope = demoScope): number[] {
  const evidenceIds = collectSimulatedEvidence().map((draft) =>
    demoEntityId('Evidence', draft.externalId, scope),
  )
  const connectorIds = simulatedConnectors().map((connector) =>
    demoEntityId('ConnectorSource', connector.externalId, scope),
  )
  return [
    ...nodes.map((node) => demoEntityId(node.label, node.externalId, scope)),
    ...evidenceIds,
    ...connectorIds,
    ...benchmarkNodeIds(scope),
  ]
}

export async function seedDemoGraph(
  options: { reset?: boolean; scope?: DemoScope } = {},
): Promise<SeedSummary> {
  const scope = options.scope ?? demoScope
  const started = Date.now()
  const ids = demoNodeIds(scope)

  const deleted = await deleteNodes(ids)

  // Learning state is derived from the seeded graph, so re-seeding must clear it
  // rather than leave ledger entries that describe mutations the fresh edges no
  // longer carry.
  let clearedLearning = 0
  for (const label of [
    'PathTemplate',
    'Feedback',
    'LearningUpdate',
    'EvaluationRun',
    'EntityMatchCandidate',
    'Investigation',
    'Hypothesis',
  ] as const) {
    const nodes = await listNodes(label, { limit: 200 })
    if (nodes.length > 0) {
      const result = await deleteNodes(nodes.map((node) => node.id))
      clearedLearning += result.deleted
    }
  }

  const idByKey = new Map<string, number>()
  for (const node of nodes) idByKey.set(node.key, demoEntityId(node.label, node.externalId, scope))

  const evidenceDrafts = collectSimulatedEvidence()
  for (const draft of evidenceDrafts) {
    idByKey.set(draft.externalId, demoEntityId('Evidence', draft.externalId, scope))
  }

  // Evidence relationships (SUPPORTS/CONTRADICTS) reference evidence by external id.
  const evidenceEdges: SeedEdge[] = [
    { from: 'evidence/ev-metric-pool-wait', to: 'hyp-pool', type: 'SUPPORTS' },
    { from: 'evidence/ev-trace-db-timeout', to: 'hyp-pool', type: 'SUPPORTS' },
    { from: 'evidence/ev-log-pool-exhausted', to: 'hyp-pool', type: 'SUPPORTS' },
    { from: 'evidence/ev-deployment-window', to: 'hyp-deploy', type: 'SUPPORTS' },
    { from: 'evidence/ev-metric-pool-wait', to: 'hyp-deploy', type: 'CONTRADICTS' },
    { from: 'evidence/ev-deployment-window', to: 'hyp-pool', type: 'CONTRADICTS' },
    { from: 'evidence/ev-k8s-pod-health', to: 'hyp-pods', type: 'CONTRADICTS' },
  ]
  const allEdges = [...edges, ...evidenceEdges]

  const nodeResult = await upsertNodes(
    nodes.map((node) => ({ label: node.label, externalId: node.externalId, properties: node.properties })),
    scope,
  )

  const edgeInputs: EdgeInput[] = allEdges.map((edge) => {
    const src = idByKey.get(edge.from)
    const dst = idByKey.get(edge.to)
    if (src === undefined || dst === undefined) {
      throw new Error(`Seed edge references unknown node: ${edge.from} -> ${edge.to}`)
    }
    return { type: edge.type, src, dst, properties: edge.properties }
  })
  const edgeResult = await upsertEdges(edgeInputs, scope)

  // Write evidence payloads into object storage and the graph.
  const ingestion = await ingestEvidence(evidenceDrafts, scope)

  // Seed the held-out benchmark incidents used by the evaluation lab.
  const benchmark = await seedBenchmarkGraph(scope)

  invalidateStatsCache()
  const stats = await graphStats({ fresh: true })

  const byLabel: Record<string, number> = {}
  for (const entry of stats.nodes) byLabel[entry.label] = entry.count
  const byRelationship: Record<string, number> = {}
  for (const entry of stats.relationships) {
    byRelationship[entry.type] = (byRelationship[entry.type] ?? 0) + entry.count
  }

  return {
    scope: scopeKey(scope),
    nodes: nodeResult.written + ingestion.evidenceNodes,
    edges: edgeResult.written + ingestion.relationships,
    nodeRequests: nodeResult.requests,
    edgeRequests: edgeResult.requests,
    deleted: deleted.deleted + clearedLearning,
    durationMs: Date.now() - started,
    byLabel,
    byRelationship,
    totals: { nodes: stats.totalNodes, relationships: stats.totalRelationships },
    bookmark: edgeResult.bookmark ?? nodeResult.bookmark,
    benchmark,
  }
}
