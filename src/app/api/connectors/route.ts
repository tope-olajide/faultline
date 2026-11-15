import { NextResponse } from 'next/server'
import { listNodes } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const nodes = await listNodes('ConnectorSource', { limit: 200 })
    return NextResponse.json({ label: 'ConnectorSource', count: nodes.length, nodes })
  } catch (error) {
    return apiError(error)
  }
}
