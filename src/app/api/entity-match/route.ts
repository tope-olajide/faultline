import { NextResponse } from 'next/server'
import type { NodeRecord } from '@/server/graph/repository'
import { createEntityMatchCandidate } from '@/server/graph/repository'
import type { GraphLabel } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { leftExternalId, rightExternalId, leftLabel, rightLabel, similarityScore } = body as {
      leftExternalId: string
      rightExternalId: string
      leftLabel: GraphLabel
      rightLabel: GraphLabel
      similarityScore: number
    }

    if (!leftExternalId || typeof leftExternalId !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`leftExternalId` is required and must be a string' } },
        { status: 400 }
      )
    }

    if (!rightExternalId || typeof rightExternalId !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`rightExternalId` is required and must be a string' } },
        { status: 400 }
      )
    }

    if (!leftLabel) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`leftLabel` is required' } },
        { status: 400 }
      )
    }

    if (!rightLabel) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`rightLabel` is required' } },
        { status: 400 }
      )
    }

    if (similarityScore < 0 || similarityScore > 1) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`similarityScore` must be between 0 and 1' } },
        { status: 400 }
      )
    }

    const candidate = await createEntityMatchCandidate({
      leftExternalId,
      rightExternalId,
      leftLabel,
      rightLabel,
      similarityScore,
    })

    return NextResponse.json({ candidate })
  } catch (error) {
    return apiError(error)
  }
}