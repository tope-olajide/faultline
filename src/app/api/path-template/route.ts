import { NextResponse } from 'next/server'
import type { NodeRecord } from '@/server/graph/repository'
import { createPathTemplate, trackPathTemplate } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { signature, pathScore, successCount, failureCount } = body as {
      signature: string
      pathScore?: number
      successCount?: number
      failureCount?: number
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: '`signature` is required and must be a string' } },
        { status: 400 }
      )
    }

    // Check idempotency
    const { alreadyProcessed } = await trackPathTemplate(signature)
    if (alreadyProcessed) {
      return NextResponse.json({ alreadyProcessed: true })
    }

    // Create new template
    const template = await createPathTemplate({
      signature,
      pathScore,
      successCount,
      failureCount,
    })

    return NextResponse.json({ alreadyProcessed: false, template })
  } catch (error) {
    return apiError(error)
  }
}