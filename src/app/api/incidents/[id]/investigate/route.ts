import { NextResponse } from 'next/server'
import { investigateIncident } from '@/server/investigation/engine'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const params = await context.params
    const incidentId = Number(params.id)
    if (!Number.isSafeInteger(incidentId) || incidentId <= 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Incident id must be a positive integer' } },
        { status: 400 },
      )
    }
    const result = await investigateIncident(incidentId, { persist: true })
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}
