import type { GraphLabel, RelationshipType } from '../graph/schema'

/** A graph entity an evidence item is attached to. */
export interface EvidenceLink {
  label: GraphLabel
  externalId: string
  type: RelationshipType
}

/**
 * Normalized evidence record.
 *
 * Adapters produce drafts; the ingestion layer redacts, stores the payload in
 * object storage, and writes the graph node plus its relationships. Adapters never
 * touch HydraDB or the filesystem directly, so a real Prometheus/Loki/GitHub
 * adapter can replace a simulator without changing ingestion.
 */
export interface EvidenceDraft {
  externalId: string
  evidenceType: string
  /** Source provider, e.g. `prometheus`, `loki`, `tempo`, `github`, `kubernetes`. */
  source: string
  /** Identifier/reference inside the source system. */
  sourceRecordId: string
  observedAt: string
  windowStart?: string
  windowEnd?: string
  summary: string
  /** Prior reliability of this source for this evidence type, 0..1. */
  reliability: number
  payload: Record<string, unknown>
  /** Where the evidence came from: `Service GENERATED Evidence`. */
  generatedBy?: EvidenceLink
  /** Source records the evidence was derived from. */
  derivedFrom?: EvidenceLink[]
  /** Investigation window the evidence belongs to. */
  observedDuring?: EvidenceLink[]
}

/** A connected source and its sync state, surfaced as freshness in the UI. */
export interface ConnectorState {
  externalId: string
  provider: string
  resource: string
  lastSyncedAt: string
  status: 'healthy' | 'degraded' | 'paused'
  permissionScope: string
  lastError?: string
}

/** Simulated connectors share the shape a real adapter will expose. */
export interface EvidenceSource {
  id: string
  provider: string
  resource: string
  connector: ConnectorState
  collect(): EvidenceDraft[]
}
