import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyFeedback } from '@/server/learning/engine'
import { isRelationshipType } from '@/server/graph/schema'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  requestKey: z.string().min(8).max(200),
  outcome: z.enum([
    'confirm',
    'reject',
    'contributing_factor',
    'inconclusive',
    'stale_relationship',
    'incorrect_mapping',
  ]),
  actorRef: z.string().min(2).max(200),
  reason: z.string().min(3).max(1000),
  incidentExternalId: z.string().max(300).optional(),
  hypothesisExternalId: z.string().max(400).optional(),
  edge: z.object({
    src: z.number().int().positive(),
    dst: z.number().int().positive(),
    type: z.string().refine(isRelationshipType, 'Unknown relationship type'),
  }),
  pathSignature: z.string().max(400).optional(),
  evidenceExternalIds: z.array(z.string().max(300)).max(20).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_request',
            message: parsed.error.issues[0]?.message ?? 'Invalid feedback payload',
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      )
    }

    const result = await applyFeedback({
      ...parsed.data,
      edge: {
        src: parsed.data.edge.src,
        dst: parsed.data.edge.dst,
        type: parsed.data.edge.type,
      },
    })

    return NextResponse.json(result, { status: result.alreadyProcessed ? 200 : 201 })
  } catch (error) {
    return apiError(error)
  }
}
