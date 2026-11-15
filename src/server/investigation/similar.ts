import { getAffectedServices, listIncidents } from '../graph/reads'
import type { IncidentRecord } from '../graph/reads'
import { incidentSignalClass } from './signal'

/**
 * Historical incident matching.
 *
 * Prior incidents are matched against the current incident using only graph
 * facts: the services both incidents affect (AFFECTS edges), the declared
 * failure family, and a signal class derived from the incident's own text. The
 * benchmark's verified cause is surfaced when one exists, clearly labelled as a
 * benchmark label rather than an engineer confirmation.
 *
 * Similarity never reads the current incident's ground-truth props and never
 * looks forward in time, so a held-out incident is only ever compared with
 * incidents that started before it.
 */

export interface SimilarIncident {
  id: number
  externalId: string
  title: string
  severity: string
  status: string
  startedAt: string
  family: string
  /** 0..1 blend of service overlap, family, signal class and recency. */
  similarity: number
  sharedServices: string[]
  sameFamily: boolean
  sameSignalClass: boolean
  /** Benchmark-verified cause, empty when the incident has no label. */
  verifiedCause: string
  /** `benchmark` means the cause comes from the evaluation dataset label. */
  causeSource: 'benchmark' | 'none'
  reasons: string[]
}

const MATCH_THRESHOLD = 0.28
const MAX_MATCHES = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier).getTime()
  const b = new Date(later).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 90
  return Math.max(0, (b - a) / 86_400_000)
}

export async function findSimilarIncidents(
  incident: IncidentRecord,
  limit = MAX_MATCHES,
): Promise<SimilarIncident[]> {
  const incidents = await listIncidents(200)
  const prior = incidents.filter(
    (entry) =>
      entry.id !== incident.id &&
      entry.startedAt !== '' &&
      incident.startedAt !== '' &&
      entry.startedAt < incident.startedAt,
  )
  if (prior.length === 0) return []

  const currentServices = await getAffectedServices(incident.id)
  const currentNames = new Set(currentServices.map((service) => service.name))
  const signalClass = incidentSignalClass(incident)

  const scored: SimilarIncident[] = []
  for (const entry of prior) {
    const services = await getAffectedServices(entry.id)
    const shared = services.map((service) => service.name).filter((name) => currentNames.has(name))
    if (shared.length === 0) continue

    const union = new Set([...currentNames, ...services.map((service) => service.name)])
    const serviceScore = shared.length / Math.max(1, union.size)
    const sameFamily = Boolean(incident.family) && entry.family === incident.family
    const sameSignalClass = incidentSignalClass(entry) === signalClass
    const recency = clamp(1 - daysBetween(entry.startedAt, incident.startedAt) / 90, 0, 1)

    const similarity = round(
      0.5 * serviceScore + 0.22 * Number(sameFamily) + 0.16 * Number(sameSignalClass) + 0.12 * recency,
    )
    if (similarity < MATCH_THRESHOLD) continue

    const reasons: string[] = []
    reasons.push(`${shared.length} shared service${shared.length === 1 ? '' : 's'}`)
    if (sameFamily) reasons.push(`same family (${entry.family})`)
    if (sameSignalClass) reasons.push(`same signal class (${signalClass})`)

    scored.push({
      id: entry.id,
      externalId: entry.externalId,
      title: entry.title,
      severity: entry.severity,
      status: entry.status,
      startedAt: entry.startedAt,
      family: entry.family,
      similarity,
      sharedServices: shared,
      sameFamily,
      sameSignalClass,
      verifiedCause: entry.groundTruthCause,
      causeSource: entry.groundTruthCause ? 'benchmark' : 'none',
      reasons,
    })
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, Math.max(1, limit))
}
