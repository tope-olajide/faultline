import { NextResponse } from 'next/server'
import { listIncidents } from '@/server/graph/reads'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const incidents = await listIncidents(100)
    return NextResponse.json({ count: incidents.length, incidents })
  } catch (error) {
    return apiError(error)
  }
}
