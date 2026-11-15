import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight, Boxes, GitBranch, Network, Server } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
  SeverityBadge,
  Stat,
  VerificationBadge,
} from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import {
  getDependencies,
  getNeighborhood,
  getNode,
  type NeighborEdge,
} from '@/server/graph/repository'
import {
  getDeploymentsForService,
  getIncidentsForService,
} from '@/server/graph/reads'
import { formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

function identity(edge: NeighborEdge): string {
  return edge.display ?? `#${edge.neighborId}`
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const serviceId = Number(id)
  if (!Number.isSafeInteger(serviceId) || serviceId <= 0) notFound()

  const health = await getGraphHealth()
  const node = health.hasDemoData ? await getNode(serviceId, 'Service') : null
  if (!node) notFound()

  const properties = node.properties
  const name = String(properties.name ?? properties.external_id ?? `Service ${serviceId}`)

  const [neighborhood, deployments, incidents, currentDeps, retiredDeps] = await Promise.all([
    getNeighborhood(serviceId, 'Service'),
    getDeploymentsForService(serviceId),
    getIncidentsForService(serviceId),
    getDependencies(serviceId, 'Service', { mode: 'current' }),
    getDependencies(serviceId, 'Service', { mode: 'history' }),
  ])

  const dependents = neighborhood.filter(
    (edge) => edge.relationship === 'DEPENDS_ON' && edge.direction === 'incoming',
  )
  const openIncidents = incidents.filter((incident) => incident.status !== 'Resolved')

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/services"
            className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint hover:text-ink"
          >
            <ArrowLeft aria-hidden size={12} /> All services
          </Link>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-ink">{name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="mono text-[11px] text-ink-faint">
              {String(properties.external_id ?? `service/${serviceId}`)}
            </span>
            <Badge tone={String(properties.criticality ?? '').toLowerCase() === 'critical' ? 'danger' : 'warning'}>
              {String(properties.criticality ?? 'unclassified')}
            </Badge>
            <span className="text-[11.5px] text-ink-faint">
              owner {String(properties.owner_team ?? 'unassigned')}
            </span>
            <Badge tone="neutral">{String(properties.environment ?? 'production')}</Badge>
          </div>
        </div>
        <Link href={`/graph?label=Service&node=${serviceId}`} className="link-quiet text-[12.5px] text-accent">
          Inspect in graph <ArrowUpRight aria-hidden size={12} className="inline" />
        </Link>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Service detail is read live from the graph."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dependencies" value={currentDeps.dependencies.length} hint="Current outgoing DEPENDS_ON" />
        <Stat label="Dependents" value={dependents.length} hint="Services that depend on this one" />
        <Stat label="Incidents" value={incidents.length} hint={`${openIncidents.length} currently open`} />
        <Stat label="Deployments" value={deployments.length} hint="Observed by deployment connectors" />
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel>
            <PanelHeader
              eyebrow="Dependency map"
              title="What this service depends on"
              description="Current relationships first; retired edges remain queryable because the graph keeps validity periods."
            />
            <PanelBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="eyebrow mb-2 flex items-center gap-1.5">
                  <ArrowRight aria-hidden size={11} /> In force now · {currentDeps.dependencies.length}
                </div>
                {currentDeps.dependencies.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">No current dependency is recorded.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {currentDeps.dependencies.map((edge) => (
                      <li
                        key={`current-${edge.neighborLabel}-${edge.neighborId}`}
                        className="rounded-md border border-line bg-canvas/40 px-2.5 py-2"
                      >
                        <Link
                          href={`/graph?label=${edge.neighborLabel}&node=${edge.neighborId}`}
                          className="block truncate text-[12px] font-medium text-ink hover:text-accent"
                        >
                          {identity(edge)}
                        </Link>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-ink-faint">
                          <span>{edge.neighborLabel}</span>
                          <span className="mono">
                            confidence {String(edge.edge.confidence_score ?? '—')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="eyebrow mb-2 flex items-center gap-1.5">
                  <Network aria-hidden size={11} /> Dependents · {dependents.length}
                </div>
                {dependents.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">No service depends on this one.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {dependents.map((edge) => (
                      <li
                        key={`dependent-${edge.neighborId}`}
                        className="rounded-md border border-line bg-canvas/40 px-2.5 py-2"
                      >
                        <Link
                          href={`/services/${edge.neighborId}`}
                          className="block truncate text-[12px] font-medium text-ink hover:text-accent"
                        >
                          {identity(edge)}
                        </Link>
                        <div className="mt-1 text-[10px] text-ink-faint">{edge.neighborLabel}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {retiredDeps.dependencies.length > 0 ? (
                <div className="md:col-span-2">
                  <div className="eyebrow mb-2">Retired · {retiredDeps.dependencies.length}</div>
                  <ul className="flex flex-wrap gap-1.5">
                    {retiredDeps.dependencies.map((edge) => (
                      <li
                        key={`retired-${edge.neighborLabel}-${edge.neighborId}`}
                        className="rounded-md border border-line/70 bg-canvas/30 px-2 py-1 text-[10.5px] text-ink-faint"
                      >
                        {identity(edge)} · ended {String(edge.edge.valid_to ?? 'unknown')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Change history"
              title="Deployments"
              description="Correlation only: a deployment near an incident is a lead, not a verified cause."
            />
            <PanelBody className="pt-2">
              {deployments.length === 0 ? (
                <p className="text-[12px] text-ink-faint">No deployment is linked to this service.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {deployments.map((deployment) => (
                    <li key={deployment.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[12px] text-ink">{deployment.version}</span>
                          <Badge tone="neutral">{deployment.environment || 'production'}</Badge>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-snug text-ink-dim">{deployment.changeSummary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="mono text-[10.5px] text-ink-faint">{formatUtc(deployment.startedAt)}</div>
                        <div className="text-[10px] text-ink-faint">{deployment.status}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Incident history"
              title="Incidents affecting this service"
              description="Read from AFFECTS relationships, newest first."
              actions={
                <Link href="/incidents" className="link-quiet text-[11.5px] text-accent">
                  All incidents
                </Link>
              }
            />
            <PanelBody className="pt-2">
              {incidents.length === 0 ? (
                <p className="text-[12px] text-ink-faint">No incident has affected this service.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {incidents.map((incident) => (
                    <li key={incident.id} className="rounded-md border border-line bg-canvas/40 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="text-[12.5px] font-medium text-ink hover:text-accent"
                        >
                          {incident.title}
                        </Link>
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={incident.severity} />
                          <Badge tone={incident.status === 'Resolved' ? 'success' : 'warning'}>
                            {incident.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mono mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-faint">
                        <span>{incident.externalId}</span>
                        <span>{formatUtc(incident.startedAt)}</span>
                        <span>{incident.family || 'general'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel>
            <PanelHeader eyebrow="Entity" title="Graph record" />
            <PanelBody>
              <dl>
                <KeyValue label="Node id">
                  <span className="mono">{serviceId}</span>
                </KeyValue>
                <KeyValue label="External id">
                  <span className="mono text-[11px]">{String(properties.external_id ?? '—')}</span>
                </KeyValue>
                <KeyValue label="Criticality">{String(properties.criticality ?? '—')}</KeyValue>
                <KeyValue label="Owner">{String(properties.owner_team ?? '—')}</KeyValue>
                <KeyValue label="Environment">{String(properties.environment ?? '—')}</KeyValue>
                <KeyValue label="Last observation">
                  {String(properties.last_observed_at ? formatUtc(String(properties.last_observed_at)) : '—')}
                </KeyValue>
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Temporal validity" title="Why history matters" />
            <PanelBody>
              <p className="text-[12px] leading-relaxed text-ink-dim">
                A dependency that was true last month is not automatically current. Faultline stores
                <span className="mono text-ink"> valid_from </span> and
                <span className="mono text-ink"> valid_to </span> on every relationship and only traverses
                edges that were in force when the incident started.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <VerificationBadge state={currentDeps.dependencies[0]?.edge.verification_state} />
                <span className="text-[10.5px] text-ink-faint">
                  {pluralize(retiredDeps.dependencies.length, 'retired edge')} preserved
                </span>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Next step" title="Investigate with this context" />
            <PanelBody>
              <Link
                href="/incidents"
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas/50 px-3 py-2 text-[12px] font-medium text-ink hover:border-accent/40 hover:text-accent"
              >
                <span className="flex items-center gap-2">
                  <GitBranch aria-hidden size={13} /> Open an incident
                </span>
                <ArrowRight aria-hidden size={13} />
              </Link>
              <Link
                href={`/graph?label=Service&node=${serviceId}`}
                className="mt-2 flex items-center justify-between gap-2 rounded-md border border-line bg-canvas/50 px-3 py-2 text-[12px] font-medium text-ink hover:border-accent/40 hover:text-accent"
              >
                <span className="flex items-center gap-2">
                  <Boxes aria-hidden size={13} /> Explore relationships
                </span>
                <ArrowRight aria-hidden size={13} />
              </Link>
            </PanelBody>
          </Panel>
        </div>
      </div>

      {incidents.length === 0 && deployments.length === 0 && dependents.length === 0 ? (
        <EmptyState
          icon={<Server aria-hidden size={22} strokeWidth={1.6} />}
          title="Sparse graph record"
          description="This service exists but has no linked incidents, deployments or dependents. That is an evidence gap, not a healthy service."
        />
      ) : null}
    </div>
  )
}
