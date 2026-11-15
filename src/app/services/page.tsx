import Link from 'next/link'
import { ArrowUpRight, Boxes, Search } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  Panel,
  PanelBody,
  PanelHeader,
  Stat,
} from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import { getDependencyEdges, getIncidentServiceLinks, listDeployments } from '@/server/graph/reads'
import { listNodes } from '@/server/graph/repository'
import { formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function criticalityRank(criticality: string): number {
  const normalized = criticality.toLowerCase()
  if (normalized === 'critical' || normalized === 'tier-0') return 0
  if (normalized === 'high') return 1
  if (normalized === 'medium') return 2
  return 3
}

export default async function ServicesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = (first(params.q) ?? '').trim().toLowerCase()
  const health = await getGraphHealth()

  const services = health.hasDemoData ? await listNodes('Service', { limit: 200 }) : []
  const edges = health.hasDemoData ? await getDependencyEdges() : []
  const links = health.hasDemoData ? await getIncidentServiceLinks() : []
  const deployments = health.hasDemoData ? await listDeployments(200) : []

  const rows = services
    .map((node) => {
      const properties = node.properties as Record<string, unknown>
      const name = String(properties.name ?? properties.external_id ?? `Service ${node.id}`)
      const outbound = edges.filter((edge) => edge.src === node.id)
      const inbound = edges.filter((edge) => edge.dst === node.id && edge.dstLabel === 'Service')
      const incidents = links.filter((link) => link.serviceId === node.id)
      const latestDeployment = deployments.find((deployment) => deployment.serviceId === node.id)
      return {
        id: node.id,
        externalId: String(properties.external_id ?? ''),
        name,
        criticality: String(properties.criticality ?? ''),
        ownerTeam: String(properties.owner_team ?? ''),
        outbound,
        inbound,
        incidents,
        latestDeployment,
      }
    })
    .filter((row) => !query || `${row.name} ${row.externalId} ${row.ownerTeam}`.toLowerCase().includes(query))
    .sort(
      (a, b) =>
        criticalityRank(a.criticality) - criticalityRank(b.criticality) || a.name.localeCompare(b.name),
    )

  const activeIncidents = links.filter((link) => link.incidentStartedAt).length
  const healthyDependencies = edges.filter((edge) => edge.verificationState !== 'stale').length

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Infrastructure</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Services</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            The service layer of the graph: ownership, live dependency edges, open incidents and the last
            deployment observed by a connector.
          </p>
        </div>
        <Link href="/graph" className="link-quiet text-[12.5px] text-accent">
          Graph explorer <ArrowUpRight aria-hidden size={12} className="inline" />
        </Link>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Services are graph entities; the page cannot render without the engine."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Services" value={services.length} hint={`${pluralize(services.length, 'service')} in the active scope`} />
        <Stat label="Dependency edges" value={healthyDependencies} hint="Current DEPENDS_ON relationships" />
        <Stat label="Affected by incidents" value={activeIncidents} hint="Incident → service AFFECTS links" />
        <Stat label="Deployments" value={deployments.length} hint="Observed by deployment connectors" />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Service catalogue"
          title="Ownership and dependency shape"
          description="Ordered by criticality. Dependency counts come from the live graph, not a configuration file."
          actions={
            <form action="/services" className="flex items-center gap-2">
              <label className="sr-only" htmlFor="service-search">
                Search services
              </label>
              <div className="flex items-center gap-1.5 rounded-md border border-line bg-canvas/60 px-2 py-1.5">
                <Search aria-hidden size={12} className="text-ink-faint" />
                <input
                  id="service-search"
                  name="q"
                  defaultValue={first(params.q) ?? ''}
                  placeholder="Filter services"
                  className="w-40 bg-transparent text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </form>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Boxes aria-hidden size={22} strokeWidth={1.6} />}
            title={query ? 'No service matches that filter' : 'No services yet'}
            description={
              query
                ? 'Clear the filter to see the full catalogue.'
                : 'Seed the demo dataset from the overview page to populate the infrastructure graph.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-y border-line bg-canvas/40 text-[10px] tracking-[0.08em] text-ink-faint uppercase">
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Criticality</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Dependencies</th>
                  <th className="px-4 py-2 font-medium">Dependents</th>
                  <th className="px-4 py-2 font-medium">Incidents</th>
                  <th className="px-4 py-2 font-medium">Last deploy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-hover/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/services/${row.id}`} className="text-[12.5px] font-medium text-ink hover:text-accent">
                        {row.name}
                      </Link>
                      <div className="mono mt-0.5 text-[10px] text-ink-faint">{row.externalId}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          criticalityRank(row.criticality) === 0
                            ? 'danger'
                            : criticalityRank(row.criticality) === 1
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {row.criticality || 'unclassified'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-dim">{row.ownerTeam || '—'}</td>
                    <td className="mono px-4 py-2.5 text-[11.5px] text-ink-dim">{row.outbound.length}</td>
                    <td className="mono px-4 py-2.5 text-[11.5px] text-ink-dim">{row.inbound.length}</td>
                    <td className="mono px-4 py-2.5 text-[11.5px] text-ink-dim">
                      {row.incidents.length > 0 ? (
                        <Link href={`/services/${row.id}`} className="text-accent hover:underline">
                          {row.incidents.length}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.latestDeployment ? (
                        <div>
                          <span className="mono text-[11px] text-ink-dim">{row.latestDeployment.version}</span>
                          <div className="text-[10px] text-ink-faint">{formatUtc(row.latestDeployment.startedAt)}</div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-faint">none</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
