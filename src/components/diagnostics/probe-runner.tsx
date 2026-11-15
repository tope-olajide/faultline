'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react'
import { Button, Badge, EmptyState } from '@/components/ui/primitives'

interface ProbeResult {
  name: string
  status: 'pass' | 'fail'
  detail: string
  ms: number
}

type State = { status: 'idle' } | { status: 'running' } | { status: 'done'; passed: boolean; results: ProbeResult[] } | { status: 'error'; message: string }

export function ProbeRunner() {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      const response = await fetch('/api/diagnostics/probe', { method: 'POST' })
      const body = (await response.json()) as { passed?: boolean; results?: ProbeResult[]; error?: { message?: string } }
      if (!body.results) throw new Error(body.error?.message ?? `Probe failed (HTTP ${response.status})`)
      setState({ status: 'done', passed: Boolean(body.passed), results: body.results })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={run} disabled={state.status === 'running'} aria-busy={state.status === 'running'}>
          {state.status === 'running' ? (
            <Loader2 aria-hidden size={13} className="animate-spin" />
          ) : (
            <Play aria-hidden size={13} />
          )}
          Run compatibility probes
        </Button>
        {state.status === 'done' ? (
          <Badge tone={state.passed ? 'success' : 'danger'}>{state.passed ? 'all probes passed' : 'probe failures'}</Badge>
        ) : null}
      </div>

      {state.status === 'error' ? <p className="text-[12px] text-danger">{state.message}</p> : null}

      {state.status === 'done' ? (
        <ul className="flex flex-col gap-1.5">
          {state.results.map((result) => (
            <li key={result.name} className="rounded-md border border-line bg-canvas/40 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {result.status === 'pass' ? (
                    <CheckCircle2 aria-hidden size={14} className="mt-0.5 shrink-0 text-success" />
                  ) : (
                    <XCircle aria-hidden size={14} className="mt-0.5 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-ink">{result.name}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{result.detail}</p>
                  </div>
                </div>
                <span className="mono shrink-0 text-[10.5px] text-ink-faint">{result.ms} ms</span>
              </div>
            </li>
          ))}
        </ul>
      ) : state.status === 'idle' ? (
        <EmptyState
          title="Probes not run yet"
          description="Runs idempotency, edge-property, traversal, dialect-guard and cleanup checks against throwaway ids, then removes them."
        />
      ) : null}
    </div>
  )
}
