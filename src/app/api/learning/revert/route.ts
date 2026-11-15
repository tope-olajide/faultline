import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revertLearningUpdate } from '@/server/learning/engine'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const schema = z.object({ externalId: z.string().min(8).max(300) })

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Body must be { "externalId": string }' } },
        { status: 400 },
      )
    }

    const result = await revertLearningUpdate(parsed.data.externalId)
    return NextResponse.json(result, { status: result.reverted ? 200 : 409 })
  } catch (error) {
    return apiError(error)
  }
}
