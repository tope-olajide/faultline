/**
 * Secret redaction.
 *
 * Evidence payloads are redacted before they reach object storage, the graph, an
 * LLM prompt, or an exported report. Redaction is key-based and conservative: it
 * removes the value, records that it was removed, and never tries to guess at
 * free-text secrets (which would risk false negatives presented as safety).
 */

const SENSITIVE_KEY = /(pass(word|wd)?|secret|token|api[-_]?key|authorization|cookie|private[-_]?key|credential|dsn|connection[-_]?string)/i
const REDACTED = '[redacted]'

export interface RedactionSummary {
  removed: string[]
}

/**
 * Recursively replace sensitive values. Keys are preserved so the payload shape
 * stays inspectable; only values are dropped.
 */
export function redact<T>(value: T, trail: string[] = [], removed: string[] = []): T {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, trail, removed)) as unknown as T
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const path = [...trail, key]
      if (SENSITIVE_KEY.test(key)) {
        removed.push(path.join('.'))
        result[key] = REDACTED
        continue
      }
      result[key] = redact(entry, path, removed)
    }
    return result as unknown as T
  }

  return value
}

export function redactWithSummary<T>(value: T): { value: T; summary: RedactionSummary } {
  const removed: string[] = []
  const redacted = redact(value, [], removed)
  return { value: redacted, summary: { removed } }
}

export const REDACTION_MARKER = REDACTED
