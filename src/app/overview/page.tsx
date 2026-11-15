import Link from 'next/link'
import { ArrowUpRight, Database, ShieldCheck, TrendingUp } from 'lucide-react'
import { Badge, KeyValue, Panel, PanelHeader, PanelBody } from '@/components/ui/primitives'
import { getGraphHealth } from '@/server/health'
import { countNodes } from '@/server/graph/repository'
import { simulatedConnectors } from '@/server/integrations/simulator'
import { formatDuration, formatUtc } from '@/lib/format'
import { getNeighborhood } from '@/server/graph/repository'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const health = await getGraphHealth()
  const stats = health.stats

  // Count nodes by label from the graph
  const labelCounts: Record<string, number> = {}
  const labels = [
    'Service', 'Evidence', 'Incident', 'Hypothesis', 'Finding',
    'LearningUpdate', 'PathTemplate', 'EntityMatchCandidate'
  ]
  for (const label of labels) {
    try {
      const count = await countNodes(label as any)
      labelCounts[label] = count
    } catch {
      labelCounts[label] = 0
    }
  }

  // Count feedback and learning update nodes
  const feedbackCount = await countNodes('Feedback')
  const learningUpdateCount = await countNodes('LearningUpdate')

  // Connector info
  const connectors = simulatedConnectors()

  // Neighborhood sample from a central service
  const neighborhood = await getNeighborhood(1, 'Service')

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Faultline Overview</div>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-faint">
            Real-time view of the graph, evidence integrity, connector freshness, and engineer feedback ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={health.reachable ? 'success' : 'danger'}>
            {health.reachable ? 'graph-node ready' : 'graph-node unreachable'}
          </Badge>
          <Link href="/diagnostics" className="link-quiet text-[11px] text-accent">
            Diagnostics <ArrowUpRight aria-hidden size={12} className="inline" />
          </Link>
        </div>
      </header>

      <PanelHeader title="Engine readiness" eyebrow="System" />
      <PanelBody className="pt-1">
        <dl>
          <KeyValue label="Query API (/healthz)">
            <Badge tone={health.healthzOk ? 'success' : 'danger'}>
              {health.healthzOk ? 'ok' : 'unavailable'}
            </Badge>
          </KeyValue>
          <KeyValue label="Admin (/readyz)">
            <Badge tone={health.ready ? 'success' : 'danger'}>
              {health.ready ? '200' : 'not ready'}
            </Badge>
          </KeyValue>
          <KeyValue label="Entities">
            <span className="mono text-[11px]">{stats?.totalNodes ?? 0}</span>
          </KeyValue>
          <KeyValue label="Relationships">
            <span className="mono text-[11px]">{stats?.totalRelationships ?? 0}</span>
          </KeyValue>
          <KeyValue label="Demo data present">
            <Badge tone={health.hasDemoData ? 'success' : 'warning'}>
              {health.hasDemoData ? 'yes' : 'no'}
            </Badge>
          </KeyValue>
        </dl>
      </PanelBody>

      <PanelHeader title="Node distribution" eyebrow="Data" />
      <PanelBody className="pt-1">
        <dl className="flex flex-col gap-1">
          {labels.map((label) => (
            <KeyValue key={label} label={label}>
              <span className="mono text-[10.5px] text-ink-dim">
                {labelCounts[label] ?? 0}
              </span>
            </KeyValue>
          ))}
        </dl>
      </PanelBody>

      <PanelHeader title="Integrity & volume" eyebrow="Evidence" />
      <PanelBody className="pt-1">
        <dl>
          <KeyValue label="Evidence nodes">
            <span className="mono text-[11px]">
              {labelCounts.Evidence ?? 0}
            </span>
          </KeyValue>
          <KeyValue label="Verified payloads">
            <span className="mono text-[11px] text-ink-dim">
              {labelCounts.Evidence && labelCounts.Evidence > 0 ? 'see evidence page' : 'n/a'}
            </span>
          </KeyValue>
          <KeyValue label="LearningUpdates">
            <span className="mono text-[11px]">
              {learningUpdateCount}
            </span>
          </KeyValue>
          <KeyValue label="Feedback entries">
            <span className="mono text-[11px]">
              {feedbackCount}
            </span>
          </KeyValue>
        </dl>
      </PanelBody>

      <PanelHeader title="Source freshness" eyebrow="Connectors" />
      <PanelBody className="pt-1">
        <dl>
          {connectors.map((connector) => {
            const status = connector.status ?? 'healthy'
            const synced = connector.lastSyncedAt ?? ''
            return (
              <KeyValue key={connector.externalId} label={`${connector.provider} · ${connector.resource}`}>
                <div className="flex items-center gap-2">
                  <Badge tone={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'neutral'}>
                    {status}
                  </Badge>
                  <span className="mono text-[10px] text-ink-dim">
                    synced {formatUtc(synced)} ago
                  </span>
                </div>
              </KeyValue>
            )
          })}
        </dl>
      </PanelBody>

      <PanelHeader title="Path templates & evaluation" eyebrow="Causal" />
      <PanelBody className="pt-1">
        <dl>
          <KeyValue label="PathTemplates">
            <span className="mono text-[11px]">
              {labelCounts.PathTemplate ?? 0}
            </span>
          </KeyValue>
          <KeyValue label="EvaluationRuns">
            <span className="mono text-[11px] text-ink-dim">
              {labelCounts.EntityMatchCandidate ?? 0} candidates recorded
            </span>
          </KeyValue>
          <KeyValue label="EntityMatchCandidates">
            <span className="mono text-[11px] text-ink-dim">
              {labelCounts.EntityMatchCandidate ?? 0}
            </span>
          </KeyValue>
        </dl>
      </PanelBody>

      <PanelHeader title="Service dependencies" eyebrow="Neighborhood" />
      <PanelBody className="pt-1">
        <dl>
          {neighborhood.map((ne) => (
            <KeyValue
              key={ne.neighborId}
              label={ne.direction === 'outgoing' ? 'outgoing' : 'incoming'}
            >
              <span className="mono text-[10px] text-ink-faint">
                edge type
              </span>
            </KeyValue>
          ))}
        </dl>
      </PanelBody>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Panel>
          <PanelBody>
            <Link href="/evidence" className="block text-center text-sm text-accent hover:underline">
              View Evidence <TrendingUp aria-hidden size={14} className="inline-block mt-1" />
            </Link>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <Link href="/graph" className="block text-center text-sm text-accent hover:underline">
              Graph Explorer <Database aria-hidden size={14} className="inline-block mt-1" />
            </Link>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <Link href="/api/ask" className="block text-center text-sm text-accent hover:underline">
              Causal Reasoning <ArrowUpRight aria-hidden size={14} className="inline-block mt-1" />
            </Link>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <Link href="/diagnostics" className="block text-center text-sm text-accent hover:underline">
              Full Diagnostics <ShieldCheck aria-hidden size={14} className="inline-block mt-1" />
            </Link>
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}