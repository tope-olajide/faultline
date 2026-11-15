/**
 * Qwen LLM client types — OpenAI-compatible protocol.
 * The Qwen API (QwenCloud/DashScope) accepts the same request shape as the OpenAI SDK:
 *   base_url, api_key (as env var DASHSCOPE_API_KEY), and model name.
 *
 * Slice 3: causal reasoning over the Faultline incident graph.
 */

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LlmChatCompletion = {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: LlmChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export type LlmChoice = {
  index: number
  message: LlmMessage
  finish_reason: 'stop' | 'length' | 'tool_calls'
}

export type LlmChatCompletionCreate = {
  model: string
  messages: LlmMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

/**
 * Causal reasoning prompt template.
 * Given a graph node (Service, Evidence, etc.) and its dependency neighbourhood,
 * the LLM produces a short causal explanation + confidence + suggested follow-up edges.
 */
export function buildCausalPrompt(
  nodeLabel: string,
  nodeId: number,
  neighborSummary: string,
  question: string
): string {
  return `You are a reliability engineer investigating an incident in a distributed system.

Graph node: label="${nodeLabel}", id=${nodeId}.

Neighbourhood summary: ${neighborSummary}

User question: "${question}"

Please answer the following:
1. Give a concise root-cause analysis (1–2 sentences).
2. Rate your confidence in this analysis on a scale of 0.0–1.0.
3. Suggest at most 2 new graph edges (type + target node label) that would help future investigations.
4. If the evidence is insufficient, state "insufficient data" and propose what additional data would help.

Respond in valid JSON with exactly these keys: "analysis", "confidence", "suggested_edges", "data_gap".
`
}