import Link from 'next/link'
import { ArrowUpRight, FlaskConical, Scale } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  KeyValue,
  Meter,
  Panel,
  PanelBody,
  PanelHeader,
  Stat,
} from '@/components/ui/primitives'
import { RunExperiment } from '@/components/evaluation/run-experiment'
import { getGraphHealth } from '@/server/health'
import { listEvaluationRuns, type EvaluationRunRecord } from '@/server/graph/reads'
import { DATASET_VERSION } from '@/server/graph/benchmark'
import { formatUtc } from '@/lib/format'

export const dynamic = 'force-dynamic'

function latestByKey(runs: EvaluationRunRecord[]): Map<string, EvaluationRunRecord> {
  const map = new Map<string, EvaluationRunRecord>()
  for (const run of runs) {
    const key = `${run.round}:${run.engine}`
    const existing = map.get(key)
    if (!existing || run.completedAt > existing.completedAt) map.set(key, run)
  }
  return map
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function MetricRow({
  label,
  hint,
  values,
  invert = false,
}: {
  label: string
  hint?: string
  values: Array<number | null>
  invert?: boolean
}) {
  const present = values.filter((value): value is number => value !== null)
  const best = present.length > 0 ? (invert ? Math.min(...present) : Math.max(...present)) : null
  return (
    <tr>
      <td className="min-w-[190px]">
        <div className="text-[12.5px] font-medium text-ink">{label}</div>
        {hint ? <div className="mt-0.5 text-[10.5px] text-ink-faint">{hint}</div> : null}
      </td>
      {values.map((value, index) => (
        <td key={index} className="text-right">
          {value === null ? (
            <span className="text-ink-faint">—</span>
          ) : (
            <span
              className={`mono text-[12.5px] ${
                best !== null && value === best ? 'font-semibold text-success' : 'text-ink-dim'
              }`}
            >
              {value.toFixed(3)}
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}

export default async function EvaluationPage() {
  const health = await getGraphHealth()
  const runs = health.hasDemoData ? await listEvaluationRuns(40) : []
  const latest = latestByKey(runs)

  const vectorR0 = latest.get('R0:vector') ?? null
  const fixedR0 = latest.get('R0:fixed-graph') ?? null
  const adaptiveR0 = latest.get('R0:adaptive-graph') ?? null
  const adaptiveR1 = latest.get('R1:adaptive-graph') ?? null
  const fixedR1 = latest.get('R1:fixed-graph') ?? null
  const vectorR1 = latest.get('R1:vector') ?? null

  const baseline = adaptiveR0 ?? fixedR0
  const after = adaptiveR1
  const delta = baseline && after ? after.metrics.top1Accuracy - baseline.metrics.top1Accuracy : null

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Evaluation laboratory</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">
            Does learning actually improve investigation?
          </h1>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-ink-faint">
            Three engines, one held-out benchmark, one measurement protocol. The adaptive graph is trained on
            six incidents and scored on six different incidents it never saw. Vector-only and fixed-graph
            runs are controls.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RunExperiment hasRuns={runs.length > 0} />
          <span className="mono text-[10px] text-ink-faint">{DATASET_VERSION}</span>
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Evaluation reads the benchmark graph, so it cannot run without the engine."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      {health.reachable && !health.hasDemoData ? (
        <Panel>
          <EmptyState
            icon={<FlaskConical aria-hidden size={22} strokeWidth={1.6} />}
            title="No benchmark in the graph"
            description="Seed the demo dataset to load twelve benchmark incidents (six training, six held-out)."
          />
        </Panel>
      ) : null}

      {health.hasDemoData && runs.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<FlaskConical aria-hidden size={22} strokeWidth={1.6} />}
            title="No experiment has been run"
            description="Run the experiment to measure all three engines before and after a verified learning round."
          />
        </Panel>
      ) : null}

      {health.hasDemoData && runs.length > 0 ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Adaptive · held-out Top-1"
              value={after ? pct(after.metrics.top1Accuracy) : '—'}
              hint={after ? `round ${after.round} · ${after.caseCount} cases` : 'run the experiment'}
              accent
            />
            <Stat
              label="Fixed graph · Top-1"
              value={fixedR1 ? pct(fixedR1.metrics.top1Accuracy) : fixedR0 ? pct(fixedR0.metrics.top1Accuracy) : '—'}
              hint="Static baseline weights, learning ignored"
            />
            <Stat
              label="Vector-only · Top-1"
              value={vectorR1 ? pct(vectorR1.metrics.top1Accuracy) : vectorR0 ? pct(vectorR0.metrics.top1Accuracy) : '—'}
              hint="TF-IDF retrieval, no graph traversal"
            />
            <Stat
              label="Learning delta"
              value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)} pts`}
              hint="Adaptive before → after training"
            />
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Results"
                title="Engine comparison"
                description="The same six held-out incidents, the same candidate universe and the same evidence corpus."
                actions={<Badge tone="cyan">{after?.caseCount ?? 0} held-out cases</Badge>}
              />
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      <th scope="col" className="text-right">
                        Vector-only
                      </th>
                      <th scope="col" className="text-right">
                        Fixed graph
                      </th>
                      <th scope="col" className="text-right">
                        Adaptive · before
                      </th>
                      <th scope="col" className="text-right">
                        Adaptive · after
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <MetricRow
                      label="Root-cause Top-1"
                      hint="Did the leading cause match the verified cause?"
                      values={[
                        vectorR1?.metrics.top1Accuracy ?? vectorR0?.metrics.top1Accuracy ?? null,
                        fixedR1?.metrics.top1Accuracy ?? fixedR0?.metrics.top1Accuracy ?? null,
                        adaptiveR0?.metrics.top1Accuracy ?? baseline?.metrics.top1Accuracy ?? null,
                        adaptiveR1?.metrics.top1Accuracy ?? null,
                      ]}
                    />
                    <MetricRow
                      label="Root-cause Recall@3"
                      hint="Was the verified cause in the top three?"
                      values={[
                        vectorR1?.metrics.recallAt3 ?? vectorR0?.metrics.recallAt3 ?? null,
                        fixedR1?.metrics.recallAt3 ?? fixedR0?.metrics.recallAt3 ?? null,
                        adaptiveR0?.metrics.recallAt3 ?? baseline?.metrics.recallAt3 ?? null,
                        adaptiveR1?.metrics.recallAt3 ?? null,
                      ]}
                    />
                    <MetricRow
                      label="Evidence precision"
                      hint="Share of the leading hypothesis' evidence that is reference-relevant"
                      values={[
                        vectorR1?.metrics.evidencePrecision ?? vectorR0?.metrics.evidencePrecision ?? null,
                        fixedR1?.metrics.evidencePrecision ?? fixedR0?.metrics.evidencePrecision ?? null,
                        adaptiveR0?.metrics.evidencePrecision ?? baseline?.metrics.evidencePrecision ?? null,
                        adaptiveR1?.metrics.evidencePrecision ?? null,
                      ]}
                    />
                    <MetricRow
                      label="Evidence recall"
                      hint="Share of the reference evidence the leading hypothesis retrieved"
                      values={[
                        vectorR1?.metrics.evidenceRecall ?? vectorR0?.metrics.evidenceRecall ?? null,
                        fixedR1?.metrics.evidenceRecall ?? fixedR0?.metrics.evidenceRecall ?? null,
                        adaptiveR0?.metrics.evidenceRecall ?? baseline?.metrics.evidenceRecall ?? null,
                        adaptiveR1?.metrics.evidenceRecall ?? null,
                      ]}
                    />
                    <MetricRow
                      label="False-positive rate"
                      hint="1 − evidence precision"
                      values={[
                        vectorR1?.metrics.falsePositiveRate ?? vectorR0?.metrics.falsePositiveRate ?? null,
                        fixedR1?.metrics.falsePositiveRate ?? fixedR0?.metrics.falsePositiveRate ?? null,
                        adaptiveR0?.metrics.falsePositiveRate ?? baseline?.metrics.falsePositiveRate ?? null,
                        adaptiveR1?.metrics.falsePositiveRate ?? null,
                      ]}
                      invert
                    />
                    <MetricRow
                      label="Mean latency (ms)"
                      hint="Wall-clock investigation time for one incident"
                      values={[
                        vectorR1?.metrics.meanLatencyMs ?? vectorR0?.metrics.meanLatencyMs ?? null,
                        fixedR1?.metrics.meanLatencyMs ?? fixedR0?.metrics.meanLatencyMs ?? null,
                        adaptiveR0?.metrics.meanLatencyMs ?? baseline?.metrics.meanLatencyMs ?? null,
                        adaptiveR1?.metrics.meanLatencyMs ?? null,
                      ]}
                      invert
                    />
                    <MetricRow
                      label="Traversal efficiency"
                      hint="Relevant evidence retrieved per 100 graph nodes visited"
                      values={[
                        vectorR1?.metrics.traversalEfficiency ?? vectorR0?.metrics.traversalEfficiency ?? null,
                        fixedR1?.metrics.traversalEfficiency ?? fixedR0?.metrics.traversalEfficiency ?? null,
                        adaptiveR0?.metrics.traversalEfficiency ?? baseline?.metrics.traversalEfficiency ?? null,
                        adaptiveR1?.metrics.traversalEfficiency ?? null,
                      ]}
                    />
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="flex flex-col gap-3">
              <Panel>
                <PanelHeader eyebrow="Top-1" title="Root-cause accuracy" />
                <PanelBody className="flex flex-col gap-3 pt-2">
                  {[
                    { label: 'Vector-only', value: vectorR1?.metrics.top1Accuracy ?? vectorR0?.metrics.top1Accuracy ?? 0, tone: 'cyan' as const },
                    { label: 'Fixed graph', value: fixedR1?.metrics.top1Accuracy ?? fixedR0?.metrics.top1Accuracy ?? 0, tone: 'accent' as const },
                    { label: 'Adaptive · before', value: adaptiveR0?.metrics.top1Accuracy ?? baseline?.metrics.top1Accuracy ?? 0, tone: 'accent' as const },
                    { label: 'Adaptive · after', value: adaptiveR1?.metrics.top1Accuracy ?? 0, tone: 'success' as const },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-[11.5px]">
                        <span className="text-ink-dim">{row.label}</span>
                        <span className="mono text-ink">{pct(row.value)}</span>
                      </div>
                      <Meter value={row.value} max={1} tone={row.tone} />
                    </div>
                  ))}
                  <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
                    Bars are measured from the persisted runs, not from a target value.
                  </p>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader eyebrow="Protocol" title="How this is measured" />
                <PanelBody className="pt-1">
                  <dl>
                    <KeyValue label="Dataset">12 incidents · 4 failure families</KeyValue>
                    <KeyValue label="Training split">6 incidents, labels consulted</KeyValue>
                    <KeyValue label="Held-out split">6 incidents, never trained on</KeyValue>
                    <KeyValue label="Learning signal">Confirmed relationship + path signature</KeyValue>
                    <KeyValue label="Vector engine">TF-IDF cosine over evidence summaries</KeyValue>
                    <KeyValue label="Fixed engine">Frozen baseline edge reliability</KeyValue>
                    <KeyValue label="Adaptive engine">Live reliability + path utility</KeyValue>
                    <KeyValue label="Untrained round">Frozen reliability, no path templates</KeyValue>
                    <KeyValue label="Completed">{after ? formatUtc(after.completedAt) : '—'}</KeyValue>
                  </dl>
                  <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-faint">
                    <Scale aria-hidden size={11} className="mt-0.5 shrink-0" />
                    Vector-only here is lexical TF-IDF retrieval, not embeddings. Confidence scores are
                    uncalibrated relative scores. The benchmark is small and partially synthetic; treat the
                    delta as a demonstration of the learning mechanism, not a production accuracy claim.
                  </p>
                </PanelBody>
              </Panel>
            </div>
          </div>

          {after ? (
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Audit"
                title="Per-incident outcomes · adaptive after learning"
                description="Every held-out case, with the ranking the engine actually produced."
                actions={
                  <Link href="/incidents" className="link-quiet inline-flex items-center gap-1 text-[11.5px] text-accent">
                    Open incidents <ArrowUpRight aria-hidden size={11} />
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Incident</th>
                      <th scope="col">Family</th>
                      <th scope="col">Verified cause</th>
                      <th scope="col">Top-1</th>
                      <th scope="col">Top ranking</th>
                      <th scope="col" className="text-right">
                        Evidence P / R
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {after.cases.map((testCase) => {
                      const detail = testCase as {
                        incidentId: string
                        family: string
                        truthCause: string
                        top1: boolean
                        evidencePrecision: number
                        evidenceRecall: number
                        ranked: Array<{ cause: string; score: number }>
                      }
                      return (
                        <tr key={detail.incidentId}>
                          <td className="whitespace-nowrap text-[12px] text-ink-dim">
                            {detail.incidentId.replace('incident/', '')}
                          </td>
                          <td className="whitespace-nowrap text-[12px] text-ink-dim">{detail.family}</td>
                          <td className="max-w-[240px] truncate text-[12px] text-ink-dim">{detail.truthCause}</td>
                          <td>
                            <Badge tone={detail.top1 ? 'success' : 'danger'}>{detail.top1 ? 'hit' : 'miss'}</Badge>
                          </td>
                          <td className="max-w-[320px] truncate">
                            <span className="mono text-[10.5px] text-ink-dim">
                              {detail.ranked
                                .slice(0, 3)
                                .map((entry) => `${entry.cause.split('/').slice(-2).join('/')}:${entry.score}`)
                                .join('  ·  ')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            <span className="mono text-[11px] text-ink-dim">
                              {detail.evidencePrecision.toFixed(2)} / {detail.evidenceRecall.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
