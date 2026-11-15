import { demoEntityId } from '../graph/ids'
import { demoScope } from '../config'
import { upsertNodes } from '../graph/repository'
import {
  getAllEvidence,
  getEvidenceAttributions,
  listIncidents,
  type IncidentRecord,
} from '../graph/reads'
import {
  investigateIncident,
  listCandidateCauses,
  type InvestigationMode,
  type InvestigationResult,
} from '../investigation/engine'
import { applyFeedback } from '../learning/engine'
import { DATASET_VERSION, type BenchmarkSplit } from '../graph/benchmark'

/**
 * Evaluation laboratory.
 *
 * Three engines are measured on the same held-out incidents:
 *
 *   vector-only   — TF-IDF cosine over evidence summaries; no graph traversal or
 *                   edge statistics.
 *   fixed-graph   — bounded traversal ranked with the frozen baseline edge
 *                   reliability; learning is ignored.
 *   adaptive-graph— the same traversal ranked with live edge reliability plus
 *                   learned path-template utility.
 *
 * All three share the candidate universe, the evidence corpus and the metric
 * definitions. Nothing is trained on the held-out split. Metrics are computed
 * from actual retrieval output; the evaluator never substitutes a target number.
 */

export type EngineName = 'vector' | 'fixed-graph' | 'adaptive-graph'

export interface Metrics {
  top1Accuracy: number
  recallAt3: number
  evidencePrecision: number
  evidenceRecall: number
  falsePositiveRate: number
  meanLatencyMs: number
  traversalEfficiency: number
  caseCount: number
}

export interface CaseOutcome {
  incidentId: string
  title: string
  family: string
  truthCause: string
  ranked: Array<{ cause: string; score: number }>
  top1: boolean
  recall3: boolean
  evidencePrecision: number
  evidenceRecall: number
  latencyMs: number
  nodesVisited: number
}

export interface EvaluationRun {
  externalId: string
  engine: EngineName
  round: string
  split: BenchmarkSplit
  metrics: Metrics
  cases: CaseOutcome[]
  startedAt: string
  completedAt: string
}

export interface ExperimentResult {
  baseline: EvaluationRun[]
  afterLearning: EvaluationRun[]
  training: {
    cases: number
    confirmed: number
    confirmedPathTemplates: string[]
  }
  improvement: {
    top1Delta: number
    recallDelta: number
    evidencePrecisionDelta: number
  }
  honestNote: string
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'was', 'were', 'are', 'has', 'have',
  'had', 'its', 'into', 'during', 'after', 'before', 'while', 'when', 'than', 'then', 'over',
  'under', 'above', 'below', 'per', 'via', 'not', 'but', 'all', 'any', 'can', 'may', 'also',
  'service', 'checkout', 'incident', 'window', 'same', 'rose', 'increased',
])

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? []
  return matches.filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  const length = tokens.length || 1
  const tf = new Map<string, number>()
  for (const [token, count] of counts) tf.set(token, count / length)
  return tf
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const value of a.values()) normA += value * value
  for (const value of b.values()) normB += value * value
  for (const [token, value] of a) {
    const other = b.get(token)
    if (other) dot += value * other
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

interface VectorRanking {
  ranked: Array<{ causeExternalId: string; score: number; evidenceIds: string[] }>
  nodesVisited: number
  latencyMs: number
}

/**
 * Vector-only baseline: rank evidence chunks by TF-IDF cosine similarity to the
 * incident description, then attribute the best chunk to its cause entity.
 * No edge confidence, path template or graph traversal is consulted.
 */
async function vectorRanking(incident: IncidentRecord): Promise<VectorRanking> {
  const started = Date.now()
  const corpus = await getAllEvidence(300)
  const candidates = await listCandidateCauses(incident.id)
  const attributions = await getEvidenceAttributions()

  const evidenceById = new Map(corpus.map((item) => [item.id, item]))
  const docs = corpus.map((item) => termFrequency(tokenize(item.summary)))
  const queryTokens = tokenize(`${incident.title} ${incident.summary} ${incident.impact}`)

  const df = new Map<string, number>()
  for (const doc of docs) {
    for (const token of doc.keys()) df.set(token, (df.get(token) ?? 0) + 1)
  }
  const total = docs.length || 1
  const idf = new Map<string, number>()
  for (const [token, count] of df) idf.set(token, Math.log((1 + total) / (1 + count)) + 1)

  const applyIdf = (tf: Map<string, number>) => {
    const weighted = new Map<string, number>()
    for (const [token, value] of tf) weighted.set(token, value * (idf.get(token) ?? 1))
    return weighted
  }

  const query = applyIdf(termFrequency(queryTokens))
  const similarities = new Map<number, number>()
  corpus.forEach((item, index) => {
    similarities.set(item.id, cosine(query, applyIdf(docs[index])))
  })

  const ranked = candidates
    .map((candidate) => {
      const attached = attributions.get(candidate.id) ?? []
      const evidenceIds: string[] = []
      let best = 0
      for (const evidenceId of attached) {
        const evidence = evidenceById.get(evidenceId)
        if (!evidence) continue
        const similarity = similarities.get(evidenceId) ?? 0
        if (similarity > best) best = similarity
        if (similarity > 0.05) evidenceIds.push(evidence.externalId)
      }
      return { causeExternalId: candidate.externalId, score: Math.round(best * 1000) / 1000, evidenceIds }
    })
    .sort((a, b) => b.score - a.score)

  return { ranked, nodesVisited: corpus.length + candidates.length, latencyMs: Date.now() - started }
}

interface GraphRanking {
  ranked: Array<{ causeExternalId: string; score: number; evidenceIds: string[] }>
  nodesVisited: number
  latencyMs: number
  investigation: InvestigationResult
}

async function graphRanking(
  incident: IncidentRecord,
  mode: InvestigationMode,
): Promise<GraphRanking> {
  const investigation = await investigateIncident(incident.id, { mode, persist: false })
  return {
    ranked: investigation.hypotheses.map((hypothesis) => ({
      causeExternalId: hypothesis.causeExternalId,
      score: hypothesis.confidence,
      evidenceIds: hypothesis.evidence.map((item) => item.externalId),
    })),
    nodesVisited: investigation.stats.nodesVisited,
    latencyMs: investigation.durationMs,
    investigation,
  }
}

function relevantEvidence(incident: IncidentRecord): string[] {
  return incident.groundTruthEvidence
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function scoreCase(
  incident: IncidentRecord,
  ranking: { ranked: Array<{ causeExternalId: string; score: number; evidenceIds: string[] }>; nodesVisited: number; latencyMs: number },
): CaseOutcome {
  const truth = incident.groundTruthCause
  const relevant = relevantEvidence(incident)
  const top = ranking.ranked[0]
  const retrieved = top?.evidenceIds ?? []
  const relevantRetrieved = retrieved.filter((id) => relevant.includes(id))

  const precision = retrieved.length > 0 ? relevantRetrieved.length / retrieved.length : 0
  const recall = relevant.length > 0 ? relevantRetrieved.length / relevant.length : 0

  return {
    incidentId: incident.externalId,
    title: incident.title,
    family: incident.family,
    truthCause: truth,
    ranked: ranking.ranked.slice(0, 5).map((entry) => ({ cause: entry.causeExternalId, score: entry.score })),
    top1: top?.causeExternalId === truth,
    recall3: ranking.ranked.slice(0, 3).some((entry) => entry.causeExternalId === truth),
    evidencePrecision: Math.round(precision * 1000) / 1000,
    evidenceRecall: Math.round(recall * 1000) / 1000,
    latencyMs: Math.round(ranking.latencyMs),
    nodesVisited: ranking.nodesVisited,
  }
}

function aggregate(cases: CaseOutcome[]): Metrics {
  const count = cases.length || 1
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / count
  const precision = mean(cases.map((entry) => entry.evidencePrecision))
  return {
    top1Accuracy: Math.round((cases.filter((entry) => entry.top1).length / count) * 1000) / 1000,
    recallAt3: Math.round((cases.filter((entry) => entry.recall3).length / count) * 1000) / 1000,
    evidencePrecision: Math.round(precision * 1000) / 1000,
    evidenceRecall: Math.round(mean(cases.map((entry) => entry.evidenceRecall)) * 1000) / 1000,
    falsePositiveRate: Math.round((1 - precision) * 1000) / 1000,
    meanLatencyMs: Math.round(mean(cases.map((entry) => entry.latencyMs))),
    traversalEfficiency:
      Math.round(
        mean(
          cases.map((entry) => (entry.evidenceRecall * 100) / Math.max(1, entry.nodesVisited)),
        ) * 1000,
      ) / 1000,
    caseCount: cases.length,
  }
}

async function persistRun(run: EvaluationRun): Promise<void> {
  await upsertNodes(
    [
      {
        label: 'EvaluationRun',
        externalId: run.externalId,
        properties: {
          round: run.round,
          engine: run.engine,
          dataset_version: DATASET_VERSION,
          split: run.split,
          started_at: run.startedAt,
          completed_at: run.completedAt,
          top1_accuracy: run.metrics.top1Accuracy,
          recall_at_3: run.metrics.recallAt3,
          evidence_precision: run.metrics.evidencePrecision,
          evidence_recall: run.metrics.evidenceRecall,
          false_positive_rate: run.metrics.falsePositiveRate,
          mean_latency_ms: run.metrics.meanLatencyMs,
          traversal_efficiency: run.metrics.traversalEfficiency,
          case_count: run.metrics.caseCount,
          detail: JSON.stringify(run.cases),
        },
      },
    ],
    demoScope,
  )
}

async function evaluateEngine(
  engine: EngineName,
  round: string,
  split: BenchmarkSplit,
): Promise<EvaluationRun> {
  const startedAt = new Date().toISOString()
  const incidents = (await listIncidents(200)).filter((incident) => incident.benchmarkSplit === split)

  const cases: CaseOutcome[] = []
  for (const incident of incidents) {
    // R0 is the untrained round: the adaptive engine has no learned inputs yet,
    // so it must use frozen baseline reliability and no path templates. Using
    // live state here would let a second experiment run report a contaminated
    // "before learning" score.
    const graphMode = engine === 'fixed-graph' || round === 'R0' ? 'baseline' : 'learned'
    const ranking =
      engine === 'vector' ? await vectorRanking(incident) : await graphRanking(incident, graphMode)
    cases.push(scoreCase(incident, ranking))
  }

  const run: EvaluationRun = {
    externalId: `evaluation/${DATASET_VERSION}/${split}/${round}/${engine}`,
    engine,
    round,
    split,
    metrics: aggregate(cases),
    cases,
    startedAt,
    completedAt: new Date().toISOString(),
  }

  await persistRun(run)
  return run
}

/**
 * Learning round. Only the `train` split is used. For each training incident the
 * engine locates the ground-truth candidate in its own ranking and confirms the
 * relationship + path signature that produced it. No held-out incident is read.
 */
async function trainFromBenchmark(): Promise<{
  cases: number
  confirmed: number
  confirmedPathTemplates: string[]
}> {
  const incidents = (await listIncidents(200)).filter((incident) => incident.benchmarkSplit === 'train')
  let confirmed = 0
  const templates = new Set<string>()

  for (const incident of incidents) {
    const result = await investigateIncident(incident.id, { mode: 'learned', persist: false })
    const truth = result.hypotheses.find(
      (hypothesis) => hypothesis.causeExternalId === incident.groundTruthCause,
    )
    if (!truth || !truth.causeEdge) continue

    const feedback = await applyFeedback({
      requestKey: `auto-train/${incident.externalId}`,
      outcome: 'confirm',
      actorRef: 'evaluation/harness',
      reason: `Training label: ${incident.groundTruthCause} was the verified cause of ${incident.externalId}.`,
      incidentExternalId: incident.externalId,
      hypothesisExternalId: truth.externalId,
      edge: {
        src: truth.causeEdge.src,
        dst: truth.causeEdge.dst,
        type: truth.causeEdge.type,
      },
      pathSignature: truth.pathSignature,
    })

    if (feedback.applied) {
      confirmed += 1
      templates.add(truth.pathSignature)
    } else if (feedback.alreadyProcessed) {
      confirmed += 1
      templates.add(truth.pathSignature)
    } else {
      templates.add(truth.pathSignature)
    }
  }

  return { cases: incidents.length, confirmed, confirmedPathTemplates: [...templates] }
}

/**
 * Full reproducible experiment: measure the three engines, apply verified
 * learning from the training split only, then measure again on held-out cases.
 */
export async function runExperiment(): Promise<ExperimentResult> {
  const baseline = [
    await evaluateEngine('vector', 'R0', 'heldout'),
    await evaluateEngine('fixed-graph', 'R0', 'heldout'),
    await evaluateEngine('adaptive-graph', 'R0', 'heldout'),
  ]

  const training = await trainFromBenchmark()

  const afterLearning = [
    await evaluateEngine('vector', 'R1', 'heldout'),
    await evaluateEngine('fixed-graph', 'R1', 'heldout'),
    await evaluateEngine('adaptive-graph', 'R1', 'heldout'),
  ]

  const adaptiveBefore = baseline.find((run) => run.engine === 'adaptive-graph')?.metrics
  const adaptiveAfter = afterLearning.find((run) => run.engine === 'adaptive-graph')?.metrics

  const improvement = {
    top1Delta:
      Math.round(((adaptiveAfter?.top1Accuracy ?? 0) - (adaptiveBefore?.top1Accuracy ?? 0)) * 1000) / 1000,
    recallDelta:
      Math.round(((adaptiveAfter?.recallAt3 ?? 0) - (adaptiveBefore?.recallAt3 ?? 0)) * 1000) / 1000,
    evidencePrecisionDelta:
      Math.round(
        ((adaptiveAfter?.evidencePrecision ?? 0) - (adaptiveBefore?.evidencePrecision ?? 0)) * 1000,
      ) / 1000,
  }

  const honestNote =
    improvement.top1Delta > 0
      ? `Adaptive-graph Top-1 improved by ${(improvement.top1Delta * 100).toFixed(0)} points on held-out incidents after one verified learning round. Vector-only and fixed-graph results are unchanged controls.`
      : `Adaptive-graph did not improve Top-1 in this round (delta ${(improvement.top1Delta * 100).toFixed(
          0,
        )} points). The result is reported as measured; inspect the per-case outcomes before claiming a learning effect.`

  return { baseline, afterLearning, training, improvement, honestNote }
}

