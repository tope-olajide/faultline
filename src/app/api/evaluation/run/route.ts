import { NextResponse } from 'next/server'
import { runExperiment } from '@/server/evaluation/engine'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Run the full evaluation experiment: measure all three engines on held-out
 * incidents, apply verified learning from the training split, measure again.
 */
export async function POST() {
  try {
    const result = await runExperiment()
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}
