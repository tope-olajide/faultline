import type { GraphLabel } from './schema'
import { scopeKey, type DemoScope } from '../config'

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn
/** 2^53 - 1: ids stay exactly representable as JavaScript numbers. */
const MAX_SAFE = 0x1fffffffffffffn

/** 64-bit FNV-1a over UTF-8 bytes. */
export function fnv1a64(input: string): bigint {
  let hash = FNV_OFFSET_BASIS
  const bytes = new TextEncoder().encode(input)
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & MASK_64
  }
  return hash
}

/**
 * Derive a stable HydraDB vertex id.
 *
 * HydraDB treats `id` as an upsert identity key supplied by the caller, so ids
 * must be deterministic across re-ingestion and unique across tenants. Scope is
 * part of the hash input: the same service name in staging and production is a
 * different node by construction.
 */
export function entityId(scope: string, label: GraphLabel, externalId: string): number {
  const hash = fnv1a64(`${scope}\u0000${label}\u0000${externalId}`) & MAX_SAFE
  const id = Number(hash)
  // 0 is a legal vertex id but a poor sentinel; shift it.
  return id === 0 ? 1 : id
}

/** Deterministic id within the demo scope. */
export function demoEntityId(label: GraphLabel, externalId: string, scope: DemoScope): number {
  return entityId(scopeKey(scope), label, externalId)
}

export function isSafeVertexId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
