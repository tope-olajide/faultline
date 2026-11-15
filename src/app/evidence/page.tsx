import Link from 'next/link'
import { ArrowUpRight, Database, FileJson, ShieldCheck } from 'lucide-react'
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
import { listNodes, getNode } from '@/server/graph/repository'
import { getEvidencePayload } from '@/server/evidence/object-store'
import { simulatedConnectors } from '@/server/integrations/simulator'
import { formatDuration, formatUtc, pluralize, truncateMiddle } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function EvidencePage() {
  const health = await getGraphHealth()
  const stats = health.stats
  const hasData = health.hasDemoData

  const evidenceNodes = hasData ? await listNodes('Evidence', { limit: 200 }) : []
  const connectorNodes = hasData ? await listNodes('ConnectorSource', { limit: 200 }) : []

  // Load each payload and verify its hash against the graph record.
  const evidenceDetails = await Promise.all(
    evidenceNodes.map(async (node) => {
      const full = await getNode(node.id, 'Evidence')
      const uri = String(node.properties.object_uri ?? '')
      const hash = String(node.properties.content_hash ?? '')
      const loaded = uri ? await getEvidencePayload(uri, hash) : null
      return { node, full, loaded }
    }),
  )

  const connectors = connectorNodes.length
    ? connectorNodes
    : simulatedConnectors().map((connector) => ({
        id: 0,
        properties: {
          external_id: connector.externalId,
          provider: connector.provider,
          resource: connector.resource,
          last_synced_at: connector.lastSyncedAt,
          status: connector.status,
          permission_scope: connector.permissionScope,
        },
      }))

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Evidence &amp; sources</div>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">Evidence</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-faint">
            Evidence payloads live in object storage and are referenced from HydraDB by URI and content hash. Every
            record below is read back from the graph and verified against its stored bytes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={health.reachable ? 'success' : 'danger'}>
            {health.reachable ? 'graph-node ready' : 'graph-node unreachable'}
          </Badge>
          <Link href="/diagnostics" className="link-quiet text-[12.5px] text-accent">
            Diagnostics <ArrowUpRight aria-hidden size={12} className="inline" />
          </Link>
        </div>
      </header>

      {!health.reachable ? (
        <InlineError
          title="HydraDB is not reachable"
          message="Evidence records are stored in the graph; there is nothing to inspect without it."
          detail={`${health.error ?? ''}\n\nnpm run db:up`}
        />
      ) : null}

      {health.reachable && !hasData ? (
        <Panel>
          <EmptyState
            icon={<Database aria-hidden size={22} strokeWidth={1.6} />}
            title="No evidence yet"
            description="Seed the demo dataset to populate evidence records, connector sources and the object store."
          />
        </Panel>
      ) : null}

      {hasData ? (
        <>
          <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <Panel className="xl:col-span-7">
              <PanelHeader
                eyebrow="Connector freshness"
                title="Connected sources"
                description="Last sync time and permission scope for each simulated connector."
              />
              <PanelBody className="pt-2">
                <dl>
                  {connectors.map((connector) => {
                    const p = connector.properties as Record<string, unknown>
                    const status = String(p.status ?? 'healthy')
                    const synced = String(p.last_synced_at ?? '')
                    return (
                      <KeyValue
                        key={String(p.external_id ?? connector.id)}
                        label={`${String(p.provider ?? 'source')} · ${String(p.resource ?? '')}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'neutral'}>
                            {status}
                          </Badge>
                          <span className="mono text-[11px] text-ink-dim">
                            synced {formatUtc(synced)} · {formatDuration(synced, null)} ago
                          </span>
                        </div>
                      </KeyValue>
                    )
                  })}
                </dl>
              </PanelBody>
            </Panel>

            <Panel className="xl:col-span-5">
              <PanelHeader
                eyebrow="Object store"
                title="Integrity"
                description="Payloads are hashed with SHA-256 over canonical JSON after redaction."
              />
              <PanelBody className="pt-1">
                <dl>
                  <KeyValue label="Evidence items">
                    <span className="mono">{evidenceNodes.length}</span>
                  </KeyValue>
                  <KeyValue label="Verified">
                    <span className="mono">
                      {evidenceDetails.filter((item) => item.loaded?.verified).length} / {evidenceDetails.length}
                    </span>
                  </KeyValue>
                  <KeyValue label="Redacted payloads">
                    <span className="mono">
                      {evidenceDetails.filter((item) => String(item.node.properties.redaction_status) === 'redacted').length}
                    </span>
                  </KeyValue>
                  <KeyValue label="Store root">
                    <span className="mono text-[11px]">.hydradb/evidence</span>
                  </KeyValue>
                </dl>
              </PanelBody>
            </Panel>
          </section>

          <Panel>
            <PanelHeader
              eyebrow="Evidence records"
              title="Source-linked evidence"
              description="Each row is a graph node pointing at an object-store payload."
              actions={<Badge tone="violet">Simulated</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Source</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Observed</th>
                    <th scope="col">Integrity</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceDetails.map(({ node, loaded }) => {
                    const p = node.properties as Record<string, unknown>
                    return (
                      <tr key={node.id}>
                        <td className="whitespace-nowrap text-[12px] text-ink-dim">{String(p.evidence_type ?? '')}</td>
                        <td className="whitespace-nowrap text-[12px] text-ink-dim">
                          {String(p.source ?? '')}
                          <span className="ml-1 mono text-[10.5px] text-ink-faint">
                            {truncateMiddle(String(p.source_record_id ?? ''), 28)}
                          </span>
                        </td>
                        <td className="min-w-[260px] max-w-[420px] text-[12px] text-ink">
                          {String(p.summary ?? '')}
                        </td>
                        <td className="whitespace-nowrap text-[12px] text-ink-dim">{formatUtc(String(p.observed_at ?? ''))}</td>
                        <td>
                          {loaded ? (
                            <div className="flex items-center gap-2">
                              <VerificationBadge state={loaded.verified ? 'verified' : 'provisional'} />
                              <span className="mono text-[10.5px] text-ink-faint">
                                {truncateMiddle(loaded.contentHash, 22)}
                              </span>
                            </div>
                          ) : (
                            <Badge tone="danger">missing</Badge>
                          )}
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
              eyebrow="Payload preview"
              title="Stored bytes"
              description="First evidence record, pretty-printed from object storage."
            />
            <PanelBody>
              {evidenceDetails[0]?.loaded ? (
                <pre className="mono max-h-[420px] overflow-auto rounded-md border border-line bg-canvas/60 p-3 text-[11px] leading-relaxed text-ink-dim">
                  {JSON.stringify(evidenceDetails[0].loaded.payload, null, 2)}
                </pre>
              ) : (
                <p className="text-[12.5px] text-ink-faint">No payload available.</p>
              )}
            </PanelBody>
          </Panel>
        </>
      ) : null}
    </div>
  )
}
