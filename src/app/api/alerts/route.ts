import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { demoScope } from '@/server/config'
import { demoEntityId } from '@/server/graph/ids'
import { getIncidentByExternalId, getServiceByExternalId } from '@/server/graph/reads'
import { upsertEdges, upsertNodes } from '@/server/graph/repository'
import { apiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  fingerprint: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'fingerprint may contain letters, digits, dot, underscore, colon and dash'),
  title: z.string().min(3).max(300),
  summary: z.string().min(3).max(2000),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'warning', 'info']),
  serviceExternalId: z.string().min(3).max(300),
  startedAt: z.string().datetime().optional(),
  ownerTeam: z.string().max(120).optional(),
})

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/**
 * Inbound alert ingestion.
 *
 * The endpoint is disabled unless `FAULTLINE_ALERT_TOKEN` is set. It creates or
 * updates exactly one Incident (and its Alert) per fingerprint, links both to the
 * affected Service, and returns the incident id. Investigation is a separate
 * step so an alert storm cannot trigger unbounded traversal.
 */
export async function POST(request: Request) {
  try {
    const expected = process.env.FAULTLINE_ALERT_TOKEN
    if (!expected || expected.length < 16) {
      return NextResponse.json(
        {
          error: {
            code: 'ingestion_disabled',
            message: 'Set FAULTLINE_ALERT_TOKEN (16+ characters) to enable alert ingestion.',
          },
        },
        { status: 503 },
      )
    }

    const header = request.headers.get('authorization') ?? ''
    const supplied = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : (request.headers.get('x-faultline-token') ?? '')
    if (!timingSafeEqual(digest(supplied), digest(expected))) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Invalid alert ingestion token.' } },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_request',
            message: parsed.error.issues[0]?.message ?? 'Invalid alert payload',
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      )
    }

    const service = await getServiceByExternalId(parsed.data.serviceExternalId)
    if (!service) {
      return NextResponse.json(
        {
          error: {
            code: 'unknown_service',
            message: `No service with external_id ${parsed.data.serviceExternalId}.`,
          },
        },
        { status: 422 },
      )
    }

    const incidentExternalId = `incident/alert/${parsed.data.fingerprint}`
    const existing = await getIncidentByExternalId(incidentExternalId)
    if (existing) {
      return NextResponse.json(
        {
          duplicate: true,
          incident: {
            id: existing.id,
            externalId: existing.externalId,
            status: existing.status,
            investigateUrl: `/incidents/${existing.id}`,
          },
        },
        { status: 200 },
      )
    }

    const alertExternalId = `alert/${parsed.data.fingerprint}`
    const startedAt = parsed.data.startedAt ?? new Date().toISOString()
    const alertId = demoEntityId('Alert', alertExternalId, demoScope)
    const incidentId = demoEntityId('Incident', incidentExternalId, demoScope)

    await upsertNodes(
      [
        {
          label: 'Alert',
          externalId: alertExternalId,
          properties: {
            fingerprint: parsed.data.fingerprint,
            name: parsed.data.title,
            severity: parsed.data.severity,
            status: 'firing',
            started_at: startedAt,
            ended_at: '',
            summary: parsed.data.summary,
            source: 'webhook',
            data_origin: 'alert-webhook',
          },
        },
        {
          label: 'Incident',
          externalId: incidentExternalId,
          properties: {
            title: parsed.data.title,
            severity: parsed.data.severity,
            status: 'Investigating',
            started_at: startedAt,
            detected_at: startedAt,
            resolved_at: '',
            owner_team: parsed.data.ownerTeam ?? service.ownerTeam ?? 'platform-sre',
            summary: parsed.data.summary,
            impact: '',
            benchmark_split: 'live',
            ground_truth_cause: '',
            ground_truth_evidence: '',
            family: '',
            source: 'webhook',
            data_origin: 'alert-webhook',
          },
        },
      ],
      demoScope,
    )

    await upsertEdges(
      [
        { type: 'TRIGGERED', src: alertId, dst: incidentId },
        { type: 'AFFECTS', src: alertId, dst: service.id },
        { type: 'AFFECTS', src: incidentId, dst: service.id },
      ],
      demoScope,
    )

    return NextResponse.json(
      {
        duplicate: false,
        incident: {
          id: incidentId,
          externalId: incidentExternalId,
          status: 'Investigating',
          investigateUrl: `/incidents/${incidentId}`,
        },
        alert: { id: alertId, externalId: alertExternalId },
        service: { id: service.id, externalId: service.externalId, name: service.name },
      },
      { status: 201 },
    )
  } catch (error) {
    return apiError(error)
  }
}
