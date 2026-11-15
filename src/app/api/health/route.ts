import { NextResponse } from 'next/server'
import { getGraphHealth } from '@/server/health'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const health = await getGraphHealth()
    return NextResponse.json(health, { status: health.reachable ? 200 : 503 })
  } catch (error) {
    return apiError(error)
  }
}
