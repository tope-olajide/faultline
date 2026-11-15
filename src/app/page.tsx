import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BrainCircuit, Radar, ShieldQuestion } from 'lucide-react'
import { SeedControls } from '@/components/demo/seed-controls'
import {
  Badge,
  ButtonLink,
  EmptyState,
  InlineError,
  KeyValue,
  Meter,
  Panel,
  PanelBody,
  PanelHeader,
  SeverityBadge,
  Stat,
} from '@/components/ui/primitives'
import { demoScope } from '@/server/config'
import { getGraphHealth } from '@/server/health'
import {
  listEvaluationRuns,
  listIncidents,
  listLearningUpdates,
  type EvaluationRunRecord,
} from '@/server/graph/reads'
import { listNodes } from '@/server/graph/repository'
import { formatDuration, formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

function isOpen(status: string): boolean {
  return !['Resolved', 'Closed'].includes(status)
}

function latestAdaptive(runs: EvaluationRunRecord[]): {
  before: EvaluationRunRecord | null
  after: EvaluationRunRecord | null
} {
  const adaptive = runs.filter((run) => run.engine === 'adaptive-graph')
  const after = adaptive.find((run) => run.round === 'R1') ?? null
  const before = adaptive.find((run) => run.round === 'R0') ?? null
  return { before, after }
}

const STATUS_TONE: Record<string, 'warning' | 'accent' | 'success' | 'neutral' | 'danger'> = {
  New: 'danger',
  Investigating: 'warning',
  Identified: 'accent',
  Mitigating: 'accent',
  Monitoring: 'accent',
  Resolved: 'success',
  Closed: 'neutral',
  Reopened: 'danger',
}

export default async function OverviewPage() {
  const health = await getGraphHealth()
  const stats = health.stats
  const hasData = health.hasDemoData

  const incidents = hasData ? await listIncidents(8) : []
  const open = incidents.filter((incident) => isOpen(incident.status))
  const updates = hasData ? await listLearningUpdates(4) : []
  const runs = hasData ? await listEvaluationRuns(20) : []
  const evidenceCount = hasData ? (await listNodes('Evidence', { limit: 200 })).length : 0
  const connectors = hasData ? await listNodes('ConnectorSource', { limit: 20 }) : []

  const { before, after } = latestAdaptive(runs)
  const delta =
    before && after ? after.metrics.top1Accuracy - before.metrics.top1Accuracy : null
  const openIncident = open[0] ?? incidents[0] ?? null

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">
            {demoScope.project} · {demoScope.environment}
          </div>
          <h1 className="mt-1 max-w-3xl text-[26px] font-semibold leading-tight tracking-tight text-ink">
            Know why it broke. Learn how to stop it happening again.
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Faultline investigates incidents on a HydraDB operational knowledge graph, cites the
            evidence behind every hypothesis, and rewires the graph when an engineer confirms or rejects
            the cause.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={health.reachable ? 'success' : 'danger'}>
              {health.reachable ? 'graph-node ready' : 'graph-node unreachable'}
            </Badge>
            <ButtonLink href="/diagnostics" size="sm">
              Diagnostics <ArrowUpRight aria-hidden size={12} />
            </ButtonLink>
          </div>
          {hasData ? <SeedControls hasData /> : null}
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Faultline has no fallback graph. Start the self-hosted HydraDB node, then reload."
          detail={`readyz  ${health.ready ? 'ok' : 'unavailable'}\nhealthz ${health.healthzOk ? 'ok' : 'unavailable'}\n${
            health.error ?? ''
          }\n\nnpm run db:up`}
          action={<ButtonLink href="/diagnostics">Open diagnostics</ButtonLink>}
        />
      ) : null}

      {health.reachable && !hasData ? (
        <Panel>
          <EmptyState
            icon={<Radar aria-hidden size={22} strokeWidth={1.6} />}
            title="The graph is empty"
            description="Seed the checkout-platform dataset to load services, dependencies, evidence, an open incident and a held-out evaluation benchmark — all written into HydraDB."
            action={
              <div className="w-full max-w-sm text-left">
                <SeedControls hasData={false} />
              </div>
            }
          />
        </Panel>
      ) : null}

      {hasData && stats ? (
        <>
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Open incidents"
              value={open.length}
              hint={openIncident ? formatUtc(openIncident.startedAt) : 'None open'}
              accent
            />
            <Stat label="Evidence records" value={evidenceCount} hint="Source-linked, hash-verified" />
            <Stat label="Learning updates" value={updates.length > 0 ? (stats.nodes.find((entry) => entry.label === 'LearningUpdate')?.count ?? updates.length) : 0} hint="Auditable graph mutations" />
            <Stat
              label="Adaptive held-out Top-1"
              value={after ? `${(after.metrics.top1Accuracy * 100).toFixed(0)}%` : '—'}
              hint={
                delta === null
                  ? 'Run the evaluation lab to measure'
                  : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)} pts after learning`
              }
            />
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-3 xl:col-span-8">
              <Panel className="overflow-hidden">
                <PanelHeader
                  eyebrow="Incident queue"
                  title="Recent incidents"
                  description="Open an incident to see ranked hypotheses, the causal path and the evidence behind each one."
                  actions={<ButtonLink href="/incidents" size="sm">All incidents</ButtonLink>}
                />
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Severity</th>
                        <th scope="col">Incident</th>
                        <th scope="col">Status</th>
                        <th scope="col">Started</th>
                        <th scope="col" className="text-right">
                          Workspace
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((incident) => (
                        <tr key={incident.id}>
                          <td className="w-[100px]">
                            <SeverityBadge severity={incident.severity} />
                          </td>
                          <td className="min-w-[260px] max-w-[420px]">
                            <Link
                              href={`/incidents/${incident.id}`}
                              className="link-quiet block truncate font-medium"
                            >
                              {incident.title}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="mono text-[10.5px] text-ink-faint">{incident.externalId}</span>
                              <Badge tone="neutral">{incident.family || 'general'}</Badge>
                            </div>
                          </td>
                          <td>
                            <Badge tone={STATUS_TONE[incident.status] ?? 'neutral'}>{incident.status}</Badge>
                          </td>
                          <td className="whitespace-nowrap text-[12px] text-ink-dim">
                            {formatUtc(incident.startedAt)}
                            <span className="ml-2 text-ink-faint">
                              {formatDuration(incident.startedAt, incident.resolvedAt || undefined)}
                            </span>
                          </td>
                          <td className="text-right">
                            <Link
                              href={`/incidents/${incident.id}`}
                              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                            >
                              Investigate <ArrowRight aria-hidden size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  eyebrow="Learning loop"
                  title="Latest graph updates"
                  description="Each row is a persisted relationship mutation caused by verified feedback."
                  actions={<ButtonLink href="/learning" size="sm">Learning ledger</ButtonLink>}
                />
                <PanelBody className="pt-2">
                  {updates.length === 0 ? (
                    <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
                      <BrainCircuit aria-hidden size={14} className="mt-0.5 shrink-0" />
                      No feedback yet. Confirm or reject a hypothesis in an incident workspace to teach the
                      graph, or run the evaluation lab to apply verified training feedback.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {updates.map((update) => (
                        <li key={update.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge tone={update.updateType === 'confirm' ? 'success' : 'danger'}>
                                {update.updateType.replace(/_/g, ' ')}
                              </Badge>
                              <span className="mono text-[10.5px] text-cyan">{update.edgeType}</span>
                              <span className="mono text-[10px] text-ink-faint">
                                {update.edgeSrc} → {update.edgeDst}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-dim">
                              {update.reason}
                            </p>
                          </div>
                          <span
                            className={`mono shrink-0 text-[11.5px] ${
                              update.confidenceDelta >= 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {update.confidenceDelta >= 0 ? '+' : ''}
                            {update.confidenceDelta.toFixed(3)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelBody>
              </Panel>
            </div>

            <div className="flex min-w-0 flex-col gap-3 xl:col-span-4">
              <Panel>
                <PanelHeader
                  eyebrow="Proof"
                  title="Evaluation snapshot"
                  description="The adaptive graph measured on incidents it never trained on."
                  actions={<ButtonLink href="/evaluation" size="sm">Open lab</ButtonLink>}
                />
                <PanelBody className="flex flex-col gap-3 pt-2">
                  {after && before ? (
                    <>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="text-ink-dim">Vector-only</span>
                          <span className="mono text-ink">
                            {Math.round(
                              (runs.find((run) => run.engine === 'vector' && run.round === 'R1')?.metrics
                                .top1Accuracy ?? 0) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <Meter
                          value={runs.find((run) => run.engine === 'vector' && run.round === 'R1')?.metrics.top1Accuracy ?? 0}
                          max={1}
                          tone="cyan"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="text-ink-dim">Fixed graph</span>
                          <span className="mono text-ink">
                            {Math.round(
                              (runs.find((run) => run.engine === 'fixed-graph' && run.round === 'R1')?.metrics
                                .top1Accuracy ?? 0) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <Meter
                          value={runs.find((run) => run.engine === 'fixed-graph' && run.round === 'R1')?.metrics.top1Accuracy ?? 0}
                          max={1}
                          tone="accent"
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11.5px]">
                          <span className="text-ink">Adaptive graph</span>
                          <span className="mono font-semibold text-success">
                            {(after.metrics.top1Accuracy * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Meter value={after.metrics.top1Accuracy} max={1} tone="success" />
                      </div>
                      <p className="text-[10.5px] leading-snug text-ink-faint">
                        {after.caseCount} held-out incidents. Adaptive before learning:{' '}
                        {(before.metrics.top1Accuracy * 100).toFixed(0)}%.
                      </p>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
                      <ShieldQuestion aria-hidden size={14} className="mt-0.5 shrink-0" />
                      No measured run yet. Open the evaluation lab and run the experiment.
                    </p>
                  )}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader eyebrow="Engine" title="Graph health" />
                <PanelBody className="pt-1">
                  <dl>
                    <KeyValue label="Graph / cell">
                      <span className="mono text-[11px]">
                        {health.engine.graphId} · {health.engine.cellId}
                      </span>
                    </KeyValue>
                    <KeyValue label="Entities">
                      <span className="mono">{stats.totalNodes}</span>
                    </KeyValue>
                    <KeyValue label="Relationships">
                      <span className="mono">{stats.totalRelationships}</span>
                    </KeyValue>
                    <KeyValue label="Read epoch">
                      <span className="mono">{stats.readEpoch ?? '—'}</span>
                    </KeyValue>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    <ButtonLink href="/graph" size="sm">Graph explorer</ButtonLink>
                    <ButtonLink href="/evidence" size="sm">Evidence</ButtonLink>
                  </div>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader
                  eyebrow="Connectors"
                  title="Source freshness"
                  description="Simulated adapters; the ingestion path is real."
                />
                <PanelBody className="pt-1">
                  <dl>
                    {connectors.map((connector) => {
                      const provider = String(connector.properties.provider ?? 'source')
                      const synced = String(connector.properties.last_synced_at ?? '')
                      return (
                        <KeyValue key={connector.id} label={provider}>
                          <span className="mono text-[10.5px] text-ink-dim">{formatUtc(synced)}</span>
                        </KeyValue>
                      )
                    })}
                  </dl>
                  <p className="mt-2 text-[10.5px] text-ink-faint">
                    {pluralize(connectors.length, 'connector')} · read-only permission scopes
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
