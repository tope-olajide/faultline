import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redactWithSummary } from '../security/redact'

/**
 * Local evidence object store.
 *
 * Raw evidence payloads (metric windows, log excerpts, trace spans, event lists)
 * belong in object storage, not in the graph. HydraDB stores the identity,
 * timestamps, relationships and an object reference plus content hash; this module
 * is the object store for local and demo deployments.
 *
 * URI form: `local://evidence/<sha256>.json`. Swapping in S3/MinIO later means
 * replacing `put`/`get` and keeping the URI contract.
 */

const DEFAULT_ROOT = path.join(process.cwd(), '.hydradb', 'evidence')
const URI_PREFIX = 'local://evidence/'
const HASH_PREFIX = 'sha256:'

export interface StoredEvidenceObject {
  uri: string
  contentHash: string
  bytes: number
  redactedKeys: string[]
}

export interface LoadedEvidenceObject {
  uri: string
  payload: unknown
  contentHash: string
  bytes: number
  /** False when the stored bytes no longer match the hash recorded in the graph. */
  verified: boolean
}

export function evidenceRoot(): string {
  return process.env.FAULTLINE_EVIDENCE_DIR ?? DEFAULT_ROOT
}

/** Deterministic JSON so the content hash is stable across runs. */
function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>()

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input
    if (seen.has(input as object)) return '[circular]'
    seen.add(input as object)

    if (Array.isArray(input)) return input.map(normalize)

    const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    const output: Record<string, unknown> = {}
    for (const [key, entry] of entries) output[key] = normalize(entry)
    return output
  }

  return JSON.stringify(normalize(value), null, 2)
}

export function hashPayload(payload: unknown): { content: string; contentHash: string } {
  const content = canonicalJson(payload)
  return { content, contentHash: `${HASH_PREFIX}${createHash('sha256').update(content).digest('hex')}` }
}

/** Redact, hash, and persist a payload. Re-running with identical input is a no-op write. */
export async function putEvidencePayload(payload: unknown): Promise<StoredEvidenceObject> {
  const { value, summary } = redactWithSummary(payload)
  const { content, contentHash } = hashPayload(value)
  const filename = `${contentHash.slice(HASH_PREFIX.length)}.json`
  const root = evidenceRoot()

  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, filename), content, { encoding: 'utf8' })

  return {
    uri: `${URI_PREFIX}${filename}`,
    contentHash,
    bytes: Buffer.byteLength(content, 'utf8'),
    redactedKeys: summary.removed,
  }
}

function resolveUri(uri: string): string | null {
  if (!uri.startsWith(URI_PREFIX)) return null
  const filename = uri.slice(URI_PREFIX.length)
  if (!/^[a-f0-9]{64}\.json$/.test(filename)) return null
  return path.join(evidenceRoot(), filename)
}

/** Read a payload back and verify it against the hash the graph recorded. */
export async function getEvidencePayload(uri: string, expectedHash?: string | null): Promise<LoadedEvidenceObject | null> {
  const filePath = resolveUri(uri)
  if (!filePath) return null

  let content: string
  try {
    content = await readFile(filePath, 'utf8')
  } catch {
    return null
  }

  const contentHash = `${HASH_PREFIX}${createHash('sha256').update(content).digest('hex')}`
  let payload: unknown = null
  try {
    payload = JSON.parse(content)
  } catch {
    payload = null
  }

  return {
    uri,
    payload,
    contentHash,
    bytes: Buffer.byteLength(content, 'utf8'),
    verified: expectedHash ? contentHash === expectedHash : true,
  }
}

export function isManagedEvidenceUri(uri: unknown): uri is string {
  return typeof uri === 'string' && uri.startsWith(URI_PREFIX)
}
