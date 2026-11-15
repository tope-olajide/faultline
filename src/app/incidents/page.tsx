import Link from 'next/link'
import { ArrowUpRight, Radar } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  Panel,
  PanelBody,
  PanelHeader,
  SeverityBadge,
  Stat,
} from '@/components/ui/primitives'
import { SeedControls } from '@/components/demo/seed-controls'
import { getGraphHealth } from '@/server/health'
import { listIncidents } from '@/server/graph/reads'
import { formatDuration, formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

function isOpen(status: string): boolean {
  return !['Resolved', 'Closed'].includes(status)
}

export default async function IncidentsPage() {
  const health = await getGraphHealth()
  const incidents = health.hasDemoData ? await listIncidents(100) : []
  const open = incidents.filter((incident) => isOpen(incident.status))
  const benchmark = incidents.filter((incident) => incident.benchmarkSplit === 'heldout')

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Incident response</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Incidents</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Every incident is investigated against the operational graph. Open one to see ranked,
            evidence-backed hypotheses and to correct the investigator.
          </p>
        </div>
        <SeedControls hasData={health.hasDemoData} />
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Incidents and their evidence live in the graph, so this page cannot load without the engine."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      {health.reachable && !health.hasDemoData ? (
        <Panel>
          <EmptyState
            icon={<Radar aria-hidden size={22} strokeWidth={1.6} />}
            title="No incidents in the graph"
            description="Seed the demo dataset to create the checkout incident, its evidence and the held-out benchmark."
          />
        </Panel>
      ) : null}

      {health.hasDemoData ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Open incidents" value={open.length} hint={`${incidents.length} total in scope`} accent />
            <Stat label="Critical / high" value={incidents.filter((incident) => ['critical', 'high'].includes(incident.severity)).length} />
            <Stat label="Held-out benchmark" value={benchmark.length} hint="Scored by the evaluation lab" />
            <Stat
              label="Graph"
              value={health.stats?.totalNodes ?? 0}
              hint={`${pluralize(health.stats?.totalRelationships ?? 0, 'relationship')} in HydraDB`}
            />
          </section>

          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Queue"
              title="All incidents"
              description="Ordered by start time. Benchmark incidents carry verified ground truth for evaluation only."
              actions={<Badge tone="neutral">{incidents.length}</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Incident</th>
                    <th scope="col">Family</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Status</th>
                    <th scope="col">Started</th>
                    <th scope="col">Duration</th>
                    <th scope="col" className="text-right">
                      Investigation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident.id}>
                      <td className="min-w-[280px] max-w-[440px]">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="link-quiet block truncate font-medium"
                        >
                          {incident.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="mono text-[10.5px] text-ink-faint">{incident.externalId}</span>
                          {incident.benchmarkSplit === 'heldout' ? (
                            <Badge tone="violet">held-out</Badge>
                          ) : incident.benchmarkSplit === 'train' ? (
                            <Badge tone="cyan">training</Badge>
                          ) : (
                            <Badge tone="accent">live demo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-ink-dim">{incident.family || '—'}</td>
                      <td>
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td>
                        <Badge tone={isOpen(incident.status) ? 'warning' : 'success'}>{incident.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-ink-dim">{formatUtc(incident.startedAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-ink-dim">
                        {formatDuration(incident.startedAt, incident.resolvedAt || undefined)}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                        >
                          Investigate <ArrowUpRight aria-hidden size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {incidents.length === 0 ? (
              <EmptyState title="No incidents" description="This scope has no incident nodes yet." />
            ) : null}
          </Panel>
        </>
      ) : null}
    </div>
  )
}
