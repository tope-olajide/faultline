import type { IncidentRecord } from '../graph/reads'

/**
 * Coarse failure-context classifier derived only from the incident's own text.
 *
 * Path templates are conditional on this context: a database/metric path learned
 * from latency incidents must not silently boost a database candidate in a
 * deployment incident. This is context extraction, not ground truth — the same
 * signal a real system would derive from alert labels and the incident summary.
 */
export function incidentSignalClass(incident: IncidentRecord): string {
  const text = `${incident.title} ${incident.summary}`.toLowerCase()
  if (/deploy|release|rollout|regression/.test(text)) return 'change'
  if (/backlog|consumer lag|\blag\b|queue|redeliver|unacknowledged/.test(text)) return 'queue'
  if (/cache|session|eviction|cart read/.test(text)) return 'cache'
  return 'latency'
}
