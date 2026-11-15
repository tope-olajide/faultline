'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, CircleDot } from 'lucide-react'
import { Badge } from '@/components/ui/primitives'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/incidents': 'Incidents',
  '/services': 'Services',
  '/deployments': 'Deployments',
  '/patterns': 'Failure Patterns',
  '/graph': 'Graph Explorer',
  '/evidence': 'Evidence',
  '/learning': 'Learning Engine',
  '/evaluation': 'Evaluation Lab',
  '/diagnostics': 'HydraDB Diagnostics',
}

export function TopBar({ project, environment }: { project: string; environment: string }) {
  const pathname = usePathname()
  const pageTitle = pathname.startsWith('/incidents/')
    ? 'Incident workspace'
    : pathname.startsWith('/services/')
      ? 'Service detail'
      : (PAGE_TITLES[pathname] ?? 'Overview')

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-canvas/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="mr-1 flex items-center gap-2 lg:hidden">
          <span className="grid size-6 place-items-center rounded border border-line-strong/80 bg-raised">
            <svg viewBox="0 0 20 20" aria-hidden className="size-3.5">
              <path
                d="M1.5 12.5 L5 12.5 L7 6 L9.5 15 L12 9 L13.5 12.5 L18.5 12.5"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </Link>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
          <span className="truncate text-ink-faint">{project}</span>
          <ChevronRight aria-hidden size={12} className="shrink-0 text-ink-faint/70" />
          <span className="truncate font-medium text-ink">{pageTitle}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-dim sm:inline-flex">
          <CircleDot aria-hidden size={11} className="text-success" strokeWidth={2.5} />
          <span className="capitalize">{environment}</span>
        </span>
        <Badge tone="violet" className="hidden md:inline-flex">
          Demo dataset
        </Badge>
        <span className="mono hidden text-[11px] text-ink-faint xl:inline">12 incidents · 6 held out</span>
      </div>
    </header>
  )
}
