import { NextResponse } from 'next/server'
import type { NeighborEdge } from '@/server/graph/repository'
import { reasonCausally } from '@/server/llm/qwen'
import { getNeighborhood } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question, nodeId, label } = body as {
      question: string
      nodeId: number
      label?: string
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`question` is required and must be a string' } },
        { status: 400 }
      )
    }

    if (!Number.isInteger(nodeId) || nodeId <= 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`nodeId` must be a positive integer' } },
        { status: 400 }
      )
    }

    const effectiveLabel = label ?? 'Service'

    // fetch neighbourhood (outgoing + incoming edges) to give the LLM context
    const neighborhood = await getNeighborhood(nodeId, effectiveLabel as 'Service')
    const edges: NeighborEdge[] = neighborhood

    // build a neighbour summary for the prompt
    const neighborSummary = edges
      .map(
        (e: NeighborEdge) =>
          `- ${e.direction === 'outgoing' ? 'outgoing' : 'incoming'} ${e.edge.type} → ${e.neighborLabel} (${e.neighborId})`
      )
      .join('\n')

    const analysis = await reasonCausally(effectiveLabel, nodeId, neighborSummary, question)

    return NextResponse.json({
      question,
      nodeId,
      label: effectiveLabel,
      ...analysis,
      neighbourSummary: neighborSummary,
    })
  } catch (error) {
    return apiError(error)
  }
}