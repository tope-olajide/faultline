import { NextResponse } from 'next/server'
import { graphStats } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get('fresh') === 'true'
    return NextResponse.json(await graphStats({ fresh }))
  } catch (error) {
    return apiError(error)
  }
}
