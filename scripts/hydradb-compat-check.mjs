#!/usr/bin/env node
/**
 * HydraDB compatibility check.
 *
 * Probes the engine behaviours Faultline's repository depends on. Every probe
 * uses throwaway ids outside the seeded range and cleans up after itself.
 *
 *   node scripts/hydradb-compat-check.mjs
 *
 * Exit code is 0 only when every probe passes. This intentionally fails loudly
 * if a future HydraDB release changes write semantics, because the failure mode
 * otherwise is silently duplicated relationships and inflated counts.
 */
import process from 'node:process'

const HTTP = (process.env.HYDRADB_HTTP_URL ?? 'http://127.0.0.1:8443').replace(/\/$/, '')
const ADMIN = (process.env.HYDRADB_ADMIN_URL ?? 'http://127.0.0.1:9090').replace(/\/$/, '')
const GRAPH = process.env.HYDRADB_GRAPH_ID ?? 'default'
const CELL = process.env.HYDRADB_CELL_ID ?? 'cell-0'
const TOKEN = process.env.HYDRADB_TOKEN ?? 'local-development-token-32-bytes'

const A = 9_100_001
const B = 9_100_002
const C = 9_100_003
const TYPE = 'FAULTLINE_CHECK'

const results = []

function pass(name, detail) {
  results.push({ name, status: 'pass', detail })
  console.log(`  PASS  ${name} — ${detail}`)
}

function fail(name, detail) {
  results.push({ name, status: 'fail', detail })
  console.log(`  FAIL  ${name} — ${detail}`)
}

async function query(cypher, parameters = {}) {
  const response = await fetch(`${HTTP}/v1/graphs/${encodeURIComponent(GRAPH)}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-Graph-Namespace': process.env.HYDRADB_NAMESPACE ?? 'default',
    },
    body: JSON.stringify({ cell_id: CELL, query: cypher, parameters }),
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (payload?.error) {
    const error = new Error(payload.error.message)
    error.code = payload.error.code
    error.status = response.status
    throw error
  }
  if (!payload || !('rows' in payload)) {
    throw new Error(`Unexpected response envelope (HTTP ${response.status})`)
  }
  return payload
}

function decode(cell) {
  if (!cell) return null
  return cell.type === 'null' ? null : (cell.value ?? null)
}

function rows(payload) {
  return payload.rows.map((cells) => Object.fromEntries(payload.columns.map((column, index) => [column, decode(cells[index])])))
}

async function probe(name, run) {
  try {
    pass(name, await run())
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error))
  }
}

async function cleanup() {
  await query('UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n', {
    rows: [{ id: A }, { id: B }, { id: C }],
  }).catch(() => undefined)
}

async function main() {
  console.log(`\nHydraDB compatibility check`)
  console.log(`  http   ${HTTP}`)
  console.log(`  admin  ${ADMIN}`)
  console.log(`  graph  ${GRAPH} · cell ${CELL}\n`)

  const ready = await fetch(`${ADMIN}/readyz`, { signal: AbortSignal.timeout(5000) })
    .then((response) => response.status === 200)
    .catch(() => false)
  if (!ready) {
    console.error('HydraDB is not ready. Start it with `npm run db:up` and retry.\n')
    process.exitCode = 1
    return
  }
  const healthz = await fetch(`${HTTP}/healthz`, { signal: AbortSignal.timeout(5000) })
    .then((response) => response.json())
    .catch(() => null)
  console.log(`  readyz 200 · healthz ${JSON.stringify(healthz)}\n`)

  await cleanup()

  await probe('Single MERGE edge write is idempotent', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await query(`MERGE (a {id: $src})-[r:${TYPE} {confidence_score: $score}]->(b {id: $dst})`, {
        src: A,
        dst: B,
        score: 0.5,
      })
    }
    const payload = await query(`MATCH (a {id: $src})-[:${TYPE}]->(b) RETURN count(*) AS n`, { src: A })
    const count = rows(payload)[0].n
    if (count !== 1) throw new Error(`expected 1 edge after 3 MERGEs, got ${count}`)
    return '3 MERGEs produced exactly 1 relationship'
  })

  await probe('Batched node upsert writes label and properties', async () => {
    await query(
      'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:CheckNode, n.name = row.name, n.external_id = row.external_id',
      {
        rows: [
          { id: A, name: 'alpha', external_id: 'check/alpha' },
          { id: B, name: 'beta', external_id: 'check/beta' },
        ],
      },
    )
    const payload = await query('MATCH (n:CheckNode {id: $id}) RETURN n.name AS name, n.external_id AS external_id', {
      id: A,
    })
    const row = rows(payload)[0]
    if (!row || row.name !== 'alpha' || row.external_id !== 'check/alpha') {
      throw new Error(`unexpected node payload ${JSON.stringify(row)}`)
    }
    return 'label + properties round-tripped'
  })

  await probe('Batched edge write deduplicates on (src, dst, type)', async () => {
    const cypher = `UNWIND $rows AS row CREATE (a {id: row.src})-[:${TYPE}_BATCH]->(b {id: row.dst})`
    const parameters = {
      rows: [
        { src: A, dst: B },
        { src: B, dst: C },
      ],
    }
    await query(cypher, parameters)
    await query(cypher, parameters)
    const payload = await query(`MATCH (a:CheckNode)-[:${TYPE}_BATCH]->(b) RETURN count(*) AS n`)
    const count = rows(payload)[0].n
    if (count !== 2) throw new Error(`expected 2 edges after 2 batch runs, got ${count}`)
    return '2 batch runs produced 2 relationships (no duplicates)'
  })

  await probe('Relationship property write and read', async () => {
    await query(`MATCH (a {id: $src})-[r:${TYPE}]->(b {id: $dst}) SET r.confidence_score = $score`, {
      src: A,
      dst: B,
      score: 0.82,
    })
    const payload = await query(`MATCH (a {id: $src})-[r:${TYPE}]->(b) RETURN r.confidence_score AS score`, { src: A })
    const score = rows(payload)[0].score
    if (typeof score !== 'number' || Math.abs(score - 0.82) > 1e-9) {
      throw new Error(`expected 0.82, read ${JSON.stringify(score)}`)
    }
    return 'edge property read back as a number'
  })

  await probe('Bounded variable-length traversal', async () => {
    const payload = await query(`MATCH (a {id: $src})-[:${TYPE}*1..2]->(b) RETURN b.id AS id ORDER BY id`, { src: A })
    const ids = rows(payload).map((row) => row.id)
    if (!ids.includes(B)) throw new Error(`expected to reach ${B}, got ${JSON.stringify(ids)}`)
    return `reached ${JSON.stringify(ids)}`
  })

  await probe('Path procedure returns a decodable path', async () => {
    const payload = await query(
      `CALL algo.SPpaths({sourceNode: $src, targetNode: $dst, relTypes: ['${TYPE}'], relDirection: 'outgoing', maxLen: 2, pathCount: 1}) YIELD path RETURN path`,
      { src: A, dst: B },
    )
    const path = decode(payload.rows[0]?.[0])
    if (!path || !Array.isArray(path.nodes) || path.nodes.length < 2) {
      throw new Error('no decodable path returned')
    }
    const rel = path.relationships[0]
    if (rel.edge_type !== TYPE || rel.src !== A || rel.dst !== B) {
      throw new Error(`unexpected relationship encoding ${JSON.stringify(rel)}`)
    }
    return `path with ${path.nodes.length} nodes decoded (properties use capitalised tags)`
  })

  await probe('Null cells carry no value key', async () => {
    const payload = await query(`MATCH (a:CheckNode {id: $src}) OPTIONAL MATCH (a)-[:NOT_A_REAL_EDGE]->(b) RETURN b.id AS id`, {
      src: A,
    }).catch(async () => {
      // Relationship type must exist for OPTIONAL MATCH to parse; use a real one instead.
      return query(`MATCH (a:CheckNode {id: $src}) OPTIONAL MATCH (a)-[:${TYPE}_BATCH]->(b:CheckNode) RETURN b.missing_prop AS value`, {
        src: A,
      })
    })
    const cell = payload.rows[0]?.[0]
    if (!cell || cell.type !== 'null' || 'value' in cell) {
      throw new Error(`expected {"type":"null"} with no value key, got ${JSON.stringify(cell)}`)
    }
    return 'absent property decodes as {"type":"null"}'
  })

  await probe('Dialect guard rejects RETURN *', async () => {
    try {
      await query(`MATCH (n:CheckNode {id: $src}) RETURN *`, { src: A })
    } catch (error) {
      if (String(error.message).includes('not supported yet')) return 'rejected as documented'
      throw error
    }
    throw new Error('RETURN * was accepted — dialect assumptions need re-checking')
  })

  await probe('Dialect guard rejects UNWIND CREATE followed by SET', async () => {
    try {
      await query(`UNWIND $rows AS row CREATE (a {id: row.src})-[r:${TYPE}_X]->(b {id: row.dst}) SET r.weight = 1`, {
        rows: [{ src: A, dst: C }],
      })
    } catch (error) {
      if (String(error.message).includes('not supported yet')) {
        return 'rejected — edge properties must stay inline in MERGE'
      }
      throw error
    }
    throw new Error('UNWIND CREATE … SET was accepted; the edge-write strategy can be simplified')
  })

  await probe('Batched delete cleans up', async () => {
    await query('UNWIND $rows AS row MATCH (n {id: row.id}) DETACH DELETE n', {
      rows: [{ id: A }, { id: B }, { id: C }],
    })
    const payload = await query('MATCH (n {id: $src}) RETURN n.id AS id', { src: A })
    if (payload.rows.length !== 0) throw new Error('probe nodes survived deletion')
    return 'probe ids removed; graph left clean'
  })

  await cleanup()

  const failed = results.filter((result) => result.status === 'fail')
  console.log(`\n${results.length - failed.length}/${results.length} probes passed\n`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\ncompatibility check failed:', error)
  process.exitCode = 1
})
