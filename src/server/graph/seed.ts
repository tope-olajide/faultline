import type { DemoScope } from '../config'
import { demoScope, scopeKey } from '../config'
import { demoEntityId } from './ids'
import { OPEN_ENDED, type RelationshipType } from './schema'
import {
  deleteNodes,
  graphStats,
  invalidateStatsCache,
  upsertEdges,
  upsertNodes,
  type EdgeInput,
  type NodeInput,
  type PropertyMap,
} from './repository'

/**
 * Demo dataset — a deterministic checkout platform with one open incident.
 *
 * This is the only simulated data in the product. Everything consuming it
 * (writes, reads, traversal, statistics) is real; the dataset simply stands in
 * for a connected cluster until Slice 7 adds live connectors. Every node carries
 * `source: demo-simulator` where a source applies so the UI can label it.
 */

const SCOPE_NOTE: PropertyMap = { data_origin: 'demo-simulator' } as PropertyMap

interface SeedNode extends NodeInput {
  key: string
  /** Short description used by the UI graph inspector. */
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
  source: string,
  observedAt: string,
  options: { verificationState?: 'verified' | 'provisional'; confidence?: number; source?: string } = {},
): PropertyMap {
  return {
    confidence_score: options.confidence ?? 0.93,
    support_count: options.verificationState === 'provisional' ? 1 : 4,
    contradiction_count: 0,
    verification_state: options.verificationState ?? 'verified',
    source: options.source ?? 'otel-traces',
    observed_at: observedAt,
    valid_from: '2026-09-01T00:00:00Z',
    valid_to: OPEN_ENDED,
    last_verified_at: observedAt,
    weight: 1,
  }
}

const nodes: SeedNode[] = [
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
    key: 'ev-metric',
    label: 'Evidence',
    externalId: 'evidence/ev-metric-pool-wait',
    purpose: 'Metric anomaly evidence',
    properties: {
      evidence_type: 'metric_anomaly',
      source: 'prometheus',
      source_record_id: 'promql:histogram_quantile(0.99,pg_pool_wait_seconds)',
      observed_at: '2026-11-14T15:18:00Z',
      window_start: T.windowStart,
      window_end: T.windowEnd,
      summary: 'Database connection wait p99 rose from 12 ms to 1.94 s on checkout-service, peaking at 15:19.',
      object_uri: 's3://faultline-evidence/demo/ev-metric-pool-wait.json',
      content_hash: 'sha256:5d1c0a9f7b3e',
      reliability: 0.92,
      redaction_status: 'clean',
    },
  },
  {
    key: 'ev-trace',
    label: 'Evidence',
    externalId: 'evidence/ev-trace-db-timeout',
    purpose: 'Trace evidence',
    properties: {
      evidence_type: 'trace_excerpt',
      source: 'tempo',
      source_record_id: 'trace:4f8a91c2d7e3',
      observed_at: '2026-11-14T15:24:41Z',
      window_start: T.windowStart,
      window_end: T.windowEnd,
      summary:
        '38% of checkout spans block on postgres-main for >2 s; the slow span starts after a successful auth call, ruling out gateway saturation.',
      object_uri: 's3://faultline-evidence/demo/ev-trace-db-timeout.json',
      content_hash: 'sha256:a71b22c9d410',
      reliability: 0.88,
      redaction_status: 'clean',
    },
  },
  {
    key: 'ev-logs',
    label: 'Evidence',
    externalId: 'evidence/ev-log-pool-exhausted',
    purpose: 'Log pattern evidence',
    properties: {
      evidence_type: 'log_pattern',
      source: 'loki',
      source_record_id: 'logql:{service="checkout-service"} |= "pool_size"',
      observed_at: '2026-11-14T15:17:00Z',
      window_start: T.windowStart,
      window_end: T.windowEnd,
      summary: '2,410 pool-acquisition failures from pgx in the incident window, none in the preceding hour.',
      object_uri: 's3://faultline-evidence/demo/ev-log-pool-exhausted.json',
      content_hash: 'sha256:0c9e4bb11872',
      reliability: 0.85,
      redaction_status: 'clean',
    },
  },
  {
    key: 'ev-deploy',
    label: 'Evidence',
    externalId: 'evidence/ev-deployment-window',
    purpose: 'Deployment correlation evidence',
    properties: {
      evidence_type: 'deployment_correlation',
      source: 'github',
      source_record_id: 'deployment:checkout-service@2.14.3',
      observed_at: T.deployEnd,
      window_start: T.deployStart,
      window_end: T.deployEnd,
      summary:
        'checkout-service@2.14.3 completed 26 hours before onset, and no deployment occurred inside the incident window.',
      object_uri: 's3://faultline-evidence/demo/ev-deployment-window.json',
      content_hash: 'sha256:3f0d81c7a2b6',
      reliability: 0.7,
      redaction_status: 'clean',
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
]

const edges: SeedEdge[] = [
  { from: 'project', to: 'environment', type: 'CONTAINS' },

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
  { from: 'svc-checkout', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-payment', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-inventory', to: 'cluster', type: 'RUNS_ON' },
  { from: 'svc-notifications', to: 'cluster', type: 'RUNS_ON' },
  { from: 'db', to: 'cluster', type: 'RUNS_ON' },
  { from: 'cache', to: 'cluster', type: 'RUNS_ON' },
  { from: 'queue', to: 'cluster', type: 'RUNS_ON' },

  {
    from: 'svc-gateway',
    to: 'svc-auth',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-gateway', '2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-gateway',
    to: 'svc-checkout',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-gateway', '2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'svc-payment',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-checkout', '2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'svc-inventory',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-checkout', '2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-checkout',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-checkout', '2026-11-14T15:24:41Z', { confidence: 0.97 }),
  },
  {
    from: 'svc-checkout',
    to: 'cache',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-checkout', '2026-11-14T15:24:00Z'),
  },
  {
    from: 'svc-payment',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-payment', '2026-11-14T15:22:00Z', { confidence: 0.9 }),
  },
  {
    from: 'svc-payment',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-payment', '2026-11-14T15:22:00Z'),
  },
  {
    from: 'svc-inventory',
    to: 'db',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-inventory', '2026-11-14T15:22:00Z', { confidence: 0.86 }),
  },
  {
    from: 'svc-inventory',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-inventory', '2026-11-14T15:22:00Z', {
      verificationState: 'provisional',
      confidence: 0.42,
      source: 'inferred-topology',
    }),
  },
  {
    from: 'svc-auth',
    to: 'cache',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-auth', '2026-11-14T15:20:00Z'),
  },
  {
    from: 'svc-notifications',
    to: 'queue',
    type: 'DEPENDS_ON',
    properties: dependencyEdge('svc-notifications', '2026-11-14T15:22:00Z'),
  },

  { from: 'repository', to: 'commit', type: 'CONTAINS' },
  { from: 'deployment', to: 'svc-checkout', type: 'DEPLOYS' },
  { from: 'deployment', to: 'environment', type: 'DEPLOYED_TO' },
  { from: 'deployment', to: 'commit', type: 'CHANGED_BY' },

  { from: 'svc-checkout', to: 'alert', type: 'GENERATED' },
  { from: 'alert', to: 'incident', type: 'TRIGGERED' },
  { from: 'incident', to: 'svc-checkout', type: 'AFFECTS' },
  { from: 'incident', to: 'svc-payment', type: 'AFFECTS' },
  { from: 'incident', to: 'svc-gateway', type: 'AFFECTS' },

  { from: 'svc-checkout', to: 'ev-metric', type: 'GENERATED' },
  { from: 'svc-checkout', to: 'ev-trace', type: 'GENERATED' },
  { from: 'svc-checkout', to: 'ev-logs', type: 'GENERATED' },
  { from: 'svc-checkout', to: 'log-pattern', type: 'GENERATED' },
  { from: 'svc-checkout', to: 'trace', type: 'GENERATED' },
  { from: 'db', to: 'metric-pool', type: 'GENERATED' },

  { from: 'ev-metric', to: 'metric-pool', type: 'DERIVED_FROM' },
  { from: 'ev-logs', to: 'log-pattern', type: 'DERIVED_FROM' },
  { from: 'ev-trace', to: 'trace', type: 'DERIVED_FROM' },
  { from: 'ev-deploy', to: 'deployment', type: 'DERIVED_FROM' },

  { from: 'ev-metric', to: 'incident', type: 'OBSERVED_DURING' },
  { from: 'ev-trace', to: 'incident', type: 'OBSERVED_DURING' },
  { from: 'ev-logs', to: 'incident', type: 'OBSERVED_DURING' },
  { from: 'ev-deploy', to: 'incident', type: 'OBSERVED_DURING' },

  { from: 'ev-metric', to: 'hyp-pool', type: 'SUPPORTS' },
  { from: 'ev-trace', to: 'hyp-pool', type: 'SUPPORTS' },
  { from: 'ev-logs', to: 'hyp-pool', type: 'SUPPORTS' },
  { from: 'ev-deploy', to: 'hyp-deploy', type: 'SUPPORTS' },
  { from: 'ev-metric', to: 'hyp-deploy', type: 'CONTRADICTS' },
  { from: 'ev-deploy', to: 'hyp-pool', type: 'CONTRADICTS' },

  { from: 'hyp-pool', to: 'db', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-pool', to: 'svc-checkout', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-deploy', to: 'deployment', type: 'POSSIBLY_CAUSED_BY' },
  { from: 'hyp-deploy', to: 'commit', type: 'POSSIBLY_CAUSED_BY' },
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
}

export function demoNodeIds(scope: DemoScope = demoScope): number[] {
  return nodes.map((node) => demoEntityId(node.label, node.externalId, scope))
}

/**
 * Seed (or re-seed) the demo graph.
 *
 * Re-seeding deletes the ids this dataset owns first, then writes nodes and
 * edges. That makes the result deterministic *and* refreshes properties, which a
 * pure `MERGE` re-run would not do (HydraDB `MERGE` does not update properties on
 * an existing edge).
 */
export async function seedDemoGraph(
  options: { reset?: boolean; scope?: DemoScope } = {},
): Promise<SeedSummary> {
  const scope = options.scope ?? demoScope
  const started = Date.now()
  const ids = demoNodeIds(scope)

  // Always clear owned ids: node property updates go through MERGE … SET (cheap)
  // but edge properties are inline, so a clean write is the only way to guarantee
  // the dataset matches this definition.
  const deleted = await deleteNodes(ids)

  const idByKey = new Map<string, number>()
  for (const node of nodes) idByKey.set(node.key, demoEntityId(node.label, node.externalId, scope))

  // Labels and properties first: a node that only ever appears as an edge
  // endpoint carries no label, and label-anchored counts would silently miss it.
  const nodeResult = await upsertNodes(
    nodes.map((node) => ({ label: node.label, externalId: node.externalId, properties: node.properties })),
    scope,
  )

  const edgeInputs: EdgeInput[] = edges.map((edge) => {
    const src = idByKey.get(edge.from)
    const dst = idByKey.get(edge.to)
    if (src === undefined || dst === undefined) {
      throw new Error(`Seed edge references unknown node: ${edge.from} -> ${edge.to}`)
    }
    return { type: edge.type, src, dst, properties: edge.properties }
  })
  const edgeResult = await upsertEdges(edgeInputs, scope)

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
    nodes: nodeResult.written,
    edges: edgeResult.written,
    nodeRequests: nodeResult.requests,
    edgeRequests: edgeResult.requests,
    deleted: deleted.deleted,
    durationMs: Date.now() - started,
    byLabel,
    byRelationship,
    totals: { nodes: stats.totalNodes, relationships: stats.totalRelationships },
    bookmark: edgeResult.bookmark ?? nodeResult.bookmark,
  }
}
