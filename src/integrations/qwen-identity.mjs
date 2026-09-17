function clean(value) {
  return String(value || '').trim()
}

export function cookiePairFromSetCookie(value) {
  const raw = clean(value)
  if (!raw) return ''
  return raw.split(';', 1)[0]?.trim() || ''
}

/**
 * Ask the local Qwen Gateway to issue/resolve a browser identity before the
 * realtime WebSocket is opened. In `personal` identity mode there is no
 * Set-Cookie header, so this safely returns an empty string.
 */
export async function bootstrapQwenGatewayIdentity({
  gatewayOrigin,
  fetchImpl = fetch,
} = {}) {
  if (!gatewayOrigin) throw new TypeError('gatewayOrigin is required')
  const url = new URL('/api/health', gatewayOrigin)
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Qwen Gateway identity bootstrap failed (${response.status})`)
  }
  const setCookies = typeof response.headers?.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []
  const header = setCookies[0] || response.headers?.get?.('set-cookie') || ''
  return cookiePairFromSetCookie(header)
}

export function mergeGatewaySocketOptions(options = {}, cookie = '') {
  const headers = {
    ...(options.headers || {}),
    ...(cookie ? { Cookie: cookie } : {}),
  }
  return { ...options, headers }
}
