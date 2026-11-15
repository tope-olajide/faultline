import { NextResponse } from 'next/server'
import type { NodeRecord } from '@/server/graph/repository'
import { createEvaluationRun } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question, nodeId, label, analysis, confidence, suggestedEdges, dataGap } = body as {
      question: string
      nodeId: number
      label: string
      analysis: string
      confidence: number
      suggestedEdges: Array<{ type: string; reason: string }>
      dataGap: string
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

    if (!analysis || typeof analysis !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`analysis` is required and must be a string' } },
        { status: 400 }
      )
    }

    if (confidence < 0 || confidence > 1) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`confidence` must be between 0 and 1' } },
        { status: 400 }
      )
    }

    const evaluation = await createEvaluationRun({
      question,
      nodeId,
      label,
      analysis,
      confidence,
      suggestedEdges,
      dataGap,
    })

    return NextResponse.json({ evaluation })
  } catch (error) {
    return apiError(error)
  }
}