'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

interface ExperimentResponse {
  improvement: { top1Delta: number; recallDelta: number; evidencePrecisionDelta: number }
  training: { cases: number; confirmed: number }
  error?: { message?: string }
}

type State =
  | { status: 'idle' }
  | { status: 'running'; elapsed: number }
  | { status: 'done'; response: ExperimentResponse }
  | { status: 'error'; message: string }

export function RunExperiment({ hasRuns }: { hasRuns: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'idle' })

  useEffect(() => {
    if (state.status !== 'running') return
    const timer = setInterval(() => {
      setState((current) =>
        current.status === 'running' ? { status: 'running', elapsed: current.elapsed + 1 } : current,
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [state.status])

  const run = async () => {
    setState({ status: 'running', elapsed: 0 })
    try {
      const response = await fetch('/api/evaluation/run', { method: 'POST' })
      const body = (await response.json()) as ExperimentResponse
      if (!response.ok) throw new Error(body.error?.message ?? `Evaluation failed (HTTP ${response.status})`)
      setState({ status: 'done', response: body })
      router.refresh()
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const running = state.status === 'running'

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="primary" onClick={run} disabled={running} aria-busy={running}>
        {running ? (
          <Loader2 aria-hidden size={13} className="animate-spin" />
        ) : (
          <FlaskConical aria-hidden size={13} />
        )}
        {running ? `Measuring… ${state.elapsed}s` : hasRuns ? 'Re-run experiment' : 'Run experiment'}
      </Button>
      <div role="status" aria-live="polite" className="max-w-[420px] text-right text-[11px] leading-snug">
        {state.status === 'done' ? (
          <span className={state.response.improvement.top1Delta > 0 ? 'text-success' : 'text-warning'}>
            Held-out Top-1 delta {(state.response.improvement.top1Delta * 100).toFixed(0)} points after{' '}
            {state.response.training.confirmed}/{state.response.training.cases} training confirmations.
          </span>
        ) : null}
        {state.status === 'error' ? <span className="text-danger">{state.message}</span> : null}
        {state.status === 'idle' ? (
          <span className="text-ink-faint">
            Measures 6 held-out incidents across three engines, trains on 6 separate incidents, then
            measures again.
          </span>
        ) : null}
        {running ? (
          <span className="text-ink-faint">
            Running investigations against HydraDB. This takes roughly 30–90 seconds.
          </span>
        ) : null}
      </div>
    </div>
  )
}
