import { HydraDbError } from './hydradb/client'
import { graphClient } from './graph/repository'

export interface ProbeResult {
  name: string
  status: 'pass' | 'fail'
  detail: string
  ms: number
}

const PROBE_SOURCE = 9_000_001
const PROBE_TARGET = 9_000_002
const PROBE_TYPE = 'FAULTLINE_PROBE'

/**
 * Runtime compatibility probes.
 *
 * These write to throwaway ids outside the seeded id range, assert HydraDB's
 * documented behaviour, and clean up after themselves. They exist because the
 * engine's write semantics differ from Neo4j in ways that silently corrupt
 * counts (duplicate edges, unlabelled nodes) rather than failing loudly.
 */
export async function runCompatibilityProbes(): Promise<ProbeResult[]> {
  const client = graphClient()
  const results: ProbeResult[] = []

  const record = async (name: string, run: () => Promise<string>) => {
    const started = Date.now()
    try {
      const detail = await run()
      results.push({ name, status: 'pass', detail, ms: Date.now() - started })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ name, status: 'fail', detail: message, ms: Date.now() - started })
    }
  }

  const cleanup = async () => {
    await client
      .mutate('UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n', {
        rows: [{ id: PROBE_SOURCE }, { id: PROBE_TARGET }],
      })
      .catch(() => undefined)
  }

  try {
    await cleanup()

    await record('Idempotent edge write', async () => {
      const query = `MERGE (a {id: $src})-[r:${PROBE_TYPE} {confidence_score: $score}]->(b {id: $dst})`
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await client.mutate(query, { src: PROBE_SOURCE, dst: PROBE_TARGET, score: 0.5 })
      }
      const count = await client.query<{ n: number }>(
        `MATCH (a {id: $src})-[:${PROBE_TYPE}]->(b) RETURN count(*) AS n`,
        { src: PROBE_SOURCE },
      )
      const edges = Number(count.rows[0]?.n ?? 0)
      if (edges !== 1) throw new Error(`Expected 1 edge after 3 MERGEs, found ${edges}`)
      return '3 MERGEs produced exactly 1 relationship'
    })

    await record('Relationship property write', async () => {
      await client.mutate(`MATCH (a {id: $src})-[r:${PROBE_TYPE}]->(b {id: $dst}) SET r.confidence_score = $score`, {
        src: PROBE_SOURCE,
        dst: PROBE_TARGET,
        score: 0.82,
      })
      const read = await client.query<{ score: number | null }>(
        `MATCH (a {id: $src})-[r:${PROBE_TYPE}]->(b) RETURN r.confidence_score AS score`,
        { src: PROBE_SOURCE },
      )
      const score = read.rows[0]?.score
      if (typeof score !== 'number' || Math.abs(score - 0.82) > 1e-6) {
        throw new Error(`Expected confidence_score 0.82, read ${String(score)}`)
      }
      return 'Edge property written and read back as a number'
    })

    await record('Bounded traversal + path procedure', async () => {
      const traversal = await client.query<{ id: number }>(
        `MATCH (a {id: $src})-[:${PROBE_TYPE}*1..2]->(b) RETURN b.id AS id`,
        { src: PROBE_SOURCE },
      )
      if (!traversal.rows.some((row) => Number(row.id) === PROBE_TARGET)) {
        throw new Error('Variable-length traversal did not reach the target node')
      }
      const paths = await client.query<{ path: unknown }>(
        `CALL algo.SPpaths({sourceNode: $src, targetNode: $dst, relTypes: ['${PROBE_TYPE}'], relDirection: 'outgoing', maxLen: 2, pathCount: 1}) YIELD path RETURN path`,
        { src: PROBE_SOURCE, dst: PROBE_TARGET },
      )
      const path = paths.rows[0]?.path as { nodes?: unknown[] } | undefined
      if (!path || !Array.isArray(path.nodes) || path.nodes.length < 2) {
        throw new Error('algo.SPpaths returned no decodable path')
      }
      return 'Bounded MATCH and algo.SPpaths both returned the target'
    })

    await record('Dialect guard (unsupported shapes still rejected)', async () => {
      let rejected = false
      try {
        await client.query(`MATCH (n {id: $src}) RETURN *`, { src: PROBE_SOURCE })
      } catch (error) {
        rejected = error instanceof HydraDbError && error.message.includes('not supported yet')
      }
      if (!rejected) throw new Error('RETURN * was accepted — the dialect assumptions need re-checking')
      return 'RETURN * rejected as documented'
    })

    await record('Batched delete cleanup', async () => {
      await client.mutate('UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n', {
        rows: [{ id: PROBE_SOURCE }, { id: PROBE_TARGET }],
      })
      const remaining = await client.query<{ id: number | null }>('MATCH (n {id: $src}) RETURN n.id AS id', {
        src: PROBE_SOURCE,
      })
      if (remaining.rows.length !== 0) throw new Error('Probe nodes were not deleted')
      return 'Probe nodes deleted; graph left clean'
    })
  } finally {
    await cleanup()
  }

  return results
}
