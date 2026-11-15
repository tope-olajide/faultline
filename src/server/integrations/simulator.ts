import type { ConnectorState, EvidenceDraft, EvidenceSource } from './types'

/**
 * Deterministic telemetry simulator for the demo scenario.
 *
 * Stands in for Prometheus, Loki, Tempo, GitHub and Kubernetes until real
 * connectors land. The adapters produce the same normalized `EvidenceDraft` a real
 * connector will produce, and every record carries a source reference, a bounded
 * observation window, and the entity it was derived from.
 *
 * Scenario: INC-104 — checkout latency and 5xx spike caused by PostgreSQL
 * connection pool exhaustion. The deployment evidence in this scenario is the
 * *misleading but plausible* signal: it is real, it is recent, and it is not causal.
 */

export const SCENARIO = {
  incident: 'incident/INC-104',
  service: 'service/checkout-service/production',
  serviceName: 'checkout-service',
  windowStart: '2026-11-14T15:11:00Z',
  windowEnd: '2026-11-14T15:26:00Z',
  observedAt: '2026-11-14T15:18:00Z',
  syncedAt: '2026-11-15T08:52:00Z',
  metricSeries: 'metric/pg-pool-wait-seconds',
  logPattern: 'logpattern/pgx-pool-saturated',
  trace: 'trace/4f8a91c2d7e3',
  deployment: 'deployment/checkout-service/2.14.3',
  configChange: 'configchange/cache-migration-2026-10-02',
  podEvent: 'event/evt-checkout-pods-ready',
} as const

function connector(
  provider: string,
  resource: string,
  scope: string,
  options: Partial<ConnectorState> = {},
): ConnectorState {
  return {
    externalId: `connector/${provider}/${resource}`,
    provider,
    resource,
    lastSyncedAt: SCENARIO.syncedAt,
    status: 'healthy',
    permissionScope: scope,
    ...options,
  }
}

const serviceLink = { label: 'Service' as const, externalId: SCENARIO.service, type: 'GENERATED' as const }
const incidentLink = { label: 'Incident' as const, externalId: SCENARIO.incident, type: 'OBSERVED_DURING' as const }

/** Prometheus: one bounded metric window with baseline and active pool state. */
const prometheusSource: EvidenceSource = {
  id: 'prometheus',
  provider: 'prometheus',
  resource: 'prod-us-east-1',
  connector: connector('prometheus', 'prod-us-east-1', 'metrics:read'),
  collect: () => [
    {
      externalId: 'evidence/ev-metric-pool-wait',
      evidenceType: 'metric_anomaly',
      source: 'prometheus',
      sourceRecordId: 'promql:histogram_quantile(0.99, pg_pool_wait_seconds)',
      observedAt: SCENARIO.observedAt,
      windowStart: SCENARIO.windowStart,
      windowEnd: SCENARIO.windowEnd,
      summary:
        'Database connection wait p99 rose from 12 ms to 1.94 s on checkout-service, with the pool fully consumed from 15:17 UTC.',
      reliability: 0.92,
      generatedBy: serviceLink,
      polarity: 'supports',
      derivedFrom: [
        { label: 'MetricSeries', externalId: SCENARIO.metricSeries, type: 'DERIVED_FROM' },
        // Attributed directly to the infrastructure entity the observation is about,
        // so graph traversal can attach evidence to a candidate cause.
        { label: 'Database', externalId: 'database/postgres-main/production', type: 'DERIVED_FROM' },
      ],
      observedDuring: [incidentLink],
      payload: {
        provider: 'prometheus',
        query:
          'histogram_quantile(0.99, sum by (le) (rate(pg_pool_wait_seconds_bucket{service="checkout-service"}[1m])))',
        metric: 'pg_pool_wait_seconds',
        unit: 'seconds',
        baseline: { window: '2026-11-14T14:00:00Z/2026-11-14T15:10:00Z', p99: 0.012, p50: 0.004 },
        anomaly: { onset: '2026-11-14T15:17:00Z', peak: 1.94, threshold: 0.5 },
        pool: { size: 20, in_use: 20, waiting: 47, acquisitions_failed: 2410 },
        series: [
          { at: '2026-11-14T15:11:00Z', p99: 0.011, in_use: 7 },
          { at: '2026-11-14T15:13:00Z', p99: 0.013, in_use: 9 },
          { at: '2026-11-14T15:15:00Z', p99: 0.028, in_use: 14 },
          { at: '2026-11-14T15:17:00Z', p99: 0.84, in_use: 20 },
          { at: '2026-11-14T15:19:00Z', p99: 1.94, in_use: 20 },
          { at: '2026-11-14T15:21:00Z', p99: 1.87, in_use: 20 },
          { at: '2026-11-14T15:24:00Z', p99: 1.63, in_use: 20 },
          { at: '2026-11-14T15:26:00Z', p99: 1.41, in_use: 20 },
        ],
        headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.demo-should-be-redacted' },
      },
    },
  ],
}

/** Loki: clustered log signature rather than raw lines. */
const lokiSource: EvidenceSource = {
  id: 'loki',
  provider: 'loki',
  resource: 'checkout-service',
  connector: connector('loki', 'checkout-service', 'logs:read'),
  collect: () => [
    {
      externalId: 'evidence/ev-log-pool-exhausted',
      evidenceType: 'log_pattern',
      source: 'loki',
      sourceRecordId: 'logql:{service="checkout-service"} |= "pool_size"',
      observedAt: '2026-11-14T15:17:00Z',
      windowStart: SCENARIO.windowStart,
      windowEnd: SCENARIO.windowEnd,
      summary:
        '2,410 pool-acquisition failures from pgx inside the incident window, and none in the preceding hour.',
      reliability: 0.85,
      generatedBy: serviceLink,
      polarity: 'supports',
      derivedFrom: [
        { label: 'LogPattern', externalId: SCENARIO.logPattern, type: 'DERIVED_FROM' },
        { label: 'Database', externalId: 'database/postgres-main/production', type: 'DERIVED_FROM' },
      ],
      observedDuring: [incidentLink],
      payload: {
        provider: 'loki',
        selector: '{service="checkout-service", level="error"} |= "pgx"',
        signature: 'pgx: acquired=false wait=1.94s pool_size=20 saturated',
        window_count: 2410,
        baseline_count: 0,
        by_minute: [
          { at: '2026-11-14T15:16:00Z', count: 0 },
          { at: '2026-11-14T15:17:00Z', count: 212 },
          { at: '2026-11-14T15:18:00Z', count: 388 },
          { at: '2026-11-14T15:19:00Z', count: 401 },
          { at: '2026-11-14T15:20:00Z', count: 396 },
          { at: '2026-11-14T15:21:00Z', count: 377 },
          { at: '2026-11-14T15:24:00Z', count: 341 },
          { at: '2026-11-14T15:26:00Z', count: 295 },
        ],
        samples: [
          {
            at: '2026-11-14T15:19:02Z',
            line: 'pgx: acquired=false wait=1.94s pool_size=20 in_use=20 waiting=47',
          },
          {
            at: '2026-11-14T15:21:44Z',
            line: 'checkout.persist: timeout after 2000ms acquiring connection (retry 2/3)',
          },
        ],
      },
    },
  ],
}

/** Tempo: representative slow trace with the decisive span ordering. */
const tempoSource: EvidenceSource = {
  id: 'tempo',
  provider: 'tempo',
  resource: 'prod-us-east-1',
  connector: connector('tempo', 'prod-us-east-1', 'traces:read'),
  collect: () => [
    {
      externalId: 'evidence/ev-trace-db-timeout',
      evidenceType: 'trace_excerpt',
      source: 'tempo',
      sourceRecordId: 'trace:4f8a91c2d7e3',
      observedAt: '2026-11-14T15:24:41Z',
      windowStart: SCENARIO.windowStart,
      windowEnd: SCENARIO.windowEnd,
      summary:
        '38% of checkout spans block on postgres-main for more than 2 s; the slow span starts after a successful auth call, which rules out gateway saturation.',
      reliability: 0.88,
      generatedBy: serviceLink,
      polarity: 'supports',
      derivedFrom: [
        { label: 'Trace', externalId: SCENARIO.trace, type: 'DERIVED_FROM' },
        { label: 'Database', externalId: 'database/postgres-main/production', type: 'DERIVED_FROM' },
      ],
      observedDuring: [incidentLink],
      payload: {
        provider: 'tempo',
        trace_id: '4f8a91c2d7e3',
        root_service: 'api-gateway',
        total_duration_ms: 4870,
        status: 'error',
        spans: [
          { span_id: 'a1', service: 'api-gateway', operation: 'POST /checkout', duration_ms: 4870, status: 'error' },
          { span_id: 'b2', service: 'auth-service', operation: 'POST /session/verify', duration_ms: 61, status: 'ok' },
          { span_id: 'c3', service: 'checkout-service', operation: 'checkout.submit', duration_ms: 4780, status: 'error' },
          {
            span_id: 'd4',
            service: 'checkout-service',
            operation: 'pgx.acquire',
            duration_ms: 2000,
            status: 'error',
            note: 'pool acquisition timeout',
          },
          { span_id: 'e5', service: 'inventory-service', operation: 'GET /stock', duration_ms: 88, status: 'ok' },
        ],
      },
    },
  ],
}

/** GitHub: real deployment record, used as misleading-but-plausible evidence. */
const githubSource: EvidenceSource = {
  id: 'github',
  provider: 'github',
  resource: 'faultline-demo/checkout-platform',
  connector: connector('github', 'faultline-demo/checkout-platform', 'contents:read,deployments:read'),
  collect: () => [
    {
      externalId: 'evidence/ev-deployment-window',
      evidenceType: 'deployment_correlation',
      source: 'github',
      sourceRecordId: 'deployment:checkout-service@2.14.3',
      observedAt: '2026-11-13T13:16:00Z',
      windowStart: '2026-11-13T13:10:00Z',
      windowEnd: '2026-11-13T13:16:00Z',
      summary:
        'checkout-service@2.14.3 completed 26 hours before onset, and no deployment occurred inside the incident window.',
      reliability: 0.7,
      generatedBy: serviceLink,
      polarity: 'neutral',
      derivedFrom: [{ label: 'Deployment', externalId: SCENARIO.deployment, type: 'DERIVED_FROM' }],
      observedDuring: [incidentLink],
      payload: {
        provider: 'github',
        repository: 'faultline-demo/checkout-platform',
        environment: 'production',
        deployment_id: 8841203,
        ref: 'checkout-service@2.14.3',
        sha: '9f2c1ab',
        status: 'success',
        completed_at: '2026-11-13T13:16:00Z',
        hours_before_incident: 26.1,
        deployments_in_window: 0,
        workflow_token: 'ghs_demo_token_should_be_redacted',
      },
    },
  ],
}

/** Kubernetes: the refuting observation for a pod-crash explanation. */
const kubernetesSource: EvidenceSource = {
  id: 'kubernetes',
  provider: 'kubernetes',
  resource: 'prod-us-east-1/prod-checkout',
  connector: connector('kubernetes', 'prod-us-east-1/prod-checkout', 'pods:read,events:read'),
  collect: () => [
    {
      externalId: 'evidence/ev-k8s-pod-health',
      evidenceType: 'kubernetes_observation',
      source: 'kubernetes',
      sourceRecordId: 'k8s:pods:prod-checkout/checkout-service',
      observedAt: SCENARIO.observedAt,
      windowStart: SCENARIO.windowStart,
      windowEnd: SCENARIO.windowEnd,
      summary:
        'All 6 checkout-service pods stayed Ready with zero restarts and no OOMKilled events during the window.',
      reliability: 0.9,
      generatedBy: serviceLink,
      polarity: 'contradicts',
      derivedFrom: [
        { label: 'Event', externalId: SCENARIO.podEvent, type: 'DERIVED_FROM' },
        { label: 'Workload', externalId: 'workload/checkout-service-7d9f', type: 'DERIVED_FROM' },
      ],
      observedDuring: [incidentLink],
      payload: {
        provider: 'kubernetes',
        cluster: 'prod-us-east-1',
        namespace: 'prod-checkout',
        workload: 'checkout-service',
        pods: [
          { name: 'checkout-service-7d9f-2xk4p', ready: true, restarts: 0, oom_killed: false },
          { name: 'checkout-service-7d9f-9c1lq', ready: true, restarts: 0, oom_killed: false },
          { name: 'checkout-service-7d9f-b7mn2', ready: true, restarts: 0, oom_killed: false },
          { name: 'checkout-service-7d9f-h4st8', ready: true, restarts: 0, oom_killed: false },
          { name: 'checkout-service-7d9f-p2vw6', ready: true, restarts: 0, oom_killed: false },
          { name: 'checkout-service-7d9f-z9q1r', ready: true, restarts: 0, oom_killed: false },
        ],
        events: [],
        node_pressure: false,
      },
    },
  ],
}

/** Config audit: the provenance for a dependency that changed (temporal fact). */
const configAuditSource: EvidenceSource = {
  id: 'config-audit',
  provider: 'config-audit',
  resource: 'checkout-service',
  connector: connector('config-audit', 'checkout-service', 'config:read', {
    status: 'healthy',
    lastSyncedAt: '2026-11-15T08:41:00Z',
  }),
  collect: () => [
    {
      externalId: 'evidence/ev-cache-migration',
      evidenceType: 'config_change',
      source: 'config-audit',
      sourceRecordId: 'config:CACHE_BACKEND@2026-10-02',
      observedAt: '2026-10-02T10:04:00Z',
      windowStart: '2026-10-02T09:55:00Z',
      windowEnd: '2026-10-02T10:10:00Z',
      summary:
        'CACHE_BACKEND moved from redis-cache-legacy to redis-sessions on 2026-10-02; the legacy dependency has not been observed since.',
      reliability: 0.95,
      generatedBy: serviceLink,
      derivedFrom: [{ label: 'ConfigChange', externalId: SCENARIO.configChange, type: 'DERIVED_FROM' }],
      payload: {
        provider: 'config-audit',
        key: 'CACHE_BACKEND',
        actor: 'priya.raman',
        ticket: 'PLAT-2231',
        applied_at: '2026-10-02T10:04:00Z',
        previous: { engine: 'redis-6.2', endpoint: 'redis-cache-legacy:6379', ttl_seconds: 900 },
        next: { engine: 'redis-7.2', endpoint: 'redis-sessions:6379', ttl_seconds: 900 },
        verification: 'no traffic to redis-cache-legacy observed after 2026-10-02T10:09:00Z',
        credentials: { password: 'demo-secret-value-should-be-redacted' },
      },
    },
  ],
}

export const SIMULATED_SOURCES: EvidenceSource[] = [
  prometheusSource,
  lokiSource,
  tempoSource,
  githubSource,
  kubernetesSource,
  configAuditSource,
]

/** All drafts produced by the simulated connectors. Deterministic. */
export function collectSimulatedEvidence(): EvidenceDraft[] {
  return SIMULATED_SOURCES.flatMap((source) => source.collect())
}

export function simulatedConnectors(): ConnectorState[] {
  return SIMULATED_SOURCES.map((source) => source.connector)
}
