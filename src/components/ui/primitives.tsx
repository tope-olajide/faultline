import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

/* ----------------------------------------------------------------- button -- */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55'

const BUTTON_VARIANT = {
  primary: 'bg-accent text-canvas hover:bg-accent/88',
  secondary: 'border border-line-strong/80 bg-surface text-ink hover:border-line-strong hover:bg-hover/70',
  ghost: 'text-ink-dim hover:bg-hover/60 hover:text-ink',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/16',
} as const

const BUTTON_SIZE = {
  sm: 'h-[30px] px-2.5 text-[12px]',
  md: 'h-[34px] px-3',
  lg: 'h-[40px] px-4',
} as const

type ButtonVariant = keyof typeof BUTTON_VARIANT
type ButtonSize = keyof typeof BUTTON_SIZE

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  children,
  href,
  variant = 'secondary',
  size = 'md',
  className,
}: {
  children: ReactNode
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  return (
    <Link href={href} className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}>
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ panel -- */

export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'aside'
}) {
  return <Tag className={cn('panel', className)}>{children}</Tag>
}

export function PanelHeader({
  title,
  eyebrow,
  actions,
  description,
  className,
}: {
  title: ReactNode
  eyebrow?: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('panel-header', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <div className="flex items-baseline gap-2 truncate text-[15px] font-semibold text-ink">{title}</div>
        {description ? <p className="mt-1 text-[12.5px] leading-snug text-ink-faint">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

/* ------------------------------------------------------------------ badges -- */

type Tone = 'neutral' | 'accent' | 'cyan' | 'success' | 'warning' | 'danger' | 'violet'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-line-strong/70 bg-hover/60 text-ink-dim',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  cyan: 'border-cyan/30 bg-cyan/10 text-cyan',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  violet: 'border-violet/30 bg-violet/10 text-violet',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  mono,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  mono?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        TONE_CLASSES[tone],
        mono && 'font-mono text-[10.5px] tracking-tight',
        className,
      )}
    >
      {children}
    </span>
  )
}

const SEVERITY_TONE: Record<string, Tone> = {
  critical: 'danger',
  high: 'warning',
  medium: 'accent',
  low: 'neutral',
  informational: 'neutral',
}

export function SeverityBadge({ severity }: { severity?: string | null }) {
  const value = (severity ?? 'unknown').toLowerCase()
  const tone = SEVERITY_TONE[value] ?? 'neutral'
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] capitalize text-ink-dim">
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          tone === 'danger' && 'bg-danger',
          tone === 'warning' && 'bg-warning',
          tone === 'accent' && 'bg-accent',
          tone === 'neutral' && 'bg-ink-faint',
        )}
      />
      {severity ?? 'Unknown'}
    </span>
  )
}

const VERIFICATION_TONE: Record<string, Tone> = {
  verified: 'success',
  provisional: 'warning',
  rejected: 'danger',
  stale: 'neutral',
  'inferred-topology': 'warning',
}

export function VerificationBadge({ state }: { state?: unknown }) {
  if (typeof state !== 'string' || state.length === 0) return <span className="text-ink-faint">—</span>
  return <Badge tone={VERIFICATION_TONE[state] ?? 'neutral'}>{state}</Badge>
}

/* -------------------------------------------------------------------- stat -- */

export function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  accent?: boolean
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-mono text-[21px] font-semibold leading-none tracking-tight',
            accent ? 'text-accent' : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[11.5px] text-ink-faint">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 truncate text-[11.5px] text-ink-faint">{hint}</div> : null}
    </div>
  )
}

/* --------------------------------------------------------------- feedback -- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <div>
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-faint">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function InlineError({
  title,
  message,
  detail,
  action,
}: {
  title: string
  message: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[10px] border border-danger/35 bg-danger/8 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{message}</p>
          {detail ? (
            <pre className="mono mt-2 max-h-40 overflow-auto rounded-md border border-line bg-canvas/70 p-2.5 text-[11px] leading-relaxed text-ink-faint whitespace-pre-wrap">
              {detail}
            </pre>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- misc -- */

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-b-0">
      <dt className="shrink-0 text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[12.5px] text-ink-dim">{children}</dd>
    </div>
  )
}

export function Meter({ value, max, tone = 'accent' }: { value: number; max: number; tone?: Tone }) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  const barClass =
    tone === 'cyan'
      ? 'bg-cyan'
      : tone === 'violet'
        ? 'bg-violet'
        : tone === 'success'
          ? 'bg-success'
          : 'bg-accent'
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-hover" role="presentation">
      <div className={cn('h-full rounded-full transition-[width] duration-300', barClass)} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
