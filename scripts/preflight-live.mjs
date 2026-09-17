import { liveSalesPreflight } from '../src/runtime/sales-frontend.mjs'

const result = liveSalesPreflight(process.env)
const icon = value => value ? 'yes' : 'no'

console.log('Live sales-avatar preflight')
console.log(`  realtime provider: ${result.configuration.provider || '(unset)'}`)
console.log(`  OpenAI credential: ${icon(result.configuration.hasOpenAIKey)}`)
console.log(`  LiveAvatar credential: ${icon(result.configuration.hasLiveAvatarKey)}`)
console.log(`  explicit avatar id: ${icon(result.configuration.hasAvatarId)} (optional)`)
console.log(`  sales reasoner: ${result.configuration.reasonerMode}`)
console.log(`  assistant profile: ${result.configuration.assistantProfilePath || '(generic Qwen profile)'}`)

for (const warning of result.warnings) console.warn(`warning: ${warning}`)
if (!result.ok) {
  for (const error of result.errors) console.error(`error: ${error}`)
  process.exitCode = 2
} else {
  console.log('preflight: ready for an explicitly paid live smoke test')
}
