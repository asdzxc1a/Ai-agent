import { liveSalesPreflight } from '../src/runtime/sales-frontend.mjs'

const result = liveSalesPreflight(process.env)
const icon = value => value ? 'yes' : 'no'

console.log('Live sales-avatar preflight')
console.log(`  realtime provider: ${result.configuration.provider || '(unset)'}`)
console.log(`  OpenAI credential: ${icon(result.configuration.hasOpenAIKey)}`)
console.log(`  LiveAvatar credential: ${icon(result.configuration.hasLiveAvatarKey)}`)
console.log(`  explicit avatar id: ${icon(result.configuration.hasAvatarId)} (optional)`)
console.log(`  Qwen identity mode: ${result.configuration.identityMode}`)
console.log(`  persistent identity secret: ${icon(result.configuration.hasPersistentIdentitySecret)} (optional for local single-process test)`)
console.log(`  sales reasoner: ${result.configuration.reasonerMode}`)
console.log(`  assistant profile: ${result.configuration.assistantProfilePath || '(generic Qwen profile)'}`)
console.log(`  configured product truth: ${icon(result.configuration.hasConfiguredProducts)}`)
console.log(`  approved case studies: ${icon(result.configuration.hasApprovedCaseStudies)}`)
console.log(`  ROI assumption set: ${result.configuration.roiAssumptionSet}`)

for (const warning of result.warnings) console.warn(`warning: ${warning}`)
if (!result.ok) {
  for (const error of result.errors) console.error(`error: ${error}`)
  process.exitCode = 2
} else {
  console.log('preflight: transport is ready for an explicitly paid live smoke test')
}
