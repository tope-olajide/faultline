import { NextResponse } from 'next/server'
import { z } from 'zod'
import { seedDemoGraph } from '@/server/graph/seed'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ reset: z.boolean().optional() }).optional()

export async function POST(request: Request) {
  try {
    let reset = false
    const text = await request.text()
    if (text.trim().length > 0) {
      const parsed = bodySchema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'invalid_request', message: 'Body must be { "reset"?: boolean }' } },
          { status: 400 },
        )
      }
      reset = parsed.data?.reset ?? false
    }

    const summary = await seedDemoGraph({ reset })
    return NextResponse.json(summary)
  } catch (error) {
    return apiError(error)
  }
}
