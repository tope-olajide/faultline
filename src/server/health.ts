import { demoScope, hydraDbConfig, scopeKey } from './config'
import { graphClient, graphStats, probeGraph, type GraphStats } from './graph/repository'

export interface HealthReport {
  reachable: boolean
  ready: boolean
  healthzOk: boolean
  error?: string
  graphReadable: boolean
  projects: number
  hasDemoData: boolean
  stats: GraphStats | null
  engine: {
    image: string
    graphId: string
    cellId: string
    namespace: string
    httpUrl: string
    adminUrl: string
    scope: string
    tenant: string
    project: string
    environment: string
  }
  checkedAt: string
}

const ENGINE_IMAGE = 'ghcr.io/hydra-db/hydradb:latest (v0.4.0)'

/**
 * Live diagnostics for the graph engine.
 *
 * `/readyz` lives on the admin port and answers 200 with an empty body; `/healthz`
 * lives on the query port. They are not interchangeable, so both are reported.
 */
export async function getGraphHealth(): Promise<HealthReport> {
  const diagnostics = await graphClient().diagnostics()
  const probe = diagnostics.reachable
    ? await probeGraph()
    : { ok: false, projects: 0, error: diagnostics.error ?? 'engine unreachable' }

  const stats = probe.ok ? await graphStats() : null

  return {
    reachable: diagnostics.reachable,
    ready: diagnostics.ready,
    healthzOk: diagnostics.healthzOk,
    error: diagnostics.error ?? probe.error,
    graphReadable: probe.ok,
    projects: probe.projects,
    hasDemoData: probe.ok && probe.projects > 0,
    stats,
    engine: {
      image: ENGINE_IMAGE,
      graphId: hydraDbConfig.graphId,
      cellId: hydraDbConfig.cellId,
      namespace: hydraDbConfig.namespace,
      httpUrl: hydraDbConfig.httpUrl,
      adminUrl: hydraDbConfig.adminUrl,
      scope: scopeKey(),
      tenant: demoScope.tenant,
      project: demoScope.project,
      environment: demoScope.environment,
    },
    checkedAt: new Date().toISOString(),
  }
}
