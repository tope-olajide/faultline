import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Clock3,
  GitBranch,
  History,
  Layers,
  Network,
  ShieldQuestion,
} from 'lucide-react'
import {
  Badge,
  EmptyState,
  InlineError,
  KeyValue,
  Meter,
  Panel,
  PanelBody,
  PanelHeader,
  SeverityBadge,
  VerificationBadge,
} from '@/components/ui/primitives'
import { FeedbackForm } from '@/components/incidents/feedback-form'
import { getGraphHealth } from '@/server/health'
import { getIncident } from '@/server/graph/reads'
import { investigateIncident, type EvidenceView, type HypothesisView } from '@/server/investigation/engine'
import { formatUtc, humanizePropertyKey, pluralize } from '@/lib/format'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function confidenceTone(confidence: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (confidence >= 0.68) return 'success'
  if (confidence >= 0.45) return 'warning'
  return 'neutral'
}

function EvidenceCard({ evidence, tone }: { evidence: EvidenceView; tone: 'support' | 'contradict' }) {
  return (
    <li className="rounded-md border border-line bg-canvas/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={tone === 'support' ? 'success' : 'danger'}>
            {tone === 'support' ? 'supports' : 'contradicts'}
          </Badge>
          <span className="text-[11.5px] font-medium text-ink">
            {evidence.evidenceType.replace(/_/g, ' ')}
          </span>
          <span className="text-[10.5px] text-ink-faint">· {evidence.source}</span>
        </div>
        <span className="mono text-[10.5px] text-ink-faint">
          reliability {evidence.reliability.toFixed(2)} · {formatUtc(evidence.observedAt)}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">{evidence.summary}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="mono truncate text-[10px] text-ink-faint">{evidence.externalId}</span>
        {evidence.objectUri ? (
          <span className="mono text-[10px] text-ink-faint">object verified</span>
        ) : (
          <span className="text-[10px] text-ink-faint">reference only</span>
        )}
      </div>
    </li>
  )
}

function CausalPath({ hypothesis }: { hypothesis: HypothesisView }) {
  if (hypothesis.path.length === 0) {
    return <p className="text-[12px] text-ink-faint">No graph path was recorded.</p>
  }

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {hypothesis.path.map((step, index) => (
        <li key={`${step.type}-${step.fromId}-${step.toId}-${index}`} className="flex items-center gap-1.5">
          <span className="rounded-md border border-line bg-canvas/50 px-2 py-1 text-[11.5px] text-ink">
            {step.fromName}
          </span>
          <span className="flex flex-col items-center text-ink-faint">
            <ArrowRight aria-hidden size={12} />
            <span className="mono text-[9px] tracking-tight text-cyan">{step.type}</span>
          </span>
          <span className="rounded-md border border-line bg-canvas/50 px-2 py-1 text-[11.5px] text-ink">
            {step.toName}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default async function IncidentWorkspacePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams
  const incidentId = Number(id)
  if (!Number.isSafeInteger(incidentId) || incidentId <= 0) notFound()

  const health = await getGraphHealth()
  const incident = health.hasDemoData ? await getIncident(incidentId) : null
  if (!incident) notFound()

  const result = await investigateIncident(incidentId, { persist: true })

  const requested = Number(first(query.h))
  const selectedIndex =
    Number.isSafeInteger(requested) && requested >= 0 && requested < result.hypotheses.length
      ? requested
      : 0
  const selected = result.hypotheses[selectedIndex] ?? null

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint hover:text-ink"
          >
            <ArrowLeft aria-hidden size={12} /> All incidents
          </Link>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-ink">
            {incident.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="mono text-[11px] text-ink-faint">{incident.externalId}</span>
            <SeverityBadge severity={incident.severity} />
            <Badge tone={incident.status === 'Resolved' ? 'success' : 'warning'}>{incident.status}</Badge>
            <Badge tone="neutral">{incident.family || 'general'}</Badge>
            <span className="text-[11.5px] text-ink-faint">
              started {formatUtc(incident.startedAt)} · owner {incident.ownerTeam || 'unassigned'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Badge tone={health.reachable ? 'success' : 'danger'}>
              {health.reachable ? 'HydraDB live' : 'HydraDB unreachable'}
            </Badge>
            <Badge tone="cyan">{result.mode === 'learned' ? 'adaptive graph' : 'fixed baseline'}</Badge>
          </div>
          <span className="mono text-[10.5px] text-ink-faint">
            {result.stats.candidates} candidates · {result.stats.evidenceConsidered} evidence · {result.durationMs} ms
          </span>
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="The investigation reads the graph directly, so it cannot run without the engine."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      <Panel className="border-line-strong/60">
        <PanelBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <div className="eyebrow">What happened</div>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-dim">{incident.summary}</p>
            {incident.impact ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">Impact: {incident.impact}</p>
            ) : null}
          </div>
          <dl className="min-w-[220px] shrink-0">
            <KeyValue label="Affected services">
              <span className="text-ink">
                {result.affectedServices.map((service) => service.name).join(', ') || '—'}
              </span>
            </KeyValue>
            <KeyValue label="Blast radius">
              <span className="mono">{pluralize(result.blastRadius.length, 'service')}</span>
            </KeyValue>
            <KeyValue label="Leading cause">
              <span className="text-ink">{result.hypotheses[0]?.causeName ?? 'undetermined'}</span>
            </KeyValue>
          </dl>
        </PanelBody>
      </Panel>

      {result.hypotheses.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ShieldQuestion aria-hidden size={22} strokeWidth={1.6} />}
            title="No candidate causes found"
            description="The graph has no dependency or deployment path from the affected services to a causal entity. That is an evidence gap, not a conclusion."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_330px]">
          <Panel as="aside" className="h-fit overflow-hidden">
            <PanelHeader
              eyebrow="Hypotheses"
              title="Ranked explanations"
              description="Ranking uses graph structure, evidence reliability and learned path utility."
            />
            <ol className="divide-y divide-line/70">
              {result.hypotheses.map((hypothesis, index) => {
                const active = index === selectedIndex
                return (
                  <li key={hypothesis.externalId}>
                    <Link
                      href={`/incidents/${incident.id}?h=${index}`}
                      aria-current={active ? 'true' : undefined}
                      className={`block px-3.5 py-3 transition-colors ${
                        active ? 'bg-hover/55' : 'hover:bg-hover/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10.5px] text-ink-faint">#{hypothesis.rank}</span>
                          <Badge tone={confidenceTone(hypothesis.confidence)}>{hypothesis.status}</Badge>
                          <span className="text-[10px] text-ink-faint">{hypothesis.causeLabel}</span>
                        </div>
                        <span className="mono text-[12px] font-semibold text-ink">
                          {hypothesis.confidence.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
                        {hypothesis.causeName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-faint">{hypothesis.serviceName}</p>
                      <div className="mt-2">
                        <Meter value={hypothesis.confidence} max={1} tone={hypothesis.confidence >= 0.68 ? 'success' : 'accent'} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
                        <span>
                          {hypothesis.evidence.length} supporting · {hypothesis.contradicting.length} contradicting
                        </span>
                        {hypothesis.pathTemplateScore > 0 ? (
                          <span className="text-cyan">path {hypothesis.pathTemplateScore.toFixed(2)}</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </Panel>

          <div className="flex min-w-0 flex-col gap-3">
            {selected ? (
              <>
                <Panel>
                  <PanelHeader
                    eyebrow={`Hypothesis ${selected.rank}`}
                    title={selected.causeName}
                    description={selected.statement}
                    actions={<Badge tone={confidenceTone(selected.confidence)}>{selected.confidence.toFixed(2)} confidence</Badge>}
                  />
                  <PanelBody className="flex flex-col gap-4">
                    <p className="text-[12.5px] leading-relaxed text-ink-dim">{selected.rationale}</p>

                    <div>
                      <div className="eyebrow mb-1.5">Causal path</div>
                      <CausalPath hypothesis={selected} />
                    </div>

                    <div className="rounded-md border border-cyan/25 bg-cyan/5 px-3 py-2.5">
                      <div className="eyebrow text-cyan">Next best check</div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{selected.nextCheck}</p>
                    </div>

                    {selected.causeEdge ? (
                      <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                        <div className="rounded-md border border-line bg-canvas/40 px-2.5 py-2">
                          <dt className="eyebrow">Live reliability</dt>
                          <dd className="mono mt-1 text-[13px] text-ink">{selected.causeEdge.confidence.toFixed(2)}</dd>
                        </div>
                        <div className="rounded-md border border-line bg-canvas/40 px-2.5 py-2">
                          <dt className="eyebrow">Baseline</dt>
                          <dd className="mono mt-1 text-[13px] text-ink-dim">{selected.causeEdge.baseline.toFixed(2)}</dd>
                        </div>
                        <div className="rounded-md border border-line bg-canvas/40 px-2.5 py-2">
                          <dt className="eyebrow">Support</dt>
                          <dd className="mono mt-1 text-[13px] text-success">{selected.causeEdge.support}</dd>
                        </div>
                        <div className="rounded-md border border-line bg-canvas/40 px-2.5 py-2">
                          <dt className="eyebrow">Contradictions</dt>
                          <dd className="mono mt-1 text-[13px] text-danger">{selected.causeEdge.contradiction}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader
                    eyebrow="Evidence"
                    title={`${selected.evidence.length + selected.contradicting.length} linked observations`}
                    description="Only evidence connected to this incident and attributed to the candidate entity is used."
                  />
                  <PanelBody>
                    {selected.evidence.length === 0 && selected.contradicting.length === 0 ? (
                      <p className="text-[12.5px] text-ink-faint">
                        No evidence is attributed to this entity. The hypothesis is structural only.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {selected.evidence.map((evidence) => (
                          <EvidenceCard key={evidence.id} evidence={evidence} tone="support" />
                        ))}
                        {selected.contradicting.map((evidence) => (
                          <EvidenceCard key={evidence.id} evidence={evidence} tone="contradict" />
                        ))}
                      </ul>
                    )}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader
                    eyebrow="Uncertainty"
                    title="What is still unknown"
                    description="The investigator abstains rather than inventing certainty."
                  />
                  <PanelBody className="flex flex-col gap-2">
                    {result.unknowns.length === 0 ? (
                      <p className="flex items-center gap-2 text-[12.5px] text-success">
                        <CheckCircle2 aria-hidden size={14} /> No structural evidence gaps were detected for the
                        leading explanation.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {result.unknowns.map((unknown) => (
                          <li key={unknown} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-dim">
                            <AlertTriangle aria-hidden size={13} className="mt-0.5 shrink-0 text-warning" />
                            {unknown}
                          </li>
                        ))}
                      </ul>
                    )}
                  </PanelBody>
                </Panel>
              </>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Panel className="border-accent/25">
              <PanelHeader
                eyebrow="Teach the graph"
                title="Engineer feedback"
                description="Feedback persists to HydraDB and changes how the next investigation ranks this path."
              />
              <PanelBody>
                {selected ? (
                  <FeedbackForm
                    incidentExternalId={incident.externalId}
                    hypothesisExternalId={selected.externalId}
                    pathSignature={selected.pathSignature}
                    edge={
                      selected.causeEdge
                        ? {
                            src: selected.causeEdge.src,
                            dst: selected.causeEdge.dst,
                            type: selected.causeEdge.type,
                          }
                        : null
                    }
                    actorRef={incident.ownerTeam || 'engineer/on-call'}
                  />
                ) : null}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                eyebrow="Prior knowledge"
                title="Similar incidents"
                description="Matched on shared AFFECTS services, failure family and signal class. Only incidents that started earlier are compared."
              />
              <PanelBody className="pt-2">
                {result.similarIncidents.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">
                    No earlier incident in the graph shares a service with this one.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {result.similarIncidents.map((match) => (
                      <li key={match.id} className="rounded-md border border-line bg-canvas/40 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/incidents/${match.id}`}
                            className="line-clamp-2 text-[12px] font-medium leading-snug text-ink hover:text-accent"
                          >
                            {match.title}
                          </Link>
                          <span className="mono shrink-0 text-[11px] text-ink">
                            {Math.round(match.similarity * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
                          <span className="mono">{match.externalId}</span>
                          <span>·</span>
                          <span className="truncate">{match.sharedServices.join(', ')}</span>
                        </div>
                        {match.verifiedCause ? (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-dim">
                            <History aria-hidden size={11} className="mt-0.5 shrink-0 text-ink-faint" />
                            <span>
                              benchmark cause <span className="mono text-ink">{match.verifiedCause}</span>
                            </span>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[10.5px] text-ink-faint">No verified cause recorded.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Impact" title="Blast radius" />
              <PanelBody className="pt-2">
                <ul className="flex flex-col gap-1.5">
                  {result.blastRadius.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-dim">
                        <Network aria-hidden size={12} className="shrink-0 text-ink-faint" />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <Badge tone={entry.depth === 0 ? 'warning' : 'neutral'}>
                        {entry.depth === 0 ? 'affected' : `${entry.depth} hop`}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {result.blastRadius.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">No dependent services are recorded.</p>
                ) : null}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Chronology" title="Timeline" />
              <PanelBody className="pt-2">
                <ol className="relative flex flex-col gap-2 border-l border-line pl-3">
                  {result.timeline.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="relative">
                      <span
                        aria-hidden
                        className={`absolute top-1 -left-[17px] size-1.5 rounded-full ${
                          entry.kind === 'incident' ? 'bg-warning' : entry.kind === 'evidence' ? 'bg-cyan' : 'bg-ink-faint'
                        }`}
                      />
                      <div className="mono text-[10px] text-ink-faint">{formatUtc(entry.at)}</div>
                      <div className="text-[11.5px] leading-snug text-ink-dim">{entry.label}</div>
                    </li>
                  ))}
                </ol>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Provenance" title="Investigation record" />
              <PanelBody className="pt-1">
                <dl>
                  <KeyValue label="Engine">
                    <span className="mono text-[11px]">{result.engineVersion}</span>
                  </KeyValue>
                  <KeyValue label="Reasoning">
                    <span className="mono text-[11px]">{result.promptVersion}</span>
                  </KeyValue>
                  <KeyValue label="Generated">
                    <span className="mono text-[11px]">{formatUtc(result.generatedAt)}</span>
                  </KeyValue>
                  <KeyValue label="Candidate causes">
                    <span className="mono text-[11px]">{result.stats.candidates}</span>
                  </KeyValue>
                  <KeyValue label="Evidence considered">
                    <span className="mono text-[11px]">{result.stats.evidenceConsidered}</span>
                  </KeyValue>
                  <KeyValue label="Dependency edges">
                    <span className="mono text-[11px]">{result.stats.edgesTraversed}</span>
                  </KeyValue>
                </dl>
                <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-faint">
                  <CircleSlash aria-hidden size={11} className="mt-0.5 shrink-0" />
                  {result.limitation}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-faint">
                  <GitBranch aria-hidden size={11} className="mt-0.5 shrink-0" />
                  Path signature <span className="mono">{selected?.pathSignature}</span>
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-faint">
                  <Layers aria-hidden size={11} className="mt-0.5 shrink-0" />
                  Investigation nodes and evidence links are persisted in HydraDB on every run.
                </p>
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
