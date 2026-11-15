const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-11-14T15:21:00Z` → `14 Nov 15:21 UTC`. */
export function formatUtc(iso?: string | null, options: { withYear?: boolean } = {}): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = MONTHS[date.getUTCMonth()]
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
  return options.withYear ? `${day} ${month} ${date.getUTCFullYear()} · ${time} UTC` : `${day} ${month} ${time} UTC`
}

/** Duration between two ISO timestamps, rendered compactly: `26h 06m`. */
export function formatDuration(fromIso?: string | null, toIso?: string | null): string {
  if (!fromIso) return '—'
  const from = new Date(fromIso).getTime()
  const to = toIso ? new Date(toIso).getTime() : Date.now()
  if (Number.isNaN(from) || Number.isNaN(to)) return '—'

  const minutes = Math.max(0, Math.round((to - from) / 60000))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${String(hours % 24).padStart(2, '0')}h`
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${minutes}m`
}

export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value
  const half = Math.floor((max - 1) / 2)
  return `${value.slice(0, half)}…${value.slice(-half)}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function humanizePropertyKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
