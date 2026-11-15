import { demoScope, type DemoScope } from '../config'
import { demoEntityId } from '../graph/ids'
import { upsertEdges, upsertNodes, type EdgeInput, type NodeInput } from '../graph/repository'
import type { EvidenceDraft, EvidenceLink } from '../integrations/types'
import { putEvidencePayload } from './object-store'

export interface EvidenceIngestionResult {
  evidenceNodes: number
  relationships: number
  payloads: number
  totalBytes: number
  redactedKeys: string[]
  evidenceIds: number[]
}

export function evidenceExternalId(draft: EvidenceDraft): string {
  return draft.externalId
}

export function evidenceNodeId(externalId: string, scope: DemoScope = demoScope): number {
  return demoEntityId('Evidence', externalId, scope)
}

export function evidenceIdsFor(drafts: EvidenceDraft[], scope: DemoScope = demoScope): number[] {
  return drafts.map((draft) => evidenceNodeId(draft.externalId, scope))
}

/** Write one batch of simulated (or real) evidence into the graph. */
export async function ingestEvidence(
  drafts: EvidenceDraft[],
  scope: DemoScope = demoScope,
): Promise<EvidenceIngestionResult> {
  const nodes: NodeInput[] = []
  const edges: EdgeInput[] = []
  const allRedacted: string[] = []
  let totalBytes = 0

  for (const draft of drafts) {
    const stored = await putEvidencePayload(draft.payload)
    totalBytes += stored.bytes

    const id = evidenceNodeId(draft.externalId, scope)
    const redactionStatus = stored.redactedKeys.length > 0 ? 'redacted' : 'clean'

    nodes.push({
      label: 'Evidence',
      externalId: draft.externalId,
      properties: {
        evidence_type: draft.evidenceType,
        source: draft.source,
        source_record_id: draft.sourceRecordId,
        observed_at: draft.observedAt,
        window_start: draft.windowStart ?? '',
        window_end: draft.windowEnd ?? '',
        summary: draft.summary,
        object_uri: stored.uri,
        content_hash: stored.contentHash,
        reliability: draft.reliability,
        redaction_status: redactionStatus,
        polarity: draft.polarity ?? 'supports',
      },
    })

    allRedacted.push(...stored.redactedKeys.map((key) => `${draft.externalId}:${key}`))

    if (draft.generatedBy) {
      edges.push({
        type: draft.generatedBy.type,
        src: demoEntityId(draft.generatedBy.label, draft.generatedBy.externalId, scope),
        dst: id,
      })
    }

    for (const link of draft.derivedFrom ?? []) {
      edges.push({
        type: 'DERIVED_FROM',
        src: id,
        dst: demoEntityId(link.label, link.externalId, scope),
      })
    }

    for (const link of draft.observedDuring ?? []) {
      edges.push({
        type: 'OBSERVED_DURING',
        src: id,
        dst: demoEntityId(link.label, link.externalId, scope),
      })
    }
  }

  // Nodes first (label write), then edges (per-edge MERGE needs endpoints).
  const nodeResult = await upsertNodes(nodes, scope)
  const edgeResult = await upsertEdges(edges, scope)

  return {
    evidenceNodes: nodeResult.written,
    relationships: edgeResult.written,
    payloads: drafts.length,
    totalBytes,
    redactedKeys: allRedacted,
    evidenceIds: drafts.map((draft) => evidenceNodeId(draft.externalId, scope)),
  }
}
