import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findPathsBetween } from '@/server/graph/repository'
import { isRelationshipType, type RelationshipType } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  source: z.coerce.number().int().positive(),
  target: z.coerce.number().int().positive(),
  maxLen: z.coerce.number().int().min(1).max(6).optional(),
  types: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      )
    }

    const types = (parsed.data.types ?? 'DEPENDS_ON,CALLS')
      .split(',')
      .map((value) => value.trim())
      .filter(isRelationshipType) as RelationshipType[]

    const paths = await findPathsBetween(parsed.data.source, parsed.data.target, {
      maxLen: parsed.data.maxLen,
      relTypes: types.length > 0 ? types : undefined,
    })
    return NextResponse.json({ count: paths.length, paths })
  } catch (error) {
    return apiError(error)
  }
}
