import Link from 'next/link'
import { ChevronDown, Database, Layers } from 'lucide-react'
import { demoScope } from '@/server/config'
import { graphClient } from '@/server/graph/repository'
import { NavLinks } from './nav-links'

function FaultlineMark() {
  return (
    <span className="relative grid size-7 place-items-center rounded-md border border-line-strong/80 bg-raised">
      <svg viewBox="0 0 20 20" aria-hidden className="size-4">
        <path
          d="M1.5 12.5 L5 12.5 L7 6 L9.5 15 L12 9 L13.5 12.5 L18.5 12.5"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

async function GraphStatus() {
  let connected = false
  let detail = 'unreachable'
  try {
    const diagnostics = await graphClient().diagnostics()
    connected = diagnostics.reachable
    detail = connected ? 'graph-node ready' : diagnostics.error ? 'not ready' : 'unknown'
  } catch {
    connected = false
  }

  return (
    <Link
      href="/diagnostics"
      className="flex items-center gap-2 rounded-md border border-line/80 bg-surface/70 px-2.5 py-2 transition-colors hover:border-line-strong hover:bg-hover/50"
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span
          className={`size-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`}
          style={connected ? { boxShadow: '0 0 0 3px color-mix(in oklab, var(--color-success) 16%, transparent)' } : undefined}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-ink">
          {connected ? 'HydraDB connected' : 'HydraDB unreachable'}
        </span>
        <span className="block truncate text-[10.5px] text-ink-faint">{detail}</span>
      </span>
      <Database aria-hidden size={13} className="shrink-0 text-ink-faint" strokeWidth={1.75} />
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <FaultlineMark />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-ink">Faultline</div>
          <div className="text-[10px] tracking-[0.06em] text-ink-faint uppercase">Incident intelligence</div>
        </div>
      </div>

      <div className="border-b border-line px-3 py-3">
        <div className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left">
          <span className="grid size-6 shrink-0 place-items-center rounded border border-line-strong/70 bg-raised text-[10px] font-semibold text-ink-dim">
            CP
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-ink">{demoScope.project}</span>
            <span className="block truncate text-[10.5px] text-ink-faint">
              {demoScope.tenant} · {demoScope.environment}
            </span>
          </span>
          <span className="mono shrink-0 text-[10px] text-ink-faint">{demoScope.environment}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
        <GraphStatus />
        <div className="flex items-center gap-2 px-2 py-1 text-[10.5px] text-ink-faint">
          <Layers aria-hidden size={12} strokeWidth={1.75} />
          <span>Demo dataset · simulated telemetry</span>
        </div>
      </div>
    </aside>
  )
}
