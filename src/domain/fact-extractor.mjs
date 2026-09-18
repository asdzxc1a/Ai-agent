const REQUIREMENT_PATTERNS = Object.freeze([
  ['salesforce', /\bsalesforce\b/i],
  ['sso', /\b(?:sso|single[ -]sign[ -]on)\b/i],
  ['advanced analytics', /\badvanced analytics\b/i],
  ['hubspot', /\bhubspot\b/i],
  ['crm integration', /\bcrm (?:integration|sync|connector)\b/i],
])

const TEAM_SIZE_PATTERNS = Object.freeze([
  /\b(?:team|company|sales team)\s+(?:of\s+)?(\d{1,5})\b/i,
  /\b(?:we(?:'re| are| have)|there are)\s+(\d{1,5})\s+(?:sales\s+)?(?:people|employees|reps|representatives|users|seats|agents)\b/i,
  /\b(\d{1,5})\s+(?:sales\s+)?(?:people|employees|reps|representatives|users|seats|agents)\b/i,
])

/**
 * Extract only high-confidence facts that can be recognized deterministically
 * from the buyer's own turn. More nuanced facts remain reasoner proposals.
 */
export function extractDeterministicSalesFacts(turn) {
  const text = String(turn ?? '').trim()
  const patch = {}

  for (const pattern of TEAM_SIZE_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    const teamSize = Number(match[1])
    if (Number.isSafeInteger(teamSize) && teamSize > 0) patch.teamSize = teamSize
    break
  }

  const requirements = REQUIREMENT_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
  if (requirements.length) patch.requirements = requirements

  return patch
}
