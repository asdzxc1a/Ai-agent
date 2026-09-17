export const SALES_SPAWN_THINKING_DESCRIPTION = [
  'Use this backend whenever the user asks for or reveals information that changes a sales decision or deal state.',
  'Delegate product or plan recommendations, feature/integration/security claims, pricing or discount questions, competitor comparisons, qualification, objections, ROI, case studies, implementation fit, purchase timing, and concrete next-step/deal actions.',
  'Also delegate when the buyer states high-confidence deal facts such as team size, required integrations, budget/timeline constraints, current solution, or objections so the server-owned sales state is updated.',
  'Do not delegate greetings, casual acknowledgements, simple requests to repeat or clarify what was just said, or natural delivery of a backend result that has already arrived.',
  'The backend owns commercial truth and deal state. Never invent pricing, discounts, product capabilities, customer facts, or competitor claims in the realtime frontend.',
].join(' ')

export function liveSalesPreflight(env = process.env) {
  const errors = []
  const warnings = []
  const provider = String(env.QWEN_AUDIO_REALTIME_PROVIDER || '').trim().toLowerCase()
  if (!['gpt-live', 'openai', 'gptlive', 'gpt-realtime'].includes(provider)) {
    errors.push('QWEN_AUDIO_REALTIME_PROVIDER must be gpt-live for the first live test')
  }
  if (!String(env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY || '').trim()) {
    errors.push('OPENAI_API_KEY (or GPT_LIVE_API_KEY) is required')
  }
  if (!String(env.LIVEAVATAR_API_KEY || '').trim()) {
    errors.push('LIVEAVATAR_API_KEY is required')
  }
  if (!String(env.QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH || '').trim()) {
    warnings.push('QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH is not set; Qwen will use its generic assistant persona')
  }

  const reasonerMode = String(env.SALES_REASONER_MODE || 'mock').trim().toLowerCase()
  if (reasonerMode === 'openai-compatible') {
    for (const key of ['SALES_REASONER_BASE_URL', 'SALES_REASONER_API_KEY', 'SALES_REASONER_MODEL']) {
      if (!String(env[key] || '').trim()) errors.push(`${key} is required for SALES_REASONER_MODE=openai-compatible`)
    }
  } else if (reasonerMode !== 'mock') {
    errors.push(`Unsupported SALES_REASONER_MODE: ${reasonerMode}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    configuration: {
      provider: provider || null,
      reasonerMode,
      hasOpenAIKey: Boolean(String(env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY || '').trim()),
      hasLiveAvatarKey: Boolean(String(env.LIVEAVATAR_API_KEY || '').trim()),
      hasAvatarId: Boolean(String(env.LIVEAVATAR_AVATAR_ID || '').trim()),
      assistantProfilePath: String(env.QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH || '').trim() || null,
    },
  }
}
