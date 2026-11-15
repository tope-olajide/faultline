import Link from 'next/link'
import { ArrowUpRight, Layers, Route } from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  Meter,
  Panel,
  PanelBody,
  PanelHeader,
  Stat,
} from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import { listIncidents, listPathTemplates } from '@/server/graph/reads'
import { formatUtc, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface FamilySummary {
  family: string
  incidents: Awaited<ReturnType<typeof listIncidents>>
  verifiedCauses: string[]
  latestStartedAt: string
  splits: string[]
}

function summarizeFamilies(incidents: Awaited<ReturnType<typeof listIncidents>>): FamilySummary[] {
  const groups = new Map<string, FamilySummary>()
  for (const incident of incidents) {
    const family = incident.family || 'uncategorized'
    const existing = groups.get(family) ?? {
      family,
      incidents: [],
      verifiedCauses: [],
      latestStartedAt: '',
      splits: [],
    }
    existing.incidents.push(incident)
    if (incident.groundTruthCause && !existing.verifiedCauses.includes(incident.groundTruthCause)) {
      existing.verifiedCauses.push(incident.groundTruthCause)
    }
    if (incident.benchmarkSplit && !existing.splits.includes(incident.benchmarkSplit)) {
      existing.splits.push(incident.benchmarkSplit)
    }
    if (!existing.latestStartedAt || incident.startedAt > existing.latestStartedAt) {
      existing.latestStartedAt = incident.startedAt
    }
    groups.set(family, existing)
  }
  return [...groups.values()].sort((a, b) => b.incidents.length - a.incidents.length)
}

function parseSignature(signature: string): { context: string; cause: string; path: string; evidence: string } {
  const [context = '', rest = ''] = signature.split('|')
  const [causeAndPath = '', evidence = ''] = rest.split(':')
  const colon = causeAndPath.indexOf(':')
  const cause = colon >= 0 ? causeAndPath.slice(0, colon) : causeAndPath
  const path = colon >= 0 ? causeAndPath.slice(colon + 1) : ''
  return { context, cause, path, evidence }
}

export default async function FailurePatternsPage() {
  const health = await getGraphHealth()
  const incidents = health.hasDemoData ? await listIncidents(200) : []
  const templates = health.hasDemoData ? await listPathTemplates(100) : []

  const families = summarizeFamilies(incidents)
  const verified = families.reduce((total, family) => total + family.verifiedCauses.length, 0)
  const heldOut = incidents.filter((incident) => incident.benchmarkSplit === 'heldout').length
  const learned = templates.filter((template) => template.successCount + template.failureCount > 0)

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Intelligence</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">
            Failure patterns
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Recurring failure families observed in the incident graph, and the causal path signatures the
            learning engine has actually rewarded or penalised.
          </p>
        </div>
        <Link href="/learning" className="link-quiet text-[12.5px] text-accent">
          Learning ledger <ArrowUpRight aria-hidden size={12} className="inline" />
        </Link>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Patterns are derived from persisted incident and path-template nodes."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Failure families" value={families.length} hint="Distinct families in the graph" />
        <Stat label="Incidents" value={incidents.length} hint={`${heldOut} held out for evaluation`} />
        <Stat label="Verified causes" value={verified} hint="Unique benchmark labels per family" />
        <Stat label="Learned paths" value={learned.length} hint="Signatures with verified feedback" />
      </section>

      {families.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Layers aria-hidden size={22} strokeWidth={1.6} />}
            title="No failure patterns yet"
            description="Seed the benchmark dataset to populate incident families."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Pattern library"
              title="Recurring failure families"
              description="Grouped from incident metadata. Verified cause values are benchmark labels, not engineer confirmations."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-line bg-canvas/40 text-[10px] tracking-[0.08em] text-ink-faint uppercase">
                    <th className="px-4 py-2 font-medium">Family</th>
                    <th className="px-4 py-2 font-medium">Incidents</th>
                    <th className="px-4 py-2 font-medium">Split</th>
                    <th className="px-4 py-2 font-medium">Verified cause</th>
                    <th className="px-4 py-2 font-medium">Latest occurrence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {families.map((family) => (
                    <tr key={family.family} className="align-top transition-colors hover:bg-hover/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Route aria-hidden size={12} className="text-ink-faint" />
                          <span className="text-[12.5px] font-medium text-ink">{family.family}</span>
                        </div>
                        <div className="mono mt-1 text-[10px] text-ink-faint">
                          {pluralize(family.incidents.length, 'incident')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {family.incidents.slice(0, 3).map((incident) => (
                            <Link
                              key={incident.id}
                              href={`/incidents/${incident.id}`}
                              className="text-[11px] text-ink-dim hover:text-accent"
                            >
                              {incident.externalId}
                            </Link>
                          ))}
                          {family.incidents.length > 3 ? (
                            <span className="text-[10px] text-ink-faint">
                              +{family.incidents.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {family.splits.length === 0 ? (
                            <Badge tone="neutral">live</Badge>
                          ) : (
                            family.splits.map((split) => (
                              <Badge key={split} tone={split === 'heldout' ? 'cyan' : 'neutral'}>
                                {split}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {family.verifiedCauses.length === 0 ? (
                            <span className="text-[11px] text-ink-faint">none recorded</span>
                          ) : (
                            family.verifiedCauses.map((cause) => (
                              <span key={cause} className="mono text-[10.5px] text-ink-dim">
                                {cause}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="mono px-4 py-3 text-[10.5px] text-ink-faint">
                        {formatUtc(family.latestStartedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="h-fit">
            <PanelHeader
              eyebrow="Learned utility"
              title="Causal path signatures"
              description="A signature is reusable only within its failure context. Utility is a Beta estimate with a 0.5 prior."
            />
            <PanelBody className="pt-2">
              {learned.length === 0 ? (
                <p className="text-[12px] text-ink-faint">
                  No path has been rewarded or penalised yet. Run the evaluation lab or confirm a hypothesis
                  to create learned paths.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {learned.slice(0, 9).map((template) => {
                    const parsed = parseSignature(template.signature)
                    const total = template.successCount + template.failureCount
                    return (
                      <li key={template.id} className="rounded-md border border-line bg-canvas/40 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Badge tone={parsed.context === 'change' ? 'warning' : 'neutral'}>
                              {parsed.context || 'context'}
                            </Badge>
                            <span className="truncate text-[11.5px] font-medium text-ink">
                              {parsed.cause}
                            </span>
                          </div>
                          <span className="mono text-[11px] text-ink">{template.pathScore.toFixed(2)}</span>
                        </div>
                        <div className="mono mt-1 truncate text-[10px] text-ink-faint">
                          {parsed.path || 'direct'} · {parsed.evidence || 'no evidence class'}
                        </div>
                        <div className="mt-2">
                          <Meter value={template.pathScore} max={1} tone={template.pathScore >= 0.6 ? 'success' : 'accent'} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
                          <span>
                            {template.successCount} success · {template.failureCount} failure
                          </span>
                          <span>{total === 0 ? 'untrained' : `n=${total}`}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}
    </div>
  )
}
