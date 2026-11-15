import { NextResponse } from 'next/server'
import { getNeighborhood, getNode } from '@/server/graph/repository'
import { isGraphLabel } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const label = new URL(request.url).searchParams.get('label')
    if (!label || !isGraphLabel(label)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`label` must be a known graph label' } },
        { status: 400 },
      )
    }

    const nodeId = Number(id)
    if (!Number.isSafeInteger(nodeId) || nodeId <= 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`id` must be a positive integer vertex id' } },
        { status: 400 },
      )
    }

    const node = await getNode(nodeId, label)
    if (!node) {
      return NextResponse.json({ error: { code: 'not_found', message: 'No such node in this graph' } }, { status: 404 })
    }

    const edges = await getNeighborhood(nodeId, label)
    return NextResponse.json({ node, edges })
  } catch (error) {
    return apiError(error)
  }
}
