import type {
  GraphPath,
  HydraCell,
  HydraErrorPayload,
  HydraPathValue,
  HydraQueryRequest,
  HydraQueryResult,
  HydraSuccessPayload,
} from './types'

export interface HydraDbConfig {
  httpUrl: string
  adminUrl: string
  graphId: string
  cellId: string
  token: string
  namespace: string
  /** Per-request timeout. Investigative queries are always bounded. */
  timeoutMs: number
}

export class HydraDbError extends Error {
  readonly code: string
  readonly status: number
  readonly query: string

  constructor(message: string, opts: { code: string; status: number; query: string }) {
    super(message)
    this.name = 'HydraDbError'
    this.code = opts.code
    this.status = opts.status
    this.query = opts.query
  }
}

/** Raised when the engine cannot be reached or answered outside the documented envelopes. */
export class HydraDbUnavailableError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'HydraDbUnavailableError'
    this.cause = cause
  }
}

const MAX_ROWS_DEFAULT = 4096
const RESERVED_COLUMN = '__page'

/** Unwrap a path cell's capitalised property tags: `{ String: 'x' }` -> `'x'`. */
function unwrapPathProperties(properties: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, tagged] of Object.entries(properties ?? {})) {
    if (tagged && typeof tagged === 'object') {
      const value = Object.values(tagged)[0]
      out[key] = value === undefined ? null : value
    } else {
      out[key] = tagged
    }
  }
  return out
}

/** Decode a single typed cell into a plain JavaScript value. */
export function decodeCell(cell: HydraCell | undefined): unknown {
  if (!cell) return null
  switch (cell.type) {
    case 'vertex_id':
    case 'integer':
    case 'float':
    case 'string':
    case 'boolean':
      return cell.value
    case 'null':
      // A null cell has no `value` key at all.
      return null
    case 'list':
      return cell.value.map(decodeCell)
    case 'path':
      return decodePath(cell.value)
    default:
      return null
  }
}

export function decodePath(raw: HydraPathValue): GraphPath {
  return {
    nodes: (raw.nodes ?? []).map((node) => ({
      id: node.id,
      labels: node.labels ?? [],
      properties: unwrapPathProperties(node.properties),
    })),
    relationships: (raw.relationships ?? []).map((rel) => ({
      type: rel.edge_type,
      src: rel.src,
      dst: rel.dst,
      properties: unwrapPathProperties(rel.properties),
    })),
  }
}

function decodeRow(columns: string[], cells: HydraCell[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  columns.forEach((column, index) => {
    row[column] = decodeCell(cells[index])
  })
  return row
}

export interface QueryOptions {
  pageSize?: number
  consistency?: 'causal' | 'strong'
  bookmark?: string
  maxPages?: number
  timeoutMs?: number
}

/**
 * Typed HydraDB client over the HTTP query API.
 *
 * Everything HydraDB-specific — cell decoding, the error envelopes, pagination
 * semantics, bookmark handling — lives here and nowhere else. Application code
 * calls `query` / `mutate` and never builds raw transport requests.
 */
export class HydraDbClient {
  constructor(private readonly config: HydraDbConfig) {}

  get graphId(): string {
    return this.config.graphId
  }

  private get baseUrl(): string {
    return this.config.httpUrl.replace(/\/$/, '')
  }

  private async post(body: HydraQueryRequest, timeoutMs: number): Promise<unknown> {
    const url = `${this.baseUrl}/v1/graphs/${encodeURIComponent(this.config.graphId)}/query`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.token}`,
          'X-Graph-Namespace': this.config.namespace,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'TimeoutError'
          ? `HydraDB query timed out after ${timeoutMs}ms`
          : `HydraDB is unreachable at ${this.baseUrl}`
      throw new HydraDbUnavailableError(message, error)
    }

    const text = await response.text()
    let payload: unknown
    try {
      payload = text.length > 0 ? JSON.parse(text) : null
    } catch {
      throw new HydraDbUnavailableError(
        `HydraDB returned a non-JSON response (HTTP ${response.status})`,
        text.slice(0, 500),
      )
    }

    if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
      const errorPayload = payload as HydraErrorPayload | null
      if (errorPayload?.error) {
        throw new HydraDbError(errorPayload.error.message, {
          code: errorPayload.error.code,
          status: response.status,
          query: body.query,
        })
      }
      // A 422 body carries neither `rows` nor `error`; it usually means a
      // missing `cell_id`. Guard explicitly instead of reading it as empty.
      throw new HydraDbError(`HydraDB rejected the request (HTTP ${response.status})`, {
        code: 'invalid_request',
        status: response.status,
        query: body.query,
      })
    }

    if (!payload || typeof payload !== 'object' || !('rows' in payload)) {
      throw new HydraDbUnavailableError('HydraDB response did not contain rows', payload)
    }

    return payload
  }

  /**
   * Run a read query and drain every page.
   *
   * `next_cursor` is a consuming iterator, not an offset: each page is fetched
   * exactly once and page fetches are never retried (a retry silently skips a
   * page). `page_size` is resent on every page because the server does not
   * remember it between requests.
   */
  async query<Row = Record<string, unknown>>(
    cypher: string,
    parameters: Record<string, unknown> = {},
    options: QueryOptions = {},
  ): Promise<HydraQueryResult<Row>> {
    const pageSize = options.pageSize ?? 512
    const maxPages = options.maxPages ?? 16
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs
    const rows: Row[] = []

    let cursor: string | number | null = null
    let queryId: string | undefined
    let bookmark: string | null = options.bookmark ?? null
    let readEpoch: number | null = null
    let pages = 0

    for (let page = 0; page < maxPages; page += 1) {
      const body: HydraQueryRequest = {
        cell_id: this.config.cellId,
        query: cypher,
        parameters,
        page_size: pageSize,
      }
      if (cursor !== null) {
        body.cursor = cursor
        body.query_id = queryId
      }
      if (bookmark) body.bookmark = bookmark
      if (options.consistency) body.consistency = options.consistency

      const payload = (await this.post(body, timeoutMs)) as HydraSuccessPayload
      pages += 1
      queryId = payload.query_id
      bookmark = payload.bookmark ?? bookmark
      readEpoch = payload.read_epoch ?? readEpoch

      for (const cells of payload.rows ?? []) {
        rows.push(decodeRow(payload.columns ?? [], cells) as Row)
      }

      if (rows.length > MAX_ROWS_DEFAULT * maxPages) {
        throw new HydraDbError('Query exceeded the application row budget', {
          code: 'budget_exceeded',
          status: 200,
          query: cypher,
        })
      }

      cursor = payload.next_cursor ?? null
      if (cursor === null) break
    }

    return {
      rows,
      rowCount: rows.length,
      bookmark,
      readEpoch,
      queryId: queryId ?? 'unknown',
      pages,
    }
  }

  /**
   * Run a mutation. HydraDB auto-commits every request and has no
   * multi-statement transactions, so callers must write idempotently; this
   * method deliberately does not retry.
   */
  async mutate(
    cypher: string,
    parameters: Record<string, unknown> = {},
    options: Pick<QueryOptions, 'timeoutMs'> = {},
  ): Promise<{ bookmark: string | null; readEpoch: number | null; queryId: string }> {
    const payload = (await this.post(
      {
        cell_id: this.config.cellId,
        query: cypher,
        parameters,
      },
      options.timeoutMs ?? this.config.timeoutMs,
    )) as HydraSuccessPayload

    return {
      bookmark: payload.bookmark ?? null,
      readEpoch: payload.read_epoch ?? null,
      queryId: payload.query_id,
    }
  }

  /** Readiness lives on the admin port; `/healthz` lives on the query port. */
  async diagnostics(): Promise<{
    reachable: boolean
    ready: boolean
    healthzOk: boolean
    error?: string
  }> {
    const adminBase = this.config.adminUrl.replace(/\/$/, '')
    let ready = false
    let healthzOk = false
    let error: string | undefined

    try {
      const response = await fetch(`${adminBase}/readyz`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      })
      // 200 with an empty body is the healthy response: check the status code.
      ready = response.status === 200
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }

    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      })
      healthzOk = response.ok
    } catch (cause) {
      error = error ?? (cause instanceof Error ? cause.message : String(cause))
    }

    return { reachable: ready && healthzOk, ready, healthzOk, error }
  }
}
