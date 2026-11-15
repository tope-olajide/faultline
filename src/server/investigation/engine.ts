import { demoEntityId } from '../graph/ids'
import { demoScope } from '../config'
import {
  getAffectedServices,
  getDependencyEdges,
  getDeploymentsForService,
  getEvidenceForCause,
  getEvidenceForIncident,
  getIncident,
  getNodeIdentity,
  getPathTemplate,
  type DependencyEdge,
  type EvidenceRecord,
  type IncidentRecord,
  type ServiceRecord,
} from '../graph/reads'
import { upsertEdges, upsertNodes } from '../graph/repository'
import type { GraphLabel, RelationshipType } from '../graph/schema'
import { isCurrent } from '../graph/temporal'
import { findSimilarIncidents, type SimilarIncident } from './similar'
import { incidentSignalClass } from './signal'

/**
 * Evidence-first investigation engine.
 *
 * The investigator is deterministic: it reads the real HydraDB graph, enumerates
 * candidate causes along bounded dependency paths, attaches only evidence that is
 * actually linked to those entities, and ranks the candidates with an explicit
 * score. No language model is asked to invent a cause, and no ground-truth label
 * is read.
 *
 * The only learned inputs are:
 *   - the live edge reliability (`confidence_score`, mutated by feedback), and
 *   - the utility of the path signature that produced the evidence
 *     (`PathTemplate.path_score`).
 *
 * A `baseline` run ignores both and uses the frozen `baseline_confidence`, which
 * is what the fixed-graph evaluation baseline measures.
 */

export const ENGINE_VERSION = 'faultline-investigator/1.0.0'
export const PROMPT_VERSION = 'deterministic-graph-v1'

const MAX_DEPTH = 3
const MAX_CANDIDATES = 10

/** Base informativeness of each normalized evidence type. */
const EVIDENCE_TYPE_WEIGHT: Record<string, number> = {
  metric_anomaly: 1,
  log_pattern: 1,
  trace_excerpt: 0.98,
  deployment_correlation: 0.95,
  config_change: 0.9,
  kubernetes_observation: 0.9,
  metric_summary: 0.7,
}

const SCORE = {
  evidence: 0.5,
  edge: 0.2,
  path: 0.3,
}

export type InvestigationMode = 'learned' | 'baseline'

export interface CausalStep {
  type: RelationshipType
  fromLabel: string
  fromId: number
  fromName: string
  toLabel: string
  toId: number
  toName: string
  confidence: number
}

export interface EvidenceView {
  id: number
  externalId: string
  evidenceType: string
  source: string
  summary: string
  observedAt: string
  reliability: number
  polarity: 'supports' | 'contradicts' | 'neutral'
  objectUri: string
}

export interface CauseEdgeView {
  src: number
  dst: number
  type: RelationshipType
  confidence: number
  baseline: number
  support: number
  contradiction: number
  verificationState: string
}

export interface HypothesisView {
  externalId: string
  rank: number
  statement: string
  status: 'Candidate' | 'Likely'
  confidence: number
  confidenceType: 'uncalibrated_relative_score'
  causeLabel: GraphLabel
  causeExternalId: string
  causeName: string
  serviceName: string
  serviceExternalId: string
  pathSignature: string
  path: CausalStep[]
  causeEdge: CauseEdgeView | null
  evidence: EvidenceView[]
  contradicting: EvidenceView[]
  pathTemplateScore: number
  rationale: string
  nextCheck: string
}

export interface BlastRadiusEntry {
  id: number
  name: string
  depth: number
}

export interface TimelineEntry {
  at: string
  label: string
  kind: 'incident' | 'evidence' | 'deployment' | 'finding'
}

export interface InvestigationResult {
  incident: IncidentRecord
  affectedServices: ServiceRecord[]
  hypotheses: HypothesisView[]
  observedFacts: string[]
  unknowns: string[]
  blastRadius: BlastRadiusEntry[]
  timeline: TimelineEntry[]
  similarIncidents: SimilarIncident[]
  engineVersion: string
  promptVersion: string
  mode: InvestigationMode
  generatedAt: string
  durationMs: number
  stats: {
    nodesVisited: number
    edgesTraversed: number
    evidenceConsidered: number
    candidates: number
  }
  limitation: string
}

interface Candidate {
  label: GraphLabel
  id: number
  name: string
  externalId: string
  service: ServiceRecord
  path: CausalStep[]
  causeEdge: DependencyEdge | null
  depth: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function evidenceWeight(evidenceType: string): number {
  return EVIDENCE_TYPE_WEIGHT[evidenceType] ?? 0.6
}

/** Recency of an observation relative to incident onset, capped and floored. */
function freshness(observedAt: string, incidentStart: string): number {
  const observed = new Date(observedAt).getTime()
  const start = new Date(incidentStart).getTime()
  if (Number.isNaN(observed) || Number.isNaN(start)) return 0.6
  const hoursBefore = (start - observed) / 3_600_000
  if (hoursBefore <= 0) return 1
  return clamp(1 - hoursBefore / 48, 0.15, 1)
}

function toEvidenceView(evidence: EvidenceRecord): EvidenceView {
  const polarity =
    evidence.polarity === 'contradicts' || evidence.polarity === 'neutral' ? evidence.polarity : 'supports'
  return {
    id: evidence.id,
    externalId: evidence.externalId,
    evidenceType: evidence.evidenceType,
    source: evidence.source,
    summary: evidence.summary,
    observedAt: evidence.observedAt,
    reliability: evidence.reliability,
    polarity,
    objectUri: evidence.objectUri,
  }
}

function dominantEvidenceType(evidence: EvidenceRecord[]): string {
  let best = 'none'
  let bestScore = -1
  for (const item of evidence) {
    const score = item.reliability * evidenceWeight(item.evidenceType)
    if (score > bestScore) {
      bestScore = score
      best = item.evidenceType
    }
  }
  return best
}

/**
 * Path-template signature: the causal entity class, the relationship sequence
 * that connects it to the affected service, and the evidence class that pointed
 * at it. This is what makes a learned path reusable across *different* incidents
 * from the same failure family without encoding any incident-specific detail.
 */
export { incidentSignalClass }

export function pathSignature(
  signalClass: string,
  causeLabel: string,
  path: CausalStep[],
  evidenceType: string,
): string {
  const relTypes = path.map((step) => step.type).join('>')
  return `${signalClass}|${causeLabel}:${relTypes}:${evidenceType}`
}

async function discoverCandidates(
  services: ServiceRecord[],
  incident: IncidentRecord,
): Promise<{ candidates: Candidate[]; edges: DependencyEdge[]; deployments: number }> {
  const edges = await getDependencyEdges()
  const adjacency = new Map<number, DependencyEdge[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.src) ?? []
    list.push(edge)
    adjacency.set(edge.src, list)
  }

  const candidates = new Map<string, Candidate>()
  let deploymentCount = 0

  const addCandidate = (candidate: Candidate) => {
    const key = `${candidate.label}:${candidate.id}`
    const existing = candidates.get(key)
    if (!existing || candidate.path.length < existing.path.length) candidates.set(key, candidate)
  }

  for (const service of services) {
    if (!service.externalId) continue

    // Breadth-first over DEPENDS_ON, bounded in both depth and fan-out.
    const queue: Array<{ id: number; name: string; path: CausalStep[]; depth: number }> = [
      { id: service.id, name: service.name, path: [], depth: 0 },
    ]
    const visited = new Set<number>([service.id])

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || current.depth >= MAX_DEPTH) continue
      for (const edge of adjacency.get(current.id) ?? []) {
        if (visited.has(edge.dst)) continue
        if (!isCurrent(edge.validFrom, edge.validTo, incident.startedAt)) continue
        visited.add(edge.dst)

        const step: CausalStep = {
          type: 'DEPENDS_ON',
          fromLabel: 'Service',
          fromId: current.id,
          fromName: current.name,
          toLabel: edge.dstLabel,
          toId: edge.dst,
          toName: edge.dstName,
          confidence: edge.confidence,
        }
        const path = [...current.path, step]

        const identity = await getNodeIdentity(edge.dst, edge.dstLabel)
        addCandidate({
          label: edge.dstLabel,
          id: edge.dst,
          name: identity?.name ?? edge.dstName,
          externalId: identity?.externalId ?? `${edge.dstLabel}/${edge.dst}`,
          service,
          path,
          causeEdge: edge,
          depth: path.length,
        })

        if (edge.dstLabel === 'Service') {
          queue.push({ id: edge.dst, name: edge.dstName, path, depth: current.depth + 1 })
        }
      }
    }

    // Recent deployments are candidate causes too, linked by DEPLOYS (incoming).
    const deployments = await getDeploymentsForService(service.id)
    deploymentCount += deployments.length
    for (const deployment of deployments) {
      addCandidate({
        label: 'Deployment',
        id: deployment.id,
        name: deployment.version || deployment.externalId,
        externalId: deployment.externalId,
        service,
        path: [
          {
            type: 'DEPLOYS',
            fromLabel: 'Deployment',
            fromId: deployment.id,
            fromName: deployment.version || deployment.externalId,
            toLabel: 'Service',
            toId: service.id,
            toName: service.name,
            confidence: 0.95,
          },
        ],
        causeEdge: {
          type: 'DEPLOYS',
          src: deployment.id,
          srcName: deployment.version || deployment.externalId,
          dst: service.id,
          dstLabel: 'Service',
          dstName: service.name,
          confidence: 0.95,
          baseline: 0.95,
          support: 2,
          contradiction: 0,
          source: 'github-deployments',
          verificationState: 'verified',
          validFrom: '',
          validTo: '',
        },
        depth: 1,
      })
    }
  }

  const ranked = [...candidates.values()]
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth
      const priority = (label: string) =>
        label === 'Database' ? 0 : label === 'Cache' ? 1 : label === 'Queue' ? 2 : label === 'Deployment' ? 3 : 4
      return priority(a.label) - priority(b.label)
    })
    .slice(0, MAX_CANDIDATES)

  return { candidates: ranked, edges, deployments: deploymentCount }
}

export interface CandidateCause {
  label: GraphLabel
  id: number
  externalId: string
  name: string
  serviceExternalId: string
  serviceName: string
}

/**
 * Enumerate the answer universe for an incident without ranking it.
 * The vector baseline uses this to know which causes exist; it scores them with
 * text similarity only and never reads edge reliability or path templates.
 */
export async function listCandidateCauses(incidentId: number): Promise<CandidateCause[]> {
  const incident = await getIncident(incidentId)
  if (!incident) throw new Error(`Incident ${incidentId} not found`)
  const services = await getAffectedServices(incidentId)
  const { candidates } = await discoverCandidates(services, incident)
  return candidates.map((candidate) => ({
    label: candidate.label,
    id: candidate.id,
    externalId: candidate.externalId,
    name: candidate.name,
    serviceExternalId: candidate.service.externalId,
    serviceName: candidate.service.name,
  }))
}

/** Reverse reachability over DEPENDS_ON: who is affected if this service fails. */
export function computeBlastRadius(
  services: ServiceRecord[],
  edges: DependencyEdge[],
): BlastRadiusEntry[] {
  const serviceIds = services.map((service) => service.id)
  const dependents = new Map<number, DependencyEdge[]>()
  for (const edge of edges) {
    if (edge.dstLabel !== 'Service') continue
    const list = dependents.get(edge.dst) ?? []
    list.push(edge)
    dependents.set(edge.dst, list)
  }

  const seen = new Map<number, BlastRadiusEntry>()
  for (const service of services) {
    seen.set(service.id, { id: service.id, name: service.name, depth: 0 })
  }
  const queue = serviceIds.map((id) => ({ id, depth: 0 }))
  const visited = new Set(serviceIds)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || current.depth >= 3) continue
    for (const edge of dependents.get(current.id) ?? []) {
      if (visited.has(edge.src)) continue
      visited.add(edge.src)
      const depth = current.depth + 1
      seen.set(edge.src, { id: edge.src, name: edge.srcName, depth })
      queue.push({ id: edge.src, depth })
    }
  }

  return [...seen.values()].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
}

function buildRationale(
  candidate: Candidate,
  evidence: EvidenceRecord[],
  contradicting: EvidenceRecord[],
  edge: CauseEdgeView | null,
  templateScore: number,
  mode: InvestigationMode,
): string {
  const parts: string[] = []

  if (candidate.path.length === 1) {
    parts.push(
      `${candidate.service.name} has a direct ${candidate.path[0].type} relationship to ${candidate.name}.`,
    )
  } else {
    parts.push(
      `${candidate.name} is reachable from ${candidate.service.name} through a ${candidate.path.length}-hop dependency path (${candidate.path
        .map((step) => `${step.fromName} → ${step.toName}`)
        .join(' → ')}).`,
    )
  }

  if (evidence.length > 0) {
    const strongest = [...evidence]
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 2)
      .map((item) => `${item.evidenceType.replace(/_/g, ' ')} from ${item.source}`)
      .join(' and ')
    parts.push(`Supporting evidence: ${strongest}.`)
  } else {
    parts.push('No evidence in the graph is attributed to this entity yet.')
  }

  if (edge) {
    const used = mode === 'learned' ? edge.confidence : edge.baseline
    parts.push(
      `Relationship reliability ${used.toFixed(2)} (support ${edge.support}, contradictions ${edge.contradiction}).`,
    )
  }

  if (templateScore > 0) {
    parts.push(`A learned path template with the same signature scores ${templateScore.toFixed(2)}.`)
  }

  if (contradicting.length > 0) {
    parts.push(
      `${contradicting.length} observation${contradicting.length === 1 ? '' : 's'} contradict this explanation.`,
    )
  }

  return parts.join(' ')
}

function buildNextCheck(
  candidate: Candidate,
  evidence: EvidenceRecord[],
  contradicting: EvidenceRecord[],
): string {
  const types = new Set(evidence.map((item) => item.evidenceType))
  if (!types.has('trace_excerpt')) {
    return `Capture a trace through ${candidate.service.name} that includes the ${candidate.name} span.`
  }
  if (!types.has('metric_anomaly')) {
    return `Pull the saturation metric for ${candidate.name} over the incident window and the preceding baseline.`
  }
  if (contradicting.length > 0) {
    return `Reconcile the contradictory observation before confirming ${candidate.name} as the cause.`
  }
  const edge = candidate.causeEdge
  if (edge && edge.confidence < 0.8) {
    return `Verify the ${edge.srcName} → ${edge.dstName} dependency with a config or network-flow check.`
  }
  return `Compare ${candidate.name} saturation before and after ${candidate.service.name} onset to confirm the timing.`
}

export interface InvestigateOptions {
  mode?: InvestigationMode
  persist?: boolean
}

export async function investigateIncident(
  incidentId: number,
  options: InvestigateOptions = {},
): Promise<InvestigationResult> {
  const started = Date.now()
  const mode: InvestigationMode = options.mode ?? 'learned'
  const incident = await getIncident(incidentId)
  if (!incident) throw new Error(`Incident ${incidentId} not found`)

  const affectedServices = await getAffectedServices(incidentId)
  const { candidates, edges, deployments } = await discoverCandidates(affectedServices, incident)

  // Evidence only counts if it is connected to *this* incident. Without this,
  // one shared graph would let evidence from a different incident inflate a
  // candidate that appears in several failure families.
  const incidentEvidence = await getEvidenceForIncident(incidentId)
  const incidentEvidenceIds = new Set(incidentEvidence.map((item) => item.id))

  const allEvidence: EvidenceRecord[] = []
  const hypotheses: HypothesisView[] = []

  for (const candidate of candidates) {
    const attached = (await getEvidenceForCause(candidate.label, candidate.id)).filter((item) =>
      incidentEvidenceIds.has(item.id),
    )
    allEvidence.push(...attached)

    const supporting = attached.filter((item) => item.polarity !== 'contradicts')
    const contradicting = attached.filter((item) => item.polarity === 'contradicts')

    let support = 0
    for (const item of supporting) {
      support += item.reliability * evidenceWeight(item.evidenceType) * freshness(item.observedAt, incident.startedAt)
    }
    let contradictionSupport = 0
    for (const item of contradicting) {
      contradictionSupport +=
        item.reliability * evidenceWeight(item.evidenceType) * freshness(item.observedAt, incident.startedAt)
    }

    const evidenceScore = support / (support + 1.2)
    const contradictionPenalty = Math.min(0.45, contradictionSupport * 0.3)

    const edge = candidate.causeEdge
    const edgeScore = edge ? (mode === 'learned' ? edge.confidence : edge.baseline) : 0.35

    const signature = pathSignature(
      incidentSignalClass(incident),
      candidate.label,
      candidate.path,
      dominantEvidenceType(attached),
    )
    const template = mode === 'learned' ? await getPathTemplate(signature) : null
    const templateScore = template ? template.pathScore : 0

    const raw =
      SCORE.evidence * evidenceScore +
      SCORE.edge * edgeScore +
      SCORE.path * templateScore -
      contradictionPenalty
    const confidence = round(clamp(0.05 + 0.92 * raw, 0.05, 0.96))

    const causeEdge: CauseEdgeView | null = edge
      ? {
          src: edge.src,
          dst: edge.dst,
          type: edge.type,
          confidence: edge.confidence,
          baseline: edge.baseline,
          support: edge.support,
          contradiction: edge.contradiction,
          verificationState: edge.verificationState,
        }
      : null

    hypotheses.push({
      externalId: `hypothesis/${incident.externalId}/${candidate.externalId}`,
      rank: 0,
      statement: `${candidate.name} explains the ${incident.family || 'incident'} symptoms observed by ${candidate.service.name}`,
      status: confidence >= 0.68 ? 'Likely' : 'Candidate',
      confidence,
      confidenceType: 'uncalibrated_relative_score',
      causeLabel: candidate.label,
      causeExternalId: candidate.externalId,
      causeName: candidate.name,
      serviceName: candidate.service.name,
      serviceExternalId: candidate.service.externalId,
      pathSignature: signature,
      path: candidate.path,
      causeEdge,
      evidence: supporting.map(toEvidenceView),
      contradicting: contradicting.map(toEvidenceView),
      pathTemplateScore: round(templateScore),
      rationale: buildRationale(candidate, supporting, contradicting, causeEdge, templateScore, mode),
      nextCheck: buildNextCheck(candidate, supporting, contradicting),
    })
  }

  hypotheses.sort((a, b) => b.confidence - a.confidence || a.causeName.localeCompare(b.causeName))
  hypotheses.forEach((hypothesis, index) => {
    hypothesis.rank = index + 1
  })

  const blastRadius = computeBlastRadius(affectedServices, edges)
  const similarIncidents = await findSimilarIncidents(incident)

  const observedFacts = incidentEvidence
    .slice(0, 6)
    .map((item) => `${item.evidenceType.replace(/_/g, ' ')} · ${item.source}: ${item.summary}`)

  const collectedTypes = new Set(allEvidence.map((item) => item.evidenceType))
  const unknowns: string[] = []
  if (!collectedTypes.has('trace_excerpt')) {
    unknowns.push('No trace evidence is attached to the candidate causes; span-level timing is unverified.')
  }
  if (!collectedTypes.has('metric_anomaly')) {
    unknowns.push('No metric anomaly is linked to the candidate causes; saturation cannot be confirmed.')
  }
  if (deployments === 0) {
    unknowns.push('No deployment is linked to the affected services, so change correlation is unavailable.')
  }
  if (hypotheses.length > 1 && hypotheses[0].confidence - hypotheses[1].confidence < 0.08) {
    unknowns.push(
      `The top two explanations are within ${(hypotheses[0].confidence - hypotheses[1].confidence).toFixed(
        2,
      )} confidence, so the evidence does not separate them yet.`,
    )
  }
  if (hypotheses[0] && hypotheses[0].confidence < 0.5) {
    unknowns.push('Overall evidence is thin; treat the ranking as provisional.')
  }

  const timelineEntries: TimelineEntry[] = [
    { at: incident.startedAt, label: 'Incident started', kind: 'incident' },
    ...(incident.detectedAt && incident.detectedAt !== incident.startedAt
      ? [{ at: incident.detectedAt, label: 'Incident detected', kind: 'incident' as const }]
      : []),
    ...incidentEvidence.map(
      (item): TimelineEntry => ({
        at: item.observedAt,
        label: `${item.evidenceType.replace(/_/g, ' ')} · ${item.source}`,
        kind: 'evidence',
      }),
    ),
    ...candidates
      .filter((candidate) => candidate.label === 'Deployment')
      .map(
        (candidate): TimelineEntry => ({
          at: incident.startedAt,
          label: `Deployment candidate: ${candidate.name}`,
          kind: 'deployment',
        }),
      ),
  ]
  const timeline = timelineEntries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  const summary =
    hypotheses.length === 0
      ? 'No candidate causes were found in the graph for the affected services.'
      : `${hypotheses[0].causeName} is the leading explanation (${hypotheses[0].confidence.toFixed(
          2,
        )} relative confidence) for ${incident.title}.`

  const result: InvestigationResult = {
    incident,
    affectedServices,
    hypotheses,
    observedFacts,
    unknowns,
    blastRadius,
    timeline,
    similarIncidents,
    engineVersion: ENGINE_VERSION,
    promptVersion: PROMPT_VERSION,
    mode,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    stats: {
      nodesVisited: affectedServices.length + candidates.length + allEvidence.length,
      edgesTraversed: edges.length,
      evidenceConsidered: allEvidence.length,
      candidates: candidates.length,
    },
    limitation:
      'Confidence is an uncalibrated relative score derived from graph structure, evidence reliability and learned path utility. It is not a probability.',
  }

  if (options.persist !== false) {
    await persistInvestigation(result)
  }

  return result
}

/** Persist the investigation, its hypotheses and their evidence links. */
async function persistInvestigation(result: InvestigationResult): Promise<void> {
  const scope = demoScope
  const incidentNodeId = result.incident.id
  const investigationExternalId = `investigation/${result.incident.externalId}`
  const investigationId = demoEntityId('Investigation', investigationExternalId, scope)

  await upsertNodes(
    [
      {
        label: 'Investigation',
        externalId: investigationExternalId,
        properties: {
          incident_external_id: result.incident.externalId,
          started_at: result.generatedAt,
          completed_at: result.generatedAt,
          status: result.hypotheses[0] && result.hypotheses[0].confidence >= 0.5 ? 'completed' : 'completed_with_uncertainty',
          engine_version: result.engineVersion,
          prompt_version: result.promptVersion,
          summary: result.hypotheses[0]
            ? `Leading cause: ${result.hypotheses[0].causeName} (${result.hypotheses[0].confidence.toFixed(2)})`
            : 'No candidate causes found',
          unknowns: JSON.stringify(result.unknowns),
          duration_ms: result.durationMs,
        },
      },
      ...result.hypotheses.map((hypothesis) => ({
        label: 'Hypothesis' as const,
        externalId: hypothesis.externalId,
        properties: {
          statement: hypothesis.statement,
          status: hypothesis.status,
          rank: hypothesis.rank,
          confidence: hypothesis.confidence,
          confidence_type: hypothesis.confidenceType,
          created_at: result.generatedAt,
          next_check: hypothesis.nextCheck,
          rationale: hypothesis.rationale,
          cause_external_id: hypothesis.causeExternalId,
          cause_label: hypothesis.causeLabel,
          path_signature: hypothesis.pathSignature,
          evidence_count: hypothesis.evidence.length,
          contradiction_count: hypothesis.contradicting.length,
        },
      })),
    ],
    scope,
  )

  const edges: Array<{
    type: RelationshipType
    src: number
    dst: number
  }> = [
    { type: 'INVESTIGATED_IN', src: incidentNodeId, dst: investigationId },
  ]

  for (const hypothesis of result.hypotheses) {
    const hypothesisId = demoEntityId('Hypothesis', hypothesis.externalId, scope)
    edges.push({ type: 'INVESTIGATED_IN', src: hypothesisId, dst: investigationId })
    edges.push({
      type: 'POSSIBLY_CAUSED_BY',
      src: hypothesisId,
      dst: demoEntityId(hypothesis.causeLabel, hypothesis.causeExternalId, scope),
    })
    for (const evidence of hypothesis.evidence.slice(0, 6)) {
      edges.push({ type: 'SUPPORTS', src: evidence.id, dst: hypothesisId })
    }
    for (const evidence of hypothesis.contradicting.slice(0, 6)) {
      edges.push({ type: 'CONTRADICTS', src: evidence.id, dst: hypothesisId })
    }
  }

  await upsertEdges(edges, scope)
}
