'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Loader2, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

interface SeedSummary {
  totals: { nodes: number; relationships: number }
  durationMs: number
  scope: string
}

type State =
  | { status: 'idle' }
  | { status: 'running'; action: 'seed' | 'reset' }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string }

export function SeedControls({ hasData }: { hasData: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [state, setState] = useState<State>({ status: 'idle' })

  const run = useCallback(
    async (reset: boolean) => {
      setState({ status: 'running', action: reset ? 'reset' : 'seed' })
      try {
        const response = await fetch('/api/demo/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset }),
        })
        const body = (await response.json()) as SeedSummary & { error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? `Seeding failed (HTTP ${response.status})`)

        setState({
          status: 'done',
          message: `${body.totals.nodes} nodes · ${body.totals.relationships} relationships written in ${body.durationMs} ms`,
        })
        startTransition(() => router.refresh())
      } catch (error) {
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    },
    [router],
  )

  const running = state.status === 'running'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={hasData ? 'secondary' : 'primary'}
          onClick={() => run(false)}
          disabled={running}
          aria-busy={running}
        >
          {running && state.action === 'seed' ? (
            <Loader2 aria-hidden size={13} className="animate-spin" />
          ) : (
            <Play aria-hidden size={13} />
          )}
          {hasData ? 'Re-seed demo graph' : 'Seed demo graph'}
        </Button>
        {hasData ? (
          <Button variant="ghost" onClick={() => run(true)} disabled={running} aria-busy={running}>
            {running && state.action === 'reset' ? (
              <Loader2 aria-hidden size={13} className="animate-spin" />
            ) : (
              <RotateCcw aria-hidden size={13} />
            )}
            Reset
          </Button>
        ) : null}
      </div>

      <p className="min-h-[16px] text-[11.5px] leading-snug text-ink-faint" role="status" aria-live="polite">
        {state.status === 'done' ? <span className="text-success">{state.message}</span> : null}
        {state.status === 'error' ? <span className="text-danger">{state.message}</span> : null}
        {state.status === 'running'
          ? state.action === 'reset'
            ? 'Clearing owned ids, then writing nodes and relationships…'
            : 'Writing nodes and relationships to HydraDB…'
          : null}
        {state.status === 'idle'
          ? hasData
            ? 'Re-seeding clears the ids this dataset owns, then rewrites them deterministically.'
            : 'Writes the checkout platform dataset into HydraDB.'
          : null}
      </p>
    </div>
  )
}
