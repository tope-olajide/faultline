import { NextResponse } from 'next/server'
import { getNode } from '@/server/graph/repository'
import { getEvidencePayload } from '@/server/evidence/object-store'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const nodeId = Number(id)
    if (!Number.isSafeInteger(nodeId) || nodeId <= 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`id` must be a positive integer vertex id' } },
        { status: 400 },
      )
    }

    const node = await getNode(nodeId, 'Evidence')
    if (!node) {
      return NextResponse.json({ error: { code: 'not_found', message: 'No such evidence node' } }, { status: 404 })
    }

    const uri = String(node.properties.object_uri ?? '')
    const expectedHash = String(node.properties.content_hash ?? '')
    const loaded = await getEvidencePayload(uri, expectedHash)

    return NextResponse.json({
      node,
      payload: loaded?.payload ?? null,
      object: loaded
        ? { uri: loaded.uri, contentHash: loaded.contentHash, bytes: loaded.bytes, verified: loaded.verified }
        : null,
    })
  } catch (error) {
    return apiError(error)
  }
}
