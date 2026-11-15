import { NextResponse } from 'next/server'
import { runCompatibilityProbes } from '@/server/diagnostics'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const results = await runCompatibilityProbes()
    const passed = results.every((result) => result.status === 'pass')
    return NextResponse.json({ passed, results, ranAt: new Date().toISOString() }, { status: passed ? 200 : 502 })
  } catch (error) {
    return apiError(error)
  }
}
