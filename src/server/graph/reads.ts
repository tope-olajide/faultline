import { getNode, graphClient, type PropertyMap } from './repository'
import type { GraphLabel } from './schema'
import type { RelationshipType } from './schema'

/**
 * Read-side graph queries used by the investigation, learning and evaluation
 * services.
 *
 * HydraDB rejects unbounded and undirected patterns, so every query here is
 * anchored on an id, a label or a property; multi-hop reasoning is done in the
 * application over a bounded, explicitly projected result set.
 */

export interface IncidentRecord {
  id: number
  externalId: string
  title: string
  severity: string
  status: string
  startedAt: string
  detectedAt: string
  resolvedAt: string
  ownerTeam: string
  summary: string
  impact: string
  benchmarkSplit: string
  groundTruthCause: string
  groundTruthEvidence: string
  family: string
}

export interface ServiceRecord {
  id: number
  externalId: string
  name: string
  criticality: string
  ownerTeam: string
}

export interface DependencyEdge {
  type: RelationshipType
  src: number
  srcName: string
  dst: number
  dstLabel: GraphLabel
  dstName: string
  confidence: number
  baseline: number
  support: number
  contradiction: number
  source: string
  verificationState: string
  validFrom: string
  validTo: string
}

export interface EvidenceRecord {
  id: number
  externalId: string
  evidenceType: string
  source: string
  sourceRecordId: string
  observedAt: string
  windowStart: string
  windowEnd: string
  summary: string
  reliability: number
  polarity: string
  objectUri: string
}

export interface DeploymentRecord {
  id: number
  externalId: string
  version: string
  status: string
  startedAt: string
  completedAt: string
  changeSummary: string
  environment: string
}

export interface DeploymentWithService extends DeploymentRecord {
  serviceId: number
  serviceName: string
  serviceExternalId: string
}

export interface EdgeState {
  confidence: number
  baseline: number
  support: number
  contradiction: number
  verificationState: string
}

export interface PathTemplateRecord {
  id: number
  signature: string
  pathScore: number
  successCount: number
  failureCount: number
  lastUsedAt: string
}

export interface LearningUpdateRecord {
  id: number
  externalId: string
  updateType: string
  beforeState: string
  afterState: string
  reason: string
  createdAt: string
  status: string
  edgeType: string
  edgeSrc: string
  edgeDst: string
  confidenceDelta: number
  revertedAt: string
}

export interface IncidentServiceLink {
  incidentId: number
  incidentExternalId: string
  incidentTitle: string
  incidentStartedAt: string
  serviceId: number
  serviceName: string
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function num(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function id(row: Record<string, unknown>, key = 'id'): number {
  return Number(row[key] ?? 0)
}

const INCIDENT_PROJECTION = [
  'n.id AS id',
  'n.external_id AS external_id',
  'n.title AS title',
  'n.severity AS severity',
  'n.status AS status',
  'n.started_at AS started_at',
  'n.detected_at AS detected_at',
  'n.resolved_at AS resolved_at',
  'n.owner_team AS owner_team',
  'n.summary AS summary',
  'n.impact AS impact',
  'n.benchmark_split AS benchmark_split',
  'n.ground_truth_cause AS ground_truth_cause',
  'n.ground_truth_evidence AS ground_truth_evidence',
  'n.family AS family',
].join(', ')

function toIncident(row: Record<string, unknown>): IncidentRecord {
  return {
    id: id(row),
    externalId: text(row, 'external_id'),
    title: text(row, 'title'),
    severity: text(row, 'severity'),
    status: text(row, 'status'),
    startedAt: text(row, 'started_at'),
    detectedAt: text(row, 'detected_at'),
    resolvedAt: text(row, 'resolved_at'),
    ownerTeam: text(row, 'owner_team'),
    summary: text(row, 'summary'),
    impact: text(row, 'impact'),
    benchmarkSplit: text(row, 'benchmark_split'),
    groundTruthCause: text(row, 'ground_truth_cause'),
    groundTruthEvidence: text(row, 'ground_truth_evidence'),
    family: text(row, 'family'),
  }
}

export async function listIncidents(limit = 100): Promise<IncidentRecord[]> {
  const bounded = Math.min(Math.max(limit, 1), 200)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (n:Incident) RETURN ${INCIDENT_PROJECTION} ORDER BY n.started_at DESC LIMIT ${bounded}`,
  )
  return result.rows.map(toIncident)
}

export async function getIncident(incidentId: number): Promise<IncidentRecord | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (n:Incident {id: $id}) RETURN ${INCIDENT_PROJECTION}`,
    { id: incidentId },
  )
  return result.rows[0] ? toIncident(result.rows[0]) : null
}

export async function getServiceByExternalId(externalId: string): Promise<ServiceRecord | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (s:Service {external_id: $externalId}) RETURN s.id AS id, s.external_id AS external_id, s.name AS name, s.criticality AS criticality, s.owner_team AS owner_team LIMIT 1`,
    { externalId },
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: id(row),
    externalId: text(row, 'external_id'),
    name: text(row, 'name'),
    criticality: text(row, 'criticality'),
    ownerTeam: text(row, 'owner_team'),
  }
}

export async function getIncidentByExternalId(externalId: string): Promise<IncidentRecord | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (n:Incident {external_id: $externalId}) RETURN ${INCIDENT_PROJECTION}`,
    { externalId },
  )
  return result.rows[0] ? toIncident(result.rows[0]) : null
}

export async function getAffectedServices(incidentId: number): Promise<ServiceRecord[]> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (i:Incident {id: $id})-[:AFFECTS]->(s:Service) RETURN s.id AS id, s.external_id AS external_id, s.name AS name, s.criticality AS criticality, s.owner_team AS owner_team LIMIT 20`,
    { id: incidentId },
  )
  return result.rows.map((row) => ({
    id: id(row),
    externalId: text(row, 'external_id'),
    name: text(row, 'name'),
    criticality: text(row, 'criticality'),
    ownerTeam: text(row, 'owner_team'),
  }))
}

const DEPENDENCY_TARGETS: GraphLabel[] = ['Service', 'Database', 'Cache', 'Queue', 'Resource']

/**
 * Every service→dependency edge in the scope, with the learning state attached.
 * The graph is small enough (dozens of edges) that one bounded scan beats one
 * query per candidate.
 */
export async function getDependencyEdges(): Promise<DependencyEdge[]> {
  const queries = DEPENDENCY_TARGETS.map(async (target) => {
    const result = await graphClient().query<Record<string, unknown>>(
      `MATCH (a:Service)-[r:DEPENDS_ON]->(b:${target}) RETURN a.id AS src, a.name AS src_name, b.id AS dst, b.name AS dst_name, r.confidence_score AS confidence, r.baseline_confidence AS baseline, r.support_count AS support, r.contradiction_count AS contradiction, r.source AS source, r.verification_state AS verification_state, r.valid_from AS valid_from, r.valid_to AS valid_to LIMIT 500`,
    )
    return result.rows.map(
      (row): DependencyEdge => ({
        type: 'DEPENDS_ON',
        src: id(row, 'src'),
        srcName: text(row, 'src_name'),
        dst: id(row, 'dst'),
        dstLabel: target,
        dstName: text(row, 'dst_name'),
        confidence: num(row, 'confidence', 0.5),
        baseline: num(row, 'baseline', num(row, 'confidence', 0.5)),
        support: num(row, 'support'),
        contradiction: num(row, 'contradiction'),
        source: text(row, 'source'),
        verificationState: text(row, 'verification_state'),
        validFrom: text(row, 'valid_from'),
        validTo: text(row, 'valid_to'),
      }),
    )
  })

  return (await Promise.all(queries)).flat()
}

export interface IncidentServiceLink {
  incidentId: number
  incidentExternalId: string
  incidentTitle: string
  incidentStartedAt: string
  serviceId: number
  serviceName: string
}

/** Every Incident→Service `AFFECTS` link, used for matching and service pages. */
export async function getIncidentServiceLinks(): Promise<IncidentServiceLink[]> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (i:Incident)-[:AFFECTS]->(s:Service) RETURN i.id AS incident_id, i.external_id AS incident_external_id, i.title AS incident_title, i.started_at AS incident_started_at, s.id AS service_id, s.name AS service_name LIMIT 500`,
  )
  return result.rows.map((row) => ({
    incidentId: id(row, 'incident_id'),
    incidentExternalId: text(row, 'incident_external_id'),
    incidentTitle: text(row, 'incident_title'),
    incidentStartedAt: text(row, 'incident_started_at'),
    serviceId: id(row, 'service_id'),
    serviceName: text(row, 'service_name'),
  }))
}

export async function getIncidentsForService(serviceId: number): Promise<IncidentRecord[]> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (n:Incident)-[:AFFECTS]->(s:Service {id: $id}) RETURN ${INCIDENT_PROJECTION} ORDER BY n.started_at DESC LIMIT 50`,
    { id: serviceId },
  )
  return result.rows.map(toIncident)
}

export async function listDeployments(limit = 100): Promise<DeploymentWithService[]> {
  const bounded = Math.min(Math.max(limit, 1), 200)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (d:Deployment)-[:DEPLOYS]->(s:Service) RETURN d.id AS id, d.external_id AS external_id, d.version AS version, d.status AS status, d.started_at AS started_at, d.completed_at AS completed_at, d.change_summary AS change_summary, d.environment AS environment, s.id AS service_id, s.name AS service_name, s.external_id AS service_external_id ORDER BY d.started_at DESC LIMIT ${bounded}`,
  )
  return result.rows.map((row) => ({
    id: id(row),
    externalId: text(row, 'external_id'),
    version: text(row, 'version'),
    status: text(row, 'status'),
    startedAt: text(row, 'started_at'),
    completedAt: text(row, 'completed_at'),
    changeSummary: text(row, 'change_summary'),
    environment: text(row, 'environment'),
    serviceId: id(row, 'service_id'),
    serviceName: text(row, 'service_name'),
    serviceExternalId: text(row, 'service_external_id'),
  }))
}

export async function getDeploymentsForService(serviceId: number): Promise<DeploymentRecord[]> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (d:Deployment)-[:DEPLOYS]->(s:Service {id: $id}) RETURN d.id AS id, d.external_id AS external_id, d.version AS version, d.status AS status, d.started_at AS started_at, d.completed_at AS completed_at, d.change_summary AS change_summary, d.environment AS environment LIMIT 20`,
    { id: serviceId },
  )
  return result.rows.map((row) => ({
    id: id(row),
    externalId: text(row, 'external_id'),
    version: text(row, 'version'),
    status: text(row, 'status'),
    startedAt: text(row, 'started_at'),
    completedAt: text(row, 'completed_at'),
    changeSummary: text(row, 'change_summary'),
    environment: text(row, 'environment'),
  }))
}

const EVIDENCE_PROJECTION = [
  'e.id AS id',
  'e.external_id AS external_id',
  'e.evidence_type AS evidence_type',
  'e.source AS source',
  'e.source_record_id AS source_record_id',
  'e.observed_at AS observed_at',
  'e.window_start AS window_start',
  'e.window_end AS window_end',
  'e.summary AS summary',
  'e.reliability AS reliability',
  'e.polarity AS polarity',
  'e.object_uri AS object_uri',
].join(', ')

function toEvidence(row: Record<string, unknown>): EvidenceRecord {
  return {
    id: id(row),
    externalId: text(row, 'external_id'),
    evidenceType: text(row, 'evidence_type'),
    source: text(row, 'source'),
    sourceRecordId: text(row, 'source_record_id'),
    observedAt: text(row, 'observed_at'),
    windowStart: text(row, 'window_start'),
    windowEnd: text(row, 'window_end'),
    summary: text(row, 'summary'),
    reliability: num(row, 'reliability', 0.5),
    polarity: text(row, 'polarity') || 'supports',
    objectUri: text(row, 'object_uri'),
  }
}

export async function getEvidenceForIncident(incidentId: number): Promise<EvidenceRecord[]> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (e:Evidence)-[:OBSERVED_DURING]->(i:Incident {id: $id}) RETURN ${EVIDENCE_PROJECTION} ORDER BY e.observed_at DESC LIMIT 200`,
    { id: incidentId },
  )
  return result.rows.map(toEvidence)
}

/** Evidence attributed directly to a candidate cause. */
export async function getEvidenceForCause(
  label: GraphLabel,
  causeId: number,
): Promise<EvidenceRecord[]> {
  const direct = await graphClient().query<Record<string, unknown>>(
    `MATCH (e:Evidence)-[:DERIVED_FROM]->(c:${label} {id: $id}) RETURN ${EVIDENCE_PROJECTION} LIMIT 100`,
    { id: causeId },
  )
  if (direct.rows.length > 0) return direct.rows.map(toEvidence)

  // Fall back to the real ingestion shape: candidate --GENERATED--> source
  // record <--DERIVED_FROM-- evidence. One extra bounded hop per record type.
  const recordLabels: GraphLabel[] = ['MetricSeries', 'LogPattern', 'Trace', 'Event']
  const collected: EvidenceRecord[] = []
  for (const recordLabel of recordLabels) {
    const records = await graphClient().query<Record<string, unknown>>(
      `MATCH (c:${label} {id: $id})-[:GENERATED]->(r:${recordLabel}) RETURN r.id AS id LIMIT 10`,
      { id: causeId },
    )
    for (const record of records.rows) {
      const evidence = await graphClient().query<Record<string, unknown>>(
        `MATCH (e:Evidence)-[:DERIVED_FROM]->(r:${recordLabel} {id: $recordId}) RETURN ${EVIDENCE_PROJECTION} LIMIT 25`,
        { recordId: id(record) },
      )
      collected.push(...evidence.rows.map(toEvidence))
    }
  }
  return collected
}

export async function getAllEvidence(limit = 300): Promise<EvidenceRecord[]> {
  const bounded = Math.min(Math.max(limit, 1), 500)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (e:Evidence) RETURN ${EVIDENCE_PROJECTION} ORDER BY e.observed_at DESC LIMIT ${bounded}`,
  )
  return result.rows.map(toEvidence)
}

/** Evidence→cause attribution edges, used by the vector baseline (no traversal). */
export async function getEvidenceAttributions(): Promise<Map<number, number[]>> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (e:Evidence)-[:DERIVED_FROM]->(c) RETURN e.id AS evidence, c.id AS cause LIMIT 2000`,
  )
  const map = new Map<number, number[]>()
  for (const row of result.rows) {
    const evidenceId = id(row, 'evidence')
    const causeId = id(row, 'cause')
    const list = map.get(causeId) ?? []
    list.push(evidenceId)
    map.set(causeId, list)
  }
  return map
}

export async function getEdgeState(
  src: number,
  dst: number,
  type: RelationshipType,
): Promise<EdgeState | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (a {id: $src})-[r:${type}]->(b {id: $dst}) RETURN r.confidence_score AS confidence, r.baseline_confidence AS baseline, r.support_count AS support, r.contradiction_count AS contradiction, r.verification_state AS verification_state`,
    { src, dst },
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    confidence: num(row, 'confidence', 0.5),
    baseline: num(row, 'baseline', num(row, 'confidence', 0.5)),
    support: num(row, 'support'),
    contradiction: num(row, 'contradiction'),
    verificationState: text(row, 'verification_state'),
  }
}

export async function setEdgeState(
  src: number,
  dst: number,
  type: RelationshipType,
  state: { confidence: number; support: number; contradiction: number; verificationState: string },
): Promise<void> {
  await graphClient().mutate(
    `MATCH (a {id: $src})-[r:${type}]->(b {id: $dst}) SET r.confidence_score = $confidence, r.support_count = $support, r.contradiction_count = $contradiction, r.verification_state = $verificationState`,
    {
      src,
      dst,
      confidence: state.confidence,
      support: state.support,
      contradiction: state.contradiction,
      verificationState: state.verificationState,
    },
  )
}

export async function getPathTemplate(signature: string): Promise<PathTemplateRecord | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (p:PathTemplate {signature: $signature}) RETURN p.id AS id, p.signature AS signature, p.path_score AS path_score, p.success_count AS success_count, p.failure_count AS failure_count, p.last_used_at AS last_used_at LIMIT 1`,
    { signature },
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: id(row),
    signature: text(row, 'signature'),
    pathScore: num(row, 'path_score', 0.5),
    successCount: num(row, 'success_count'),
    failureCount: num(row, 'failure_count'),
    lastUsedAt: text(row, 'last_used_at'),
  }
}

export async function listPathTemplates(limit = 50): Promise<PathTemplateRecord[]> {
  const bounded = Math.min(Math.max(limit, 1), 100)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (p:PathTemplate) RETURN p.id AS id, p.signature AS signature, p.path_score AS path_score, p.success_count AS success_count, p.failure_count AS failure_count, p.last_used_at AS last_used_at ORDER BY p.path_score DESC LIMIT ${bounded}`,
  )
  return result.rows.map((row) => ({
    id: id(row),
    signature: text(row, 'signature'),
    pathScore: num(row, 'path_score', 0.5),
    successCount: num(row, 'success_count'),
    failureCount: num(row, 'failure_count'),
    lastUsedAt: text(row, 'last_used_at'),
  }))
}

const LEARNING_PROJECTION = [
  'l.id AS id',
  'l.external_id AS external_id',
  'l.update_type AS update_type',
  'l.before_state AS before_state',
  'l.after_state AS after_state',
  'l.reason AS reason',
  'l.created_at AS created_at',
  'l.status AS status',
  'l.edge_type AS edge_type',
  'l.edge_src AS edge_src',
  'l.edge_dst AS edge_dst',
  'l.confidence_delta AS confidence_delta',
  'l.reverted_at AS reverted_at',
].join(', ')

function toLearningUpdate(row: Record<string, unknown>): LearningUpdateRecord {
  return {
    id: id(row),
    externalId: text(row, 'external_id'),
    updateType: text(row, 'update_type'),
    beforeState: text(row, 'before_state'),
    afterState: text(row, 'after_state'),
    reason: text(row, 'reason'),
    createdAt: text(row, 'created_at'),
    status: text(row, 'status'),
    edgeType: text(row, 'edge_type'),
    edgeSrc: text(row, 'edge_src'),
    edgeDst: text(row, 'edge_dst'),
    confidenceDelta: num(row, 'confidence_delta'),
    revertedAt: text(row, 'reverted_at'),
  }
}

export async function listLearningUpdates(limit = 100): Promise<LearningUpdateRecord[]> {
  const bounded = Math.min(Math.max(limit, 1), 200)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (l:LearningUpdate) RETURN ${LEARNING_PROJECTION} ORDER BY l.created_at DESC LIMIT ${bounded}`,
  )
  return result.rows.map(toLearningUpdate)
}

export async function feedbackExists(requestKey: string): Promise<boolean> {
  // Feedback nodes are keyed by `feedback/<requestKey>` so the request key cannot
  // collide with another entity's external id.
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (f:Feedback {external_id: $externalId}) RETURN f.id AS id LIMIT 1`,
    { externalId: `feedback/${requestKey}` },
  )
  return result.rows.length > 0
}

export async function getLearningUpdate(externalId: string): Promise<LearningUpdateRecord | null> {
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (l:LearningUpdate {external_id: $externalId}) RETURN ${LEARNING_PROJECTION} LIMIT 1`,
    { externalId },
  )
  return result.rows[0] ? toLearningUpdate(result.rows[0]) : null
}

/** Readable identity for a vertex discovered through traversal. */
export async function getNodeIdentity(
  nodeId: number,
  label: GraphLabel,
): Promise<{ externalId: string; name: string } | null> {
  const node = await getNode(nodeId, label)
  if (!node) return null
  const externalId = typeof node.properties.external_id === 'string' ? node.properties.external_id : ''
  const name =
    (typeof node.properties.name === 'string' && node.properties.name) ||
    (typeof node.properties.version === 'string' && node.properties.version) ||
    (typeof node.properties.signature === 'string' && node.properties.signature) ||
    externalId
  return { externalId, name }
}

export interface EvaluationRunRecord {
  id: number
  externalId: string
  engine: string
  round: string
  split: string
  datasetVersion: string
  startedAt: string
  completedAt: string
  caseCount: number
  metrics: {
    top1Accuracy: number
    recallAt3: number
    evidencePrecision: number
    evidenceRecall: number
    falsePositiveRate: number
    meanLatencyMs: number
    traversalEfficiency: number
  }
  cases: unknown[]
}

export async function listEvaluationRuns(limit = 30): Promise<EvaluationRunRecord[]> {
  const bounded = Math.min(Math.max(limit, 1), 100)
  const result = await graphClient().query<Record<string, unknown>>(
    `MATCH (e:EvaluationRun) RETURN e.id AS id, e.external_id AS external_id, e.engine AS engine, e.round AS round, e.split AS split, e.dataset_version AS dataset_version, e.started_at AS started_at, e.completed_at AS completed_at, e.case_count AS case_count, e.top1_accuracy AS top1_accuracy, e.recall_at_3 AS recall_at_3, e.evidence_precision AS evidence_precision, e.evidence_recall AS evidence_recall, e.false_positive_rate AS false_positive_rate, e.mean_latency_ms AS mean_latency_ms, e.traversal_efficiency AS traversal_efficiency, e.detail AS detail ORDER BY e.completed_at DESC LIMIT ${bounded}`,
  )
  return result.rows.map((row) => {
    let cases: unknown[] = []
    try {
      const parsed = JSON.parse(text(row, 'detail') || '[]') as unknown
      cases = Array.isArray(parsed) ? parsed : []
    } catch {
      cases = []
    }
    return {
      id: id(row),
      externalId: text(row, 'external_id'),
      engine: text(row, 'engine'),
      round: text(row, 'round'),
      split: text(row, 'split'),
      datasetVersion: text(row, 'dataset_version'),
      startedAt: text(row, 'started_at'),
      completedAt: text(row, 'completed_at'),
      caseCount: num(row, 'case_count'),
      metrics: {
        top1Accuracy: num(row, 'top1_accuracy'),
        recallAt3: num(row, 'recall_at_3'),
        evidencePrecision: num(row, 'evidence_precision'),
        evidenceRecall: num(row, 'evidence_recall'),
        falsePositiveRate: num(row, 'false_positive_rate'),
        meanLatencyMs: num(row, 'mean_latency_ms'),
        traversalEfficiency: num(row, 'traversal_efficiency'),
      },
      cases,
    }
  })
}

export function propertiesFromRow(
  row: Record<string, unknown>,
  keys: string[],
): PropertyMap {
  const properties: PropertyMap = {}
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      properties[key] = value
    }
  }
  return properties
}
