import type { HydraDbConfig } from './hydradb/client'

/**
 * Server-side configuration.
 *
 * The defaults point at the local development stack from `docker-compose.yml`.
 * A deployed instance must set `HYDRADB_TOKEN` and use TLS URLs; the token below
 * is HydraDB's documented local-development token, not a secret.
 */
export const hydraDbConfig: HydraDbConfig = {
  httpUrl: process.env.HYDRADB_HTTP_URL ?? 'http://127.0.0.1:8443',
  adminUrl: process.env.HYDRADB_ADMIN_URL ?? 'http://127.0.0.1:9090',
  graphId: process.env.HYDRADB_GRAPH_ID ?? 'default',
  cellId: process.env.HYDRADB_CELL_ID ?? 'cell-0',
  token: process.env.HYDRADB_TOKEN ?? 'local-development-token-32-bytes',
  namespace: process.env.HYDRADB_NAMESPACE ?? 'default',
  timeoutMs: Number(process.env.HYDRADB_TIMEOUT_MS ?? 8000),
}

/** The single demo workspace scope. Slice 1 has no auth; RBAC arrives in Slice 8. */
export const demoScope = {
  tenant: process.env.FAULTLINE_TENANT ?? 'demo',
  project: process.env.FAULTLINE_PROJECT ?? 'checkout-platform',
  environment: process.env.FAULTLINE_ENVIRONMENT ?? 'production',
} as const

export type DemoScope = typeof demoScope

/** Stable scope key used in entity id derivation and in every scope property. */
export function scopeKey(scope: DemoScope = demoScope): string {
  return `${scope.tenant}/${scope.project}/${scope.environment}`
}
