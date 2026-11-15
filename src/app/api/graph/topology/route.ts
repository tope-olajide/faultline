import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDependencies } from '@/server/graph/repository'
import { isGraphLabel } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  id: z.coerce.number().int().positive(),
  label: z.string().refine(isGraphLabel, 'Unknown graph label'),
  mode: z.enum(['current', 'history']).optional(),
  asOf: z.string().optional(),
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

    const result = await getDependencies(parsed.data.id, parsed.data.label, {
      mode: parsed.data.mode,
      asOf: parsed.data.asOf,
    })
    return NextResponse.json(result)
  } catch (error) {
    return apiError(error)
  }
}
