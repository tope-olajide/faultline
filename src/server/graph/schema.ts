/**
 * Canonical Faultline graph schema.
 *
 * One graph, four conceptual domains (infrastructure, evidence, historical
 * knowledge, adaptive learning). HydraDB is schemaless, so this module is the
 * contract: labels, relationship endpoints, display properties, and the property
 * keys the repository is allowed to project or write.
 */

export const GRAPH_LABELS = [
  // Infrastructure
  'Organization',
  'Project',
  'Environment',
  'Team',
  'Service',
  'Endpoint',
  'Resource',
  'Cluster',
  'Namespace',
  'Workload',
  'Database',
  'Cache',
  'Queue',
  'Repository',
  'Deployment',
  'Commit',
  'PullRequest',
  'ConfigChange',
  // Evidence
  'Alert',
  'Incident',
  'Event',
  'MetricSeries',
  'LogPattern',
  'Trace',
  'Span',
  'Evidence',
  'Observation',
  // Historical knowledge
  'Hypothesis',
  'Investigation',
  'Finding',
  'Resolution',
  'Runbook',
  'FailurePattern',
  // Adaptive learning
  'Feedback',
  'LearningUpdate',
  'PathTemplate',
  'EntityMatchCandidate',
  'ConnectorSource',
  'EvaluationRun',
] as const

export type GraphLabel = (typeof GRAPH_LABELS)[number]

/**
 * Relationship types with the label pairs they may connect.
 *
 * One relationship carries exactly one type and one direction (HydraDB rejects
 * multi-type patterns), so traversal across types goes through one query per
 * type — or through the `algo.*` procedures, which do accept several.
 */
export const RELATIONSHIPS = {
  CONTAINS: {
    from: ['Organization', 'Project', 'Environment', 'Repository', 'Cluster', 'Namespace'],
    to: ['Project', 'Environment', 'Service', 'Workload', 'Commit', 'Deployment', 'Namespace', 'ConnectorSource'],
  },
  BELONGS_TO: { from: ['Service', 'Resource', 'Workload', 'Endpoint'], to: ['Project', 'Environment', 'Team'] },
  DEPENDS_ON: {
    from: ['Service', 'Workload', 'Endpoint'],
    to: ['Service', 'Database', 'Cache', 'Queue', 'Resource'],
  },
  CALLS: { from: ['Service', 'Endpoint'], to: ['Service', 'Endpoint'] },
  RUNS_ON: {
    from: ['Service', 'Workload', 'Database', 'Cache', 'Queue'],
    to: ['Cluster', 'Namespace', 'Resource', 'Workload'],
  },
  DEPLOYED_TO: { from: ['Deployment'], to: ['Environment', 'Workload'] },
  DEPLOYS: { from: ['Deployment'], to: ['Service'] },
  INTRODUCED_BY: { from: ['Service', 'Incident', 'Finding'], to: ['Commit', 'PullRequest', 'Deployment', 'ConfigChange'] },
  CHANGED_BY: { from: ['Deployment', 'ConfigChange'], to: ['Commit', 'PullRequest'] },
  OWNED_BY: { from: ['Service', 'Resource', 'Team', 'Runbook'], to: ['Team', 'Organization'] },
  GENERATED: {
    from: ['Service', 'Workload', 'Database', 'Cache', 'Queue', 'Cluster'],
    to: ['Alert', 'Event', 'MetricSeries', 'LogPattern', 'Trace', 'Evidence', 'Observation'],
  },
  OBSERVED_DURING: { from: ['Evidence', 'Observation', 'Alert', 'Trace', 'Event'], to: ['Incident', 'Investigation'] },
  AFFECTS: { from: ['Incident', 'Alert', 'FailurePattern'], to: ['Service', 'Resource', 'Database', 'Cache', 'Queue', 'Workload'] },
  TRIGGERED: { from: ['Alert', 'Event'], to: ['Incident'] },
  CORRELATED_WITH: { from: ['Evidence', 'Incident', 'Alert'], to: ['Evidence', 'Incident', 'Alert'] },
  SUPPORTS: { from: ['Evidence', 'Observation', 'Finding'], to: ['Hypothesis', 'Finding', 'Resolution'] },
  CONTRADICTS: { from: ['Evidence', 'Observation', 'Finding'], to: ['Hypothesis', 'Finding'] },
  CAUSED_BY: { from: ['Incident', 'Finding'], to: ['Service', 'Deployment', 'Commit', 'ConfigChange', 'Resource', 'Database'] },
  POSSIBLY_CAUSED_BY: {
    from: ['Incident', 'Hypothesis', 'Finding'],
    to: ['Service', 'Deployment', 'Commit', 'ConfigChange', 'Resource', 'Database', 'Cache', 'Queue', 'Workload'],
  },
  RESOLVED_BY: { from: ['Incident', 'FailurePattern'], to: ['Resolution', 'Runbook'] },
  MATCHES_PATTERN: { from: ['Incident', 'Evidence', 'Hypothesis'], to: ['FailurePattern'] },
  SIMILAR_TO: { from: ['Incident'], to: ['Incident'] },
  INVESTIGATED_IN: { from: ['Incident', 'Hypothesis', 'Evidence'], to: ['Investigation'] },
  FOLLOWED_PATH: { from: ['Investigation', 'Incident'], to: ['PathTemplate'] },
  LEARNED_FROM: {
    from: ['LearningUpdate', 'PathTemplate', 'FailurePattern'],
    to: ['Feedback', 'Investigation', 'Incident', 'PathTemplate'],
  },
  DERIVED_FROM: {
    from: ['Evidence', 'Finding', 'Observation'],
    to: ['Evidence', 'Alert', 'Trace', 'MetricSeries', 'LogPattern', 'Event', 'Deployment', 'Commit', 'ConfigChange'],
  },
  SUPERSEDES: {
    from: ['Evidence', 'Observation', 'Resource', 'Service', 'Deployment', 'ConfigChange'],
    to: ['Evidence', 'Observation', 'Resource', 'Service', 'Deployment', 'ConfigChange'],
  },
  HAS_EVIDENCE: { from: ['Incident', 'Hypothesis', 'Finding', 'Investigation'], to: ['Evidence'] },
  MATCH_CANDIDATE: { from: ['EntityMatchCandidate'], to: ['Service', 'Resource', 'Database', 'Cache', 'Queue', 'Workload'] },
  CONFIRMED_BY: { from: ['Incident', 'Hypothesis', 'Finding'], to: ['Service', 'Deployment', 'Commit', 'ConfigChange', 'Resource', 'Database'] },
  REJECTED_BY: { from: ['Incident', 'Hypothesis', 'Finding'], to: ['Service', 'Deployment', 'Commit', 'ConfigChange', 'Resource', 'Database'] },
  CONTRIBUTES_TO: { from: ['Incident', 'Hypothesis', 'Finding'], to: ['Service', 'Deployment', 'Commit', 'ConfigChange', 'Resource', 'Database', 'Cache', 'Queue', 'Workload'] },
  STALE_RELATIONSHIP: { from: ['Service', 'Database', 'Cache', 'Queue', 'Resource', 'Workload'], to: ['Service', 'Database', 'Cache', 'Queue', 'Resource', 'Workload'] },
  INCORRECT_MAPPING: { from: ['Evidence', 'Observation', 'Resource', 'Service', 'Deployment', 'ConfigChange'], to: ['Evidence', 'Observation', 'Resource', 'Service', 'Deployment', 'ConfigChange'] },
} as const satisfies Record<string, { from: readonly GraphLabel[]; to: readonly GraphLabel[] }>

export type RelationshipType = keyof typeof RELATIONSHIPS

/**
 * Widened view of the same table.
 *
 * `RELATIONSHIPS` keeps literal endpoint tuples so typos are compile errors, but
 * that makes `spec.from.includes(label)` reject a general `GraphLabel`. This typed
 * view gives the lookup a uniform signature without losing the literal checks.
 */
export const RELATIONSHIP_ENDPOINTS: Record<
  RelationshipType,
  { from: readonly GraphLabel[]; to: readonly GraphLabel[] }
> = RELATIONSHIPS

export const RELATIONSHIP_TYPES = Object.keys(RELATIONSHIPS) as RelationshipType[]

/**
 * Property used as the human label for a node of each type. Several labels have
 * no `name`; projecting the wrong key silently yields null.
 */
export const DISPLAY_PROPERTY: Partial<Record<GraphLabel, string>> = {
  Evidence: 'summary',
  Commit: 'sha',
  Hypothesis: 'statement',
  Incident: 'title',
  Deployment: 'version',
  Alert: 'name',
  LogPattern: 'signature',
  Trace: 'trace_id',
  Runbook: 'title',
  FailurePattern: 'name',
  LearningUpdate: 'update_type',
  PathTemplate: 'signature',
  Feedback: 'outcome',
  Investigation: 'external_id',
  MetricSeries: 'metric_name',
  Resolution: 'summary',
  Repository: 'url',
  Endpoint: 'route',
  Workload: 'name',
  Namespace: 'name',
  Cluster: 'name',
  Team: 'name',
  Project: 'name',
  Environment: 'name',
  Organization: 'name',
  Service: 'name',
  Database: 'name',
  Cache: 'name',
  Queue: 'name',
  ConfigChange: 'key',
  EvaluationRun: 'external_id',
  EntityMatchCandidate: 'left_external_id',
}

export function displayProperty(label: GraphLabel): string {
  return DISPLAY_PROPERTY[label] ?? 'name'
}

/** Relationship properties the repository may read or write. */
export const EDGE_PROPERTY_KEYS = [
  'weight',
  'confidence_score',
  'baseline_confidence',
  'support_count',
  'contradiction_count',
  'source',
  'source_record_id',
  'source_reliability',
  'observed_at',
  'recorded_at',
  'valid_from',
  'valid_to',
  'last_verified_at',
  'last_seen_at',
  'verification_state',
  'tenant_key',
  'project_key',
  'environment_key',
] as const

export type EdgePropertyKey = (typeof EDGE_PROPERTY_KEYS)[number]

/**
 * Open-ended temporal facts use an explicit sentinel rather than a null, because
 * HydraDB has no null predicate for filtering (`IS NULL` is not in the subset).
 */
export const OPEN_ENDED = '9999-12-31T23:59:59.999Z'

function definePropertyKeys(map: Partial<Record<GraphLabel, readonly string[]>>) {
  return map
}

/**
 * Property keys the repository may project for each label.
 *
 * HydraDB rejects `RETURN n` and `RETURN *`, so every projection is explicit and
 * therefore has to be declared here. Unknown labels fall back to `GENERIC_KEYS`.
 */
export const NODE_PROPERTY_KEYS = definePropertyKeys({
  Project: ['external_id', 'name', 'slug'],
  Environment: ['external_id', 'name', 'environment_type', 'region'],
  Team: ['external_id', 'name', 'slack_ref'],
  Cluster: ['external_id', 'name', 'provider'],
  Namespace: ['external_id', 'name', 'cluster'],
  Workload: ['external_id', 'kind', 'name', 'replicas', 'image', 'namespace'],
  ConfigChange: ['external_id', 'key', 'change_type', 'changed_at', 'summary', 'actor', 'redacted_diff_ref'],
  Event: ['external_id', 'event_type', 'occurred_at', 'source', 'severity', 'summary'],
  ConnectorSource: ['external_id', 'provider', 'resource', 'last_synced_at', 'status', 'last_error', 'permission_scope'],
  Service: ['external_id', 'name', 'language', 'criticality', 'repo_url', 'owner_team', 'created_at', 'summary'],
  Database: ['external_id', 'name', 'engine', 'tier'],
  Cache: ['external_id', 'name', 'engine', 'tier'],
  Queue: ['external_id', 'name', 'engine', 'backlog'],
  Repository: ['external_id', 'url', 'default_branch'],
  Deployment: ['external_id', 'version', 'environment', 'status', 'started_at', 'completed_at', 'deployed_by', 'change_summary'],
  Commit: ['external_id', 'sha', 'author', 'committed_at', 'message'],
  Alert: ['external_id', 'fingerprint', 'name', 'severity', 'status', 'started_at', 'ended_at', 'summary'],
  Incident: [
    'external_id',
    'title',
    'severity',
    'status',
    'started_at',
    'detected_at',
    'resolved_at',
    'owner_team',
    'summary',
    'impact',
    'benchmark_split',
    'ground_truth_cause',
    'ground_truth_evidence',
    'family',
  ],
  Evidence: [
    'external_id',
    'evidence_type',
    'source',
    'source_record_id',
    'observed_at',
    'window_start',
    'window_end',
    'summary',
    'object_uri',
    'content_hash',
    'reliability',
    'redaction_status',
    'polarity',
  ],
  LogPattern: ['external_id', 'signature', 'severity', 'first_seen_at', 'last_seen_at', 'occurrences'],
  Hypothesis: [
    'external_id',
    'statement',
    'status',
    'rank',
    'confidence',
    'confidence_type',
    'created_at',
    'next_check',
    'rationale',
    'cause_external_id',
    'cause_label',
    'path_signature',
    'evidence_count',
    'contradiction_count',
  ],
  MetricSeries: ['external_id', 'metric_name', 'labels_hash', 'unit'],
  Trace: ['external_id', 'trace_id', 'started_at', 'duration_ms', 'status'],
  Observation: ['external_id', 'observation_type', 'value', 'unit', 'observed_at', 'source_ref'],
  Investigation: [
    'external_id',
    'incident_external_id',
    'started_at',
    'completed_at',
    'status',
    'engine_version',
    'prompt_version',
    'summary',
    'unknowns',
    'duration_ms',
  ],
  Feedback: [
    'external_id',
    'outcome',
    'actor_ref',
    'created_at',
    'reason',
    'incident_external_id',
    'hypothesis_external_id',
    'edge_type',
    'edge_src',
    'edge_dst',
    'path_signature',
  ],
  LearningUpdate: [
    'external_id',
    'update_type',
    'before_state',
    'after_state',
    'reason',
    'created_at',
    'status',
    'feedback_external_id',
    'edge_type',
    'edge_src',
    'edge_dst',
    'confidence_delta',
    'reverted_at',
  ],
  PathTemplate: [
    'external_id',
    'signature',
    'path_score',
    'success_count',
    'failure_count',
    'context',
    'last_used_at',
  ],
  EvaluationRun: [
    'external_id',
    'round',
    'engine',
    'dataset_version',
    'split',
    'started_at',
    'completed_at',
    'top1_accuracy',
    'recall_at_3',
    'evidence_precision',
    'evidence_recall',
    'false_positive_rate',
    'mean_latency_ms',
    'traversal_efficiency',
    'case_count',
    'detail',
  ],
})

const GENERIC_KEYS = ['external_id', 'name'] as const

/** Always projected so scope is visible in the UI and enforced on writes. */
export const SCOPE_PROPERTY_KEYS = ['tenant_key', 'project_key', 'environment_key', 'data_origin'] as const

export function nodePropertyKeys(label: GraphLabel): string[] {
  const declared = NODE_PROPERTY_KEYS[label] ?? GENERIC_KEYS
  return [...declared, ...SCOPE_PROPERTY_KEYS]
}

export function isRelationshipType(value: string): value is RelationshipType {
  return Object.prototype.hasOwnProperty.call(RELATIONSHIPS, value)
}

export function isGraphLabel(value: string): value is GraphLabel {
  return (GRAPH_LABELS as readonly string[]).includes(value)
}
