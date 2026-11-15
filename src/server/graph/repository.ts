import { HydraDbClient } from '../hydradb/client'
import type { GraphPath } from '../hydradb/types'
import { demoScope, hydraDbConfig, type DemoScope } from '../config'
import { defaultAsOf, isCurrent } from './temporal'
import { demoEntityId } from './ids'
import {
  GRAPH_LABELS,
  RELATIONSHIP_ENDPOINTS,
  RELATIONSHIP_TYPES,
  displayProperty,
  isGraphLabel,
  isRelationshipType,
  nodePropertyKeys,
  type GraphLabel,
  type RelationshipType,
} from './schema'

export type GraphPropertyValue = string | number | boolean
export type PropertyMap = Record<string, GraphPropertyValue>

export interface NodeInput {
  label: GraphLabel
  externalId: string
  properties?: PropertyMap
}

export interface NodeRecord {
  id: number
  label: GraphLabel
  properties: PropertyMap
}

export interface EdgeInput {
  type: RelationshipType
  src: number
  dst: number
  properties?: PropertyMap
}

export interface NeighborEdge {
  relationship: RelationshipType
  direction: 'outgoing' | 'incoming'
  neighborId: number
  neighborLabel: GraphLabel
  display: string | null
  edge: Record<string, unknown>
}

export interface GraphStats {
  nodes: Array<{ label: GraphLabel; count: number }>
  relationships: Array<{ type: RelationshipType; from: GraphLabel; count: number }>
  totalNodes: number
  totalRelationships: number
  bookmark: string | null
  readEpoch: number | null
}

const WRITE_CHUNK = 500

let cachedClient: HydraDbClient | null = null

export function graphClient(): HydraDbClient {
  if (!cachedClient) cachedClient = new HydraDbClient(hydraDbConfig)
  return cachedClient
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

function assertIdentifier(value: string, what: string): void {
  if (!IDENTIFIER.test(value)) {
    throw new Error(`Refusing to interpolate unsafe ${what}: ${JSON.stringify(value)}`)
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}

function assertPrimitiveProperties(properties: PropertyMap, context: string): void {
  for (const [key, value] of Object.entries(properties)) {
    assertIdentifier(key, `property name for ${context}`)
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error(`Property ${key} on ${context} must be a string, number, or boolean`)
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`Property ${key} on ${context} is not a finite number`)
    }
  }
}

function scopeProperties(scope: DemoScope): PropertyMap {
  return {
    tenant_key: scope.tenant,
    project_key: scope.project,
    environment_key: scope.environment,
  }
}

export function nodeId(node: NodeInput, scope: DemoScope = demoScope): number {
  return demoEntityId(node.label, node.externalId, scope)
}

/**
 * Idempotent node upsert.
 *
 * HydraDB's batch node shape is `UNWIND … MERGE (n {id: row.id}) SET n:Label,
 * n.prop = row.prop …`: exactly one label per request, properties after it. It is
 * also the only way to create an edgeless node, which is why labels are written
 * before edges.
 */
export async function upsertNodes(
  nodes: NodeInput[],
  scope: DemoScope = demoScope,
): Promise<{ written: number; requests: number; bookmark: string | null }> {
  const byLabel = new Map<GraphLabel, NodeInput[]>()
  for (const node of nodes) {
    if (!isGraphLabel(node.label)) throw new Error(`Unknown label ${node.label}`)
    const list = byLabel.get(node.label) ?? []
    list.push(node)
    byLabel.set(node.label, list)
  }

  let written = 0
  let requests = 0
  let bookmark: string | null = null
  const client = graphClient()

  for (const [label, group] of byLabel) {
    assertIdentifier(label, 'label')
    for (const batch of chunk(group, WRITE_CHUNK)) {
      const rows = batch.map((node) => {
        // `external_id` is the natural identity from the source system. HydraDB's
        // `id` is only an upsert key, so the readable identity must be stored as
        // a property or every read projects `null`.
        const properties = {
          ...scopeProperties(scope),
          ...(node.properties ?? {}),
          external_id: node.externalId,
        }
        delete (properties as Record<string, unknown>).id
        assertPrimitiveProperties(properties, `${label} ${node.externalId}`)
        return { id: nodeId(node, scope), ...properties }
      })

      // Every row must carry every key the SET clause references; HydraDB would
      // otherwise bind a missing map field to null.
      const keys = new Set<string>()
      for (const node of batch) {
        for (const key of Object.keys({ ...scopeProperties(scope), ...(node.properties ?? {}), external_id: node.externalId })) {
          keys.add(key)
        }
      }
      const propertyKeys = [...keys].filter((key) => key !== 'id')
      for (const key of propertyKeys) assertIdentifier(key, 'property')
      for (const row of rows) {
        for (const key of propertyKeys) {
          if ((row as Record<string, unknown>)[key] === undefined) {
            ;(row as Record<string, unknown>)[key] = ''
          }
        }
      }

      const query = `UNWIND $rows AS row MERGE (n {id: row.id}) SET n:${label}, ${propertyKeys
        .map((key) => `n.${key} = row.${key}`)
        .join(', ')}`

      const result = await client.mutate(query, { rows })
      bookmark = result.bookmark ?? bookmark
      requests += 1
      written += batch.length
    }
  }

  return { written, requests, bookmark }
}

/**
 * Idempotent edge upsert.
 *
 * `MERGE` deduplicates on (src, dst, type) and accepts inline properties in the
 * pattern — the only way to write edge properties in one request, because
 * `UNWIND … CREATE` cannot be followed by `SET`.
 */
export async function upsertEdges(
  edges: EdgeInput[],
  scope: DemoScope = demoScope,
): Promise<{ written: number; requests: number; bookmark: string | null }> {
  const client = graphClient()
  const scoped = scopeProperties(scope)
  let bookmark: string | null = null
  let requests = 0
  let written = 0

  // Group identical property key-sets so the query text can be shared while each
  // edge keeps its own parameters.
  for (const edge of edges) {
    if (!isRelationshipType(edge.type)) throw new Error(`Unknown relationship type ${edge.type}`)
    assertIdentifier(edge.type, 'relationship type')

    const properties = { ...scoped, ...(edge.properties ?? {}) }
    delete (properties as Record<string, unknown>).id
    assertPrimitiveProperties(properties, `${edge.type} edge`)
    const keys = Object.keys(properties)
    for (const key of keys) assertIdentifier(key, 'relationship property')

    const inline = keys.length > 0 ? ` {${keys.map((key, index) => `${key}: $p${index}`).join(', ')}}` : ''
    const query = `MERGE (a {id: $src})-[r:${edge.type}${inline}]->(b {id: $dst})`
    const parameters: Record<string, unknown> = { src: edge.src, dst: edge.dst }
    keys.forEach((key, index) => {
      parameters[`p${index}`] = properties[key]
    })

    const result = await client.mutate(query, parameters)
    bookmark = result.bookmark ?? bookmark
    requests += 1
    written += 1
  }

  return { written, requests, bookmark }
}

/** Batched `DETACH DELETE`; ≤1024 ids per request. */
export async function deleteNodes(ids: number[]): Promise<{ deleted: number; requests: number; bookmark: string | null }> {
  const client = graphClient()
  let bookmark: string | null = null
  let requests = 0
  let deleted = 0

  for (const batch of chunk(ids, WRITE_CHUNK)) {
    const rows = batch.map((id) => ({ id }))
    const result = await client.mutate('UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n', { rows })
    bookmark = result.bookmark ?? bookmark
    requests += 1
    deleted += batch.length
  }

  return { deleted, requests, bookmark }
}

/** Read one node by id, projecting the declared property keys for its label. */
export async function getNode(id: number, label: GraphLabel): Promise<NodeRecord | null> {
  if (!isGraphLabel(label)) throw new Error(`Unknown label ${label}`)
  const keys = nodePropertyKeys(label)
  const query = `MATCH (n:${label} {id: $id}) RETURN ${keys.map((key) => `n.${key} AS ${key}`).join(', ')}`
  const result = await graphClient().query<Record<string, unknown>>(query, { id })
  const row = result.rows[0]
  if (!row) return null

  const properties: PropertyMap = {}
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      properties[key] = value
    }
  }
  return { id, label, properties }
}

/** List nodes of one label, ordered by its display property. */
export async function listNodes(
  label: GraphLabel,
  options: { limit?: number; skip?: number; orderBy?: string; descending?: boolean } = {},
): Promise<Array<{ id: number; properties: PropertyMap }>> {
  if (!isGraphLabel(label)) throw new Error(`Unknown label ${label}`)
  const keys = nodePropertyKeys(label)
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const skip = Math.max(options.skip ?? 0, 0)
  const orderBy = options.orderBy ?? displayProperty(label)
  assertIdentifier(orderBy, 'order property')

  // Literal bounds keep the shape simple: SKIP/LIMIT with parameters is not
  // exercised by any other query, so avoid depending on it.
  const query = `MATCH (n:${label}) RETURN n.id AS id, ${keys
    .map((key) => `n.${key} AS ${key}`)
    .join(', ')} ORDER BY n.${orderBy} ${options.descending === false ? 'ASC' : 'DESC'} SKIP ${skip} LIMIT ${limit}`

  const result = await graphClient().query<Record<string, unknown>>(query)
  return result.rows.map((row) => {
    const properties: PropertyMap = {}
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        properties[key] = value
      }
    }
    return { id: Number(row.id), properties }
  })
}

export async function countNodes(label: GraphLabel): Promise<number> {
  const result = await graphClient().query<{ n: number }>(`MATCH (n:${label}) RETURN count(n.id) AS n`)
  return Number(result.rows[0]?.n ?? 0)
}

export async function countRelationships(from: GraphLabel, type: RelationshipType): Promise<number> {
  const query = `MATCH (a:${from})-[:${type}]->(b) RETURN count(*) AS n`
  const result = await graphClient().query<{ n: number }>(query)
  return Number(result.rows[0]?.n ?? 0)
}

let statsCache: { at: number; value: GraphStats } | null = null
const STATS_TTL_MS = 4000

/**
 * Live graph statistics read from HydraDB.
 *
 * HydraDB cannot enumerate labels or relationship types, so the application
 * declares them and counts each one. Results are cached briefly because the
 * overview and the inspector both need them.
 */
export async function graphStats(options: { fresh?: boolean } = {}): Promise<GraphStats> {
  if (!options.fresh && statsCache && Date.now() - statsCache.at < STATS_TTL_MS) {
    return statsCache.value
  }

  // One cheap anchored read also gives us the bookmark/epoch for the snapshot
  // these counts were taken from.
  const meta = await graphClient().query<{ n: number }>('MATCH (n:Project) RETURN count(n.id) AS n')

  const nodeResults = await Promise.all(
    GRAPH_LABELS.map(async (label) => ({ label, count: await countNodes(label) })),
  )

  const relationshipPairs = RELATIONSHIP_TYPES.flatMap((type) =>
    RELATIONSHIP_ENDPOINTS[type].from.map((from) => ({ type, from })),
  )
  const relationshipResults = await Promise.all(
    relationshipPairs.map(async ({ type, from }) => ({
      type,
      from,
      count: await countRelationships(from, type),
    })),
  )

  const nodes = nodeResults.filter((entry) => entry.count > 0)
  const relationships = relationshipResults.filter((entry) => entry.count > 0)

  const value: GraphStats = {
    nodes,
    relationships,
    totalNodes: nodes.reduce((total, entry) => total + entry.count, 0),
    totalRelationships: relationships.reduce((total, entry) => total + entry.count, 0),
    bookmark: meta.bookmark,
    readEpoch: meta.readEpoch,
  }
  statsCache = { at: Date.now(), value }
  return value
}

export function invalidateStatsCache(): void {
  statsCache = null
}

export interface DependencyView {
  nodeId: number
  label: GraphLabel
  mode: 'current' | 'history'
  asOf: string
  dependencies: NeighborEdge[]
}

/**
 * Temporal dependency view for one node.
 *
 * `current` returns only edges whose `[valid_from, valid_to)` window contains
 * `asOf`; `history` returns the rest (closed or future facts). Filtering happens
 * in the application layer because HydraDB rejects null predicates and stores the
 * open-ended window as an explicit sentinel.
 */
export async function getDependencies(
  nodeId: number,
  label: GraphLabel,
  options: { mode?: 'current' | 'history'; asOf?: string } = {},
): Promise<DependencyView> {
  const mode = options.mode ?? 'current'
  const asOf = options.asOf ?? defaultAsOf()
  const neighborhood = await getNeighborhood(nodeId, label, { perPatternLimit: 100 })
  const candidates = neighborhood.filter(
    (edge) => edge.relationship === 'DEPENDS_ON' && edge.direction === 'outgoing',
  )
  const dependencies =
    mode === 'current'
      ? candidates.filter((edge) => isCurrent(edge.edge.valid_from, edge.edge.valid_to, asOf))
      : candidates.filter((edge) => !isCurrent(edge.edge.valid_from, edge.edge.valid_to, asOf))
  return { nodeId, label, mode, asOf, dependencies }
}

/** Relationship types that currently have at least one edge of each source label. */
async function activeRelationshipPatterns(label: GraphLabel): Promise<RelationshipType[]> {
  const stats = await graphStats()
  const active = new Set<RelationshipType>()
  for (const entry of stats.relationships) active.add(entry.type)

  return RELATIONSHIP_TYPES.filter((type) => {
    if (!active.has(type)) return false
    const spec = RELATIONSHIP_ENDPOINTS[type]
    return spec.from.includes(label) || spec.to.includes(label)
  })
}

/**
 * Typed neighbourhood of one node.
 *
 * HydraDB allows exactly one relationship type per pattern, so this issues one
 * bounded query per (type, endpoint label) pair. Only relationship types that
 * currently exist in the graph are queried, which keeps an inspector open at
 * ~20 parallel requests rather than ~57.
 */
export async function getNeighborhood(
  id: number,
  label: GraphLabel,
  options: { perPatternLimit?: number } = {},
): Promise<NeighborEdge[]> {
  if (!isGraphLabel(label)) throw new Error(`Unknown label ${label}`)
  const limit = Math.min(Math.max(options.perPatternLimit ?? 25, 1), 100)
  const client = graphClient()
  const types = await activeRelationshipPatterns(label)

  const edgeKeys = [
    'confidence_score',
    'baseline_confidence',
    'support_count',
    'contradiction_count',
    'verification_state',
    'source',
    'observed_at',
    'valid_from',
    'valid_to',
    'last_verified_at',
  ] as const

  const projection = (alias: string, displayKey: string) =>
    [`${alias}.id AS id`, `${alias}.${displayKey} AS display`, ...edgeKeys.map((key) => `r.${key} AS ${key}`)].join(', ')

  const tasks: Array<Promise<NeighborEdge[]>> = []

  for (const type of types) {
    const spec = RELATIONSHIP_ENDPOINTS[type]

    if (spec.from.includes(label)) {
      for (const target of spec.to) {
        const displayKey = displayProperty(target)
        const query = `MATCH (a:${label} {id: $id})-[r:${type}]->(b:${target}) RETURN ${projection(
          'b',
          displayKey,
        )} LIMIT ${limit}`
        tasks.push(
          client.query<Record<string, unknown>>(query, { id }).then((result) =>
            result.rows.map((row) => ({
              relationship: type,
              direction: 'outgoing' as const,
              neighborId: Number(row.id),
              neighborLabel: target,
              display: (row.display as string | null) ?? null,
              edge: pickEdge(row, edgeKeys),
            })),
          ),
        )
      }
    }

    if (spec.to.includes(label)) {
      for (const source of spec.from) {
        const displayKey = displayProperty(source)
        const query = `MATCH (a:${source})-[r:${type}]->(b:${label} {id: $id}) RETURN ${projection(
          'a',
          displayKey,
        )} LIMIT ${limit}`
        tasks.push(
          client.query<Record<string, unknown>>(query, { id }).then((result) =>
            result.rows.map((row) => ({
              relationship: type,
              direction: 'incoming' as const,
              neighborId: Number(row.id),
              neighborLabel: source,
              display: (row.display as string | null) ?? null,
              edge: pickEdge(row, edgeKeys),
            })),
          ),
        )
      }
    }
  }

  const settled = await Promise.all(tasks)
  return settled.flat()
}

function pickEdge(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const edge: Record<string, unknown> = {}
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined) edge[key] = value
  }
  return edge
}

/** Bounded multi-hop path between two entities, via a native path procedure. */
export async function findPathsBetween(
  sourceId: number,
  targetId: number,
  options: { relTypes?: RelationshipType[]; maxLen?: number; pathCount?: number } = {},
): Promise<GraphPath[]> {
  const relTypes = options.relTypes ?? ['DEPENDS_ON', 'CALLS']
  const maxLen = Math.min(Math.max(options.maxLen ?? 4, 1), 6)
  const pathCount = Math.min(Math.max(options.pathCount ?? 3, 1), 10)
  for (const type of relTypes) assertIdentifier(type, 'relationship type')

  const query = `CALL algo.SPpaths({sourceNode: $source, targetNode: $target, relTypes: [${relTypes
    .map((type) => `'${type}'`)
    .join(', ')}], relDirection: 'outgoing', maxLen: ${maxLen}, pathCount: ${pathCount}}) YIELD path RETURN path`

  // `query()` already decoded the path cell into a GraphPath.
  const result = await graphClient().query<{ path: GraphPath | null }>(query, {
    source: sourceId,
    target: targetId,
  })
  return result.rows.map((row) => row.path).filter((path): path is GraphPath => Boolean(path))
}

/** Graph connectivity probe used by health diagnostics. */
export async function probeGraph(): Promise<{ ok: boolean; projects: number; error?: string }> {
  try {
    const projects = await countNodes('Project')
    return { ok: true, projects }
  } catch (error) {
    return { ok: false, projects: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

