#!/usr/bin/env node
/**
 * Seed the demo graph through the application API.
 *
 * The dataset and its write path live in the app (`src/server/graph/seed.ts`), so
 * this script deliberately drives the real API rather than duplicating the data.
 * Start the app first (`npm run dev`), then:
 *
 *   npm run db:seed           # seed / re-seed
 *   npm run db:reset          # reset then re-seed
 */
import process from 'node:process'

const APP = (process.env.FAULTLINE_APP_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const reset = process.argv.includes('--reset')

async function main() {
  console.log(`\nSeeding demo graph via ${APP}/api/demo/seed${reset ? ' (reset)' : ''}\n`)

  let response
  try {
    response = await fetch(`${APP}/api/demo/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (error) {
    console.error('Could not reach the application.')
    console.error('Start it with `npm run dev`, then retry.')
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
    return
  }

  const body = await response.json()
  if (!response.ok) {
    console.error(`Seeding failed (HTTP ${response.status}):`, body?.error?.message ?? body)
    process.exitCode = 1
    return
  }

  console.log(`  scope        ${body.scope}`)
  console.log(`  nodes        ${body.nodes} written (${body.deleted} ids cleared first)`)
  console.log(`  edges        ${body.edges} written`)
  console.log(`  requests     ${body.nodeRequests} node batches, ${body.edgeRequests} edge writes`)
  console.log(`  duration     ${body.durationMs} ms`)
  console.log(`  totals       ${body.totals.nodes} nodes · ${body.totals.relationships} relationships in the graph\n`)

  const labels = Object.entries(body.byLabel).sort((a, b) => b[1] - a[1])
  console.log('  by label:')
  for (const [label, count] of labels) console.log(`    ${String(count).padStart(3)}  ${label}`)
  console.log('\n  by relationship:')
  for (const [type, count] of Object.entries(body.byRelationship).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(3)}  ${type}`)
  }
  console.log('')
}

main().catch((error) => {
  console.error('seed failed:', error)
  process.exitCode = 1
})
