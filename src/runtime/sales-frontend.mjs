export const SALES_SPAWN_THINKING_DESCRIPTION = [
  'Use this backend whenever the user asks for or reveals information that changes a sales decision or deal state.',
  'Delegate product or plan recommendations, feature/integration/security claims, pricing or discount questions, competitor comparisons, qualification, objections, ROI, case studies, implementation fit, purchase timing, and concrete next-step/deal actions.',
  'Also delegate when the buyer states high-confidence deal facts such as team size, required integrations, budget/timeline constraints, current solution, or objections so the server-owned sales state is updated.',
  'Do not delegate greetings, casual acknowledgements, simple requests to repeat or clarify what was just said, or natural delivery of a backend result that has already arrived.',
  'The backend owns commercial truth and deal state. Never invent pricing, discounts, product capabilities, customer facts, case-study claims, ROI numbers, or competitor claims in the realtime frontend.',
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

  const identityConfigured = String(env.QWEN_AUDIO_AGENT_IDENTITY_MODE || '').trim().toLowerCase()
  const identityMode = identityConfigured === 'personal' ? 'personal' : 'browser'
  const hasPersistentIdentitySecret = Boolean(String(env.QWEN_AUDIO_AGENT_AUTH_SECRET || '').trim())
  if (identityMode === 'personal') {
    warnings.push('QWEN_AUDIO_AGENT_IDENTITY_MODE=personal shares one Qwen voice owner; use browser mode for concurrent website buyers')
  } else if (!hasPersistentIdentitySecret) {
    warnings.push('QWEN_AUDIO_AGENT_AUTH_SECRET is unset; the launcher will generate a process-local signing secret (fine for local/single-process tests, not multi-instance production)')
  }

  const hasConfiguredProducts = Boolean(String(env.SALES_PRODUCTS_JSON || env.SALES_PRODUCTS_PATH || '').trim())
  const hasApprovedCaseStudies = Boolean(String(env.SALES_CASE_STUDIES_JSON || env.SALES_CASE_STUDIES_PATH || '').trim())
  const roiAssumptionSet = String(env.SALES_ROI_ASSUMPTION_SET || 'illustrative-default-v1').trim()
  if (!hasConfiguredProducts) {
    warnings.push('No SALES_PRODUCTS_JSON/PATH configured; runtime will use the demo product catalog. Do not treat its pricing/features as production truth.')
  }
  if (!hasApprovedCaseStudies) {
    warnings.push('No approved case-study source configured; case-study requests will return no customer proof instead of fabricating it.')
  }
  if (roiAssumptionSet === 'illustrative-default-v1') {
    warnings.push('ROI uses illustrative-default-v1 assumptions; replace them with company-approved assumptions before a real sales pilot.')
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
      identityMode,
      hasPersistentIdentitySecret,
      hasConfiguredProducts,
      hasApprovedCaseStudies,
      roiAssumptionSet,
      hasOpenAIKey: Boolean(String(env.OPENAI_API_KEY || env.GPT_LIVE_API_KEY || '').trim()),
      hasLiveAvatarKey: Boolean(String(env.LIVEAVATAR_API_KEY || '').trim()),
      hasAvatarId: Boolean(String(env.LIVEAVATAR_AVATAR_ID || '').trim()),
      assistantProfilePath: String(env.QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH || '').trim() || null,
    },
  }
}
