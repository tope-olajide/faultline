import Link from 'next/link'
import { ArrowLeft, ArrowRight, Network } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
  VerificationBadge,
} from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import { getDependencies, getNeighborhood, getNode, listNodes, type NeighborEdge } from '@/server/graph/repository'
import { displayProperty, isGraphLabel, OPEN_ENDED, type GraphLabel } from '@/server/graph/schema'
import { defaultAsOf, isCurrent } from '@/server/graph/temporal'
import { formatUtc, humanizePropertyKey, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function displayName(properties: Record<string, unknown>, label: GraphLabel): string {
  const key = displayProperty(label)
  const value = properties[key]
  if (typeof value === 'string' && value.trim().length > 0) return value
  const fallback = properties.external_id
  return typeof fallback === 'string' ? fallback : 'Unnamed entity'
}

export default async function GraphExplorerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const health = await getGraphHealth()
  const stats = health.stats

  const requestedLabel = first(params.label)
  const label: GraphLabel = requestedLabel && isGraphLabel(requestedLabel) ? requestedLabel : 'Service'

  const populated = (stats?.nodes ?? []).filter((entry) => entry.count > 0)
  const knownLabels = populated.length > 0 ? populated : stats?.nodes ?? []
  const activeEntry = knownLabels.find((entry) => entry.label === label)
  const effectiveLabel: GraphLabel = activeEntry ? activeEntry.label : (knownLabels[0]?.label ?? label)

  const nodes = health.hasDemoData ? await listNodes(effectiveLabel, { limit: 100 }) : []
  const requestedNodeId = Number(first(params.node))
  const selectedId = Number.isSafeInteger(requestedNodeId) && requestedNodeId > 0 ? requestedNodeId : nodes[0]?.id
  const selected = selectedId ? await getNode(selectedId, effectiveLabel) : null

  let edges: NeighborEdge[] = []
  if (selected) {
    edges = await getNeighborhood(selected.id, effectiveLabel)
  }

  const outgoing = edges.filter((edge) => edge.direction === 'outgoing')
  const incoming = edges.filter((edge) => edge.direction === 'incoming')
  const totalNodes = stats?.totalNodes ?? 0

  let currentDeps: Awaited<ReturnType<typeof getDependencies>> | null = null
  let historicalDeps: Awaited<ReturnType<typeof getDependencies>> | null = null
  if (selected && effectiveLabel === 'Service') {
    try {
      currentDeps = await getDependencies(selected.id, effectiveLabel, { mode: 'current' })
      historicalDeps = await getDependencies(selected.id, effectiveLabel, { mode: 'history' })
    } catch {
      currentDeps = null
      historicalDeps = null
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Graph explorer</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">
            Operational knowledge graph
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            {pluralize(totalNodes, 'entity', 'entities')} and {pluralize(stats?.totalRelationships ?? 0, 'relationship')} stored
            in HydraDB. Every value on this page is read back from the engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="cyan">graph · {health.engine.graphId}</Badge>
          <Badge tone="neutral" mono>
            epoch {stats?.readEpoch ?? '—'}
          </Badge>
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="The graph inspector reads directly from the engine, so there is nothing to render without it."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      {health.reachable && totalNodes === 0 ? (
        <Panel>
          <EmptyState
            icon={<Network aria-hidden size={22} strokeWidth={1.6} />}
            title="No entities yet"
            description="Seed the demo dataset from the overview page to populate infrastructure, evidence and incident nodes."
            action={
              <Link href="/" className="link-quiet text-[12.5px] text-accent">
                Go to overview →
              </Link>
            }
          />
        </Panel>
      ) : null}

      {health.reachable && totalNodes > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_360px]">
          <Panel as="aside" className="h-fit overflow-hidden">
            <PanelHeader eyebrow="Labels" title="Entity types" />
            <nav className="max-h-[70vh] overflow-y-auto p-1.5">
              <ul className="flex flex-col gap-0.5">
                {knownLabels.map((entry) => {
                  const active = entry.label === effectiveLabel
                  return (
                    <li key={entry.label}>
                      <Link
                        href={`/graph?label=${entry.label}`}
                        aria-current={active ? 'true' : undefined}
                        className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-[6px] text-[12.5px] transition-colors ${
                          active ? 'bg-hover font-medium text-ink' : 'text-ink-dim hover:bg-hover/55 hover:text-ink'
                        }`}
                      >
                        <span className="truncate">{entry.label}</span>
                        <span className="mono text-[11px] text-ink-faint">{entry.count}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </Panel>

          <Panel className="min-w-0 overflow-hidden">
            <PanelHeader
              eyebrow="Entities"
              title={effectiveLabel}
              description={`${pluralize(nodes.length, 'node')} shown, ordered by ${displayProperty(effectiveLabel)}`}
            />
            <div className="max-h-[70vh] overflow-auto">
              <table className="data-table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th scope="col">{humanizePropertyKey(displayProperty(effectiveLabel))}</th>
                    <th scope="col">External id</th>
                    <th scope="col" className="text-right">
                      Vertex id
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => {
                    const active = node.id === selected?.id
                    return (
                      <tr key={node.id} className={active ? 'bg-hover/45' : undefined}>
                        <td className="max-w-[280px]">
                          <Link
                            href={`/graph?label=${effectiveLabel}&node=${node.id}`}
                            className="link-quiet block truncate font-medium"
                            aria-current={active ? 'true' : undefined}
                          >
                            {displayName(node.properties, effectiveLabel)}
                          </Link>
                        </td>
                        <td className="mono max-w-[240px] truncate text-[11px] text-ink-faint">
                          {String(node.properties.external_id ?? '—')}
                        </td>
                        <td className="mono text-right text-[11px] text-ink-faint">{node.id}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {nodes.length === 0 ? (
                <EmptyState title={`No ${effectiveLabel} entities`} description="This label has no nodes in the current scope." />
              ) : null}
            </div>
          </Panel>

          <div className="min-w-0 lg:col-span-2 xl:col-span-1">
            <Panel as="aside" className="h-fit overflow-hidden">
              <PanelHeader
                eyebrow="Inspector"
                title={selected ? displayName(selected.properties, effectiveLabel) : 'Nothing selected'}
                description={selected ? undefined : 'Select an entity to inspect its properties and relationships.'}
                actions={
                  selected ? (
                    <Badge tone="neutral" mono>
                      {selected.id}
                    </Badge>
                  ) : null
                }
              />
              {selected ? (
                <div className="max-h-[70vh] overflow-y-auto">
                  <div className="border-b border-line p-4">
                    <div className="eyebrow mb-2">Properties</div>
                    <dl>
                      {Object.entries(selected.properties)
                        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
                        .map(([key, value]) => (
                          <KeyValue key={key} label={humanizePropertyKey(key)}>
                            {key.endsWith('_at') && typeof value === 'string' ? (
                              formatUtc(value)
                            ) : (
                              <span className={typeof value === 'number' ? 'mono' : undefined}>{String(value)}</span>
                            )}
                          </KeyValue>
                        ))}
                    </dl>
                  </div>

                  <div className="p-4">
                    <div className="eyebrow mb-2">Relationships</div>
                    {edges.length === 0 ? (
                      <p className="text-[12px] text-ink-faint">No typed relationships for this entity.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <EdgeGroup title="Outgoing" edges={outgoing} direction="out" label={effectiveLabel} />
                        <EdgeGroup title="Incoming" edges={incoming} direction="in" label={effectiveLabel} />
                      </div>
                    )}

                  {selected && effectiveLabel === 'Service' && (currentDeps || historicalDeps) ? (
                    <div className="mt-4 border-t border-line pt-4">
                      <div className="eyebrow mb-2">Temporal dependencies</div>
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.085em] text-ink-faint">
                            In force now · {currentDeps?.dependencies.length ?? 0}
                          </div>
                          <ul className="flex flex-col gap-1">
                            {(currentDeps?.dependencies ?? []).map((edge, index) => (
                              <li key={`cur-${edge.neighborId}-${index}`} className="rounded-md border border-line bg-canvas/40 px-2.5 py-1.5">
                                <Link
                                  href={`/graph?label=${edge.neighborLabel}&node=${edge.neighborId}`}
                                  className="link-quiet block truncate text-[12px] font-medium"
                                >
                                  {edge.display ?? `#${edge.neighborId}`}
                                </Link>
                                <span className="text-[10.5px] text-ink-faint">{edge.neighborLabel}</span>
                              </li>
                            ))}
                          </ul>
                          {(currentDeps?.dependencies.length ?? 0) === 0 ? (
                            <p className="text-[11px] text-ink-faint">None.</p>
                          ) : null}
                        </div>
                        <div>
                          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.085em] text-ink-faint">
                            Retired · {historicalDeps?.dependencies.length ?? 0}
                          </div>
                          <ul className="flex flex-col gap-1">
                            {(historicalDeps?.dependencies ?? []).map((edge, index) => (
                              <li key={`hist-${edge.neighborId}-${index}`} className="rounded-md border border-line bg-canvas/40 px-2.5 py-1.5 opacity-70">
                                <Link
                                  href={`/graph?label=${edge.neighborLabel}&node=${edge.neighborId}`}
                                  className="link-quiet block truncate text-[12px] font-medium"
                                >
                                  {edge.display ?? `#${edge.neighborId}`}
                                </Link>
                                <span className="text-[10.5px] text-ink-faint">
                                  {edge.neighborLabel} · ended {String(edge.edge.valid_to)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {(historicalDeps?.dependencies.length ?? 0) === 0 ? (
                            <p className="text-[11px] text-ink-faint">None.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  </div>
                </div>
              ) : (
                <EmptyState title="No entity selected" description="Pick a row in the entity table to inspect it." />
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EdgeGroup({
  title,
  edges,
  direction,
  label,
}: {
  title: string
  edges: NeighborEdge[]
  direction: 'in' | 'out'
  label: GraphLabel
}) {
  if (edges.length === 0) return null

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.085em] text-ink-faint uppercase">
        {direction === 'out' ? <ArrowRight aria-hidden size={11} /> : <ArrowLeft aria-hidden size={11} />}
        {title} · {edges.length}
      </div>
      <ul className="flex flex-col gap-1">
        {edges.map((edge, index) => {
          const confidence = edge.edge.confidence_score
          return (
            <li
              key={`${edge.relationship}-${edge.neighborId}-${index}`}
              className="rounded-md border border-line bg-canvas/40 px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow truncate text-[10px] text-cyan">{edge.relationship}</span>
                <VerificationBadge state={edge.edge.verification_state} />
              </div>
              <Link
                href={`/graph?label=${edge.neighborLabel}&node=${edge.neighborId}`}
                className="link-quiet mt-1 block truncate text-[12.5px] font-medium"
              >
                {edge.display ?? `#${edge.neighborId}`}
              </Link>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-ink-faint">{edge.neighborLabel}</span>
                {typeof confidence === 'number' ? (
                  <span className="mono text-[10.5px] text-ink-faint">confidence {confidence.toFixed(2)}</span>
                ) : null}
              </div>
              {edge.edge.valid_from ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="mono text-[10px] text-ink-faint">
                    {String(edge.edge.valid_from)} → {String(edge.edge.valid_to) === OPEN_ENDED ? 'open' : String(edge.edge.valid_to)}
                  </span>
                  <Badge
                    tone={
                      isCurrent(edge.edge.valid_from, edge.edge.valid_to, defaultAsOf()) ? 'success' : 'neutral'
                    }
                  >
                    {isCurrent(edge.edge.valid_from, edge.edge.valid_to, defaultAsOf()) ? 'current' : 'historical'}
                  </Badge>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <span className="sr-only">Edges shown for {label}</span>
    </div>
  )
}
