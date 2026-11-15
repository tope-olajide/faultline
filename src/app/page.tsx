import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Network, TriangleAlert } from 'lucide-react'
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
import { demoEntityId } from '@/server/graph/ids'
import { findPathsBetween, listNodes } from '@/server/graph/repository'
import type { GraphPath } from '@/server/hydradb/types'
import { formatDuration, formatUtc, pluralize, truncateMiddle } from '@/lib/format'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, 'warning' | 'accent' | 'success' | 'neutral' | 'danger'> = {
  Investigating: 'warning',
  Identified: 'accent',
  Mitigating: 'accent',
  Monitoring: 'accent',
  Resolved: 'success',
  Closed: 'neutral',
  Reopened: 'danger',
  New: 'danger',
}

function pathNodeName(path: GraphPath, id: number): { label: string; name: string } {
  const node = path.nodes.find((candidate) => candidate.id === id)
  const label = node?.labels[0] ?? 'Unknown'
  const raw = node?.properties.name ?? node?.properties.summary ?? node?.properties.title
  return { label, name: typeof raw === 'string' && raw.length > 0 ? raw : String(id) }
}

export default async function OverviewPage() {
  const health = await getGraphHealth()
  const stats = health.stats
  const counts = new Map((stats?.nodes ?? []).map((entry) => [entry.label, entry.count]))

  const hasData = health.hasDemoData
  const incidents = hasData ? await listNodes('Incident', { limit: 5 }) : []

  let dependencyPath: GraphPath | null = null
  if (hasData) {
    try {
      const paths = await findPathsBetween(
        demoEntityId('Service', 'service/api-gateway/production', demoScope),
        demoEntityId('Database', 'database/postgres-main/production', demoScope),
        { maxLen: 3, pathCount: 1 },
      )
      dependencyPath = paths[0] ?? null
    } catch {
      dependencyPath = null
    }
  }

  const openIncidents = incidents.filter((incident) => {
    const status = String(incident.properties.status ?? '')
    return status !== 'Resolved' && status !== 'Closed'
  })
  const criticalCount = openIncidents.filter(
    (incident) => String(incident.properties.severity ?? '').toLowerCase() === 'critical',
  ).length

  const topLabels = [...(stats?.nodes ?? [])].sort((a, b) => b.count - a.count).slice(0, 7)
  const topRelationships = [...(stats?.relationships ?? [])].sort((a, b) => b.count - a.count).slice(0, 7)

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">
            {demoScope.project} · {demoScope.environment}
          </div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Overview</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Operational state read live from HydraDB — infrastructure, evidence, the open incident, and the
            relationships that connect them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={health.reachable ? 'success' : 'danger'}>
            {health.reachable ? 'graph-node ready' : 'graph-node unreachable'}
          </Badge>
          <ButtonLink href="/diagnostics" size="md">
            Diagnostics
            <ArrowUpRight aria-hidden size={13} />
          </ButtonLink>
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Faultline has no fallback graph. Start the self-hosted HydraDB node, then reload this page."
          detail={`readyz  ${health.ready ? 'ok' : 'unavailable'}\nhealthz ${health.healthzOk ? 'ok' : 'unavailable'}\n${health.error ?? ''}\n\nnpm run db:up   # docker compose up -d hydradb`}
          action={<ButtonLink href="/diagnostics">Open diagnostics</ButtonLink>}
        />
      ) : null}

      {health.reachable && !hasData ? (
        <Panel>
          <EmptyState
            icon={<Network aria-hidden size={22} strokeWidth={1.6} />}
            title="The graph is empty"
            description="Seed the checkout-platform dataset to get services, dependencies, a deployment, evidence records and an open incident — all written into HydraDB."
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
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="Open incidents"
              value={openIncidents.length}
              unit={pluralize(criticalCount, 'critical')}
              hint={incidents[0] ? formatUtc(String(incidents[0].properties.started_at)) : 'No incidents'}
              accent={criticalCount > 0}
            />
            <Stat label="Services" value={counts.get('Service') ?? 0} hint="Deployable services in scope" />
            <Stat label="Graph entities" value={stats.totalNodes} hint={`${pluralize(stats.nodes.length, 'label')} populated`} />
            <Stat label="Relationships" value={stats.totalRelationships} hint={`${pluralize(stats.relationships.length, 'typed edge')}`} />
            <Stat label="Evidence items" value={counts.get('Evidence') ?? 0} hint="Source-linked records" />
            <Stat
              label="Learning updates"
              value={counts.get('LearningUpdate') ?? 0}
              hint="Awaiting engineer feedback"
            />
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-3 xl:col-span-7">
              <Panel className="overflow-hidden">
                <PanelHeader
                  eyebrow="Incidents"
                  title="Active incidents"
                  description="Correlated from alerts and read from the graph; open rows are live."
                  actions={<ButtonLink href="/graph?label=Incident" size="sm">View all</ButtonLink>}
                />
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Severity</th>
                        <th scope="col">Incident</th>
                        <th scope="col">Status</th>
                        <th scope="col">Started</th>
                        <th scope="col">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((incident) => {
                        const status = String(incident.properties.status ?? 'Unknown')
                        return (
                          <tr key={incident.id}>
                            <td className="w-[92px]">
                              <SeverityBadge severity={String(incident.properties.severity ?? '')} />
                            </td>
                            <td className="min-w-[220px]">
                              <Link
                                href={`/graph?label=Incident&node=${incident.id}`}
                                className="link-quiet block truncate font-medium"
                              >
                                {String(incident.properties.title ?? 'Untitled incident')}
                              </Link>
                              <span className="mono mt-0.5 block text-[10.5px] text-ink-faint">
                                {String(incident.properties.external_id ?? '')}
                              </span>
                            </td>
                            <td>
                              <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
                            </td>
                            <td className="whitespace-nowrap text-[12px] text-ink-dim">
                              {formatUtc(String(incident.properties.started_at ?? ''))}
                              <span className="ml-2 text-ink-faint">
                                {formatDuration(String(incident.properties.started_at ?? ''), String(incident.properties.resolved_at || '') || null)}
                              </span>
                            </td>
                            <td className="text-[12px] whitespace-nowrap text-ink-dim">
                              {String(incident.properties.owner_team ?? '—')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  eyebrow="Graph traversal"
                  title="Dependency path"
                  description="Resolved server-side by algo.SPpaths over DEPENDS_ON edges."
                  actions={<Badge tone="cyan">2 hops</Badge>}
                />
                <PanelBody>
                  {dependencyPath ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                      {dependencyPath.nodes.map((node, index) => {
                        const meta = pathNodeName(dependencyPath as GraphPath, node.id)
                        const relationship = dependencyPath?.relationships[index - 1]
                        return (
                          <div key={node.id} className="flex items-center gap-2">
                            {index > 0 && relationship ? (
                              <span className="mono flex items-center gap-1 text-[10.5px] text-ink-faint">
                                <ArrowRight aria-hidden size={12} />
                                {relationship.type}
                              </span>
                            ) : null}
                            <span className="flex flex-col rounded-md border border-line bg-raised/70 px-2.5 py-1.5">
                              <span className="eyebrow">{meta.label}</span>
                              <span className="text-[12.5px] font-medium text-ink">{meta.name}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-ink-faint">
                      No dependency path between api-gateway and postgres-main in the current graph.
                    </p>
                  )}
                </PanelBody>
              </Panel>
            </div>

            <div className="flex min-w-0 flex-col gap-3 xl:col-span-5">
              <Panel>
                <PanelHeader
                  eyebrow="Engine"
                  title="Graph health"
                  description="Readiness, snapshot epoch, and the store backing the graph."
                />
                <PanelBody className="pt-1">
                  <dl>
                    <KeyValue label="Readiness">
                      <Badge tone={health.ready ? 'success' : 'danger'}>{health.ready ? 'ready' : 'not ready'}</Badge>
                    </KeyValue>
                    <KeyValue label="Query API">
                      <Badge tone={health.healthzOk ? 'success' : 'danger'}>
                        {health.healthzOk ? 'healthy' : 'unavailable'}
                      </Badge>
                    </KeyValue>
                    <KeyValue label="Graph / cell">
                      <span className="mono">
                        {health.engine.graphId} · {health.engine.cellId}
                      </span>
                    </KeyValue>
                    <KeyValue label="Read epoch">
                      <span className="mono">{stats.readEpoch ?? '—'}</span>
                    </KeyValue>
                    <KeyValue label="Bookmark">
                      <span className="mono text-[11px]" title={stats.bookmark ?? ''}>
                        {stats.bookmark ? truncateMiddle(stats.bookmark, 26) : '—'}
                      </span>
                    </KeyValue>
                    <KeyValue label="Engine image">
                      <span className="mono text-[11px]">hydradb v0.4.0</span>
                    </KeyValue>
                  </dl>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
                    Counts and ids in this view come from the same snapshot pinned by the bookmark above.
                  </p>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader
                  eyebrow="Dataset"
                  title="Demo telemetry"
                  description="Simulated checkout platform. Writes and reads are real."
                  actions={<Badge tone="violet">Simulated</Badge>}
                />
                <PanelBody className="flex flex-col gap-4">
                  <SeedControls hasData />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-line bg-canvas/50 px-3 py-2">
                      <div className="eyebrow">Nodes</div>
                      <div className="mono mt-1 text-[16px] font-semibold text-ink">{stats.totalNodes}</div>
                    </div>
                    <div className="rounded-md border border-line bg-canvas/50 px-3 py-2">
                      <div className="eyebrow">Edges</div>
                      <div className="mono mt-1 text-[16px] font-semibold text-ink">{stats.totalRelationships}</div>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <Panel className="xl:col-span-7">
              <PanelHeader
                eyebrow="Graph composition"
                title="Entities by label"
                description="Every label is counted with an anchored HydraDB query."
              />
              <PanelBody className="flex flex-col gap-3">
                {topLabels.map((entry) => (
                  <div key={entry.label} className="grid grid-cols-[132px_1fr_44px] items-center gap-3">
                    <Link href={`/graph?label=${entry.label}`} className="link-quiet truncate text-[12.5px]">
                      {entry.label}
                    </Link>
                    <Meter value={entry.count} max={topLabels[0]?.count ?? 1} />
                    <span className="mono text-right text-[12px] text-ink-dim">{entry.count}</span>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel className="xl:col-span-5">
              <PanelHeader
                eyebrow="Relationships"
                title="Typed edges"
                description="Relationship counts are exact only when the source label is known — so they are counted per declared pair."
              />
              <PanelBody className="pt-2">
                <dl>
                  {topRelationships.map((entry) => (
                    <KeyValue key={`${entry.type}-${entry.from}`} label={`${entry.type} · from ${entry.from}`}>
                      <span className="mono">{entry.count}</span>
                    </KeyValue>
                  ))}
                </dl>
              </PanelBody>
            </Panel>
          </div>
        </>
      ) : null}

      {health.reachable && hasData && incidents.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<TriangleAlert aria-hidden size={20} strokeWidth={1.6} />}
            title="No incidents in the graph"
            description="The demo dataset includes one open incident. Re-seed the dataset to restore it."
          />
        </Panel>
      ) : null}
    </div>
  )
}
