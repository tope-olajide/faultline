import { OPEN_ENDED } from './schema'

/** Sentinel for facts that are still true. Never stored as null. */
export const TEMPORAL_OPEN_ENDED = OPEN_ENDED

/** Default "now" for current-topology queries. */
export function defaultAsOf(): string {
  return new Date().toISOString()
}

/** True when an edge is in force at the given instant. */
export function isCurrent(validFrom: unknown, validTo: unknown, asOf: string = defaultAsOf()): boolean {
  const from = typeof validFrom === 'string' ? validFrom : ''
  const to = typeof validTo === 'string' ? validTo : OPEN_ENDED
  return from.length > 0 && from <= asOf && to > asOf
}

/**
 * Cypher fragment for server-side current-topology filtering. Parameterised on
 * `$asOf` so callers can pin a historical instant.
 */
export function currentTopologyFilter(asOfParameter = '$asOf'): string {
  return `r.valid_from <= ${asOfParameter} AND r.valid_to > ${asOfParameter}`
}

/** Cypher fragment for historical (closed) facts. */
export function closedTopologyFilter(asOfParameter = '$asOf'): string {
  return `r.valid_to <= ${asOfParameter} OR r.valid_from > ${asOfParameter}`
}
