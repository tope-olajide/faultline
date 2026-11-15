import { demoEntityId } from '../graph/ids'
import { demoScope } from '../config'
import {
  feedbackExists,
  getEdgeState,
  getPathTemplate,
  listLearningUpdates,
  setEdgeState,
  type EdgeState,
  type LearningUpdateRecord,
} from '../graph/reads'
import { upsertEdges, upsertNodes } from '../graph/repository'
import type { RelationshipType } from '../graph/schema'

/**
 * Persistent, auditable graph learning.
 *
 * A feedback outcome mutates exactly one relationship's reliability statistics
 * and, optionally, the utility of the path signature that produced the
 * hypothesis. Every mutation writes:
 *
 *   Feedback        — who said what, about which hypothesis and edge
 *   LearningUpdate  — before/after state, reason, delta, status
 *   PathTemplate    — success/failure counts and derived utility
 *
 * All writes are idempotent on the feedback request key, because HydraDB has no
 * cross-request transactions and a retried request must not double-apply.
 */

export type FeedbackOutcome =
  | 'confirm'
  | 'reject'
  | 'contributing_factor'
  | 'inconclusive'
  | 'stale_relationship'
  | 'incorrect_mapping'

export interface FeedbackInput {
  requestKey: string
  outcome: FeedbackOutcome
  actorRef: string
  reason: string
  incidentExternalId?: string
  hypothesisExternalId?: string
  edge: { src: number; dst: number; type: RelationshipType }
  pathSignature?: string
  evidenceExternalIds?: string[]
}

export interface FeedbackResult {
  applied: boolean
  alreadyProcessed: boolean
  outcome: FeedbackOutcome
  before: EdgeState | null
  after: EdgeState | null
  deltas: { confidence: number; support: number; contradiction: number }
  pathTemplate: { signature: string; score: number; success: number; failure: number } | null
  ledgerExternalId: string | null
}

const PRIOR_SUCCESS = 1
const PRIOR_FAILURE = 1

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Conservative, explainable update policy. Inconclusive changes nothing. */
function nextEdgeState(outcome: FeedbackOutcome, before: EdgeState): EdgeState {
  let confidence = before.confidence
  let support = before.support
  let contradiction = before.contradiction
  let verificationState = before.verificationState || 'provisional'

  switch (outcome) {
    case 'confirm':
      support += 1
      confidence = before.confidence + (1 - before.confidence) * 0.35
      verificationState = 'verified'
      break
    case 'contributing_factor':
      support += 0.5
      confidence = before.confidence + (1 - before.confidence) * 0.15
      break
    case 'reject':
      contradiction += 1
      confidence = before.confidence - before.confidence * 0.45
      break
    case 'incorrect_mapping':
      contradiction += 1
      confidence = before.confidence - before.confidence * 0.6
      verificationState = 'rejected'
      break
    case 'stale_relationship':
      contradiction += 0.5
      confidence = before.confidence - before.confidence * 0.25
      verificationState = 'stale'
      break
    case 'inconclusive':
      break
  }

  return {
    confidence: round(clamp(confidence, 0.02, 0.99)),
    baseline: before.baseline,
    support: round(support),
    contradiction: round(contradiction),
    verificationState,
  }
}

function countsAsSuccess(outcome: FeedbackOutcome): boolean {
  return outcome === 'confirm' || outcome === 'contributing_factor'
}

function countsAsFailure(outcome: FeedbackOutcome): boolean {
  return (
    outcome === 'reject' || outcome === 'incorrect_mapping' || outcome === 'stale_relationship'
  )
}

export async function applyFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  if (await feedbackExists(input.requestKey)) {
    return {
      applied: false,
      alreadyProcessed: true,
      outcome: input.outcome,
      before: null,
      after: null,
      deltas: { confidence: 0, support: 0, contradiction: 0 },
      pathTemplate: null,
      ledgerExternalId: null,
    }
  }

  const before = await getEdgeState(input.edge.src, input.edge.dst, input.edge.type)
  if (!before) {
    throw new Error(
      `Cannot apply feedback: relationship ${input.edge.type} (${input.edge.src} → ${input.edge.dst}) does not exist`,
    )
  }

  const createdAt = new Date().toISOString()
  const after = nextEdgeState(input.outcome, before)
  const noReliabilityChange = input.outcome === 'inconclusive'

  if (!noReliabilityChange) {
    await setEdgeState(input.edge.src, input.edge.dst, input.edge.type, after)
  }

  const feedbackExternalId = `feedback/${input.requestKey}`

  await upsertNodes(
    [
      {
        label: 'Feedback',
        externalId: feedbackExternalId,
        properties: {
          outcome: input.outcome,
          actor_ref: input.actorRef,
          created_at: createdAt,
          reason: input.reason,
          incident_external_id: input.incidentExternalId ?? '',
          hypothesis_external_id: input.hypothesisExternalId ?? '',
          edge_type: input.edge.type,
          edge_src: String(input.edge.src),
          edge_dst: String(input.edge.dst),
          path_signature: input.pathSignature ?? '',
        },
      },
    ],
    demoScope,
  )

  if (noReliabilityChange) {
    return {
      applied: true,
      alreadyProcessed: false,
      outcome: input.outcome,
      before,
      after: before,
      deltas: { confidence: 0, support: 0, contradiction: 0 },
      pathTemplate: null,
      ledgerExternalId: null,
    }
  }

  // Path-quality learning: only the signature that produced this hypothesis is
  // updated, and only by the verified outcome.
  let templateBefore: { signature: string; success: number; failure: number; score: number } | null = null
  let templateAfter: { signature: string; success: number; failure: number; score: number } | null = null

  if (input.pathSignature) {
    const existing = await getPathTemplate(input.pathSignature)
    const success = (existing?.successCount ?? 0) + (countsAsSuccess(input.outcome) ? 1 : 0)
    const failure = (existing?.failureCount ?? 0) + (countsAsFailure(input.outcome) ? 1 : 0)
    const score = round((success + PRIOR_SUCCESS) / (success + failure + PRIOR_SUCCESS + PRIOR_FAILURE))

    templateBefore = {
      signature: input.pathSignature,
      success: existing?.successCount ?? 0,
      failure: existing?.failureCount ?? 0,
      score: existing?.pathScore ?? 0.5,
    }
    templateAfter = { signature: input.pathSignature, success, failure, score }

    await upsertNodes(
      [
        {
          label: 'PathTemplate',
          externalId: `path-template/${input.pathSignature}`,
          properties: {
            signature: input.pathSignature,
            path_score: score,
            success_count: success,
            failure_count: failure,
            context: input.incidentExternalId ?? '',
            last_used_at: createdAt,
          },
        },
      ],
      demoScope,
    )
  }

  const ledgerExternalId = `learning/${input.requestKey}`
  const beforeState = {
    edge: before,
    path_template: templateBefore,
  }
  const afterState = {
    edge: after,
    path_template: templateAfter,
  }

  await upsertNodes(
    [
      {
        label: 'LearningUpdate',
        externalId: ledgerExternalId,
        properties: {
          update_type: input.outcome,
          before_state: JSON.stringify(beforeState),
          after_state: JSON.stringify(afterState),
          reason: input.reason,
          created_at: createdAt,
          status: 'applied',
          feedback_external_id: feedbackExternalId,
          edge_type: input.edge.type,
          edge_src: String(input.edge.src),
          edge_dst: String(input.edge.dst),
          confidence_delta: round(after.confidence - before.confidence),
          reverted_at: '',
        },
      },
    ],
    demoScope,
  )

  const edges: Array<{ type: RelationshipType; src: number; dst: number }> = [
    {
      type: 'LEARNED_FROM',
      src: demoEntityId('LearningUpdate', ledgerExternalId, demoScope),
      dst: demoEntityId('Feedback', feedbackExternalId, demoScope),
    },
  ]
  if (input.pathSignature) {
    edges.push({
      type: 'LEARNED_FROM',
      src: demoEntityId('LearningUpdate', ledgerExternalId, demoScope),
      dst: demoEntityId('PathTemplate', `path-template/${input.pathSignature}`, demoScope),
    })
  }
  await upsertEdges(edges, demoScope)

  return {
    applied: true,
    alreadyProcessed: false,
    outcome: input.outcome,
    before,
    after,
    deltas: {
      confidence: round(after.confidence - before.confidence),
      support: round(after.support - before.support),
      contradiction: round(after.contradiction - before.contradiction),
    },
    pathTemplate: templateAfter,
    ledgerExternalId,
  }
}

interface StoredState {
  edge: EdgeState & { support: number; contradiction: number }
  path_template: { signature: string; success: number; failure: number; score: number } | null
}

function parseState(value: string): StoredState | null {
  try {
    const parsed = JSON.parse(value) as StoredState
    if (!parsed || typeof parsed !== 'object' || !parsed.edge) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Reverse a harmful learning update. The ledger record is preserved; a new
 * status and `reverted_at` timestamp make the reversal itself auditable.
 */
export async function revertLearningUpdate(externalId: string): Promise<{
  reverted: boolean
  reason?: string
  before: EdgeState | null
  after: EdgeState | null
}> {
  const updates = await listLearningUpdates(200)
  const update = updates.find((entry) => entry.externalId === externalId)
  if (!update) return { reverted: false, reason: 'learning update not found', before: null, after: null }
  if (update.status === 'rolled_back') {
    return { reverted: false, reason: 'already rolled back', before: null, after: null }
  }

  const beforeState = parseState(update.beforeState)
  if (!beforeState) {
    return { reverted: false, reason: 'stored before-state is unreadable', before: null, after: null }
  }

  const src = Number(update.edgeSrc)
  const dst = Number(update.edgeDst)
  const type = update.edgeType as RelationshipType
  const current = await getEdgeState(src, dst, type)
  if (!current) {
    return { reverted: false, reason: 'relationship no longer exists', before: null, after: null }
  }

  await setEdgeState(src, dst, type, {
    confidence: beforeState.edge.confidence,
    support: beforeState.edge.support,
    contradiction: beforeState.edge.contradiction,
    verificationState: beforeState.edge.verificationState || 'provisional',
  })

  if (beforeState.path_template) {
    const template = beforeState.path_template
    await upsertNodes(
      [
        {
          label: 'PathTemplate',
          externalId: `path-template/${template.signature}`,
          properties: {
            signature: template.signature,
            path_score: template.score,
            success_count: template.success,
            failure_count: template.failure,
            context: '',
            last_used_at: new Date().toISOString(),
          },
        },
      ],
      demoScope,
    )
  }

  await upsertNodes(
    [
      {
        label: 'LearningUpdate',
        externalId: update.externalId,
        properties: {
          update_type: update.updateType,
          before_state: update.beforeState,
          after_state: update.afterState,
          reason: update.reason,
          created_at: update.createdAt,
          status: 'rolled_back',
          feedback_external_id: `feedback/${update.externalId.replace(/^learning\//, '')}`,
          edge_type: update.edgeType,
          edge_src: update.edgeSrc,
          edge_dst: update.edgeDst,
          confidence_delta: update.confidenceDelta,
          reverted_at: new Date().toISOString(),
        },
      },
    ],
    demoScope,
  )

  return { reverted: true, before: beforeState.edge, after: current }
}

export async function learningLedger(limit = 100): Promise<LearningUpdateRecord[]> {
  return listLearningUpdates(limit)
}
