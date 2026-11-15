import { NextResponse } from 'next/server'
import { HydraDbError, HydraDbUnavailableError } from './hydradb/client'

/**
 * Map internal failures onto HTTP responses without leaking query text or tokens.
 *
 * An unreachable engine is a 503 on purpose: there is no mock graph fallback, and
 * the UI shows the specific cause rather than an empty dataset.
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof HydraDbUnavailableError) {
    return NextResponse.json(
      {
        error: {
          code: 'graph_unavailable',
          message: error.message,
          hint: 'Start the self-hosted HydraDB node with `npm run db:up`, then retry.',
        },
      },
      { status: 503 },
    )
  }

  if (error instanceof HydraDbError) {
    const unsupported = error.message.includes('not supported yet')
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(unsupported ? { hint: 'This query shape is outside HydraDB\'s OpenCypher subset.' } : {}),
        },
      },
      { status: error.status >= 400 && error.status < 500 ? 400 : 502 },
    )
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error'
  return NextResponse.json({ error: { code: 'internal_error', message } }, { status: 500 })
}
