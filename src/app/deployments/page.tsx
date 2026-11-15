import Link from 'next/link'
import { ArrowUpRight, GitCommitHorizontal, Rocket, Search } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  Panel,
  PanelHeader,
  Stat,
} from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import { getIncidentServiceLinks, listDeployments } from '@/server/graph/reads'
import { formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const CORRELATION_WINDOW_MS = 24 * 60 * 60 * 1000

export default async function DeploymentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = (first(params.q) ?? '').trim().toLowerCase()
  const environment = first(params.env) ?? ''

  const health = await getGraphHealth()
  const deployments = health.hasDemoData ? await listDeployments(200) : []
  const links = health.hasDemoData ? await getIncidentServiceLinks() : []

  const rows = deployments
    .map((deployment) => {
      const started = new Date(deployment.startedAt).getTime()
      const correlated = links
        .filter((link) => link.serviceId === deployment.serviceId)
        .filter((link) => {
          const incidentStart = new Date(link.incidentStartedAt).getTime()
          if (Number.isNaN(started) || Number.isNaN(incidentStart)) return false
          return incidentStart >= started && incidentStart - started <= CORRELATION_WINDOW_MS
        })
      return { deployment, correlated }
    })
    .filter((row) => !query || `${row.deployment.version} ${row.deployment.serviceName} ${row.deployment.changeSummary}`.toLowerCase().includes(query))
    .filter((row) => !environment || row.deployment.environment === environment)

  const environments = [...new Set(deployments.map((deployment) => deployment.environment).filter(Boolean))]
  const correlatedCount = rows.filter((row) => row.correlated.length > 0).length

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Change history</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Deployments</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Deployments are first-class graph entities linked to the service they changed. A deployment
            inside 24 hours of an incident is shown as a lead — never as a verified cause.
          </p>
        </div>
        <Link href="/graph?label=Deployment" className="link-quiet text-[12.5px] text-accent">
          Graph explorer <ArrowUpRight aria-hidden size={12} className="inline" />
        </Link>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Deployments are graph entities and cannot be listed without the engine."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Deployments" value={deployments.length} hint="In the active scope" />
        <Stat label="Environments" value={environments.length || 1} hint={environments.join(', ') || 'production'} />
        <Stat label="Near an incident" value={correlatedCount} hint="Started ≤ 24h before an affected incident" />
        <Stat
          label="Services changed"
          value={new Set(deployments.map((deployment) => deployment.serviceId)).size}
          hint="Distinct DEPLOYS targets"
        />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Deployment ledger"
          title={pluralize(rows.length, 'deployment')}
          description="Read from the Deployment→Service DEPLOYS relationships. Correlation is computed from timestamps, not asserted."
          actions={
            <form action="/deployments" className="flex items-center gap-2">
              <label className="sr-only" htmlFor="deployment-search">
                Search deployments
              </label>
              <div className="flex items-center gap-1.5 rounded-md border border-line bg-canvas/60 px-2 py-1.5">
                <Search aria-hidden size={12} className="text-ink-faint" />
                <input
                  id="deployment-search"
                  name="q"
                  defaultValue={first(params.q) ?? ''}
                  placeholder="Filter deployments"
                  className="w-40 bg-transparent text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
              {environments.length > 1 ? (
                <select
                  name="env"
                  defaultValue={environment}
                  className="rounded-md border border-line bg-canvas/60 px-2 py-1.5 text-[12px] text-ink"
                  aria-label="Environment"
                >
                  <option value="">All environments</option>
                  {environments.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              ) : null}
            </form>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Rocket aria-hidden size={22} strokeWidth={1.6} />}
            title={query || environment ? 'No deployment matches those filters' : 'No deployments yet'}
            description={
              query || environment
                ? 'Clear the filters to see the full change history.'
                : 'Seed the demo dataset to populate the deployment history.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="border-y border-line bg-canvas/40 text-[10px] tracking-[0.08em] text-ink-faint uppercase">
                  <th className="px-4 py-2 font-medium">Deployment</th>
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Environment</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Change</th>
                  <th className="px-4 py-2 font-medium">Correlated incident</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map(({ deployment, correlated }) => (
                  <tr key={deployment.id} className="transition-colors hover:bg-hover/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <GitCommitHorizontal aria-hidden size={12} className="text-ink-faint" />
                        <span className="mono text-[12px] font-medium text-ink">{deployment.version}</span>
                      </div>
                      <div className="mono mt-0.5 text-[10px] text-ink-faint">{deployment.externalId}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/services/${deployment.serviceId}`}
                        className="text-[12px] text-ink hover:text-accent"
                      >
                        {deployment.serviceName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="neutral">{deployment.environment || 'production'}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="mono text-[11px] text-ink-dim">{formatUtc(deployment.startedAt)}</div>
                      <div className="text-[10px] text-ink-faint">{deployment.status}</div>
                    </td>
                    <td className="max-w-[300px] px-4 py-2.5 text-[11.5px] leading-snug text-ink-dim">
                      {deployment.changeSummary || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {correlated.length === 0 ? (
                        <span className="text-[10.5px] text-ink-faint">none within 24h</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {correlated.slice(0, 2).map((link) => (
                            <Link
                              key={link.incidentId}
                              href={`/incidents/${link.incidentId}`}
                              className="text-[11px] text-warning hover:underline"
                            >
                              {link.incidentExternalId} · correlated
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[11px] leading-relaxed text-ink-faint">
        Correlation means the incident started within 24 hours after a deployment to the same service. It
        is not causation; only an engineer confirmation or the benchmark label promotes a deployment to a
        verified cause.
      </p>
    </div>
  )
}
