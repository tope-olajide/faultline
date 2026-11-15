import Link from 'next/link'
import { ArrowUpRight, BrainCircuit, History } from 'lucide-react'
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
import { RevertUpdate } from '@/components/learning/revert-update'
import { getGraphHealth } from '@/server/health'
import { listLearningUpdates, listPathTemplates } from '@/server/graph/reads'
import { listNodes } from '@/server/graph/repository'
import { formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

function parseEdge(value: string): { confidence?: number; support?: number; contradiction?: number } {
  try {
    const parsed = JSON.parse(value) as { edge?: { confidence?: number; support?: number; contradiction?: number } }
    return parsed?.edge ?? {}
  } catch {
    return {}
  }
}

export default async function LearningPage() {
  const health = await getGraphHealth()
  const hasData = health.hasDemoData

  const updates = hasData ? await listLearningUpdates(100) : []
  const templates = hasData ? await listPathTemplates(30) : []
  const feedback = hasData ? await listNodes('Feedback', { limit: 200 }) : []

  const applied = updates.filter((update) => update.status === 'applied').length
  const rolledBack = updates.filter((update) => update.status === 'rolled_back').length

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Adaptive causal graph</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Learning engine</h1>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-ink-faint">
            Every verified outcome updates a relationship&apos;s reliability and the utility of the path
            that produced the hypothesis. Updates are written to HydraDB as an auditable ledger and can be
            reversed.
          </p>
        </div>
        <Link href="/evaluation" className="link-quiet inline-flex items-center gap-1 text-[12px] text-accent">
          Measure the effect <ArrowUpRight aria-hidden size={12} />
        </Link>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Learning state is stored in the graph, so the ledger cannot be read."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      {health.reachable && !hasData ? (
        <Panel>
          <EmptyState
            icon={<BrainCircuit aria-hidden size={22} strokeWidth={1.6} />}
            title="No learning state yet"
            description="Seed the demo and confirm or reject a hypothesis to create the first auditable graph update."
          />
        </Panel>
      ) : null}

      {hasData ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Feedback records" value={feedback.length} hint="Confirmed, rejected, inconclusive" accent />
            <Stat label="Applied updates" value={applied} hint={`${rolledBack} rolled back`} />
            <Stat label="Learned paths" value={templates.length} hint="Path signatures with utility scores" />
            <Stat
              label="Relationships"
              value={health.stats?.totalRelationships ?? 0}
              hint={pluralize(health.stats?.totalNodes ?? 0, 'node')}
            />
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Ledger"
                title="Graph updates"
                description="Before/after state for every relationship mutation, with the feedback that caused it."
                actions={<Badge tone="neutral">{updates.length}</Badge>}
              />
              {updates.length === 0 ? (
                <EmptyState
                  icon={<History aria-hidden size={22} strokeWidth={1.6} />}
                  title="No learning updates"
                  description="Open an incident, choose a hypothesis and record feedback. Task-generated training feedback also appears here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Outcome</th>
                        <th scope="col">Relationship</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">Reason</th>
                        <th scope="col" className="text-right">
                          State
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {updates.map((update) => {
                        const before = parseEdge(update.beforeState)
                        const after = parseEdge(update.afterState)
                        return (
                          <tr key={update.id}>
                            <td className="whitespace-nowrap text-[12px] text-ink-dim">{formatUtc(update.createdAt)}</td>
                            <td className="whitespace-nowrap">
                              <Badge
                                tone={
                                  update.updateType === 'confirm' || update.updateType === 'contributing_factor'
                                    ? 'success'
                                    : update.updateType === 'inconclusive'
                                      ? 'neutral'
                                      : 'danger'
                                }
                              >
                                {update.updateType.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="mono text-[10.5px] text-cyan">{update.edgeType}</div>
                              <div className="mono text-[10px] text-ink-faint">
                                {update.edgeSrc} → {update.edgeDst}
                              </div>
                            </td>
                            <td className="whitespace-nowrap">
                              <div className="mono text-[11px] text-ink">
                                {(before.confidence ?? 0).toFixed(2)} → {(after.confidence ?? 0).toFixed(2)}
                              </div>
                              <div className="mono text-[10px] text-ink-faint">
                                {update.confidenceDelta >= 0 ? '+' : ''}
                                {update.confidenceDelta.toFixed(3)} · s{before.support ?? 0}→{after.support ?? 0} · c
                                {before.contradiction ?? 0}→{after.contradiction ?? 0}
                              </div>
                            </td>
                            <td className="max-w-[320px] text-[12px] leading-snug text-ink-dim">{update.reason}</td>
                            <td className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <Badge tone={update.status === 'rolled_back' ? 'neutral' : 'success'}>
                                  {update.status.replace(/_/g, ' ')}
                                </Badge>
                                {update.status === 'applied' ? (
                                  <RevertUpdate externalId={update.externalId} />
                                ) : (
                                  <span className="text-[10px] text-ink-faint">
                                    {formatUtc(update.revertedAt)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-3">
              <Panel>
                <PanelHeader
                  eyebrow="Path quality"
                  title="Learned investigation paths"
                  description="Utility is a Beta-style estimate from verified successes and failures, with a 0.5 prior."
                />
                <PanelBody className="pt-2">
                  {templates.length === 0 ? (
                    <p className="text-[12px] text-ink-faint">
                      No path templates yet. Confirming a hypothesis records the path signature that produced it.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {templates.map((template) => (
                        <li key={template.id}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="mono break-all text-[10.5px] leading-snug text-ink-dim">
                              {template.signature}
                            </span>
                            <span className="mono shrink-0 text-[12px] font-semibold text-ink">
                              {template.pathScore.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Meter value={template.pathScore} max={1} tone="violet" />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
                            <span>
                              {template.successCount} success · {template.failureCount} failure
                            </span>
                            <span>{template.lastUsedAt ? formatUtc(template.lastUsedAt) : ''}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader eyebrow="Model" title="How an update is applied" />
                <PanelBody className="pt-1">
                  <dl>
                    <KeyValue label="Confirm">+1 support, lift confidence 35% of the gap</KeyValue>
                    <KeyValue label="Contributing">+0.5 support, lift 15%</KeyValue>
                    <KeyValue label="Reject">+1 contradiction, cut confidence 45%</KeyValue>
                    <KeyValue label="Incorrect mapping">+1 contradiction, cut 60%</KeyValue>
                    <KeyValue label="Stale relationship">+0.5 contradiction, cut 25%, mark stale</KeyValue>
                    <KeyValue label="Inconclusive">No numeric change; feedback still recorded</KeyValue>
                  </dl>
                  <p className="mt-3 text-[10.5px] leading-snug text-ink-faint">
                    Path utility uses the same outcome: confirmations raise success count, rejections raise
                    failures. Inconclusive never counts as negative evidence.
                  </p>
                </PanelBody>
              </Panel>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
