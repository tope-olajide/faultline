#!/usr/bin/env node
/**
 * Local development setup.
 *
 * Creates the HydraDB bearer-token file and data directories that
 * docker-compose.yml mounts, and copies .env.example to .env.local if it is
 * missing. Safe to re-run: existing files are left untouched.
 */
import { mkdir, copyFile, access, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const hydraDir = path.join(root, '.hydradb')
const tokenPath = path.join(hydraDir, 'auth-token')
const TOKEN = 'local-development-token-32-bytes'

async function exists(target) {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(path.join(hydraDir, 'store'), { recursive: true })
  await mkdir(path.join(hydraDir, 'cache'), { recursive: true })

  if (!(await exists(tokenPath))) {
    await writeFile(tokenPath, `${TOKEN}\n`, { encoding: 'utf8' })
    console.log('  created  .hydradb/auth-token (local development token)')
  } else {
    console.log('  exists   .hydradb/auth-token')
  }

  const envExample = path.join(root, '.env.example')
  const envLocal = path.join(root, '.env.local')
  if (!(await exists(envLocal)) && (await exists(envExample))) {
    await copyFile(envExample, envLocal)
    console.log('  created  .env.local from .env.example')
  } else {
    console.log('  exists   .env.local')
  }

  console.log('\nNext steps:')
  console.log('  1. npm run db:up          # start self-hosted HydraDB (Bolt 7687, HTTP 8443, admin 9090)')
  console.log('  2. npm run db:check       # verify the engine behaviours the app depends on')
  console.log('  3. npm run dev            # http://localhost:3000')
  console.log('  4. seed the demo graph from the overview page, or:')
  console.log('       curl -X POST http://localhost:3000/api/demo/seed -H "Content-Type: application/json" -d \'{}\'\n')
}

main().catch((error) => {
  console.error('setup failed:', error)
  process.exitCode = 1
})
