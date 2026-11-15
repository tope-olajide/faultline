'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/primitives'

interface FeedbackResponse {
  applied: boolean
  alreadyProcessed: boolean
  outcome: string
  deltas: { confidence: number; support: number; contradiction: number }
  pathTemplate: { signature: string; score: number; success: number; failure: number } | null
  error?: { message?: string }
}

type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'done'; response: FeedbackResponse }
  | { status: 'error'; message: string }

const OUTCOMES = [
  { value: 'confirm', label: 'Confirm root cause' },
  { value: 'contributing_factor', label: 'Contributing factor' },
  { value: 'reject', label: 'Reject — not the cause' },
  { value: 'inconclusive', label: 'Inconclusive' },
  { value: 'stale_relationship', label: 'Dependency is stale' },
  { value: 'incorrect_mapping', label: 'Incorrect entity mapping' },
] as const

export function FeedbackForm({
  incidentExternalId,
  hypothesisExternalId,
  pathSignature,
  edge,
  actorRef,
}: {
  incidentExternalId: string
  hypothesisExternalId: string
  pathSignature: string
  edge: { src: number; dst: number; type: string } | null
  actorRef: string
}) {
  const router = useRouter()
  const requestKey = useRef<string>('')
  const [outcome, setOutcome] = useState<string>('confirm')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  if (!requestKey.current) {
    requestKey.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  if (!edge) {
    return (
      <div className="rounded-md border border-line bg-canvas/50 p-3 text-[12px] leading-relaxed text-ink-faint">
        This hypothesis has no learnable relationship. Feedback applies to a specific
        relationship, so it is disabled here.
      </div>
    )
  }

  const submit = async () => {
    setState({ status: 'submitting' })
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestKey: requestKey.current,
          outcome,
          actorRef,
          reason: reason.trim().length > 0 ? reason.trim() : 'No reason supplied.',
          incidentExternalId,
          hypothesisExternalId,
          pathSignature,
          edge,
        }),
      })
      const body = (await response.json()) as FeedbackResponse
      if (!response.ok) throw new Error(body.error?.message ?? `Feedback failed (HTTP ${response.status})`)
      setState({ status: 'done', response: body })
      // The investigator re-runs on refresh, so the ranking reflects the learned state.
      setTimeout(() => router.refresh(), 1200)
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const submitting = state.status === 'submitting'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {OUTCOMES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setOutcome(option.value)}
            aria-pressed={outcome === option.value}
            className={`rounded-md border px-2 py-1.5 text-left text-[11.5px] transition-colors ${
              outcome === option.value
                ? 'border-accent/50 bg-accent/10 text-ink'
                : 'border-line bg-canvas/40 text-ink-dim hover:border-line-strong hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Reason</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="What did you verify, and against which evidence?"
          className="w-full resize-none rounded-md border border-line bg-canvas/60 px-2.5 py-2 text-[12px] text-ink placeholder:text-ink-faint/70 focus:border-line-strong focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={submit} disabled={submitting} aria-busy={submitting}>
          {submitting ? (
            <Loader2 aria-hidden size={13} className="animate-spin" />
          ) : outcome === 'reject' || outcome === 'incorrect_mapping' ? (
            <ThumbsDown aria-hidden size={13} />
          ) : (
            <ThumbsUp aria-hidden size={13} />
          )}
          Record feedback
        </Button>
        <span className="text-[10.5px] leading-tight text-ink-faint">
          Writes a ledger entry and updates this relationship.
        </span>
      </div>

      <div role="status" aria-live="polite" className="min-h-[16px] text-[11.5px] leading-snug">
        {state.status === 'done' ? (
          <span className="text-success">
            {state.response.alreadyProcessed ? (
              'This feedback was already applied (idempotent replay).'
            ) : (
              <>
                Applied · confidence {state.response.deltas.confidence >= 0 ? '+' : ''}
                {state.response.deltas.confidence.toFixed(3)} · support{' '}
                {state.response.deltas.support >= 0 ? '+' : ''}
                {state.response.deltas.support} · contradictions{' '}
                {state.response.deltas.contradiction >= 0 ? '+' : ''}
                {state.response.deltas.contradiction}
                {state.response.pathTemplate
                  ? ` · path template now ${state.response.pathTemplate.score.toFixed(2)}`
                  : ''}
              </>
            )}
          </span>
        ) : null}
        {state.status === 'error' ? <span className="text-danger">{state.message}</span> : null}
        {state.status === 'idle' ? (
          <span className="text-ink-faint">
            Confirming raises support and path utility; rejecting lowers both. Inconclusive changes
            no numbers.
          </span>
        ) : null}
      </div>
    </div>
  )
}
