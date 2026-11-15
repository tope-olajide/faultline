'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, FileJson, LayoutDashboard, Network } from 'lucide-react'
import { cn } from '@/lib/cn'

const GROUPS = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/graph', label: 'Graph Explorer', icon: Network },
      { href: '/evidence', label: 'Evidence', icon: FileJson },
    ],
  },
  {
    label: 'System',
    items: [{ href: '/diagnostics', label: 'HydraDB Diagnostics', icon: Activity }],
  },
] as const

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="eyebrow px-3 pb-1.5">{group.label}</div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md py-[7px] pr-3 pl-3 text-[13px] transition-colors',
                      active ? 'bg-hover font-medium text-ink' : 'text-ink-dim hover:bg-hover/55 hover:text-ink',
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-accent"
                      />
                    ) : null}
                    <Icon
                      aria-hidden
                      size={15}
                      strokeWidth={1.75}
                      className={cn('shrink-0', active ? 'text-accent' : 'text-ink-faint group-hover:text-ink-dim')}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
