/**
 * Types for the self-hosted HydraDB HTTP query API.
 *
 * Verified against HydraDB v0.4.0 (`ghcr.io/hydra-db/hydradb`). The typed cell
 * encodings below are exactly what the engine returns; see
 * `docs/HYDRADB_INTEGRATION.md` for the probe results this was built from.
 */

/** A scalar or container value as returned inside `rows`. */
export type HydraCell =
  | { type: 'vertex_id'; value: number }
  | { type: 'integer'; value: number }
  | { type: 'float'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'list'; value: HydraCell[] }
  | { type: 'path'; value: HydraPathValue }

/** Path cells use a third encoding: node ids are plain, properties are tagged. */
export interface HydraPathValue {
  nodes: Array<{
    id: number
    labels: string[]
    properties: Record<string, Record<string, unknown>>
  }>
  relationships: Array<{
    id: number | null
    edge_type: string
    src: number
    dst: number
    properties: Record<string, Record<string, unknown>>
  }>
}

export interface HydraSuccessPayload {
  query_id: string
  columns: string[]
  /** Each row is a list of typed cells, positionally matching `columns`. */
  rows: HydraCell[][]
  read_epoch: number | null
  next_cursor: string | number | null
  /** Opaque position for read-your-writes; pass back as `bookmark`. */
  bookmark: string | null
}

export interface HydraErrorPayload {
  error: { code: string; message: string }
}

export interface HydraQueryRequest {
  cell_id: string
  query: string
  parameters?: Record<string, unknown>
  page_size?: number
  cursor?: string | number
  query_id?: string
  bookmark?: string
  consistency?: 'causal' | 'strong'
}

/** A decoded graph path produced by `algo.SPpaths` / `algo.SSpaths`. */
export interface GraphPath {
  nodes: Array<{
    id: number
    labels: string[]
    properties: Record<string, unknown>
  }>
  relationships: Array<{
    type: string
    src: number
    dst: number
    properties: Record<string, unknown>
  }>
}

/** Result of one logical query, after every page has been drained. */
export interface HydraQueryResult<Row = Record<string, unknown>> {
  rows: Row[]
  /** Row count across all pages. */
  rowCount: number
  bookmark: string | null
  readEpoch: number | null
  queryId: string
  pages: number
}
