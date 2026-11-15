import { Badge, KeyValue, Panel, PanelBody, PanelHeader } from '@/components/ui/primitives'
import { ProbeRunner } from '@/components/diagnostics/probe-runner'
import { getGraphHealth } from '@/server/health'
import { formatUtc } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function DiagnosticsPage() {
  const health = await getGraphHealth()

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">System</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">HydraDB diagnostics</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            The self-hosted graph engine is Faultline&apos;s system of record. This page reports its live readiness and
            re-checks the engine behaviours the application depends on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={health.reachable ? 'success' : 'danger'}>
            {health.reachable ? 'reachable' : 'unreachable'}
          </Badge>
          <span className="mono text-[11px] text-ink-faint">checked {formatUtc(health.checkedAt)}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Connection" title="Engine surfaces" />
          <PanelBody className="pt-1">
            <dl>
              <KeyValue label="Query API (/healthz)">
                <Badge tone={health.healthzOk ? 'success' : 'danger'}>{health.healthzOk ? 'ok' : 'unavailable'}</Badge>
              </KeyValue>
              <KeyValue label="Admin (/readyz)">
                <Badge tone={health.ready ? 'success' : 'danger'}>{health.ready ? '200' : 'not ready'}</Badge>
              </KeyValue>
              <KeyValue label="HTTP endpoint">
                <span className="mono text-[11px]">{health.engine.httpUrl}</span>
              </KeyValue>
              <KeyValue label="Admin endpoint">
                <span className="mono text-[11px]">{health.engine.adminUrl}</span>
              </KeyValue>
              <KeyValue label="Graph">
                <span className="mono">{health.engine.graphId}</span>
              </KeyValue>
              <KeyValue label="Cell">
                <span className="mono">{health.engine.cellId}</span>
              </KeyValue>
              <KeyValue label="Namespace">
                <span className="mono">{health.engine.namespace}</span>
              </KeyValue>
              <KeyValue label="Image">
                <span className="mono text-[11px]">{health.engine.image}</span>
              </KeyValue>
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Scope and data" title="Workspace binding" />
          <PanelBody className="pt-1">
            <dl>
              <KeyValue label="Scope key">
                <span className="mono text-[11px]">{health.engine.scope}</span>
              </KeyValue>
              <KeyValue label="Tenant">
                <span className="mono">{health.engine.tenant}</span>
              </KeyValue>
              <KeyValue label="Project">
                <span className="mono">{health.engine.project}</span>
              </KeyValue>
              <KeyValue label="Environment">
                <span className="mono">{health.engine.environment}</span>
              </KeyValue>
              <KeyValue label="Entities">
                <span className="mono">{health.stats?.totalNodes ?? 0}</span>
              </KeyValue>
              <KeyValue label="Relationships">
                <span className="mono">{health.stats?.totalRelationships ?? 0}</span>
              </KeyValue>
              <KeyValue label="Read epoch">
                <span className="mono">{health.stats?.readEpoch ?? '—'}</span>
              </KeyValue>
              <KeyValue label="Demo data present">
                <Badge tone={health.hasDemoData ? 'success' : 'warning'}>{health.hasDemoData ? 'yes' : 'no'}</Badge>
              </KeyValue>
            </dl>
            {health.error ? (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/8 px-3 py-2 text-[11.5px] text-danger">
                {health.error}
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Compatibility"
          title="Engine behaviour probes"
          description="HydraDB's write semantics differ from Neo4j in ways that corrupt counts silently rather than failing. These probes assert the behaviours the repository relies on."
        />
        <PanelBody>
          <ProbeRunner />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Reference" title="Write discipline this build relies on" />
        <PanelBody>
          <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-ink-dim">
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-faint">01</span>
              <span>
                Nodes are written <span className="text-ink">before</span> edges: a node that only appears as an edge
                endpoint carries no label, and label-anchored counts would silently under-report.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-faint">02</span>
              <span>
                Retryable edges use <span className="mono text-ink">MERGE</span>; bulk edges use{' '}
                <span className="mono text-ink">UNWIND … CREATE</span>. Plain one-off{' '}
                <span className="mono text-ink">CREATE</span> duplicates parallel relationships on retry.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-faint">03</span>
              <span>
                Every request auto-commits, so every mutation is idempotent and every multi-step update is recorded in a
                reversible ledger.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mono shrink-0 text-ink-faint">04</span>
              <span>
                Ids are derived from scope, label and external id — never auto-generated — so re-ingestion is stable and
                tenants cannot collide.
              </span>
            </li>
          </ul>
        </PanelBody>
      </Panel>
    </div>
  )
}
