/**
 * Qwen LLM client — OpenAI-compatible endpoint.
 *
 * Three parameters to change when switching models/regions:
 *   1. DASHSCOPE_API_KEY (environment variable)
 *   2. DASHSCOPE_BASE_URL (region-specific, e.g. ap-southeast-1.maas.qwencloudapi.com/compatible-mode/v1)
 *   3. DEFAULT_MODEL (e.g. qwen3.8-omni-flash, qwen3.8-max)
 *
 * The OpenAI client is lazily instantiated so that Turbopack / typecheck
 * does not try to resolve the API key at build time.
 */

function getApiKey(): string {
  return process.env.DASHSCOPE_API_KEY ?? ''
}

function getBaseUrl(): string {
  return process.env.DASHSCOPE_BASE_URL ?? 'ap-southeast-1.maas.qwencloudapi.com/compatible-mode/v1'
}

function getDefaultModel(): string {
  return 'qwen3.8-omni-flash'
}

let client: any = null

export function getQwenClient() {
  if (!client) {
    const OpenAI = require('openai')
    client = new OpenAI({
      apiKey: getApiKey(),
      baseURL: `https://${getBaseUrl()}`,
    })
  }
  return client
}

/**
 * Chat completion with the Qwen model.
 */
export async function chatCompletion(
  messages: { role: string; content: string }[],
  model: string = getDefaultModel(),
  temperature: number = 0.2,
  maxTokens: number = 512,
) {
  const qwen = getQwenClient()
  const response = await qwen.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })
  return response
}

/** Prompt builder for causal reasoning */
export function buildCausalPrompt(
  nodeLabel: string,
  nodeId: number,
  neighbourSummary: string,
  question: string,
): string {
  return 'You are a reliability engineer investigating an incident in a distributed system.\n\n' +
    'Graph node: label="' + nodeLabel + '", id=' + nodeId + '.\n\n' +
    'Neighbourhood summary: ' + neighbourSummary + '\n\n' +
    'User question: "' + question + '"\n\n' +
    'Please answer:\n' +
    '1. A concise root-cause analysis (1-2 sentences).\n' +
    '2. A confidence rating on a scale of 0.0-1.0.\n' +
    '3. At most 2 new graph edges (type + target node label) that would help future investigations.\n' +
    '4. If the evidence is insufficient, state "insufficient data" and propose what additional data would help.\n\n' +
    'Respond in valid JSON with exactly these keys: "analysis", "confidence", "suggested_edges", "data_gap".'
}

/**
 * Causal reasoning over a graph node.
 * Takes a node label/id, its neighbourhood summary, and a user question,
 * returns the LLM's structured causal analysis.
 */
export async function reasonCausally(
  nodeLabel: string,
  nodeId: number,
  neighbourSummary: string,
  question: string,
) {
  const prompt = buildCausalPrompt(nodeLabel, nodeId, neighbourSummary, question)

  const completion = await chatCompletion([
    { role: 'system', content: 'Respond in JSON with exactly the keys: analysis, confidence, suggested_edges, data_gap.' },
    { role: 'user', content: prompt },
  ])

  const raw = completion.choices?.[0]?.message?.content ?? ''
  // Strip any surrounding markdown fences if present
  const clean = raw.replace(/^```json/, '').replace(/```$/, '').trim()

  try {
    return JSON.parse(clean) as {
      analysis: string
      confidence: number
      suggested_edges: Array<{
        type: string
        target_label: string
        target_id?: number
      }>
      data_gap: string
    }
  } catch {
    // Fallback: return a minimal structured response
    return {
      analysis: raw.substring(0, 200),
      confidence: 0.0,
      suggested_edges: [],
      data_gap: 'Failed to parse LLM JSON response',
    }
  }
}