import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listNodes } from '@/server/graph/repository'
import { isGraphLabel } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  label: z.string().refine(isGraphLabel, 'Unknown graph label'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
})

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      )
    }

    const nodes = await listNodes(parsed.data.label, {
      limit: parsed.data.limit,
      skip: parsed.data.skip,
    })
    return NextResponse.json({ label: parsed.data.label, count: nodes.length, nodes })
  } catch (error) {
    return apiError(error)
  }
}
